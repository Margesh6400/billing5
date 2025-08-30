import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { BillGenerator } from './BillGenerator';
import { BillViewer } from './BillViewer';
import { 
  Receipt, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  Download, 
  Plus, 
  Lock,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'] & {
  clients: Client;
};

type ViewMode = 'list' | 'generate' | 'view';

export function BillManagement() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.clients.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bill.clients.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || bill.payment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bill Management</h1>
          <p className="text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  // Generate Bill View
  if (viewMode === 'generate' && selectedClient) {
    return (
      <BillGenerator
        client={selectedClient}
        onBillGenerated={() => {
          setViewMode('list');
          setSelectedClient(null);
          fetchData();
        }}
        onCancel={() => {
          setViewMode('list');
          setSelectedClient(null);
        }}
      />
    );
  }

  // View Bill View
  if (viewMode === 'view' && selectedBill) {
    return (
      <BillViewer
        bill={selectedBill}
        onBack={() => {
          setViewMode('list');
          setSelectedBill(null);
        }}
      />
    );
  }

  // Main List View
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bill Management</h1>
        <p className="text-gray-600">Generate and manage client bills</p>
      </div>

      {/* Generate New Bill */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Generate New Bill
          </h2>
          {!user?.isAdmin && (
            <div className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 justify-center">
              <Lock className="w-4 h-4" />
              View Only
            </div>
          )}
        </div>

        {user?.isAdmin && (
          <div>
            <div className="mb-4">
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
            </div>
            
            {searchTerm && (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setViewMode('generate');
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
          </div>
        )}
      </div>

      {/* Bills List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            All Bills
          </h2>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="Search bills by client name, ID, or bill number..."
            />
          </div>
        </div>
        
        <div className="space-y-4">
          {filteredBills.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No bills found</p>
              {searchTerm && (
                <p className="text-sm mt-1">Try adjusting your search terms</p>
              )}
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
                    
                    <button
                      onClick={() => {
                        setSelectedBill(bill);
                        setViewMode('view');
                      }}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View & Print
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <Receipt className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pending Bills</p>
              <p className="text-2xl font-bold text-gray-900">
                {bills.filter(b => b.payment_status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Paid Bills</p>
              <p className="text-2xl font-bold text-gray-900">
                {bills.filter(b => b.payment_status === 'paid').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{bills.filter(b => b.payment_status !== 'paid').reduce((sum, b) => sum + b.net_due, 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}