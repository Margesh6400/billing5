import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Receipt, 
  Search, 
  User, 
  Calculator,
  Download,
  Plus,
  Lock,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { BillingCalculator, BillingCalculation } from '../utils/billingCalculator';
import { generateBillJPG, downloadBillJPG, BillData } from '../utils/billJPGGenerator';
import { format } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'] & {
  clients: Client;
};

export function MobileBillingPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [billingForm, setBillingForm] = useState({
    end_date: new Date().toISOString().split('T')[0],
    daily_rate: 1.00,
    service_rate: 0.50
  });
  
  const [billingPreview, setBillingPreview] = useState<BillingCalculation | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsResult, billsResult] = await Promise.all([
        supabase.from('clients').select('*').order('id'),
        supabase.from('bills').select(`
          *,
          clients (*)
        `).order('generated_at', { ascending: false })
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (billsResult.error) throw billsResult.error;

      setClients(clientsResult.data || []);
      setBills(billsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateBilling = async () => {
    if (!selectedClient) return;

    setCalculating(true);
    try {
      const calculator = new BillingCalculator(billingForm.daily_rate, billingForm.service_rate);
      const calculation = await calculator.calculateClientBilling(
        selectedClient.id,
        billingForm.end_date,
        billingForm.daily_rate,
        billingForm.service_rate
      );
      
      setBillingPreview(calculation);
    } catch (error) {
      console.error('Error calculating billing:', error);
      alert('Error calculating billing. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateBill = async () => {
    if (!billingPreview || !selectedClient) return;

    setGenerating(true);
    try {
      const calculator = new BillingCalculator();
      const billNumber = await calculator.generateNextBillNumber();

      // Save bill to database
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNumber,
          client_id: selectedClient.id,
          billing_period_start: billingPreview.period_start,
          billing_period_end: billingPreview.period_end,
          total_udhar_quantity: billingPreview.total_udhar_quantity,
          service_charge: billingPreview.service_charge,
          period_charges: billingPreview.period_charges,
          total_amount: billingPreview.total_amount,
          previous_payments: billingPreview.previous_payments,
          net_due: billingPreview.net_due,
          daily_rate: billingForm.daily_rate,
          service_rate: billingForm.service_rate,
          payment_status: billingPreview.net_due <= 0 ? 'paid' : 'pending'
        }])
        .select()
        .single();

      if (billError) throw billError;

      // Generate and download JPG
      const billData: BillData = {
        bill_number: billNumber,
        client: {
          id: selectedClient.id,
          name: selectedClient.name,
          site: selectedClient.site || '',
          mobile: selectedClient.mobile_number || ''
        },
        bill_date: new Date().toISOString().split('T')[0],
        period_start: billingPreview.period_start,
        period_end: billingPreview.period_end,
        billing_periods: billingPreview.billing_periods,
        total_udhar_quantity: billingPreview.total_udhar_quantity,
        service_charge: billingPreview.service_charge,
        period_charges: billingPreview.period_charges,
        total_amount: billingPreview.total_amount,
        previous_payments: billingPreview.previous_payments,
        net_due: billingPreview.net_due,
        daily_rate: billingForm.daily_rate,
        service_rate: billingForm.service_rate
      };

      const jpgDataUrl = await generateBillJPG(billData);
      downloadBillJPG(jpgDataUrl, `bill-${billNumber}-${selectedClient.name.replace(/\s+/g, '-')}`);

      // Reset form
      setSelectedClient(null);
      setBillingPreview(null);
      setShowCreateForm(false);

      alert(`Bill ${billNumber} generated successfully!`);
      await fetchData();
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('Error generating bill. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-3 h-3" />;
      case 'partial':
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'overdue':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Receipt className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <div className="w-32 h-5 mx-auto mb-1 bg-blue-200 rounded animate-pulse"></div>
            <div className="w-40 h-3 mx-auto bg-blue-200 rounded animate-pulse"></div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
              <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
              <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-green-600 to-blue-600">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલિંગ</h1>
          <p className="text-xs text-gray-600">બિલ બનાવો અને પેમેન્ટ મેનેજ કરો</p>
        </div>

        {/* Create Bill Form */}
        <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Calculator className="w-4 h-4" />
                નવું બિલ બનાવો
              </h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showCreateForm && (
            <div className="p-3 space-y-3">
              {/* Client Selection */}
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  ગ્રાહક પસંદ કરો
                </label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                    placeholder="ગ્રાહક શોધો..."
                  />
                </div>
                
                {searchTerm && (
                  <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                    {clients.filter(client =>
                      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      client.id.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client);
                          setSearchTerm('');
                        }}
                        className="w-full text-left p-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <p className="text-xs font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-600">ID: {client.id}</p>
                      </button>
                    ))}
                  </div>
                )}
                
                {selectedClient && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900">{selectedClient.name}</p>
                    <p className="text-xs text-blue-700">ID: {selectedClient.id}</p>
                  </div>
                )}
              </div>

              {/* Billing Parameters */}
              {selectedClient && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">
                      અંતિમ તારીખ
                    </label>
                    <input
                      type="date"
                      value={billingForm.end_date}
                      onChange={(e) => setBillingForm({ ...billingForm, end_date: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">
                      દૈનિક દર (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={billingForm.daily_rate}
                      onChange={(e) => setBillingForm({ ...billingForm, daily_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                      placeholder="1.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">
                      સર્વિસ દર (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={billingForm.service_rate}
                      onChange={(e) => setBillingForm({ ...billingForm, service_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                      placeholder="0.50"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedClient && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCalculateBilling}
                    disabled={calculating}
                    className="flex-1 py-2 text-xs font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {calculating ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin" />
                        ગણતરી...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-3 h-3" />
                        ગણતરી કરો
                      </>
                    )}
                  </button>
                  
                  {billingPreview && (
                    <button
                      onClick={handleGenerateBill}
                      disabled={generating}
                      className="flex-1 py-2 text-xs font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {generating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin" />
                          બનાવી રહ્યા છીએ...
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          બિલ બનાવો
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Billing Preview */}
              {billingPreview && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="text-xs font-semibold text-gray-900 mb-2">બિલ પ્રીવ્યૂ</h3>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>પીરિયડ ચાર્જ:</span>
                        <span className="font-medium">₹{billingPreview.period_charges.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>સર્વિસ ચાર્જ:</span>
                        <span className="font-medium">₹{billingPreview.service_charge.toFixed(2)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>કુલ રકમ:</span>
                        <span className="font-medium">₹{billingPreview.total_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold">બાકી રકમ:</span>
                        <span className="font-bold text-red-600">₹{billingPreview.net_due.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bills List */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900">
            <Receipt className="w-4 h-4 text-blue-600" />
            બધા બિલ
          </h2>
          
          {bills.length === 0 ? (
            <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-200 to-purple-200">
                <Receipt className="w-8 h-8 text-blue-400" />
              </div>
              <p className="mb-1 font-medium text-gray-700">કોઈ બિલ મળ્યું નથી</p>
              <p className="text-xs text-blue-600">નવા બિલ બનાવવાનું શરૂ કરો</p>
            </div>
          ) : (
            bills.map((bill) => (
              <div key={bill.id} className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Receipt className="w-4 h-4" />
                      {bill.bill_number}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(bill.payment_status)}`}>
                      {getStatusIcon(bill.payment_status)}
                      {bill.payment_status}
                    </span>
                  </div>
                </div>
                
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <User className="w-3 h-3" />
                    <span className="font-medium">{bill.clients.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {format(new Date(bill.billing_period_start), 'dd/MM/yyyy')} - 
                      {format(new Date(bill.billing_period_end), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-blue-600">
                      <DollarSign className="w-3 h-3" />
                      <span>Net Due: ₹{bill.net_due.toFixed(2)}</span>
                    </div>
                    <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}