import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { BillTemplate, BillData, BillLineItem } from './BillTemplate';
import { generateBillJPG, downloadBillJPG } from '../../utils/billJPGGenerator';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  FileImage, 
  Calendar,
  DollarSign,
  Package,
  User,
  Loader2
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];

interface TransactionPeriod {
  from_date: string;
  to_date: string;
  udhar_quantity: number;
  jama_quantity: number;
  running_stock: number;
}

interface ManualLineItem {
  description: string;
  amount: number;
}

interface BillGeneratorProps {
  client: Client;
  onBillGenerated: () => void;
  onCancel: () => void;
}

export function BillGenerator({ client, onBillGenerated, onCancel }: BillGeneratorProps) {
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [ratePerPlate, setRatePerPlate] = useState(1.00);
  const [transactionPeriods, setTransactionPeriods] = useState<TransactionPeriod[]>([]);
  const [manualItems, setManualItems] = useState<ManualLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [billPreview, setBillPreview] = useState<BillData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTransactionPeriods();
  }, [client.id]);

  const fetchTransactionPeriods = async () => {
    setCalculating(true);
    try {
      // Fetch all challans (udhar) for this client
      const { data: challans, error: challansError } = await supabase
        .from('challans')
        .select(`
          challan_date,
          challan_items (
            borrowed_quantity
          )
        `)
        .eq('client_id', client.id)
        .order('challan_date');

      if (challansError) throw challansError;

      // Fetch all returns (jama) for this client
      const { data: returns, error: returnsError } = await supabase
        .from('returns')
        .select(`
          return_date,
          return_line_items (
            returned_quantity
          )
        `)
        .eq('client_id', client.id)
        .order('return_date');

      if (returnsError) throw returnsError;

      // Process transactions chronologically
      const allTransactions = [
        ...(challans || []).map(challan => ({
          date: challan.challan_date,
          type: 'udhar' as const,
          quantity: challan.challan_items.reduce((sum, item) => sum + item.borrowed_quantity, 0)
        })),
        ...(returns || []).map(returnRecord => ({
          date: returnRecord.return_date,
          type: 'jama' as const,
          quantity: returnRecord.return_line_items.reduce((sum, item) => sum + item.returned_quantity, 0)
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate periods with running stock
      const periods: TransactionPeriod[] = [];
      let runningStock = 0;
      let lastDate = allTransactions[0]?.date;

      allTransactions.forEach((transaction, index) => {
        const currentDate = transaction.date;
        
        // If there's a gap between transactions and we have stock, create a period
        if (lastDate && lastDate !== currentDate && runningStock > 0) {
          periods.push({
            from_date: lastDate,
            to_date: currentDate,
            udhar_quantity: 0,
            jama_quantity: 0,
            running_stock: runningStock
          });
        }

        // Update running stock
        if (transaction.type === 'udhar') {
          runningStock += transaction.quantity;
        } else {
          runningStock -= transaction.quantity;
        }

        // Create period for this transaction
        const nextTransaction = allTransactions[index + 1];
        const endDate = nextTransaction ? nextTransaction.date : billDate;

        if (runningStock > 0) {
          periods.push({
            from_date: currentDate,
            to_date: endDate,
            udhar_quantity: transaction.type === 'udhar' ? transaction.quantity : 0,
            jama_quantity: transaction.type === 'jama' ? transaction.quantity : 0,
            running_stock: runningStock
          });
        }

        lastDate = currentDate;
      });

      setTransactionPeriods(periods);
    } catch (error) {
      console.error('Error fetching transaction periods:', error);
    } finally {
      setCalculating(false);
    }
  };

  const addManualItem = () => {
    setManualItems([...manualItems, { description: '', amount: 0 }]);
  };

  const updateManualItem = (index: number, field: keyof ManualLineItem, value: string | number) => {
    const updated = [...manualItems];
    updated[index] = { ...updated[index], [field]: value };
    setManualItems(updated);
  };

  const removeManualItem = (index: number) => {
    setManualItems(manualItems.filter((_, i) => i !== index));
  };

  const generateBillPreview = async () => {
    try {
      // Generate next bill number
      const { data: lastBill } = await supabase
        .from('bills')
        .select('bill_number')
        .order('generated_at', { ascending: false })
        .limit(1);

      let nextBillNumber = 'BILL-0001';
      if (lastBill && lastBill.length > 0) {
        const lastNumber = parseInt(lastBill[0].bill_number.split('-')[1]) || 0;
        nextBillNumber = `BILL-${(lastNumber + 1).toString().padStart(4, '0')}`;
      }

      // Create line items from transaction periods
      const transactionLineItems: BillLineItem[] = transactionPeriods.map((period, index) => {
        const days = differenceInDays(new Date(period.to_date), new Date(period.from_date)) + 1;
        const amount = period.running_stock * ratePerPlate * days;

        return {
          id: `transaction-${index}`,
          description: `Rental Period ${index + 1}`,
          from_date: period.from_date,
          to_date: period.to_date,
          udhar_quantity: period.udhar_quantity,
          jama_quantity: period.jama_quantity,
          plates_on_rent: period.running_stock,
          rate_per_plate: ratePerPlate,
          days: days,
          amount: amount,
          type: 'transaction'
        };
      });

      // Create line items from manual entries
      const manualLineItems: BillLineItem[] = manualItems
        .filter(item => item.description.trim() && item.amount !== 0)
        .map((item, index) => ({
          id: `manual-${index}`,
          description: item.description,
          from_date: billDate,
          to_date: billDate,
          udhar_quantity: 0,
          jama_quantity: 0,
          plates_on_rent: 0,
          rate_per_plate: 0,
          days: 1,
          amount: item.amount,
          type: 'manual'
        }));

      const allLineItems = [...transactionLineItems, ...manualLineItems];
      const subtotal = transactionLineItems.reduce((sum, item) => sum + item.amount, 0);
      const manualTotal = manualLineItems.reduce((sum, item) => sum + item.amount, 0);
      const grandTotal = subtotal + manualTotal;

      const billData: BillData = {
        bill_number: nextBillNumber,
        bill_date: billDate,
        client: {
          id: client.id,
          name: client.name,
          site: client.site || '',
          mobile: client.mobile_number || ''
        },
        line_items: allLineItems,
        subtotal: subtotal,
        grand_total: grandTotal
      };

      setBillPreview(billData);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating bill preview:', error);
      alert('Error generating bill preview. Please try again.');
    }
  };

  const saveBill = async () => {
    if (!billPreview) return;

    setLoading(true);
    try {
      // Save bill to database
      const { data: savedBill, error: billError } = await supabase
        .from('bills')
        .insert([{
          bill_number: billPreview.bill_number,
          client_id: client.id,
          billing_period_start: transactionPeriods[0]?.from_date || billDate,
          billing_period_end: transactionPeriods[transactionPeriods.length - 1]?.to_date || billDate,
          total_amount: billPreview.grand_total,
          payment_status: 'pending',
          daily_rate: ratePerPlate,
          service_rate: 0,
          total_udhar_quantity: transactionPeriods.reduce((sum, p) => sum + p.udhar_quantity, 0),
          service_charge: 0,
          period_charges: billPreview.subtotal,
          previous_payments: 0,
          net_due: billPreview.grand_total
        }])
        .select()
        .single();

      if (billError) throw billError;

      // Generate and download JPG
      const jpgDataUrl = await generateBillJPG({
        bill_number: billPreview.bill_number,
        client: billPreview.client,
        bill_date: billPreview.bill_date,
        period_start: transactionPeriods[0]?.from_date || billDate,
        period_end: transactionPeriods[transactionPeriods.length - 1]?.to_date || billDate,
        billing_periods: transactionPeriods.map(period => ({
          from_date: period.from_date,
          to_date: period.to_date,
          days: differenceInDays(new Date(period.to_date), new Date(period.from_date)) + 1,
          running_stock: period.running_stock,
          daily_rate: ratePerPlate,
          charge: period.running_stock * ratePerPlate * (differenceInDays(new Date(period.to_date), new Date(period.from_date)) + 1)
        })),
        total_udhar_quantity: transactionPeriods.reduce((sum, p) => sum + p.udhar_quantity, 0),
        service_charge: 0,
        period_charges: billPreview.subtotal,
        total_amount: billPreview.grand_total,
        previous_payments: 0,
        net_due: billPreview.grand_total,
        daily_rate: ratePerPlate,
        service_rate: 0
      });

      downloadBillJPG(jpgDataUrl, `bill-${billPreview.bill_number}-${client.name.replace(/\s+/g, '-')}`);

      alert(`Bill ${billPreview.bill_number} generated successfully!`);
      onBillGenerated();
    } catch (error) {
      console.error('Error saving bill:', error);
      alert('Error saving bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showPreview && billPreview) {
    return (
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Bill Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={saveBill}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Generate Bill
            </button>
          </div>
        </div>

        {/* Bill Template */}
        <div id={`bill-${billPreview.bill_number}`}>
          <BillTemplate data={billPreview} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Generate Bill for {client.name}
          </h2>
          <p className="text-sm text-gray-600">Client ID: {client.id} | Site: {client.site}</p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {/* Bill Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bill Date
            </label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate per Plate (₹/day)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={ratePerPlate}
              onChange={(e) => setRatePerPlate(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={fetchTransactionPeriods}
          disabled={calculating}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {calculating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calculator className="w-4 h-4" />
          )}
          Calculate Periods
        </button>
      </div>

      {/* Transaction Periods */}
      {transactionPeriods.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Periods</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left">From Date</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">To Date</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Udhar</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Jama</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Running Stock</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Days</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactionPeriods.map((period, index) => {
                  const days = differenceInDays(new Date(period.to_date), new Date(period.from_date)) + 1;
                  const amount = period.running_stock * ratePerPlate * days;
                  
                  return (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-2">{format(new Date(period.from_date), 'dd/MM/yyyy')}</td>
                      <td className="border border-gray-300 px-3 py-2">{format(new Date(period.to_date), 'dd/MM/yyyy')}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-red-600 font-medium">
                        {period.udhar_quantity > 0 ? `+${period.udhar_quantity}` : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-green-600 font-medium">
                        {period.jama_quantity > 0 ? `-${period.jama_quantity}` : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-600">
                        {period.running_stock}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{days}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-bold">₹{amount.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Additional Charges</h3>
          <button
            onClick={addManualItem}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {manualItems.length > 0 && (
          <div className="space-y-3">
            {manualItems.map((item, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateManualItem(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Labour charges, Transport, Discount"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateManualItem(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <button
                  onClick={() => removeManualItem(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {manualItems.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No additional charges added</p>
            <p className="text-sm mt-1">Add labour, transport, or other charges</p>
          </div>
        )}
      </div>

      {/* Generate Preview Button */}
      <div className="flex justify-end">
        <button
          onClick={generateBillPreview}
          disabled={transactionPeriods.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileImage className="w-5 h-5" />
          Generate Preview
        </button>
      </div>
    </div>
  );
}