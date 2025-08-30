import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { 
  EnhancedBillingCalculator, 
  PlateRates, 
  BillCalculation, 
  ExtraCharge, 
  Discount 
} from '../../utils/enhancedBillingCalculator';
import { 
  generateEnhancedBillJPG, 
  downloadEnhancedBillJPG, 
  EnhancedBillData 
} from '../../utils/enhancedBillJPGGenerator';
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
  Loader2,
  ArrowLeft,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];

const DEFAULT_PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

interface EnhancedBillGeneratorProps {
  client: Client;
  onBillGenerated: () => void;
  onCancel: () => void;
}

export function EnhancedBillGenerator({ client, onBillGenerated, onCancel }: EnhancedBillGeneratorProps) {
  const { user } = useAuth();
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [plateRates, setPlateRates] = useState<PlateRates>({});
  const [defaultRate, setDefaultRate] = useState(1.00);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [billCalculation, setBillCalculation] = useState<BillCalculation | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRateSettings, setShowRateSettings] = useState(false);

  const calculator = new EnhancedBillingCalculator(plateRates, defaultRate);

  useEffect(() => {
    // Initialize default rates for all plate sizes
    const initialRates: PlateRates = {};
    DEFAULT_PLATE_SIZES.forEach(size => {
      initialRates[size] = defaultRate;
    });
    setPlateRates(initialRates);
  }, [defaultRate]);

  useEffect(() => {
    calculator.setPlateRates(plateRates);
    calculator.setDefaultRate(defaultRate);
  }, [plateRates, defaultRate]);

  const handleCalculateBill = async () => {
    setCalculating(true);
    try {
      const calculation = await calculator.calculateBilling(
        client.id,
        billDate,
        extraCharges,
        discounts,
        startDate || undefined,
        endDate || billDate
      );
      setBillCalculation(calculation);
      setShowPreview(true);
    } catch (error) {
      console.error('Error calculating bill:', error);
      alert('Error calculating bill. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateBill = async () => {
    if (!billCalculation) return;

    setLoading(true);
    try {
      // Generate next bill number
      const billNumber = await calculator.generateNextBillNumber();

      // Save bill to database
      const { data: savedBill, error: billError } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNumber,
          client_id: client.id,
          billing_period_start: startDate || billCalculation.matched_challans[0]?.issue_date || billDate,
          billing_period_end: billDate,
          total_amount: billCalculation.grand_total,
          payment_status: 'pending',
          daily_rate: defaultRate,
          service_rate: 0,
          total_udhar_quantity: billCalculation.total_plates,
          service_charge: 0,
          period_charges: billCalculation.subtotal,
          previous_payments: 0,
          net_due: billCalculation.grand_total
        }])
        .select()
        .single();

      if (billError) throw billError;

      // Prepare data for JPG generation
      const enhancedBillData: EnhancedBillData = {
        bill_number: billNumber,
        client: {
          id: client.id,
          name: client.name,
          site: client.site || '',
          mobile: client.mobile_number || ''
        },
        bill_date: billDate,
        matched_challans: billCalculation.matched_challans,
        subtotal: billCalculation.subtotal,
        extra_charges: extraCharges,
        discounts: discounts,
        grand_total: billCalculation.grand_total,
        total_plates: billCalculation.total_plates,
        total_days: billCalculation.total_days
      };

      // Generate and download JPG
      const jpgDataUrl = await generateEnhancedBillJPG(enhancedBillData);
      const filename = `bill-${client.id}-${billDate}`;
      downloadEnhancedBillJPG(jpgDataUrl, filename);

      alert(`Bill ${billNumber} generated successfully!`);
      onBillGenerated();
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('Error generating bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addExtraCharge = () => {
    setExtraCharges([...extraCharges, { description: '', amount: 0 }]);
  };

  const updateExtraCharge = (index: number, field: keyof ExtraCharge, value: string | number) => {
    const updated = [...extraCharges];
    updated[index] = { ...updated[index], [field]: value };
    setExtraCharges(updated);
  };

  const removeExtraCharge = (index: number) => {
    setExtraCharges(extraCharges.filter((_, i) => i !== index));
  };

  const addDiscount = () => {
    setDiscounts([...discounts, { description: '', amount: 0 }]);
  };

  const updateDiscount = (index: number, field: keyof Discount, value: string | number) => {
    const updated = [...discounts];
    updated[index] = { ...updated[index], [field]: value };
    setDiscounts(updated);
  };

  const removeDiscount = (index: number) => {
    setDiscounts(discounts.filter((_, i) => i !== index));
  };

  const updatePlateRate = (plateSize: string, rate: number) => {
    setPlateRates(prev => ({
      ...prev,
      [plateSize]: rate
    }));
  };

  if (showPreview && billCalculation) {
    return (
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(false)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bill Preview</h2>
              <p className="text-sm text-gray-600">
                {client.name} | Total: ₹{billCalculation.grand_total.toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={handleGenerateBill}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Generate & Download
            </button>
          </div>
        </div>

        {/* Bill Preview Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Challans</p>
                <p className="text-lg font-bold text-gray-900">
                  {Object.keys(billCalculation.matched_challans.reduce((acc, c) => {
                    acc[c.issue_challan_number] = true;
                    return acc;
                  }, {} as Record<string, boolean>)).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Plates</p>
                <p className="text-lg font-bold text-gray-900">{billCalculation.total_plates}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Total Days</p>
                <p className="text-lg font-bold text-gray-900">{billCalculation.total_days}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Grand Total</p>
                <p className="text-lg font-bold text-gray-900">₹{billCalculation.grand_total.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Matched Challans Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Matched Challans</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left">Challan No</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Issue Date</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Return Date</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Plate Size</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Qty</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Days</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Rate/Day</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">Amount</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {billCalculation.matched_challans.map((challan, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-3 py-2 font-medium">{challan.issue_challan_number}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{format(new Date(challan.issue_date), 'dd/MM/yyyy')}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{format(new Date(challan.return_date), 'dd/MM/yyyy')}</td>
                    <td className="border border-gray-300 px-3 py-2">{challan.plate_size}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-bold">{challan.issued_quantity}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{challan.days_used}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">₹{challan.rate_per_day.toFixed(2)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-bold">₹{challan.service_charge.toFixed(2)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        challan.is_fully_returned 
                          ? 'bg-green-100 text-green-800' 
                          : challan.is_partial_return 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {challan.is_fully_returned ? 'Returned' : challan.is_partial_return ? 'Partial' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            Enhanced Bill Generator for {client.name}
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bill Configuration</h3>
          <button
            onClick={() => setShowRateSettings(!showRateSettings)}
            className="flex items-center gap-2 px-3 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
          >
            <Settings className="w-4 h-4" />
            {showRateSettings ? 'Hide' : 'Show'} Rate Settings
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              Start Date (Optional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Leave empty for all transactions"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Leave empty to use bill date"
            />
          </div>
        </div>

        {/* Rate Settings */}
        {showRateSettings && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Plate Rates Configuration</h4>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Rate (₹/plate/day)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultRate}
                onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DEFAULT_PLATE_SIZES.map(size => (
                <div key={size}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {size} (₹/day)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={plateRates[size] || defaultRate}
                    onChange={(e) => updatePlateRate(size, parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleCalculateBill}
          disabled={calculating}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {calculating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calculator className="w-4 h-4" />
          )}
          Calculate Bill
        </button>
      </div>

      {/* Extra Charges */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Extra Charges</h3>
          <button
            onClick={addExtraCharge}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Charge
          </button>
        </div>

        {extraCharges.length > 0 ? (
          <div className="space-y-3">
            {extraCharges.map((charge, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={charge.description}
                    onChange={(e) => updateExtraCharge(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Labour charges, Transport"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={charge.amount}
                    onChange={(e) => updateExtraCharge(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <button
                  onClick={() => removeExtraCharge(index)}
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
            <p>No extra charges added</p>
            <p className="text-sm mt-1">Add labour, transport, or other charges</p>
          </div>
        )}
      </div>

      {/* Discounts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Discounts</h3>
          <button
            onClick={addDiscount}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Discount
          </button>
        </div>

        {discounts.length > 0 ? (
          <div className="space-y-3">
            {discounts.map((discount, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={discount.description}
                    onChange={(e) => updateDiscount(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Early payment discount, Bulk discount"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={discount.amount}
                    onChange={(e) => updateDiscount(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <button
                  onClick={() => removeDiscount(index)}
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
            <p>No discounts added</p>
            <p className="text-sm mt-1">Add early payment or bulk discounts</p>
          </div>
        )}
      </div>
    </div>
  );
}