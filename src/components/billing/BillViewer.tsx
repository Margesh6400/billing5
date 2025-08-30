import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { BillTemplate, BillData, BillLineItem } from './BillTemplate';
import { generateBillJPG, downloadBillJPG } from '../../utils/billJPGGenerator';
import { 
  Download, 
  FileImage, 
  Eye, 
  Calendar,
  User,
  DollarSign,
  Package,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

type Bill = Database['public']['Tables']['bills']['Row'] & {
  clients: Database['public']['Tables']['clients']['Row'];
};

interface BillViewerProps {
  bill: Bill;
  onBack: () => void;
}

export function BillViewer({ bill, onBack }: BillViewerProps) {
  const [billData, setBillData] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    generateBillData();
  }, [bill]);

  const generateBillData = async () => {
    try {
      // Fetch transaction periods for this bill
      const { data: periods, error: periodsError } = await supabase
        .from('bill_periods')
        .select('*')
        .eq('bill_id', bill.id)
        .order('period_start');

      if (periodsError) throw periodsError;

      // Create line items from periods
      const lineItems: BillLineItem[] = (periods || []).map((period, index) => ({
        id: period.id,
        description: `Rental Period ${index + 1}`,
        from_date: period.period_start,
        to_date: period.period_end,
        udhar_quantity: 0, // Will be calculated from transactions
        jama_quantity: 0,  // Will be calculated from transactions
        plates_on_rent: period.running_stock,
        rate_per_plate: period.daily_rate,
        days: period.days_count,
        amount: period.period_charge,
        type: 'transaction'
      }));

      // Fetch actual transactions to get udhar/jama quantities
      const [challansResult, returnsResult] = await Promise.all([
        supabase
          .from('challans')
          .select(`
            challan_date,
            challan_items (borrowed_quantity)
          `)
          .eq('client_id', bill.client_id)
          .gte('challan_date', bill.billing_period_start)
          .lte('challan_date', bill.billing_period_end),
        supabase
          .from('returns')
          .select(`
            return_date,
            return_line_items (returned_quantity)
          `)
          .eq('client_id', bill.client_id)
          .gte('return_date', bill.billing_period_start)
          .lte('return_date', bill.billing_period_end)
      ]);

      // Update line items with transaction quantities
      lineItems.forEach(item => {
        const periodStart = new Date(item.from_date);
        const periodEnd = new Date(item.to_date);

        // Calculate udhar quantity for this period
        const udharInPeriod = (challansResult.data || [])
          .filter(challan => {
            const challanDate = new Date(challan.challan_date);
            return challanDate >= periodStart && challanDate <= periodEnd;
          })
          .reduce((sum, challan) => {
            return sum + challan.challan_items.reduce((itemSum, item) => itemSum + item.borrowed_quantity, 0);
          }, 0);

        // Calculate jama quantity for this period
        const jamaInPeriod = (returnsResult.data || [])
          .filter(returnRecord => {
            const returnDate = new Date(returnRecord.return_date);
            return returnDate >= periodStart && returnDate <= periodEnd;
          })
          .reduce((sum, returnRecord) => {
            return sum + returnRecord.return_line_items.reduce((itemSum, item) => itemSum + item.returned_quantity, 0);
          }, 0);

        item.udhar_quantity = udharInPeriod;
        item.jama_quantity = jamaInPeriod;
      });

      const billData: BillData = {
        bill_number: bill.bill_number,
        bill_date: bill.generated_at.split('T')[0],
        client: {
          id: bill.clients.id,
          name: bill.clients.name,
          site: bill.clients.site || '',
          mobile: bill.clients.mobile_number || ''
        },
        line_items: lineItems,
        subtotal: bill.period_charges,
        grand_total: bill.total_amount
      };

      setBillData(billData);
    } catch (error) {
      console.error('Error generating bill data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!billData) return;

    setDownloading(true);
    try {
      const jpgDataUrl = await generateBillJPG({
        bill_number: billData.bill_number,
        client: billData.client,
        bill_date: billData.bill_date,
        period_start: bill.billing_period_start,
        period_end: bill.billing_period_end,
        billing_periods: billData.line_items.map(item => ({
          from_date: item.from_date,
          to_date: item.to_date,
          days: item.days,
          running_stock: item.plates_on_rent,
          daily_rate: item.rate_per_plate,
          charge: item.amount
        })),
        total_udhar_quantity: bill.total_udhar_quantity,
        service_charge: bill.service_charge,
        period_charges: bill.period_charges,
        total_amount: bill.total_amount,
        previous_payments: bill.previous_payments,
        net_due: bill.net_due,
        daily_rate: bill.daily_rate,
        service_rate: bill.service_rate
      });

      downloadBillJPG(jpgDataUrl, `bill-${bill.bill_number}-${bill.clients.name.replace(/\s+/g, '-')}`);
    } catch (error) {
      console.error('Error downloading bill:', error);
      alert('Error downloading bill. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading bill data...</p>
        </div>
      </div>
    );
  }

  if (!billData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-red-600">Error loading bill data</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bill {bill.bill_number}</h2>
            <p className="text-sm text-gray-600">
              {bill.clients.name} | Period: {format(new Date(bill.billing_period_start), 'dd/MM/yyyy')} - {format(new Date(bill.billing_period_end), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download JPG
          </button>
        </div>
      </div>

      {/* Bill Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Client</p>
              <p className="text-lg font-bold text-gray-900">{bill.clients.name}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Period</p>
              <p className="text-lg font-bold text-gray-900">
                {differenceInDays(new Date(bill.billing_period_end), new Date(bill.billing_period_start)) + 1} days
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Total Udhar</p>
              <p className="text-lg font-bold text-gray-900">{bill.total_udhar_quantity}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Net Due</p>
              <p className="text-lg font-bold text-gray-900">₹{bill.net_due.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Template */}
      <div id={`bill-${bill.bill_number}`}>
        <BillTemplate data={billData} />
      </div>
    </div>
  );
}