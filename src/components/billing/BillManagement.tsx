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
  Calculator,
  Download,
  Plus,
  Lock,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Trash2,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'] & {
  clients: Client;
};

export function BillManagement() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchBills();
    fetchClients();
  }, []);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          clients (*)
        `)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleGenerateBill = (client: Client) => {
    setSelectedClient(client);
    setShowGenerator(true);
  };

  const handleViewBill = (bill: Bill) => {
    setSelectedBill(bill);
    setShowViewer(true);
  };

  const handleDeleteBill = async (billId: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;

    try {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId);

      if (error) throw error;
      
      await fetchBills();
      alert('Bill deleted successfully!');
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Error deleting bill. Please try again.');
    }
  };

  const updatePaymentStatus = async (billId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ payment_status: status })
        .eq('id', billId);

      if (error) throw error;
      
      await fetchBills();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error updating payment status. Please try again.');
    }
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = !searchTerm || (
      bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.clients.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.clients.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesStatus = statusFilter === 'all' || bill.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4" />;
      case 'partial': return <DollarSign className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (showGenerator && selectedClient) {
    return (
      <BillGenerator
        client={selectedClient}
        onBillGenerated={() => {
          setShowGenerator(false);
          setSelectedClient(null);
          fetchBills();
        }}
        onCancel={() => {
          setShowGenerator(false);
          setSelectedClient(null);
        }}
      />
    );
  }

  if (showViewer && selectedBill) {
    return (
      <BillViewer
        bill={selectedBill}
        onBack={() => {
          setShowViewer(false);
          setSelectedBill(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <div className="w-32 h-5 mx-auto mb-1 bg-blue-200 rounded animate-pulse"></div>
            <div className="w-40 h-3 mx-auto bg-blue-200 rounded animate-pulse"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
              <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
              <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
            </div>
          ))}
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
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલ વ્યવસ્થાપન</h1>
          <p className="text-xs text-blue-600">બિલ બનાવો અને મેનેજ કરો</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Search className="w-4 h-4" />
              શોધો અને ફિલ્ટર કરો
            </h2>
          </div>
          
          <div className="p-3 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute w-4 h-4 text-blue-400 transform -translate-y-1/2 left-3 top-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-10 pr-3 text-sm transition-all duration-200 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="બિલ નંબર, ગ્રાહક નામ અથવા ID શોધો..."
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 py-2 px-3 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              >
                <option value="all">બધી સ્થિતિ</option>
                <option value="pending">બાકી</option>
                <option value="paid">ચૂકવેલ</option>
                <option value="overdue">મુદત વીતી</option>
                <option value="partial">આંશિક</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 text-center bg-white border border-blue-200 rounded-xl">
            <div className="text-lg font-bold text-blue-700">{bills.length}</div>
            <div className="text-xs font-medium text-blue-600">કુલ બિલ</div>
          </div>
          <div className="p-3 text-center bg-white border border-green-200 rounded-xl">
            <div className="text-lg font-bold text-green-700">
              ₹{bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0).toFixed(0)}
            </div>
            <div className="text-xs font-medium text-green-600">કુલ રકમ</div>
          </div>
        </div>

        {/* Client Selection for New Bills */}
        {user?.isAdmin && (
          <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Plus className="w-4 h-4" />
                નવું બિલ બનાવો
              </h2>
            </div>
            
            <div className="p-3">
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleGenerateBill(client)}
                    className="w-full p-2 text-xs text-left transition-all bg-white border border-gray-200 rounded shadow-sm hover:border-green-300 hover:bg-green-50 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-gradient-to-r from-green-400 to-emerald-500">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-xs text-gray-600">ID: {client.id} | {client.site}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bills List */}
        <div className="space-y-3">
          {filteredBills.length === 0 ? (
            <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                <Receipt className="w-8 h-8 text-blue-400" />
              </div>
              <p className="mb-1 font-medium text-gray-700">
                {searchTerm || statusFilter !== 'all' ? 'કોઈ બિલ મળ્યું નથી' : 'હજુ સુધી કોઈ બિલ બનાવવામાં આવ્યું નથી'}
              </p>
              <p className="text-xs text-blue-600">
                {searchTerm || statusFilter !== 'all' ? 'ફિલ્ટર બદલીને પ્રયત્ન કરો' : 'નવા બિલ બનાવવાનું શરૂ કરો'}
              </p>
            </div>
          ) : (
            filteredBills.map((bill) => (
              <div key={bill.id} className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Receipt className="w-4 h-4" />
                      બિલ #{bill.bill_number}
                    </h3>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(bill.payment_status)}`}>
                      {getStatusIcon(bill.payment_status)}
                      {bill.payment_status === 'paid' ? 'ચૂકવેલ' : 
                       bill.payment_status === 'pending' ? 'બાકી' :
                       bill.payment_status === 'overdue' ? 'મુદત વીતી' : 'આંશિક'}
                    </div>
                  </div>
                </div>
                
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <User className="w-4 h-4 text-blue-600" />
                        {bill.clients.name}
                      </div>
                      <div className="text-xs text-gray-600">ID: {bill.clients.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ₹{(bill.total_amount || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {format(new Date(bill.generated_at), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewBill(bill)}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-3 h-3" />
                        જુઓ
                      </button>
                      
                      {user?.isAdmin && (
                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          ડિલીટ
                        </button>
                      )}
                    </div>

                    {user?.isAdmin && bill.payment_status !== 'paid' && (
                      <button
                        onClick={() => updatePaymentStatus(bill.id, 'paid')}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-600 border border-green-200 rounded hover:bg-green-50"
                      >
                        <CheckCircle className="w-3 h-3" />
                        ચૂકવેલ તરીકે માર્ક કરો
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Access Denied for Non-Admin Users */}
        {!user?.isAdmin && (
          <div className="p-6 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-700">View-Only Access</h3>
            <p className="mb-3 text-sm text-gray-500">
              તમારી પાસે માત્ર જોવાની પરવાનગી છે. નવા બિલ બનાવવા માટે Admin સાથે સંપર્ક કરો.
            </p>
            <p className="text-xs text-blue-600">
              Admin: nilkanthplatdepo@gmail.com
            </p>
          </div>
        )}
      </div>
    </div>
  );
}