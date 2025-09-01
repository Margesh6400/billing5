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
  Plus,
  Minus,
  FileText,
  Lock,
  Settings,
  Loader2,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Receipt
} from 'lucide-react';
import { 
  EnhancedGujaratiBillingCalculator, 
  EnhancedGujaratiBillData, 
  BillingRates,
  ExtraItem,
  Payment
} from '../../utils/enhancedGujaratiBillingCalculator';
import { 
  generateEnhancedGujaratiBillJPG, 
  downloadEnhancedGujaratiBillJPG 
} from '../../utils/enhancedGujaratiBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function EnhancedGujaratiBillManagement() {
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
  
  // NEW: Extra items and payments
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Calculation results
  const [billData, setBillData] = useState<EnhancedGujaratiBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');

  const calculator = new EnhancedGujaratiBillingCalculator(rates);

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
      const { challans, returns } = await calculator.fetchClientTransactionData(
        selectedClient.id,
        startDate || undefined,
        endDate || billDate
      );

      const calculatedBill = calculator.calculateEnhancedGujaratiBill(
        selectedClient,
        challans,
        returns,
        billDate,
        rates,
        advancePaid,
        extraItems,
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
      const jpgDataUrl = await generateEnhancedGujaratiBillJPG(billData);
      downloadEnhancedGujaratiBillJPG(jpgDataUrl, `enhanced-gujarati-bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setAdvancePaid(0);
      setExtraItems([]);
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

  // NEW: Extra items management
  const addExtraItem = () => {
    setExtraItems([...extraItems, { note: '', item_count: 1, price: 0, total: 0 }]);
  };

  const updateExtraItem = (index: number, field: keyof ExtraItem, value: string | number) => {
    const updated = [...extraItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total
    if (field === 'item_count' || field === 'price') {
      updated[index].total = updated[index].item_count * updated[index].price;
    }
    
    setExtraItems(updated);
  };

  const removeExtraItem = (index: number) => {
    setExtraItems(extraItems.filter((_, i) => i !== index));
  };

  // NEW: Payments management
  const addPayment = () => {
    setPayments([...payments, { note: '', payment_amount: 0 }]);
  };

  const updatePayment = (index: number, field: keyof Payment, value: string | number) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value };
    setPayments(updated);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
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
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">એન્હાન્સ્ડ ગુજરાતી બિલિંગ</h1>
          <p className="text-xs text-blue-600">વધારાના ચાર્જ અને ચુકવણી સાથે</p>
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
                દરો કોન્ફિગરેશન
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
                    મજૂરી ચાર્જ (₹)
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

        {/* NEW: Extra Items (Charges & Discounts) */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-yellow-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Receipt className="w-4 h-4" />
                  વધારાના ચાર્જ / ડિસ્કાઉન્ટ્સ
                </h3>
                <button
                  onClick={addExtraItem}
                  className="p-1 text-white rounded hover:bg-yellow-400/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {extraItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 p-2 border border-yellow-200 rounded bg-yellow-50">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => updateExtraItem(index, 'note', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="વર્ણન: મજૂરી, ડિસ્કાઉન્ટ વગેરે"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.item_count}
                      onChange={(e) => updateExtraItem(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="સંખ્યા"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateExtraItem(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="દર (+ અથવા -)"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className={`px-2 py-1 text-xs font-bold text-center border rounded ${
                      item.total >= 0 
                        ? 'text-red-700 bg-red-100 border-red-300' 
                        : 'text-green-700 bg-green-100 border-green-300'
                    }`}>
                      ₹{item.total.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeExtraItem(index)}
                      className="w-full p-1 text-red-600 rounded hover:bg-red-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {extraItems.length === 0 && (
                <p className="py-2 text-xs text-center text-gray-500">કોઈ વધારાના ચાર્જ અથવા ડિસ્કાઉન્ટ નથી</p>
              )}
              
              {extraItems.length > 0 && (
                <div className="p-2 border border-yellow-300 rounded bg-yellow-100">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">વધારાના ચાર્જ:</span>
                    <span className="font-bold text-red-600">
                      ₹{extraItems.filter(i => i.price > 0).reduce((sum, i) => sum + i.total, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">ડિસ્કાઉન્ટ:</span>
                    <span className="font-bold text-green-600">
                      -₹{extraItems.filter(i => i.price < 0).reduce((sum, i) => sum + Math.abs(i.total), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NEW: Payments */}
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
                  className="p-1 text-white rounded hover:bg-purple-400/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 p-2 border border-purple-200 rounded bg-purple-50">
                  <div className="col-span-8">
                    <input
                      type="text"
                      value={payment.note}
                      onChange={(e) => updatePayment(index, 'note', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="ચુકવણીનું વર્ણન: રોકડ, ચેક, ઓનલાઇન વગેરે"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payment.payment_amount}
                      onChange={(e) => updatePayment(index, 'payment_amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="રકમ"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removePayment(index)}
                      className="w-full p-1 text-red-600 rounded hover:bg-red-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="py-2 text-xs text-center text-gray-500">કોઈ ચુકવણી નથી</p>
              )}
              
              {payments.length > 0 && (
                <div className="p-2 border border-purple-300 rounded bg-purple-100">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">કુલ ચુકવણી:</span>
                    <span className="font-bold text-purple-600">
                      ₹{payments.reduce((sum, p) => sum + p.payment_amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bill Preview */}
        {billData && (
          <div className="overflow-hidden bg-white border-2 border-green-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <TrendingUp className="w-4 h-4" />
                બિલ પ્રીવ્યૂ - એન્હાન્સ્ડ ફોર્મેટ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {/* Core Charges Summary */}
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <h4 className="mb-2 text-sm font-bold text-gray-800">મૂળ ચાર્જ સારાંશ:</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>કુલ ભાડું / Subtotal Rent:</span>
                    <span className="font-bold">₹{billData.total_rent.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>સર્વિસ ચાર્જ / Service Charge ({billData.total_plates_issued} × ₹{billData.rates.service_charge_rate}):</span>
                    <span className="font-bold">₹{billData.service_charge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>મજૂરી ચાર્જ / Worker Charge:</span>
                    <span className="font-bold">₹{billData.worker_charge.toFixed(2)}</span>
                  </div>
                  {billData.lost_plates_count > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>ગુમ પ્લેટ દંડ / Lost Plates ({billData.lost_plates_count} × ₹{billData.rates.lost_plate_penalty}):</span>
                      <span className="font-bold">₹{billData.lost_plate_penalty.toFixed(2)}</span>
                    </div>
                  )}
                  <hr className="border-gray-300" />
                  <div className="flex justify-between text-base font-bold">
                    <span>મૂળ કુલ / Core Total:</span>
                    <span>₹{billData.core_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* NEW: Extra Items Summary */}
              {billData.extra_items.length > 0 && (
                <div className="p-3 border border-yellow-200 rounded bg-yellow-50">
                  <h4 className="mb-2 text-sm font-bold text-yellow-800">વધારાના ચાર્જ / ડિસ્કાઉન્ટ્સ:</h4>
                  <div className="space-y-1 text-xs">
                    {billData.extra_items.map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.note} ({item.item_count} × ₹{item.price.toFixed(2)}):</span>
                        <span className={`font-bold ${item.total >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.total >= 0 ? '+' : ''}₹{item.total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <hr className="border-yellow-300" />
                    <div className="flex justify-between text-base font-bold">
                      <span>ગોઠવેલ કુલ / Adjusted Total:</span>
                      <span>₹{billData.adjusted_total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* NEW: Payments Summary */}
              {(billData.advance_paid > 0 || billData.payments.length > 0) && (
                <div className="p-3 border border-purple-200 rounded bg-purple-50">
                  <h4 className="mb-2 text-sm font-bold text-purple-800">ચુકવણી:</h4>
                  <div className="space-y-1 text-xs">
                    {billData.advance_paid > 0 && (
                      <div className="flex justify-between">
                        <span>અગાઉથી ચૂકવેલ / Advance Paid:</span>
                        <span className="font-bold text-purple-600">₹{billData.advance_paid.toFixed(2)}</span>
                      </div>
                    )}
                    {billData.payments.map((payment, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{payment.note}:</span>
                        <span className="font-bold text-purple-600">₹{payment.payment_amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <hr className="border-purple-300" />
                    <div className="flex justify-between text-base font-bold">
                      <span>કુલ ચુકવણી / Total Payments:</span>
                      <span className="text-purple-600">₹{(billData.advance_paid + billData.total_payments).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Due */}
              <div className={`p-3 border-2 rounded ${
                billData.final_due > 0 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-green-300 bg-green-50'
              }`}>
                <div className={`flex justify-between text-lg font-bold ${
                  billData.final_due > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  <span>અંતિમ બાકી / FINAL DUE:</span>
                  <span>₹{billData.final_due.toFixed(2)}</span>
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
                    એન્હાન્સ્ડ ગુજરાતી બિલ જનરેટ કરો
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