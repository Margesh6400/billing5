import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { BillingCalculator } from '../../utils/billingCalculator';
import { generateBillJPG, downloadBillJPG } from '../../utils/billJPGGenerator';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  Calendar,
  DollarSign,
  Package,
  User,
  Loader2,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];

interface BillingPeriod {
  from_date: string;
  to_date: string;
  days: number;
  running_stock: number;
  daily_rate: number;
  charge: number;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ratePerPlate, setRatePerPlate] = useState(1.00);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [manualItems, setManualItems] = useState<ManualLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const calculator = new BillingCalculator(ratePerPlate, 0);

  useEffect(() => {
    if (startDate && endDate) {
      calculateBillingPeriods();
    }
  }, [startDate, endDate, ratePerPlate]);

  const calculateBillingPeriods = async () => {
    if (!startDate || !endDate) return;

    setCalculating(true);
    try {
      const transactions = await calculator.fetchTransactions(client.id, startDate, endDate);
      const calculation = calculator.calculateBilling(transactions, startDate, endDate);
      setBillingPeriods(calculation.billing_periods);
    } catch (error) {
      console.error('Error calculating billing periods:', error);
      alert('Error calculating billing periods. Please try again.');
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

  const generateBill = async () => {
    setLoading(true);
    try {
      // Generate next bill number
      const billNumber = await calculator.generateNextBillNumber();

      // Calculate totals
      const periodCharges = billingPeriods.reduce((sum, period) => sum + period.charge, 0);
      const manualCharges = manualItems.reduce((sum, item) => sum + item.amount, 0);
      const totalAmount = periodCharges + manualCharges;

      // Save bill to database
      const { data: savedBill, error: billError } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNumber,
          client_id: client.id,
          billing_period_start: startDate || billDate,
          billing_period_end: endDate || billDate,
          total_amount: totalAmount,
          payment_status: 'pending',
          daily_rate: ratePerPlate,
          service_rate: 0,
          total_udhar_quantity: 0,
          service_charge: 0,
          period_charges: periodCharges,
          previous_payments: 0,
          net_due: totalAmount
        }])
        .select()
        .single();

      if (billError) throw billError;

      // Generate and download JPG
      const jpgDataUrl = await generateBillJPG({
        bill_number: billNumber,
        client: {
          id: client.id,
          name: client.name,
          site: client.site || '',
          mobile: client.mobile_number || ''
        },
        bill_date: billDate,
        period_start: startDate || billDate,
        period_end: endDate || billDate,
        billing_periods: billingPeriods,
        total_udhar_quantity: 0,
        service_charge: 0,
        period_charges: periodCharges,
        total_amount: totalAmount,
        previous_payments: 0,
        net_due: totalAmount,
        daily_rate: ratePerPlate,
        service_rate: 0,
        manual_items: manualItems.filter(item => item.description.trim() && item.amount !== 0)
      });

      downloadBillJPG(jpgDataUrl, `bill-${billNumber}-${client.name.replace(/\s+/g, '-')}`);

      alert(`Bill ${billNumber} generated successfully!`);
      onBillGenerated();
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('Error generating bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                {client.name} માટે બિલ બનાવો
              </h2>
              <p className="text-sm text-gray-600">Client ID: {client.id} | Site: {client.site}</p>
            </div>
          </div>
        </div>

        {/* Bill Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">બિલ કોન્ફિગરેશન</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                બિલ તારીખ
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
                દૈનિક દર (₹/પ્લેટ/દિવસ)
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                શરૂઆતની તારીખ
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                અંતિમ તારીખ
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={calculateBillingPeriods}
            disabled={calculating || !startDate || !endDate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {calculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            પીરિયડ કેલ્ક્યુલેટ કરો
          </button>
        </div>

        {/* Billing Periods */}
        {billingPeriods.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">બિલિંગ પીરિયડ</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left">શરૂઆતની તારીખ</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">અંતિમ તારીખ</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">દિવસો</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">સ્ટોક</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">દર</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">રકમ (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {billingPeriods.map((period, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-2">{format(new Date(period.from_date), 'dd/MM/yyyy')}</td>
                      <td className="border border-gray-300 px-3 py-2">{format(new Date(period.to_date), 'dd/MM/yyyy')}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-medium">{period.days}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-600">{period.running_stock}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">₹{period.daily_rate.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-bold">₹{period.charge.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100 border-t-2 border-blue-600">
                    <td colSpan={5} className="border border-gray-300 px-3 py-3 text-right font-bold text-lg">
                      કુલ પીરિયડ ચાર્જ:
                    </td>
                    <td className="border border-gray-300 px-3 py-3 text-right font-bold text-xl text-red-600">
                      ₹{billingPeriods.reduce((sum, period) => sum + period.charge, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manual Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">વધારાના ચાર્જ</h3>
            <button
              onClick={addManualItem}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              આઇટમ ઉમેરો
            </button>
          </div>

          {manualItems.length > 0 ? (
            <div className="space-y-3">
              {manualItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      વર્ણન
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateManualItem(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="જેમ કે: મજૂરી ચાર્જ, પરિવહન"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      રકમ (₹)
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
          ) : (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>કોઈ વધારાના ચાર્જ ઉમેરવામાં આવ્યા નથી</p>
              <p className="text-sm mt-1">મજૂરી, પરિવહન અથવા અન્ય ચાર્જ ઉમેરો</p>
            </div>
          )}
        </div>

        {/* Generate Bill Button */}
        <div className="flex justify-end">
          <button
            onClick={generateBill}
            disabled={loading || billingPeriods.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {loading ? 'બિલ બનાવી રહ્યા છીએ...' : 'બિલ બનાવો અને ડાઉનલોડ કરો'}
          </button>
        </div>
      </div>
    </div>
  );
}