import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { 
  Calculator, 
  Download, 
  Search, 
  User, 
  Plus,
  Minus,
  FileText,
  Lock,
  Settings,
  Loader2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { AdvancedBillingCalculator, AdvancedBillData, BillAdjustment } from '../../utils/advancedBillingCalculator';
import { generateAdvancedBillJPG, downloadAdvancedBillJPG } from '../../utils/advancedBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function AdvancedBillManagement() {
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
  const [ratePerDay, setRatePerDay] = useState(2.00);
  const [adjustments, setAdjustments] = useState<BillAdjustment[]>([]);
  
  // Calculation results
  const [billData, setBillData] = useState<AdvancedBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');

  const calculator = new AdvancedBillingCalculator();

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
      const { challans, returns } = await calculator.fetchClientTransactions(
        selectedClient.id,
        startDate || undefined,
        endDate || billDate
      );

      const calculatedBill = calculator.calculateDateRangeBilling(
        selectedClient,
        challans,
        returns,
        billDate,
        ratePerDay,
        adjustments
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
      const jpgDataUrl = await generateAdvancedBillJPG(billData, adjustments);
      downloadAdvancedBillJPG(jpgDataUrl, `advanced-bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setAdjustments([]);
      await generateBillNumber();
      
      alert('બિલ સફળતાપૂર્વક જનરેટ અને ડાઉનલોડ થયું!');
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('બિલ જનરેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setGenerating(false);
    }
  };

  const addAdjustment = (type: 'charge' | 'discount') => {
    setAdjustments([...adjustments, { description: '', amount: 0, type }]);
  };

  const updateAdjustment = (index: number, field: keyof BillAdjustment, value: string | number) => {
    const updated = [...adjustments];
    updated[index] = { ...updated[index], [field]: value };
    setAdjustments(updated);
  };

  const removeAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index));
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
                    અંતિમ તારીખ (વૈકલ્પિક)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
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
                    placeholder="2.00"
                />
              </div>
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
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 text-center border border-blue-200 rounded bg-blue-50">
                  <div className="text-lg font-bold text-blue-700">{billData.total_days}</div>
                  <div className="text-xs text-blue-600">કુલ દિવસ</div>
                </div>
                <div className="p-2 text-center border border-green-200 rounded bg-green-50">
                  <div className="text-lg font-bold text-green-700">{billData.date_ranges.length}</div>
                  <div className="text-xs text-green-600">રેન્જ</div>
                </div>
                <div className="p-2 text-center border border-yellow-200 rounded bg-yellow-50">
                  <div className="text-lg font-bold text-yellow-700">{billData.total_plate_days}</div>
                  <div className="text-xs text-yellow-600">પ્લેટ-દિવસ</div>
                </div>
                <div className="p-2 text-center border border-purple-200 rounded bg-purple-50">
                  <div className="text-lg font-bold text-purple-700">
                    ₹{billData.grand_total.toFixed(2)}
                  </div>
                  <div className="text-xs text-purple-600">કુલ રકમ</div>
                </div>
              </div>

              {/* Date Range Breakdown */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                      <th className="px-2 py-1 text-left">તારીખ શ્રેણી</th>
                      <th className="px-2 py-1 text-center">પ્લેટ બેલેન્સ</th>
                      <th className="px-2 py-1 text-center">દિવસ</th>
                      <th className="px-2 py-1 text-center">દર</th>
                      <th className="px-2 py-1 text-center">રકમ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billData.date_ranges.map((range, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-2 py-1 font-medium">
                          {range.start_date === range.end_date 
                            ? new Date(range.start_date).toLocaleDateString('en-GB')
                            : `${new Date(range.start_date).toLocaleDateString('en-GB')} - ${new Date(range.end_date).toLocaleDateString('en-GB')}`
                          }
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-blue-600">
                          {range.plate_balance}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-green-600">
                          {range.days}
                        </td>
                        <td className="px-2 py-1 text-center">
                          ₹{range.rate_per_day.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-purple-600">
                          ₹{range.amount.toFixed(2)}
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

        {/* Adjustments */}
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
                    onClick={() => addAdjustment('charge')}
                    className="p-1 text-white rounded hover:bg-yellow-400/20"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-3 space-y-2">
                {adjustments.filter(adj => adj.type === 'charge').map((charge, index) => {
                  const chargeIndex = adjustments.findIndex(adj => adj === charge);
                  return (
                    <div key={chargeIndex} className="flex gap-2">
                      <input
                        type="text"
                        value={charge.description}
                        onChange={(e) => updateAdjustment(chargeIndex, 'description', e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        placeholder="વર્ણન"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={charge.amount}
                        onChange={(e) => updateAdjustment(chargeIndex, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                        placeholder="રકમ"
                      />
                      <button
                        onClick={() => removeAdjustment(chargeIndex)}
                        className="p-1 text-red-600 rounded hover:bg-red-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {adjustments.filter(adj => adj.type === 'charge').length === 0 && (
                  <p className="py-2 text-xs text-center text-gray-500">કોઈ વધારાના ચાર્જ નથી</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}