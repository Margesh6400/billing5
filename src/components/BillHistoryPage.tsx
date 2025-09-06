import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Search, 
  Calendar, 
  Filter, 
  Eye, 
  Download, 
  Copy, 
  User, 
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  Loader2,
  Package,
  Calculator,
  X,
  RefreshCw
} from 'lucide-react';
import { BillDetailModal } from './billing/BillDetailModal';
import { generateComprehensiveBillJPG, downloadComprehensiveBillJPG } from '../utils/comprehensiveBillJPGGenerator';
import { ComprehensiveBillData } from '../utils/comprehensiveBillingCalculator';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'];
type BillLineItem = Database['public']['Tables']['bill_line_items']['Row'];

interface BillWithClient extends Bill {
  client: Client;
  bill_line_items: BillLineItem[];
}

interface FilterState {
  clientId: string;
  startDate: string;
  endDate: string;
  status: 'all' | 'closed' | 'continued';
  paymentStatus: 'all' | 'pending' | 'paid';
}

export function BillHistoryPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<BillWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillWithClient | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    clientId: '',
    startDate: '',
    endDate: '',
    status: 'all',
    paymentStatus: 'all'
  });

  useEffect(() => {
    fetchBills();
    fetchClients();
  }, []);

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

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          client:clients(*),
          bill_line_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = bills.filter(bill => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        bill.bill_number.toLowerCase().includes(searchLower) ||
        bill.client.name.toLowerCase().includes(searchLower) ||
        bill.client.id.toLowerCase().includes(searchLower) ||
        (bill.client.site || '').toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Client filter
    if (filters.clientId && bill.client_id !== filters.clientId) return false;

    // Date range filter
    if (filters.startDate && bill.billing_period_end < filters.startDate) return false;
    if (filters.endDate && bill.billing_period_start > filters.endDate) return false;

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'closed' && bill.account_closure !== 'close') return false;
      if (filters.status === 'continued' && bill.account_closure !== 'continue') return false;
    }

    // Payment status filter
    if (filters.paymentStatus !== 'all' && bill.payment_status !== filters.paymentStatus) return false;

    return true;
  });

  const handleDownloadBill = async (bill: BillWithClient) => {
    try {
      setDownloading(bill.id);
      
      // Convert bill data to ComprehensiveBillData format
      const billData: ComprehensiveBillData = {
        client: bill.client,
        bill_number: bill.bill_number,
        bill_date: bill.billing_period_end,
        ledger_entries: [], // Not needed for JPG generation
        date_ranges: [], // Not needed for JPG generation
        total_plates_udhar: bill.total_udhar_quantity,
        total_plates_jama: 0, // Not stored separately
        total_plates: bill.total_udhar_quantity,
        total_udhar: bill.period_charges,
        service_rate_per_plate: bill.service_rate,
        service_charge_percentage: 10, // Default
        service_charge: bill.service_charge,
        extra_charges: [], // Would need to parse from line items
        extra_charges_total: bill.extra_charges_total,
        discounts: [], // Would need to parse from line items
        discounts_total: bill.discounts_total,
        payments: [], // Would need to parse from line items
        payments_total: bill.payments_total,
        grand_total: bill.total_amount,
        advance_paid: bill.advance_paid,
        final_due: bill.final_due,
        balance_carry_forward: bill.balance_carry_forward,
        account_closure: bill.account_closure as 'close' | 'continue',
        rates: {
          daily_rent_rate: bill.daily_rate,
          service_charge_percentage: 10
        }
      };

      const jpgDataUrl = await generateComprehensiveBillJPG(billData);
      downloadComprehensiveBillJPG(jpgDataUrl, `bill-${bill.bill_number}-${bill.client.name.replace(/\s+/g, '-')}`);
      
    } catch (error) {
      console.error('Error downloading bill:', error);
      alert('બિલ ડાઉનલોડ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setDownloading(null);
    }
  };

  const handleRegenerateBill = async (bill: BillWithClient) => {
    try {
      setRegenerating(bill.id);
      
      // Create a new bill with incremented number
      const newBillNumber = `${bill.bill_number}-COPY-${Date.now().toString().slice(-4)}`;
      
      const { data: newBill, error } = await supabase
        .from('bills')
        .insert([{
          ...bill,
          id: undefined, // Let Supabase generate new ID
          bill_number: newBillNumber,
          created_at: undefined,
          updated_at: undefined,
          generated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Copy line items
      if (bill.bill_line_items.length > 0) {
        const newLineItems = bill.bill_line_items.map(item => ({
          ...item,
          id: undefined,
          bill_id: newBill.id,
          created_at: undefined
        }));

        const { error: lineItemsError } = await supabase
          .from('bill_line_items')
          .insert(newLineItems);

        if (lineItemsError) throw lineItemsError;
      }

      await fetchBills();
      alert(`નવું બિલ બનાવવામાં આવ્યું: ${newBillNumber}`);
      
    } catch (error) {
      console.error('Error regenerating bill:', error);
      alert('બિલ ફરીથી બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setRegenerating(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      clientId: '',
      startDate: '',
      endDate: '',
      status: 'all',
      paymentStatus: 'all'
    });
    setSearchTerm('');
  };

  const hasActiveFilters = filters.clientId || filters.startDate || filters.endDate || 
                          filters.status !== 'all' || filters.paymentStatus !== 'all' || searchTerm;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">બિલ ઇતિહાસ લોડ થઈ રહ્યો છે...</p>
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
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલ ઇતિહાસ</h1>
          <p className="text-xs text-blue-600">તમામ બિલોનો ઇતિહાસ અને વ્યવસ્થાપન</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Search className="w-4 h-4" />
                શોધો અને ફિલ્ટર કરો
              </h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors bg-white/20 rounded hover:bg-white/30"
              >
                <Filter className="w-3 h-3" />
                {showFilters ? 'છુપાવો' : 'ફિલ્ટર'}
              </button>
            </div>
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

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 gap-3 p-3 border-2 border-blue-100 rounded-lg bg-blue-50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      ગ્રાહક પસંદ કરો
                    </label>
                    <select
                      value={filters.clientId}
                      onChange={(e) => setFilters(prev => ({ ...prev, clientId: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                      <option value="">બધા ગ્રાહકો</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      એકાઉન્ટ સ્થિતિ
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                      <option value="all">બધી સ્થિતિ</option>
                      <option value="closed">બંધ કરેલ</option>
                      <option value="continued">ચાલુ રાખેલ</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      શરૂઆતની તારીખ
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      અંતિમ તારીખ
                    </label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-medium text-blue-700">
                    ચુકવણી સ્થિતિ
                  </label>
                  <select
                    value={filters.paymentStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                    className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  >
                    <option value="all">બધી ચુકવણી સ્થિતિ</option>
                    <option value="pending">બાકી</option>
                    <option value="paid">ચૂકવેલ</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center justify-center gap-1 py-2 text-xs font-medium text-red-600 transition-colors border border-red-200 rounded hover:bg-red-50"
                  >
                    <X className="w-3 h-3" />
                    ફિલ્ટર સાફ કરો
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 text-center bg-white border-2 border-blue-100 rounded-lg shadow-sm">
            <div className="text-lg font-bold text-blue-700">{filteredBills.length}</div>
            <div className="text-xs font-medium text-blue-600">કુલ બિલ</div>
          </div>
          <div className="p-3 text-center bg-white border-2 border-green-100 rounded-lg shadow-sm">
            <div className="text-lg font-bold text-green-700">
              ₹{filteredBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0).toFixed(0)}
            </div>
            <div className="text-xs font-medium text-green-600">કુલ રકમ</div>
          </div>
        </div>

        {/* Bills List */}
        <div className="space-y-3">
          {filteredBills.length === 0 ? (
            <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <p className="mb-1 font-medium text-gray-700">
                {hasActiveFilters ? 'કોઈ બિલ મળ્યું નથી' : 'હજુ સુધી કોઈ બિલ બનાવવામાં આવ્યું નથી'}
              </p>
              <p className="text-xs text-blue-600">
                {hasActiveFilters ? 'ફિલ્ટર બદલીને પ્રયત્ન કરો' : 'નવા બિલ બનાવવાનું શરૂ કરો'}
              </p>
            </div>
          ) : (
            filteredBills.map((bill) => (
              <div key={bill.id} className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                        <FileText className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {bill.bill_number}
                        </h3>
                        <p className="text-xs text-blue-100">
                          {new Date(bill.billing_period_end).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        bill.account_closure === 'close' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {bill.account_closure === 'close' ? 'બંધ' : 'ચાલુ'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        bill.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {bill.payment_status === 'paid' ? 'ચૂકવેલ' : 'બાકી'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 space-y-3">
                  {/* Client Info */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                      {bill.client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{bill.client.name}</h4>
                      <p className="text-xs text-blue-600">ID: {bill.client.id} | {bill.client.site}</p>
                    </div>
                  </div>

                  {/* Bill Details */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 border border-blue-200 rounded bg-blue-50">
                      <div className="text-sm font-bold text-blue-700">{bill.total_udhar_quantity}</div>
                      <div className="text-xs text-blue-600">કુલ પ્લેટ</div>
                    </div>
                    <div className="p-2 border border-green-200 rounded bg-green-50">
                      <div className="text-sm font-bold text-green-700">₹{bill.service_charge.toFixed(0)}</div>
                      <div className="text-xs text-green-600">સર્વિસ ચાર્જ</div>
                    </div>
                    <div className="p-2 border border-purple-200 rounded bg-purple-50">
                      <div className="text-sm font-bold text-purple-700">₹{bill.final_due.toFixed(0)}</div>
                      <div className="text-xs text-purple-600">અંતિમ બાકી</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedBill(bill)}
                      className="flex items-center justify-center flex-1 gap-1 py-2 text-xs font-medium text-blue-600 transition-colors border border-blue-200 rounded hover:bg-blue-50"
                    >
                      <Eye className="w-3 h-3" />
                      જુઓ
                    </button>
                    
                    <button
                      onClick={() => handleDownloadBill(bill)}
                      disabled={downloading === bill.id}
                      className="flex items-center justify-center flex-1 gap-1 py-2 text-xs font-medium text-green-600 transition-colors border border-green-200 rounded hover:bg-green-50 disabled:opacity-50"
                    >
                      {downloading === bill.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      ડાઉનલોડ
                    </button>
                    
                    {user?.isAdmin && (
                      <button
                        onClick={() => handleRegenerateBill(bill)}
                        disabled={regenerating === bill.id}
                        className="flex items-center justify-center flex-1 gap-1 py-2 text-xs font-medium text-purple-600 transition-colors border border-purple-200 rounded hover:bg-purple-50 disabled:opacity-50"
                      >
                        {regenerating === bill.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        કોપી
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={fetchBills}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105"
          >
            <RefreshCw className="w-4 h-4" />
            રિફ્રેશ કરો
          </button>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onDownload={() => handleDownloadBill(selectedBill)}
          onRegenerate={user?.isAdmin ? () => handleRegenerateBill(selectedBill) : undefined}
        />
      )}
    </div>
  );
}