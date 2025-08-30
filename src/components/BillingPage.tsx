import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Receipt, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  Download, 
  Plus, 
  Lock,
  Calculator,
  FileText,
  CreditCard,
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

export function BillingPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Billing form state
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

      // Save billing periods
      if (billingPreview.billing_periods.length > 0) {
        const periodInserts = billingPreview.billing_periods.map(period => ({
          bill_id: bill.id,
          period_start: period.from_date,
          period_end: period.to_date,
          days_count: period.days,
          running_stock: period.running_stock,
          daily_rate: period.daily_rate,
          period_charge: period.charge
        }));

        const { error: periodsError } = await supabase
          .from('bill_periods')
          .insert(periodInserts);

        if (periodsError) throw periodsError;
      }

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
      setBillingForm({
        end_date: new Date().toISOString().split('T')[0],
        daily_rate: 1.00,
        service_rate: 0.50
      });

      alert(`Bill ${billNumber} generated successfully!`);
      await fetchData();
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('Error generating bill. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const updatePaymentStatus = async (billId: string, status: string) => {
    if (!user?.isAdmin) return;

    try {
      const { error } = await supabase
        .from('bills')
        .update({ payment_status: status })
        .eq('id', billId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error updating payment status.');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBills = bills.filter(bill =>
    bill.clients.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.clients.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'partial':
        return <Clock className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing Management</h1>
          <p className="text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing Management</h1>
        <p className="text-gray-600">Generate bills and manage client payments</p>
      </div>

      {/* Create New Bill */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Generate New Bill
          </h2>
          {user?.isAdmin ? (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 justify-center"
            >
              <Plus className="w-4 h-4" />
              New Bill
            </button>
          ) : (
            <div className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 justify-center">
              <Lock className="w-4 h-4" />
              View Only
            </div>
          )}
        </div>

        {showCreateForm && user?.isAdmin && (
          <div className="space-y-6">
            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Search clients..."
                />
              </div>
              
              {searchTerm && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client);
                        setSearchTerm('');
                      }}
                      className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                    >
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-600">ID: {client.id} | {client.site}</p>
                    </button>
                  ))}
                </div>
              )}
              
              {selectedClient && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-blue-900">{selectedClient.name}</p>
                  <p className="text-sm text-blue-700">ID: {selectedClient.id} | {selectedClient.site}</p>
                </div>
              )}
            </div>

            {/* Billing Parameters */}
            {selectedClient && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing End Date
                  </label>
                  <input
                    type="date"
                    value={billingForm.end_date}
                    onChange={(e) => setBillingForm({ ...billingForm, end_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingForm.daily_rate}
                    onChange={(e) => setBillingForm({ ...billingForm, daily_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="1.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingForm.service_rate}
                    onChange={(e) => setBillingForm({ ...billingForm, service_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="0.50"
                    required
                  />
                </div>
              </div>
            )}

            {/* Calculate Button */}
            {selectedClient && (
              <div className="flex gap-3">
                <button
                  onClick={handleCalculateBilling}
                  disabled={calculating}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-base font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {calculating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Calculate Bill
                    </>
                  )}
                </button>
                
                {billingPreview && (
                  <button
                    onClick={handleGenerateBill}
                    disabled={generating}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-base font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Generate Bill
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Billing Preview */}
            {billingPreview && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Preview</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Period Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Period:</span>
                        <span className="font-medium">
                          {format(new Date(billingPreview.period_start), 'dd/MM/yyyy')} - 
                          {format(new Date(billingPreview.period_end), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Udhar Quantity:</span>
                        <span className="font-medium">{billingPreview.total_udhar_quantity} plates</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Billing Periods:</span>
                        <span className="font-medium">{billingPreview.billing_periods.length}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Amount Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Period Charges:</span>
                        <span className="font-medium">₹{billingPreview.period_charges.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Service Charge:</span>
                        <span className="font-medium">₹{billingPreview.service_charge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Previous Payments:</span>
                        <span className="font-medium text-green-600">-₹{billingPreview.previous_payments.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Net Due:</span>
                        <span className="font-bold text-lg text-red-600">₹{billingPreview.net_due.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing Periods Detail */}
                {billingPreview.billing_periods.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-700 mb-3">Billing Periods Detail</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200 rounded-lg">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">From</th>
                            <th className="px-3 py-2 text-left">To</th>
                            <th className="px-3 py-2 text-center">Days</th>
                            <th className="px-3 py-2 text-center">Stock</th>
                            <th className="px-3 py-2 text-right">Charge</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingPreview.billing_periods.map((period, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-3 py-2">{format(new Date(period.from_date), 'dd/MM/yyyy')}</td>
                              <td className="px-3 py-2">{format(new Date(period.to_date), 'dd/MM/yyyy')}</td>
                              <td className="px-3 py-2 text-center">{period.days}</td>
                              <td className="px-3 py-2 text-center">{period.running_stock}</td>
                              <td className="px-3 py-2 text-right">₹{period.charge.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bills List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-blue-600" />
          All Bills
        </h2>
        
        <div className="space-y-4">
          {filteredBills.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No bills found</p>
            </div>
          ) : (
            filteredBills.map((bill) => (
              <div key={bill.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <Receipt className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{bill.clients.name}</h3>
                      <p className="text-sm text-gray-600">Bill: {bill.bill_number}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(bill.billing_period_start), 'dd/MM/yyyy')} - 
                          {format(new Date(bill.billing_period_end), 'dd/MM/yyyy')}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <DollarSign className="w-4 h-4" />
                          ₹{bill.total_amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {user?.isAdmin ? (
                      <select
                        value={bill.payment_status}
                        onChange={(e) => updatePaymentStatus(bill.id, e.target.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${getStatusColor(bill.payment_status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${getStatusColor(bill.payment_status)}`}>
                        {getStatusIcon(bill.payment_status)}
                        {bill.payment_status.charAt(0).toUpperCase() + bill.payment_status.slice(1)}
                      </span>
                    )}
                    
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
                
                {/* Bill Summary */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Period Charges:</span>
                      <p className="font-medium">₹{bill.period_charges.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Service Charge:</span>
                      <p className="font-medium">₹{bill.service_charge.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Previous Payments:</span>
                      <p className="font-medium text-green-600">₹{bill.previous_payments.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Net Due:</span>
                      <p className="font-bold text-red-600">₹{bill.net_due.toFixed(2)}</p>
                    </div>
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