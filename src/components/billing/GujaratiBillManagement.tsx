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
  FileText,
  BookOpen
} from 'lucide-react';
import { 
  GujaratiBillingCalculator, 
  GujaratiBillData, 
  BillingRates 
} from '../../utils/gujaratiBillingCalculator';
import { 
  generateGujaratiBillJPG, 
  downloadGujaratiBillJPG 
} from '../../utils/gujaratiBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function GujaratiBillManagement() {
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
  
  // Calculation results
  const [billData, setBillData] = useState<GujaratiBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');

  const calculator = new GujaratiBillingCalculator(rates);

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

      const calculatedBill = calculator.calculateGujaratiBill(
        selectedClient,
        challans,
        returns,
        billDate,
        rates,
        advancePaid
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
      const jpgDataUrl = await generateGujaratiBillJPG(billData);
      downloadGujaratiBillJPG(jpgDataUrl, `gujarati-bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setAdvancePaid(0);
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
          <h1 className="mb-1 text-base font-bold text-gray-900">ગુજરાતી બિલિંગ સિસ્ટમ</h1>
          <p className="text-xs text-blue-600">ચલણ આધારિત ભાડા બિલ</p>
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

        {/* Bill Preview */}
        {billData && (
          <div className="overflow-hidden bg-white border-2 border-green-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <BookOpen className="w-4 h-4" />
                બિલ પ્રીવ્યૂ - ગુજરાતી ફોર્મેટ
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              {/* Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                      <th className="px-2 py-1 text-left">તારીખ</th>
                      <th className="px-2 py-1 text-center">પ્લેટ્સ</th>
                      <th className="px-2 py-1 text-center">ઉધાર</th>
                      <th className="px-2 py-1 text-center">જમા</th>
                      <th className="px-2 py-1 text-center">બાકી પ્લેટ્સ</th>
                      <th className="px-2 py-1 text-center">દિવસ</th>
                      <th className="px-2 py-1 text-center">ભાડું</th>
                      <th className="px-2 py-1 text-left">ચલણ નં.</th>
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
                        <td className="px-2 py-1 text-xs text-gray-500">
                          #{entry.challan_number}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Charges Summary */}
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <div className="space-y-2 text-xs">
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
                  <div className="flex justify-between text-lg font-bold">
                    <span>કુલ રકમ / Grand Total:</span>
                    <span>₹{billData.grand_total.toFixed(2)}</span>
                  </div>
                  {billData.advance_paid > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>અગાઉથી ચૂકવેલ / Advance Paid:</span>
                      <span className="font-bold">-₹{billData.advance_paid.toFixed(2)}</span>
                    </div>
                  )}
                  <hr className="border-gray-300" />
                  <div className={`flex justify-between text-xl font-bold ${billData.final_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span>અંતિમ બાકી / FINAL DUE:</span>
                    <span>₹{billData.final_due.toFixed(2)}</span>
                  </div>
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
                    ગુજરાતી બિલ જનરેટ કરો
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

              <div className="p-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded">
                <strong>નિયમો:</strong> ઉધાર = તે જ દિવસે અસરકારક | જમા = આગલા દિવસે અસરકારક | પ્રથમ ઉધાર = દિવસ 1
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}