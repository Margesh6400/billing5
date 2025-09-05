import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Calculator, 
  Download, 
  Search, 
  User, 
  Calendar, 
  DollarSign,
  Settings,
  Loader2,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  Lock,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Users,
  Target,
  Percent,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  ComprehensiveBillingCalculator, 
  ComprehensiveBillData, 
  BillingRates,
  ExtraCharge,
  Discount,
  Payment
} from '../utils/comprehensiveBillingCalculator';
import { 
  generateComprehensiveBillJPG, 
  downloadComprehensiveBillJPG 
} from '../utils/comprehensiveBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function ComprehensiveBillManagement() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Billing parameters
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [advancePaid, setAdvancePaid] = useState(0);
  
  // Billing rates with dynamic service rate per plate
  const [rates, setRates] = useState<BillingRates>({
    daily_rent_rate: 1.00,
    service_charge_percentage: 10.0
  });
  
  // NEW: Dynamic service rate per plate
  const [serviceRatePerPlate, setServiceRatePerPlate] = useState(10.0); // ₹10 per plate default
  
  // Override fields
  const [overrideTotalPlates, setOverrideTotalPlates] = useState<number | undefined>(undefined);
  const [overrideServiceCharge, setOverrideServiceCharge] = useState<number | undefined>(undefined);
  
  // NEW: Account closure option
  const [accountClosure, setAccountClosure] = useState<'close' | 'continue'>('continue');
  
  // Dynamic sections
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Calculation results
  const [billData, setBillData] = useState<ComprehensiveBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');

  const calculator = new ComprehensiveBillingCalculator(rates);

  useEffect(() => {
    fetchClients();
    generateBillNumber();
  }, []);

  // Recalculate when service rate per plate changes
  useEffect(() => {
    if (billData && selectedClient) {
      handleCalculateBill();
    }
  }, [serviceRatePerPlate]);

  // Recalculate when total plates override changes
  useEffect(() => {
    if (billData && selectedClient && overrideTotalPlates !== undefined) {
      handleCalculateBill();
    }
  }, [overrideTotalPlates]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('id');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBillNumber = async () => {
    try {
      const nextBillNumber = await calculator.generateNextBillNumber();
      setBillNumber(nextBillNumber);
    } catch (error) {
      console.error('Error generating bill number:', error);
      setBillNumber(`BILL-${Date.now().toString().slice(-4)}`);
    }
  };

  const handleCalculateBill = async () => {
    if (!selectedClient) {
      alert('કૃપા કરીને ગ્રાહક પસંદ કરો.');
      return;
    }

    setCalculating(true);
    try {
      const { challans, returns } = await calculator.fetchClientLedgerData(
        selectedClient.id,
        startDate || undefined,
        endDate || billDate
      );

      const calculatedBill = calculator.calculateComprehensiveBilling(
        selectedClient,
        challans,
        returns,
        billDate,
        rates,
        advancePaid,
        extraCharges,
        discounts,
        payments,
        overrideTotalPlates,
        overrideServiceCharge,
        serviceRatePerPlate,
        accountClosure
      );

      calculatedBill.bill_number = billNumber;
      setBillData(calculatedBill);
    } catch (error) {
      console.error('Error calculating bill:', error);
      alert('બિલ ગણતરી કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateBill = async () => {
    if (!billData) return;

    setGenerating(true);
    try {
      const jpgDataUrl = await generateComprehensiveBillJPG(billData);
      downloadComprehensiveBillJPG(jpgDataUrl, `comprehensive-bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setAdvancePaid(0);
      setExtraCharges([]);
      setDiscounts([]);
      setPayments([]);
      setOverrideTotalPlates(undefined);
      setOverrideServiceCharge(undefined);
      setAccountClosure('continue');
      await generateBillNumber();
      
      alert('બિલ સફળતાપૂર્વક જનરેટ અને ડાઉનલોડ થયું!');
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('બિલ જનરેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setGenerating(false);
    }
  };

  const updateRate = (field: keyof BillingRates, value: number) => {
    setRates(prev => ({ ...prev, [field]: value }));
  };
  
  // Extra Charges functions
  const addExtraCharge = () => {
    setExtraCharges(prev => [...prev, {
      note: '',
      date: new Date().toISOString().split('T')[0],
      item_count: 1,
      price: 0,
      total: 0
    }]);
  };
  
  const updateExtraCharge = (index: number, field: keyof ExtraCharge, value: string | number) => {
    setExtraCharges(prev => prev.map((charge, i) => {
      if (i === index) {
        const updated = { ...charge, [field]: value };
        if (field === 'item_count' || field === 'price') {
          updated.total = updated.item_count * updated.price;
        }
        return updated;
      }
      return charge;
    }));
  };
  
  const removeExtraCharge = (index: number) => {
    setExtraCharges(prev => prev.filter((_, i) => i !== index));
  };
  
  // Discounts functions
  const addDiscount = () => {
    setDiscounts(prev => [...prev, {
      note: '',
      date: new Date().toISOString().split('T')[0],
      item_count: 1,
      price: 0,
      total: 0
    }]);
  };
  
  const updateDiscount = (index: number, field: keyof Discount, value: string | number) => {
    setDiscounts(prev => prev.map((discount, i) => {
      if (i === index) {
        const updated = { ...discount, [field]: value };
        if (field === 'item_count' || field === 'price') {
          updated.total = updated.item_count * updated.price;
        }
        return updated;
      }
      return discount;
    }));
  };
  
  const removeDiscount = (index: number) => {
    setDiscounts(prev => prev.filter((_, i) => i !== index));
  };
  
  // Payments functions
  const addPayment = () => {
    setPayments(prev => [...prev, {
      note: '',
      date: new Date().toISOString().split('T')[0],
      payment_amount: 0
    }]);
  };
  
  const updatePayment = (index: number, field: keyof Payment, value: string | number) => {
    setPayments(prev => prev.map((payment, i) => {
      if (i === index) {
        return { ...payment, [field]: value };
      }
      return payment;
    }));
  };
  
  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.site || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-gray-500 to-gray-600">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="mb-1 text-base font-bold text-gray-900">પ્રવેશ નકારવામાં આવ્યો</h1>
            <p className="text-xs text-gray-600">તમને આ પેજ જોવાની પરવાનગી નથી</p>
          </div>
          
          <div className="p-6 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-700">View-Only Access</h3>
            <p className="mb-3 text-sm text-gray-500">
              તમારી પાસે માત્ર જોવાની પરવાનગી છે. બિલ બનાવવા માટે Admin સાથે સંપર્ક કરો.
            </p>
            <p className="text-xs text-blue-600">
              Admin: nilkanthplatdepo@gmail.com
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">લોડ થઈ રહ્યું છે...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલિંગ</h1>
        </div>

        {/* Client Selection */}
        <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <User className="w-4 h-4" />
              ગ્રાહક પસંદ કરો
            </h2>
          </div>
          
          <div className="p-3 space-y-3">
            {!selectedClient ? (
              <>
                <div className="relative">
                  <Search className="absolute w-4 h-4 text-blue-400 transform -translate-y-1/2 left-3 top-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-2 pl-10 pr-3 text-sm transition-all duration-200 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="ગ્રાહકો શોધો..."
                  />
                </div>

                <div className="space-y-2 overflow-y-auto max-h-60">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="w-full p-3 text-left transition-all bg-white border border-blue-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{client.name}</div>
                          <div className="text-xs text-blue-600">ID: {client.id} | {client.site}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="p-3 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{selectedClient.name}</h3>
                      <div className="text-xs text-blue-600">
                        ID: {selectedClient.id} | {selectedClient.site}
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  ગ્રાહક બદલો
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Billing Parameters */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Settings className="w-4 h-4" />
                બિલિંગ પેરામીટર
              </h2>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    બિલ નંબર
                  </label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="B-0001"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    બિલ તારીખ
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  અગાઉથી ચૂકવેલ રકમ (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              <button
                onClick={handleCalculateBill}
                disabled={calculating}
                className="flex items-center justify-center w-full gap-2 py-2 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
              >
                {calculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ગણતરી કરી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    બિલ ગણતરી કરો
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Billing Rates Configuration */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-purple-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <DollarSign className="w-4 h-4" />
                બિલિંગ દરો
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    દૈનિક ભાડો દર (₹/પ્લેટ/દિવસ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.daily_rent_rate}
                    onChange={(e) => updateRate('daily_rent_rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    સર્વિસ ચાર્જ (₹/પ્લેટ)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={serviceRatePerPlate}
                    onChange={(e) => setServiceRatePerPlate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extra Charges Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-orange-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-amber-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Plus className="w-4 h-4" />
                વધારાના ચાર્જ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {extraCharges.map((charge, index) => (
                <div key={index} className="p-2 border border-orange-200 rounded-lg bg-orange-50">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="નોંધ"
                      value={charge.note}
                      onChange={(e) => updateExtraCharge(index, 'note', e.target.value)}
                      className="px-2 py-1 text-xs border border-orange-300 rounded"
                    />
                    <input
                      type="date"
                      value={charge.date}
                      onChange={(e) => updateExtraCharge(index, 'date', e.target.value)}
                      className="px-2 py-1 text-xs border border-orange-300 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="number"
                      placeholder="સંખ્યા"
                      min="1"
                      value={charge.item_count}
                      onChange={(e) => updateExtraCharge(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="px-2 py-1 text-xs border border-orange-300 rounded"
                    />
                    <input
                      type="number"
                      placeholder="કિંમત"
                      step="0.01"
                      min="0"
                      value={charge.price}
                      onChange={(e) => updateExtraCharge(index, 'price', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1 text-xs border border-orange-300 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-700">
                      કુલ: ₹{charge.total.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeExtraCharge(index)}
                      className="px-2 py-1 text-xs text-red-600 rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              
              <button
                onClick={addExtraCharge}
                className="w-full py-2 text-xs font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50"
              >
                + વધારાનો ચાર્જ ઉમેરો
              </button>
            </div>
          </div>
        )}

        {/* Discounts Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-green-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <TrendingUp className="w-4 h-4" />
                ડિસ્કાઉન્ટ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {discounts.map((discount, index) => (
                <div key={index} className="p-2 border border-green-200 rounded-lg bg-green-50">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="નોંધ"
                      value={discount.note}
                      onChange={(e) => updateDiscount(index, 'note', e.target.value)}
                      className="px-2 py-1 text-xs border border-green-300 rounded"
                    />
                    <input
                      type="date"
                      value={discount.date}
                      onChange={(e) => updateDiscount(index, 'date', e.target.value)}
                      className="px-2 py-1 text-xs border border-green-300 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="number"
                      placeholder="સંખ્યા"
                      min="1"
                      value={discount.item_count}
                      onChange={(e) => updateDiscount(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="px-2 py-1 text-xs border border-green-300 rounded"
                    />
                    <input
                      type="number"
                      placeholder="કિંમત"
                      step="0.01"
                      min="0"
                      value={discount.price}
                      onChange={(e) => updateDiscount(index, 'price', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1 text-xs border border-green-300 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-700">
                      કુલ: ₹{discount.total.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeDiscount(index)}
                      className="px-2 py-1 text-xs text-red-600 rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              
              <button
                onClick={addDiscount}
                className="w-full py-2 text-xs font-medium text-green-600 border border-green-300 rounded-lg hover:bg-green-50"
              >
                + ડિસ્કાઉન્ટ ઉમેરો
              </button>
            </div>
          </div>
        )}

        {/* Payments Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-purple-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Calculator className="w-4 h-4" />
                ચુકવણી
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="p-2 border border-purple-200 rounded-lg bg-purple-50">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="નોંધ"
                      value={payment.note}
                      onChange={(e) => updatePayment(index, 'note', e.target.value)}
                      className="px-2 py-1 text-xs border border-purple-300 rounded"
                    />
                    <input
                      type="date"
                      value={payment.date}
                      onChange={(e) => updatePayment(index, 'date', e.target.value)}
                      className="px-2 py-1 text-xs border border-purple-300 rounded"
                    />
                  </div>
                  <div className="mb-2">
                    <input
                      type="number"
                      placeholder="ચુકવણી રકમ"
                      step="0.01"
                      min="0"
                      value={payment.payment_amount}
                      onChange={(e) => updatePayment(index, 'payment_amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-purple-300 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-purple-700">
                      રકમ: ₹{payment.payment_amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removePayment(index)}
                      className="px-2 py-1 text-xs text-red-600 rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              
              <button
                onClick={addPayment}
                className="w-full py-2 text-xs font-medium text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50"
              >
                + ચુકવણી ઉમેરો
              </button>
            </div>
          </div>
        )}

        {/* Bill Preview */}
        {billData && (
          <div className="overflow-hidden bg-white border-2 border-green-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <TrendingUp className="w-4 h-4" />
                બિલ પ્રીવ્યૂ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {/* Ledger Entries Table */}
              <div className="mb-4">
                <h4 className="flex items-center gap-2 mb-2 text-sm font-bold text-purple-800">
                  <Package className="w-4 h-4" />
                  વ્યવહાર ખાતાવહી
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded">
                    <thead>
                      <tr className="text-white bg-gradient-to-r from-purple-500 to-violet-500">
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-center">Udhar</th>
                        <th className="px-2 py-1 text-center">Jama</th>
                        <th className="px-2 py-1 text-left">Challan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billData.ledger_entries.map((entry, index) => (
                        <tr key={index} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${
                          entry.entry_type === 'udhar' ? 'border-l-2 border-red-300' : 'border-l-2 border-green-300'
                        }`}>
                          <td className="px-2 py-1 font-medium">
                            {new Date(entry.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-2 py-1 font-bold text-center text-red-600">
                            {entry.udhar > 0 ? entry.udhar : '-'}
                          </td>
                          <td className="px-2 py-1 font-bold text-center text-green-600">
                            {entry.jama > 0 ? entry.jama : '-'}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-500">
                            #{entry.challan_number}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Date Range Billing Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                      <th className="px-2 py-1 text-left">તારીખ શ્રેણી</th>
                      <th className="px-2 py-1 text-center">પ્લેટ્સ</th>
                      <th className="px-2 py-1 text-center">દિવસ</th>
                      <th className="px-2 py-1 text-center">ભાડો</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billData.date_ranges.map((range, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-2 py-1 font-medium">
                          {range.start_date === range.end_date 
                            ? new Date(range.start_date).toLocaleDateString('en-GB')
                            : `${new Date(range.start_date).toLocaleDateString('en-GB')} – ${new Date(range.end_date).toLocaleDateString('en-GB')}`
                          }
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-blue-600">
                          {range.plate_balance}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-green-600">
                          {range.days}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-purple-600">
                          ₹{range.rent_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Udhar */}
              <div className="p-3 border border-blue-200 rounded bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-blue-800">કુલ ઉધાર (Total Udhar):</span>
                  <span className="text-lg font-bold text-blue-600">₹{billData.total_udhar.toFixed(2)}</span>
                </div>
              </div>

              {/* NEW: Dynamic Total Plates with Override Option */}
              <div className="p-3 border rounded border-cyan-200 bg-cyan-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-cyan-800">કુલ પ્લેટ (Total Plates):</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-cyan-600">{billData.total_plates}</span>
                    <button
                      onClick={() => {
                        const newValue = prompt('કુલ પ્લેટ ઓવરરાઇડ કરો:', billData.total_plates.toString());
                        if (newValue !== null) {
                          const parsedValue = parseInt(newValue) || billData.total_plates;
                          setOverrideTotalPlates(parsedValue);
                        }
                      }}
                      className="p-1 rounded text-cyan-600 hover:bg-cyan-100"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-cyan-600">
                  ગણતરી: {billData.total_plates_udhar} ઉધાર - {billData.total_plates_jama} જમા = {billData.total_plates_udhar - billData.total_plates_jama}
                </div>
                {overrideTotalPlates !== undefined && (
                  <div className="text-xs text-cyan-600">
                    મૂળ ગણતરી: {billData.total_plates_udhar - billData.total_plates_jama} પ્લેટ
                  </div>
                )}
              </div>

              {/* NEW: Dynamic Service Charge with Per-Plate Rate */}
              {/* <div className="p-3 border border-indigo-200 rounded bg-indigo-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-indigo-800">
                    સેવા ચાર્જ (₹{billData.service_rate_per_plate}/પ્લેટ):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-indigo-600">₹{billData.service_charge.toFixed(2)}</span>
                    <button
                      onClick={() => {
                        const newValue = prompt('સેવા ચાર્જ ઓવરરાઇડ કરો:', billData.service_charge.toString());
                        if (newValue !== null) {
                          setOverrideServiceCharge(parseFloat(newValue) || billData.service_charge);
                        }
                      }}
                      className="p-1 text-indigo-600 rounded hover:bg-indigo-100"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-indigo-600">
                  ગણતરી: {billData.total_plates} પ્લેટ × ₹{billData.service_rate_per_plate} = ₹{(billData.total_plates * billData.service_rate_per_plate).toFixed(2)}
                </div>
                {overrideServiceCharge !== undefined && (
                  <div className="text-xs text-indigo-600">
                    મૂળ ગણતરી: ₹{(billData.total_plates * billData.service_rate_per_plate).toFixed(2)}
                  </div>
                )}
              </div> */}

              {/* Extra Charges Display */}
              {billData.extra_charges.length > 0 && (
                <div className="p-3 border border-orange-200 rounded bg-orange-50">
                  <h4 className="mb-2 text-sm font-bold text-orange-800">વધારાના ચાર્જ:</h4>
                  <div className="space-y-1">
                    {billData.extra_charges.map((charge, index) => (
                      <div key={index} className="text-xs text-orange-700">
                        [{new Date(charge.date).toLocaleDateString('en-GB')}] {charge.note} {charge.item_count} × ₹{charge.price.toFixed(2)} = ₹{charge.total.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 text-sm font-bold text-orange-800 border-t border-orange-300">
                    કુલ વધારાના ચાર્જ: ₹{billData.extra_charges_total.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Discounts Display */}
              {billData.discounts.length > 0 && (
                <div className="p-3 border border-green-200 rounded bg-green-50">
                  <h4 className="mb-2 text-sm font-bold text-green-800">ડિસ્કાઉન્ટ:</h4>
                  <div className="space-y-1">
                    {billData.discounts.map((discount, index) => (
                      <div key={index} className="text-xs text-green-700">
                        [{new Date(discount.date).toLocaleDateString('en-GB')}] {discount.note} {discount.item_count} × ₹{discount.price.toFixed(2)} = ₹{discount.total.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 text-sm font-bold text-green-800 border-t border-green-300">
                    કુલ ડિસ્કાઉન્ટ: ₹{billData.discounts_total.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Payments Display */}
              {billData.payments.length > 0 && (
                <div className="p-3 border border-purple-200 rounded bg-purple-50">
                  <h4 className="mb-2 text-sm font-bold text-purple-800">ચુકવણી:</h4>
                  <div className="space-y-1">
                    {billData.payments.map((payment, index) => (
                      <div key={index} className="text-xs text-purple-700">
                        [{new Date(payment.date).toLocaleDateString('en-GB')}] {payment.note} : ₹{payment.payment_amount.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 text-sm font-bold text-purple-800 border-t border-purple-300">
                    કુલ ચુકવણી: ₹{billData.payments_total.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Final Calculation Summary */}
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>કુલ ઉધાર:</span>
                    <span className="font-bold">₹{billData.total_udhar.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>સેવા ચાર્જ ({billData.total_plates_udhar} પ્લેટ × ₹{billData.service_rate_per_plate}):</span>
                    <span className="font-bold">₹{billData.service_charge.toFixed(2)}</span>
                  </div>
                  {billData.extra_charges_total > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>વધારાના ચાર્જ:</span>
                      <span className="font-bold">+₹{billData.extra_charges_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.discounts_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>ડિસ્કાઉન્ટ:</span>
                      <span className="font-bold">-₹{billData.discounts_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.payments_total > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>ચુકવણી:</span>
                      <span className="font-bold">-₹{billData.payments_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.advance_paid > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>અગાઉથી ચૂકવેલ:</span>
                      <span className="font-bold">-₹{billData.advance_paid.toFixed(2)}</span>
                    </div>
                  )}
                  <hr className="border-gray-300" />
                  <div className={`flex justify-between text-xl font-bold ${
                    billData.final_due > 0 ? 'text-red-600' : 
                    billData.balance_carry_forward > 0 ? 'text-green-600' : 'text-green-600'
                  }`}>
                    <span>
                      {billData.final_due > 0 ? 'FINAL DUE:' : 
                       billData.balance_carry_forward > 0 ? 'બેલેન્સ કેરી ફોરવર્ડ:' : 'FULLY PAID:'}
                    </span>
                    <span>
                      ₹{billData.final_due > 0 ? billData.final_due.toFixed(2) : 
                        billData.balance_carry_forward > 0 ? billData.balance_carry_forward.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* NEW: Account Closure Option */}
              <div className="p-3 border-2 border-yellow-300 rounded-lg bg-yellow-50">
                <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-yellow-800">
                  <Target className="w-4 h-4" />
                  એકાઉન્ટ બંધ કરવાનો વિકલ્પ
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100">
                    <input
                      type="radio"
                      name="accountClosure"
                      value="close"
                      checked={accountClosure === 'close'}
                      onChange={(e) => setAccountClosure(e.target.value as 'close' | 'continue')}
                      className="w-4 h-4 text-red-600"
                    />
                    <div className="flex items-center gap-2">
                      <ToggleRight className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium text-red-700">Account Close</span>
                    </div>
                    <span className="text-xs text-red-600">(Finalize ledger, reset balance to 0)</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-2 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100">
                    <input
                      type="radio"
                      name="accountClosure"
                      value="continue"
                      checked={accountClosure === 'continue'}
                      onChange={(e) => setAccountClosure(e.target.value as 'close' | 'continue')}
                      className="w-4 h-4 text-green-600"
                    />
                    <div className="flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Continue</span>
                    </div>
                    <span className="text-xs text-green-600">(Carry forward balance to next cycle)</span>
                  </label>
                </div>
              </div>

              {/* Generate Bill Button */}
              <button
                onClick={handleGenerateBill}
                disabled={generating}
                className="flex items-center justify-center w-full gap-2 py-3 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    બિલ બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    કમ્પ્રીહેન્સિવ બિલ જનરેટ કરો
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the component with the name expected by App.tsx
export const MobileBillingPage = ComprehensiveBillManagement;