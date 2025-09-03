import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
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
  Minus,
  X,
  CreditCard,
  Receipt,
  Percent
} from 'lucide-react';
import { 
  ComprehensiveBillingCalculator, 
  ComprehensiveBillData, 
  BillingRates,
  ExtraCharge,
  Discount,
  Payment
} from '../../utils/comprehensiveBillingCalculator';
import { 
  generateComprehensiveBillJPG, 
  downloadComprehensiveBillJPG 
} from '../../utils/comprehensiveBillJPGGenerator';

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
  
  // Billing rates
  const [rates, setRates] = useState<BillingRates>({
    daily_rent_rate: 1.00,
    service_charge_rate: 7.00,
    worker_charge: 100.00,
    lost_plate_penalty: 250.00
  });

  // New sections state
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
        payments
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

  // Extra Charges handlers
  const addExtraCharge = () => {
    setExtraCharges(prev => [...prev, { note: '', item_count: 1, price: 0, total: 0 }]);
  };

  const updateExtraCharge = (index: number, field: keyof ExtraCharge, value: string | number) => {
    setExtraCharges(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calculate total
      if (field === 'item_count' || field === 'price') {
        updated[index].total = updated[index].item_count * updated[index].price;
      }
      return updated;
    });
  };

  const removeExtraCharge = (index: number) => {
    setExtraCharges(prev => prev.filter((_, i) => i !== index));
  };

  // Discounts handlers
  const addDiscount = () => {
    setDiscounts(prev => [...prev, { note: '', item_count: 1, price: 0, total: 0 }]);
  };

  const updateDiscount = (index: number, field: keyof Discount, value: string | number) => {
    setDiscounts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calculate total
      if (field === 'item_count' || field === 'price') {
        updated[index].total = updated[index].item_count * updated[index].price;
      }
      return updated;
    });
  };

  const removeDiscount = (index: number) => {
    setDiscounts(prev => prev.filter((_, i) => i !== index));
  };

  // Payments handlers
  const addPayment = () => {
    setPayments(prev => [...prev, { note: '', payment_amount: 0 }]);
  };

  const updatePayment = (index: number, field: keyof Payment, value: string | number) => {
    setPayments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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
          <h1 className="mb-1 text-base font-bold text-gray-900">કમ્પ્રીહેન્સિવ બિલિંગ</h1>
          <p className="text-xs text-blue-600">હેન્ડરાઇટન બિલ ફોર્મેટ</p>
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
                    placeholder="BILL-0001"
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
            </div>
          </div>
        )}

        {/* Extra Charges Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-orange-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Plus className="w-4 h-4" />
                  વધારાના ચાર્જ
                </h3>
                <button
                  onClick={addExtraCharge}
                  className="p-1 text-white rounded hover:bg-white/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {extraCharges.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">કોઈ વધારાના ચાર્જ નથી</p>
              ) : (
                extraCharges.map((charge, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 border border-orange-200 rounded bg-orange-50">
                    <input
                      type="text"
                      placeholder="ચાર્જ વર્ણન"
                      value={charge.note}
                      onChange={(e) => updateExtraCharge(index, 'note', e.target.value)}
                      className="col-span-5 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="સંખ્યા"
                      value={charge.item_count}
                      onChange={(e) => updateExtraCharge(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="col-span-2 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="દર"
                      value={charge.price}
                      onChange={(e) => updateExtraCharge(index, 'price', parseFloat(e.target.value) || 0)}
                      className="col-span-3 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                    />
                    <div className="col-span-1 text-xs font-bold text-orange-700 text-center">
                      ₹{charge.total.toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeExtraCharge(index)}
                      className="col-span-1 p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
              {extraCharges.length > 0 && (
                <div className="text-right text-sm font-bold text-orange-700">
                  કુલ વધારાના ચાર્જ: ₹{extraCharges.reduce((sum, charge) => sum + charge.total, 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Discounts Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-green-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Percent className="w-4 h-4" />
                  ડિસ્કાઉન્ટ
                </h3>
                <button
                  onClick={addDiscount}
                  className="p-1 text-white rounded hover:bg-white/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {discounts.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">કોઈ ડિસ્કાઉન્ટ નથી</p>
              ) : (
                discounts.map((discount, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 border border-green-200 rounded bg-green-50">
                    <input
                      type="text"
                      placeholder="ડિસ્કાઉન્ટ વર્ણન"
                      value={discount.note}
                      onChange={(e) => updateDiscount(index, 'note', e.target.value)}
                      className="col-span-5 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="સંખ્યા"
                      value={discount.item_count}
                      onChange={(e) => updateDiscount(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="col-span-2 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="દર"
                      value={discount.price}
                      onChange={(e) => updateDiscount(index, 'price', parseFloat(e.target.value) || 0)}
                      className="col-span-3 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                    />
                    <div className="col-span-1 text-xs font-bold text-green-700 text-center">
                      ₹{discount.total.toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeDiscount(index)}
                      className="col-span-1 p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
              {discounts.length > 0 && (
                <div className="text-right text-sm font-bold text-green-700">
                  કુલ ડિસ્કાઉન્ટ: ₹{discounts.reduce((sum, discount) => sum + discount.total, 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payments Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-purple-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <CreditCard className="w-4 h-4" />
                  ચુકવણી
                </h3>
                <button
                  onClick={addPayment}
                  className="p-1 text-white rounded hover:bg-white/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {payments.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">કોઈ ચુકવણી નથી</p>
              ) : (
                payments.map((payment, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 border border-purple-200 rounded bg-purple-50">
                    <input
                      type="text"
                      placeholder="ચુકવણી વર્ણન"
                      value={payment.note}
                      onChange={(e) => updatePayment(index, 'note', e.target.value)}
                      className="col-span-8 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="રકમ"
                      value={payment.payment_amount}
                      onChange={(e) => updatePayment(index, 'payment_amount', parseFloat(e.target.value) || 0)}
                      className="col-span-3 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                    />
                    <button
                      onClick={() => removePayment(index)}
                      className="col-span-1 p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
              {payments.length > 0 && (
                <div className="text-right text-sm font-bold text-purple-700">
                  કુલ ચુકવણી: ₹{payments.reduce((sum, payment) => sum + payment.payment_amount, 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calculate Button */}
        {selectedClient && (
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
                    સર્વિસ ચાર્જ દર (₹/પ્લેટ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.service_charge_rate}
                    onChange={(e) => updateRate('service_charge_rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    કામદાર ચાર્જ (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.worker_charge}
                    onChange={(e) => updateRate('worker_charge', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    ગુમ પ્લેટ દંડ (₹/પ્લેટ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.lost_plate_penalty}
                    onChange={(e) => updateRate('lost_plate_penalty', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
              </div>
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
              {/* Date Range Breakdown */}
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

              {/* Enhanced Charges Summary */}
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <div className="space-y-2 text-xs">
                  {/* Original Charges */}
                  <div className="flex justify-between">
                    <span>Subtotal Rent:</span>
                    <span className="font-bold">₹{billData.total_rent.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge ({billData.total_plates_issued} × ₹{billData.rates.service_charge_rate}):</span>
                    <span className="font-bold">₹{billData.service_charge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Worker Charge:</span>
                    <span className="font-bold">₹{billData.worker_charge.toFixed(2)}</span>
                  </div>
                  {billData.lost_plates_count > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Lost Plates ({billData.lost_plates_count} × ₹{billData.rates.lost_plate_penalty}):</span>
                      <span className="font-bold">₹{billData.lost_plate_penalty.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Extra Charges */}
                  {billData.extra_charges_total > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Extra Charges:</span>
                      <span className="font-bold">₹{billData.extra_charges_total.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <hr className="border-gray-300" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Subtotal:</span>
                    <span>₹{billData.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Deductions */}
                  {billData.discounts_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discounts:</span>
                      <span className="font-bold">-₹{billData.discounts_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.advance_paid > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Advance Paid:</span>
                      <span className="font-bold">-₹{billData.advance_paid.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.payments_total > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>Payments:</span>
                      <span className="font-bold">-₹{billData.payments_total.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <hr className="border-gray-300" />
                  
                  {/* Final Result */}
                  {billData.balance_carry_forward > 0 ? (
                    <div className="flex justify-between text-xl font-bold text-green-600">
                      <span>BALANCE CARRY FORWARD:</span>
                      <span>₹{billData.balance_carry_forward.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className={`flex justify-between text-xl font-bold ${billData.final_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <span>FINAL DUE:</span>
                      <span>₹{billData.final_due.toFixed(2)}</span>
                    </div>
                  )}
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