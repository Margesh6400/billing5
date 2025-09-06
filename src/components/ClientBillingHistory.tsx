import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  Download, 
  Eye, 
  Copy,
  ArrowLeft,
  Loader2,
  Package,
  CheckCircle,
  Clock
} from 'lucide-react';
import { BillDetailModal } from './billing/BillDetailModal';
import { generateComprehensiveBillJPG, downloadComprehensiveBillJPG } from '../utils/comprehensiveBillJPGGenerator';
import { ComprehensiveBillData } from '../utils/comprehensiveBillingCalculator';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'];
type BillLineItem = Database['public']['Tables']['bill_line_items']['Row'];

interface BillWithClient extends Bill {
  client: Client;
  bill_line_items: BillLineItem[];
}

interface ClientBillingHistoryProps {
  client: Client;
  onBack: () => void;
}

export function ClientBillingHistory({ client, onBack }: ClientBillingHistoryProps) {
  const [bills, setBills] = useState<BillWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<BillWithClient | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchClientBills();
  }, [client.id]);

  const fetchClientBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          client:clients(*),
          bill_line_items(*)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching client bills:', error);
    } finally {
      setLoading(false);
    }
  };

const handleDownloadBill = async (bill: BillWithClient) => {
  try {
    setDownloading(bill.id);

    const billData: ComprehensiveBillData = {
      client: bill.client,
      bill_number: bill.bill_number,
      bill_date: bill.billing_period_end,
      ledger_entries: [],
      date_ranges: [],
      total_plates_udhar: bill.total_udhar_quantity,
      total_plates_jama: 0,
      total_plates: bill.total_udhar_quantity,
      total_udhar: bill.period_charges,
      service_rate_per_plate: bill.service_rate,
      service_charge_percentage: 10,
      service_charge: bill.service_charge,
      extra_charges: [],
      extra_charges_total: bill.extra_charges_total,
      discounts: [],
      discounts_total: bill.discounts_total,
      payments: [],
      payments_total: bill.payments_total,
      grand_total: bill.total_amount,
      advance_paid: bill.advance_paid,
      final_due: bill.final_due,
      balance_carry_forward: bill.balance_carry_forward,
      account_closure: bill.account_closure as 'close' | 'continue',
      rates: {
        daily_rent_rate: bill.daily_rate,
        service_charge_percentage: 10,
      },
    };

    const jpgDataUrl = await generateComprehensiveBillJPG(billData);
    downloadComprehensiveBillJPG(
      jpgDataUrl,
      `bill-${bill.bill_number}-${bill.client.name.replace(/\s+/g, '-')}`
    );
  } catch (error) {
    console.error('Error downloading bill:', error);
    alert('બિલ ડાઉનલોડ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
  } finally {
    setDownloading(null);
  }
};


  const calculateTotalBilled = () => {
    return bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
  };

  const calculateTotalDue = () => {
    return bills.reduce((sum, bill) => sum + (bill.final_due || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">બિલિંગ ઇતિહાસ લોડ થઈ રહ્યો છે...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-4 space-y-4">
        {/* Header with Back Button */}
        <div className="text-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 mb-3 text-sm font-medium text-blue-600 transition-colors border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <ArrowLeft className="w-4 h-4" />
            પાછા જાઓ
          </button>
          
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલિંગ ઇતિહાસ</h1>
          <p className="text-xs text-blue-600">{client.name} ({client.id})</p>
        </div>

        {/* Client Summary */}
        <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <User className="w-4 h-4" />
              ગ્રાહક સારાંશ
            </h2>
          </div>
          
          <div className="p-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 border border-blue-200 rounded bg-blue-50">
                <div className="text-sm font-bold text-blue-700">{bills.length}</div>
                <div className="text-xs text-blue-600">કુલ બિલ</div>
              </div>
              <div className="p-2 border border-green-200 rounded bg-green-50">
                <div className="text-sm font-bold text-green-700">₹{calculateTotalBilled().toFixed(0)}</div>
                <div className="text-xs text-green-600">કુલ બિલ રકમ</div>
              </div>
              <div className="p-2 border border-red-200 rounded bg-red-50">
                <div className="text-sm font-bold text-red-700">₹{calculateTotalDue().toFixed(0)}</div>
                <div className="text-xs text-red-600">કુલ બાકી</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bills List */}
        <div className="space-y-3">
          {bills.length === 0 ? (
            <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <p className="mb-1 font-medium text-gray-700">આ ગ્રાહક માટે કોઈ બિલ નથી</p>
              <p className="text-xs text-blue-600">પહેલું બિલ બનાવવા માટે બિલિંગ પેજ પર જાઓ</p>
            </div>
          ) : (
            bills.map((bill) => (
              <div key={bill.id} className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                        <FileText className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {bill.bill_number}
                        </h3>
                        <p className="text-xs text-blue-100">
                          {new Date(bill.billing_period_end).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        bill.account_closure === 'close' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {bill.account_closure === 'close' ? 'બંધ' : 'ચાલુ'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        bill.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {bill.payment_status === 'paid' ? 'ચૂકવેલ' : 'બાકી'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 space-y-3">
                  {/* Bill Summary */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 border border-blue-200 rounded bg-blue-50">
                      <div className="text-sm font-bold text-blue-700">{bill.total_udhar_quantity}</div>
                      <div className="text-xs text-blue-600">કુલ પ્લેટ</div>
                    </div>
                    <div className="p-2 border border-green-200 rounded bg-green-50">
                      <div className="text-sm font-bold text-green-700">₹{bill.total_amount.toFixed(0)}</div>
                      <div className="text-xs text-green-600">કુલ રકમ</div>
                    </div>
                    <div className="p-2 border border-red-200 rounded bg-red-50">
                      <div className="text-sm font-bold text-red-700">₹{bill.final_due.toFixed(0)}</div>
                      <div className="text-xs text-red-600">અંતિમ બાકી</div>
                    </div>
                  </div>

                  {/* Billing Period */}
                  <div className="p-2 border border-gray-200 rounded bg-gray-50">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(bill.billing_period_start).toLocaleDateString('en-GB')} થી{' '}
                        {new Date(bill.billing_period_end).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedBill(bill)}
                      className="flex items-center justify-center flex-1 gap-1 py-2 text-xs font-medium text-blue-600 transition-colors border border-blue-200 rounded hover:bg-blue-50"
                    >
                      <Eye className="w-3 h-3" />
                      વિગતો જુઓ
                    </button>
                    
                    <button
                      onClick={() => handleDownloadBill(bill)}
                      disabled={downloading === bill.id}
                      className="flex items-center justify-center flex-1 gap-1 py-2 text-xs font-medium text-green-600 transition-colors border border-green-200 rounded hover:bg-green-50 disabled:opacity-50"
                    >
                      {downloading === bill.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      ડાઉનલોડ
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onDownload={() => handleDownloadBill(selectedBill)}
        />
      )}
    </div>
  );
}