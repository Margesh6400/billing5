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
  Loader2
} from 'lucide-react';
import { SimpleBillingCalculator, SimpleBillData, ExtraCharge, Discount } from '../../utils/simpleBillingCalculator';
import { generateSimpleBillJPG, downloadSimpleBillJPG } from '../../utils/simpleBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function SimpleBillManagement() {
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
  const [ratePerDay, setRatePerDay] = useState(1.00);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  
  // Calculation results
  const [billData, setBillData] = useState<SimpleBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');

  const calculator = new SimpleBillingCalculator();

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

      const calculatedBill = calculator.calculateSimpleBilling(
        selectedClient,
        challans,
        returns,
        billDate,
        ratePerDay,
        extraCharges,
        discounts
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
      const jpgDataUrl = await generateSimpleBillJPG(billData, extraCharges, discounts);
      downloadSimpleBillJPG(jpgDataUrl, `bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setExtraCharges([]);
      setDiscounts([]);
      await generateBillNumber();
      
      alert('બિલ સફળતાપૂર્વક જનરેટ અને ડાઉનલોડ થયું!');
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('બિલ જનરેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setGenerating(false);
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
          <h1 className="mb-1 text-base font-bold text-gray-900">સિમ્પલ બિલિંગ</h1>
          <p className="text-xs text-blue-600">તારીખ આધારિત ભાડા ગણતરી</p>
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

                <div className="space-y-2 max-h-60 overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    શરૂઆતની તારીખ (વૈકલ્પિક)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    અંતિમ તારીખ (વૈકલ્પિક)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                  value={ratePerDay}
                  onChange={(e) => setRatePerDay(parseFloat(e.target.value) || 0)}
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

        {/* Extra Charges and Discounts */}
        {billData && (
          <div className="space-y-3">
            {/* Extra Charges */}
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
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={charge.description}
                      onChange={(e) => updateExtraCharge(index, 'description', e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="વર્ણન"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={charge.amount}
                      onChange={(e) => updateExtraCharge(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="રકમ"
                    />
                    <button
                      onClick={() => removeExtraCharge(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {extraCharges.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">કોઈ વધારાના ચાર્જ નથી</p>
                )}
              </div>
            </div>

            {/* Discounts */}
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
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={discount.description}
                      onChange={(e) => updateDiscount(index, 'description', e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="વર્ણન"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={discount.amount}
                      onChange={(e) => updateDiscount(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                      placeholder="રકમ"
                    />
                    <button
                      onClick={() => removeDiscount(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {discounts.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">કોઈ ડિસ્કાઉન્ટ નથી</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bill Preview */}
        {billData && (
          <div className="overflow-hidden bg-white border-2 border-purple-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <FileText className="w-4 h-4" />
                બિલ પ્રીવ્યૂ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 text-center bg-blue-50 border border-blue-200 rounded">
                  <div className="text-lg font-bold text-blue-700">{billData.total_days}</div>
                  <div className="text-xs text-blue-600">કુલ દિવસ</div>
                </div>
                <div className="p-2 text-center bg-green-50 border border-green-200 rounded">
                  <div className="text-lg font-bold text-green-700">
                    {Math.round(billData.total_plates / (billData.daily_balances.filter(d => d.days_count > 0).length || 1))}
                  </div>
                  <div className="text-xs text-green-600">સરેરાશ પ્લેટ</div>
                </div>
                <div className="p-2 text-center bg-purple-50 border border-purple-200 rounded">
                  <div className="text-lg font-bold text-purple-700">
                    ₹{billData.grand_total.toFixed(2)}
                  </div>
                  <div className="text-xs text-purple-600">કુલ રકમ</div>
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                      <th className="px-2 py-1 text-left">તારીખ</th>
                      <th className="px-2 py-1 text-center">પ્લેટ બેલેન્સ</th>
                      <th className="px-2 py-1 text-center">દિવસ ગણતરી</th>
                      <th className="px-2 py-1 text-center">રકમ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billData.daily_balances.map((day, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-2 py-1 font-medium">
                          {new Date(day.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-2 py-1 text-center font-bold text-blue-600">
                          {day.plate_balance}
                        </td>
                        <td className="px-2 py-1 text-center font-bold">
                          <span className={day.days_count === 0 ? 'text-gray-500' : 'text-green-600'}>
                            {day.days_count}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center font-bold">
                          <span className={day.amount === 0 ? 'text-gray-500' : 'text-purple-600'}>
                            ₹{day.amount.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Generate Bill Button */}
              <button
                onClick={handleGenerateBill}
                disabled={generating}
                className="flex items-center justify-center w-full gap-2 py-3 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    બિલ બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    બિલ જનરેટ કરો અને ડાઉનલોડ કરો
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="overflow-hidden bg-white border-2 border-gray-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-gray-500 to-gray-600">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <FileText className="w-4 h-4" />
              બિલિંગ નિયમો
            </h3>
          </div>
          
          <div className="p-3 space-y-2 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
              <p>દરેક નવી તારીખ = 1 પૂરો દિવસ ભાડો</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
              <p>પહેલી તારીખ ફ્રી (કોઈ ચાર્જ નહીં)</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></div>
              <p>ભાડો = પ્લેટ બેલેન્સ × દિવસ × દર</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}