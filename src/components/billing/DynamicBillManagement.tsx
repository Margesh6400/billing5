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
  ToggleLeft,
  ToggleRight,
  Percent,
  Hash,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { 
  DynamicBillingCalculator, 
  DynamicBillData, 
  ExtraCharge, 
  Discount, 
  ServiceChargeConfig 
} from '../../utils/dynamicBillingCalculator';
import { 
  generateDynamicBillJPG, 
  downloadDynamicBillJPG 
} from '../../utils/dynamicBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function DynamicBillManagement() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Billing parameters
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [perDayRate, setPerDayRate] = useState(1.00);
  const [serviceChargeConfig, setServiceChargeConfig] = useState<ServiceChargeConfig>({
    enabled: false,
    type: 'fixed',
    value: 0
  });
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  
  // Calculation results
  const [billData, setBillData] = useState<DynamicBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const calculator = new DynamicBillingCalculator();

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
      setBillNumber(Date.now().toString().slice(-4));
    }
  };

  const handleCalculateBill = async () => {
    if (!selectedClient) {
      alert('કૃપા કરીને ગ્રાહક પસંદ કરો.');
      return;
    }

    setCalculating(true);
    setValidationErrors([]);
    
    try {
      const { challans, returns } = await calculator.fetchClientTransactionData(
        selectedClient.id
      );

      const calculatedBill = calculator.calculateDynamicBill(
        selectedClient,
        challans,
        returns,
        billDate,
        perDayRate,
        serviceChargeConfig,
        extraCharges,
        discounts
      );

      calculatedBill.bill_number = billNumber;
      
      // Validate the calculated bill
      const validation = calculator.validateBillData(calculatedBill);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        alert('બિલ ગણતરીમાં ભૂલો છે. કૃપા કરીને તપાસો.');
        return;
      }

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
      const jpgDataUrl = await generateDynamicBillJPG(billData);
      downloadDynamicBillJPG(jpgDataUrl, `dynamic-bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setExtraCharges([]);
      setDiscounts([]);
      setServiceChargeConfig({ enabled: false, type: 'fixed', value: 0 });
      setValidationErrors([]);
      await generateBillNumber();
      
      alert('બિલ સફળતાપૂર્વક જનરેટ અને ડાઉનલોડ થયું!');
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('બિલ જનરેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setGenerating(false);
    }
  };

  // Extra charges management
  const addExtraCharge = () => {
    setExtraCharges([...extraCharges, { note: '', quantity: 1, rate: 0, total: 0 }]);
  };

  const updateExtraCharge = (index: number, field: keyof ExtraCharge, value: string | number) => {
    const updated = [...extraCharges];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total
    if (field === 'quantity' || field === 'rate') {
      updated[index].total = updated[index].quantity * updated[index].rate;
    }
    
    setExtraCharges(updated);
  };

  const removeExtraCharge = (index: number) => {
    setExtraCharges(extraCharges.filter((_, i) => i !== index));
  };

  // Discounts management
  const addDiscount = () => {
    setDiscounts([...discounts, { note: '', quantity: 1, rate: 0, total: 0 }]);
  };

  const updateDiscount = (index: number, field: keyof Discount, value: string | number) => {
    const updated = [...discounts];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total (negative for discounts)
    if (field === 'quantity' || field === 'rate') {
      updated[index].total = -(updated[index].quantity * updated[index].rate);
    }
    
    setDiscounts(updated);
  };

  const removeDiscount = (index: number) => {
    setDiscounts(discounts.filter((_, i) => i !== index));
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
          <h1 className="mb-1 text-base font-bold text-gray-900">ડાયનેમિક બિલિંગ સિસ્ટમ</h1>
          <p className="text-xs text-blue-600">ગુજરાતી ભાડા બિલ જનરેટર</p>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="overflow-hidden bg-white border-2 border-red-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-red-500 to-red-600">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <AlertTriangle className="w-4 h-4" />
                ભૂલો
              </h3>
            </div>
            <div className="p-3">
              {validationErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600">• {error}</p>
              ))}
            </div>
          </div>
        )}

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
                બિલ મેટાડેટા
              </h2>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    બિલ નંબર (ઓટો)
                  </label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="25"
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
                  દર પ્રતિ પ્લેટ પ્રતિ દિવસ (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={perDayRate}
                  onChange={(e) => setPerDayRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  placeholder="1.00"
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

        {/* Service Charge Configuration */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-purple-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <DollarSign className="w-4 h-4" />
                  સેવા ચાર્જ
                </h3>
                <button
                  onClick={() => setServiceChargeConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className="flex items-center gap-1 text-white"
                >
                  {serviceChargeConfig.enabled ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  <span className="text-xs">{serviceChargeConfig.enabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
            
            {serviceChargeConfig.enabled && (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">
                      પ્રકાર
                    </label>
                    <select
                      value={serviceChargeConfig.type}
                      onChange={(e) => setServiceChargeConfig(prev => ({ 
                        ...prev, 
                        type: e.target.value as 'percentage' | 'fixed' 
                      }))}
                      className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                    >
                      <option value="fixed">નિશ્ચિત રકમ</option>
                      <option value="percentage">ટકાવારી</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">
                      {serviceChargeConfig.type === 'percentage' ? 'ટકાવારી (%)' : 'રકમ (₹)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={serviceChargeConfig.value}
                        onChange={(e) => setServiceChargeConfig(prev => ({ 
                          ...prev, 
                          value: parseFloat(e.target.value) || 0 
                        }))}
                        className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                        placeholder={serviceChargeConfig.type === 'percentage' ? '10' : '100'}
                      />
                      {serviceChargeConfig.type === 'percentage' && (
                        <Percent className="absolute w-4 h-4 text-purple-400 transform -translate-y-1/2 right-3 top-1/2" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extra Charges */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-yellow-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Plus className="w-4 h-4" />
                  વધારાના ચાર્જ
                </h3>
                <button
                  onClick={addExtraCharge}
                  className="p-1 text-white rounded hover:bg-yellow-400/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {extraCharges.map((charge, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 p-2 border border-yellow-200 rounded bg-yellow-50">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={charge.note}
                      onChange={(e) => updateExtraCharge(index, 'note', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="નોટ: મજૂરી"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={charge.quantity}
                      onChange={(e) => updateExtraCharge(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="સંખ્યા"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={charge.rate}
                      onChange={(e) => updateExtraCharge(index, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="દર"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="px-2 py-1 text-xs font-bold text-center text-yellow-700 bg-yellow-100 border border-yellow-300 rounded">
                      ₹{charge.total.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeExtraCharge(index)}
                      className="w-full p-1 text-red-600 rounded hover:bg-red-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {extraCharges.length === 0 && (
                <p className="py-2 text-xs text-center text-gray-500">કોઈ વધારાના ચાર્જ નથી</p>
              )}
            </div>
          </div>
        )}

        {/* Discounts */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-green-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Minus className="w-4 h-4" />
                  ડિસ્કાઉન્ટ
                </h3>
                <button
                  onClick={addDiscount}
                  className="p-1 text-white rounded hover:bg-green-400/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {discounts.map((discount, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 p-2 border border-green-200 rounded bg-green-50">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={discount.note}
                      onChange={(e) => updateDiscount(index, 'note', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="નોટ: એડવાન્સ ડિસ્કાઉન્ટ"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={discount.quantity}
                      onChange={(e) => updateDiscount(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="સંખ્યા"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount.rate}
                      onChange={(e) => updateDiscount(index, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="દર"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="px-2 py-1 text-xs font-bold text-center text-green-700 bg-green-100 border border-green-300 rounded">
                      -₹{Math.abs(discount.total).toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeDiscount(index)}
                      className="w-full p-1 text-red-600 rounded hover:bg-red-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {discounts.length === 0 && (
                <p className="py-2 text-xs text-center text-gray-500">કોઈ ડિસ્કાઉન્ટ નથી</p>
              )}
            </div>
          </div>
        )}

        {/* Bill Preview */}
        {billData && (
          <div className="overflow-hidden bg-white border-2 border-indigo-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <FileText className="w-4 h-4" />
                બિલ પ્રીવ્યૂ - ગુજરાતી ફોર્મેટ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {/* Ledger Table with પ્લેટ્સ Column */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-purple-500 to-violet-500">
                      <th className="px-2 py-1 text-left">તારીખ</th>
                      <th className="px-2 py-1 text-center">પ્લેટ્સ</th>
                      <th className="px-2 py-1 text-center">ઉધાર</th>
                      <th className="px-2 py-1 text-center">જમા</th>
                      <th className="px-2 py-1 text-center">બાકી પ્લેટ્સ</th>
                      <th className="px-2 py-1 text-center">દિવસ</th>
                      <th className="px-2 py-1 text-center">ભાડું</th>
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
                        <td className="px-2 py-1 font-bold text-center text-gray-600">
                          {entry.plates_before}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-red-600">
                          {entry.udhar > 0 ? entry.udhar : '-'}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-green-600">
                          {entry.jama > 0 ? entry.jama : '-'}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-blue-600">
                          {entry.balance_after}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-purple-600">
                          {entry.days}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-orange-600">
                          ₹{entry.rent_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Date Range Summary */}
              <div className="p-3 border border-indigo-200 rounded bg-indigo-50">
                <h4 className="mb-2 text-sm font-bold text-indigo-800">તારીખ શ્રેણી સારાંશ:</h4>
                <div className="space-y-1 text-xs">
                  {billData.date_ranges.map((range, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{range.date_range_display}</span>
                      <span className="font-bold">{range.plate_balance} પ્લેટ્સ × {range.days} દિવસ = ₹{range.rent_amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Summary */}
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>કુલ ભાડું / Total Rent:</span>
                    <span className="font-bold">₹{billData.total_rent.toFixed(2)}</span>
                  </div>
                  
                  {billData.service_charge_config.enabled && (
                    <div className="flex justify-between">
                      <span>સેવા ચાર્જ / Service Charge:</span>
                      <span className="font-bold">₹{billData.service_charge_amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {billData.extra_charges.map((charge, index) => (
                    <div key={index} className="flex justify-between text-yellow-700">
                      <span>{charge.note}:</span>
                      <span className="font-bold">₹{charge.total.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  {billData.discounts.map((discount, index) => (
                    <div key={index} className="flex justify-between text-green-700">
                      <span>{discount.note}:</span>
                      <span className="font-bold">-₹{Math.abs(discount.total).toFixed(2)}</span>
                    </div>
                  ))}
                  
                  <hr className="border-gray-300" />
                  <div className="flex justify-between text-lg font-bold text-indigo-600">
                    <span>કુલ ચૂકવણી / Final Payment:</span>
                    <span>₹{billData.final_payment.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Generate Bill Button */}
              <button
                onClick={handleGenerateBill}
                disabled={generating}
                className="flex items-center justify-center w-full gap-2 py-3 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    બિલ બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    ડાયનેમિક બિલ જનરેટ કરો
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