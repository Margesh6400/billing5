import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  FileText, 
  Search, 
  Calendar, 
  User, 
  Package, 
  Download, 
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  EyeOff,
  Hash,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  AlertTriangle,
  X
} from 'lucide-react';
import { PrintableChallan } from './challans/PrintableChallan';
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator';
import { ChallanData } from './challans/types';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

interface ChallanWithDetails extends Challan {
  client: Client;
  challan_items: ChallanItem[];
}

interface ReturnWithDetails extends Return {
  client: Client;
  return_line_items: ReturnLineItem[];
}

interface FilterState {
  clientId: string;
  startDate: string;
  endDate: string;
  status: 'all' | 'active' | 'completed';
}

export function ChallanManagementPage() {
  const [challans, setChallans] = useState<ChallanWithDetails[]>([]);
  const [returns, setReturns] = useState<ReturnWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);

  // Filter state without type because we'll handle type toggle separately
  const [filters, setFilters] = useState<FilterState>({
    clientId: '',
    startDate: '',
    endDate: '',
    status: 'all',
  });

  // Separate state for chalans type filter: 'all', 'udhar', 'jama'
  const [viewType, setViewType] = useState<'all' | 'udhar' | 'jama'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [challansResponse, returnsResponse, clientsResponse] = await Promise.all([
        supabase
          .from('challans')
          .select(`
            *,
            client:clients(*),
            challan_items(*)
          `)
          .order('challan_number', { ascending: true }),

        supabase
          .from('returns')
          .select(`
            *,
            client:clients(*),
            return_line_items(*)
          `)
          .order('return_challan_number', { ascending: true }),

        supabase
          .from('clients')
          .select('*')
          .order('name')
      ]);

      if (challansResponse.error) throw challansResponse.error;
      if (returnsResponse.error) throw returnsResponse.error;
      if (clientsResponse.error) throw clientsResponse.error;

      setChallans(challansResponse.data || []);
      setReturns(returnsResponse.data || []);
      setClients(clientsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare udhar and jama transactions separately with same format
  const udharTransactions = challans
    .map(challan => ({
      ...challan,
      type: 'udhar' as const,
      number: challan.challan_number,
      date: challan.challan_date,
      items: challan.challan_items
    }))
    // Sort ascending by challan_number using numeric-aware comparator
    .sort((a, b) => {
      const extractNum = (x: any) => {
        const s = x?.number?.toString() || '';
        const n = Number(s);
        if (!isNaN(n)) return n;
        const m = s.match(/\d+/);
        return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
      };
      const an = extractNum(a);
      const bn = extractNum(b);
      if (an !== bn) return an - bn;
      return a.number.toString().localeCompare(b.number.toString());
    });

  const jamaTransactions = returns
    .map(returnRecord => ({
      ...returnRecord,
      type: 'jama' as const,
      number: returnRecord.return_challan_number,
      date: returnRecord.return_date,
      items: returnRecord.return_line_items
    }))
    // Sort ascending by return_challan_number using numeric-aware comparator
    .sort((a, b) => {
      const extractNum = (x: any) => {
        const s = x?.number?.toString() || '';
        const n = Number(s);
        if (!isNaN(n)) return n;
        const m = s.match(/\d+/);
        return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
      };
      const an = extractNum(a);
      const bn = extractNum(b);
      if (an !== bn) return an - bn;
      return a.number.toString().localeCompare(b.number.toString());
    });

  // Filter function reused for both (accept various transaction shapes)
  const applyFilters = (transactions: any[]) => {
    return transactions.filter((transaction: any) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          transaction.number.toLowerCase().includes(searchLower) ||
          transaction.client.name.toLowerCase().includes(searchLower) ||
          transaction.client.id.toLowerCase().includes(searchLower) ||
          (transaction.client.site || '').toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }
      // Client id filter
      if (filters.clientId && transaction.client_id !== filters.clientId) return false;

      // Date range filter
      if (filters.startDate && transaction.date < filters.startDate) return false;
      if (filters.endDate && transaction.date > filters.endDate) return false;

      // Status filter only for udhar-like transactions
      if (transaction.type === 'udhar' && filters.status !== 'all') {
        if (filters.status !== transaction.status) return false;
      }

      return true;
    });
  };

  // Apply filters to both sets
  const filteredUdhar = applyFilters(udharTransactions);
  const filteredJama = applyFilters(jamaTransactions);

  // Decide which to show based on viewType filter
  const showUdhar = viewType === 'all' || viewType === 'udhar';
  const showJama = viewType === 'all' || viewType === 'jama';

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleDownloadChallan = async (transaction: any) => {
    try {
      const downloadKey = `${transaction.type}-${transaction.id}`;
      setDownloading(downloadKey);

      const challanDataForPDF: ChallanData = {
        type: transaction.type === 'udhar' ? 'issue' : 'return',
        challan_number: transaction.number,
        date: transaction.date,
        client: {
          id: transaction.client.id,
          name: transaction.client.name,
          site: transaction.client.site || '',
          mobile: transaction.client.mobile_number || ''
        },
        driver_name: transaction.driver_name || undefined,
        plates: transaction.items.map((item: any) => ({
          size: item.plate_size,
          quantity: transaction.type === 'udhar' ? item.borrowed_quantity : item.returned_quantity,
          borrowed_stock: transaction.type === 'udhar' ? (item.borrowed_stock || 0) : (item.returned_borrowed_stock || 0),
          damaged_quantity: transaction.type === 'jama' ? (item.damaged_quantity || 0) : undefined,
          lost_quantity: transaction.type === 'jama' ? (item.lost_quantity || 0) : undefined,
          notes: transaction.type === 'udhar' ? (item.partner_stock_notes || '') : (item.damage_notes || ''),
        })),
        total_quantity: transaction.items.reduce((sum: number, item: any) => {
          const regularQty = transaction.type === 'udhar' ? item.borrowed_quantity : item.returned_quantity;
          const borrowedQty = transaction.type === 'udhar' ? (item.borrowed_stock || 0) : (item.returned_borrowed_stock || 0);
          return sum + regularQty + borrowedQty;
        }, 0)
      };

      setChallanData(challanDataForPDF);
      await new Promise(resolve => setTimeout(resolve, 500));

      const jpgDataUrl = await generateJPGChallan(challanDataForPDF);
      downloadJPGChallan(jpgDataUrl, `${transaction.type}-challan-${challanDataForPDF.challan_number}`);

      setChallanData(null);
    } catch (error) {
      console.error('Error downloading challan:', error);
      alert('ચલણ ડાઉનલોડ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setDownloading(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      clientId: '',
      startDate: '',
      endDate: '',
      status: 'all',
    });
    setSearchTerm('');
  };

  const hasActiveFilters =
    filters.clientId ||
    filters.startDate ||
    filters.endDate ||
    filters.status !== 'all' ||
    searchTerm;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">ચલણ લોડ થઈ રહ્યા છે...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      {/* Hidden Printable Challan */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`}>
            <PrintableChallan data={challanData} />
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">ચલણ બૂક</h1>
          <p className="text-xs text-blue-600">તમામ ઉધાર અને જમા ચલણોનું વ્યવસ્થાપન</p>
        </div>

        {/* Top View Type Toggle */}
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setViewType('all')}
            className={`px-4 py-1 text-xs font-semibold rounded ${
              viewType === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border border-blue-600'
            }`}
          >
            બધી
          </button>
          <button
            onClick={() => setViewType('udhar')}
            className={`px-4 py-1 text-xs font-semibold rounded ${
              viewType === 'udhar' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-red-600 border border-red-600'
            }`}
          >
            ઉધાર
          </button>
          <button
            onClick={() => setViewType('jama')}
            className={`px-4 py-1 text-xs font-semibold rounded ${
              viewType === 'jama' ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-green-600 border border-green-600'
            }`}
          >
            જમા
          </button>
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
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors rounded bg-white/20 hover:bg-white/30"
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
                placeholder="ચલણ નંબર, ગ્રાહક નામ અથવા ID શોધો..."
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
                      શરૂઆતની તારીખ
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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

                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      સક્રિયતા મોકડ
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                      <option value="all">બધા</option>
                      <option value="active">સક્રિય</option>
                      <option value="completed">પૂર્ણ</option>
                    </select>
                  </div>
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
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 text-center bg-white border-2 border-blue-100 rounded-lg shadow-sm">
            <div className="text-lg font-bold text-blue-700">{filteredUdhar.length + filteredJama.length}</div>
            <div className="text-xs font-medium text-blue-600">કુલ ચલણ</div>
          </div>
          <div className="p-3 text-center bg-white border-2 border-green-100 rounded-lg shadow-sm">
            <div className="text-lg font-bold text-green-700">
              {filteredUdhar.filter(t => t.status === 'active').length}
            </div>
            <div className="text-xs font-medium text-green-600">સક્રિય ઉધાર</div>
          </div>
          <div className="p-3 text-center bg-white border-2 border-gray-300 rounded-lg shadow-sm">
            <div className="text-lg font-bold text-gray-700">
              {filteredJama.length}
            </div>
            <div className="text-xs font-medium text-gray-600">જમા ચાલણ</div>
          </div>
        </div>

        {/* Udhar Section */}
        {showUdhar && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-red-600">ઉધાર ચલણ (Issue Challans)</h2>

            {filteredUdhar.length === 0 ? (
              <div className="py-8 text-center bg-white border-2 border-red-100 shadow-lg rounded-xl">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-red-200 to-orange-200">
                  <FileText className="w-8 h-8 text-red-400" />
                </div>
                <p className="mb-1 font-medium text-gray-700">
                  {hasActiveFilters ? 'કોઈ ઉધાર ચલણ મળ્યું નથી' : 'હજી સુધી કોઈ ઉધાર ચલણ બનાવવામાં આવ્યું નથી'}
                </p>
                <p className="text-xs text-red-600">
                  {hasActiveFilters ? 'ફિલ્ટર બદલીને પ્રયત્ન કરો' : 'નવો ઉધાર چلણ બનાવવાનું શરૂ કરો'}
                </p>
              </div>
            ) : (
              filteredUdhar.map((transaction) => {
                const isExpanded = expandedItems.has(`udhar-${transaction.id}`);
                const totalQuantity = transaction.items.reduce((sum: number, item: any) => {
                  return sum + item.borrowed_quantity + (item.borrowed_stock || 0);
                }, 0);

                return (
                  <div key={`udhar-${transaction.id}`} className="overflow-hidden transition-all duration-200 bg-white border-2 border-red-100 shadow-lg rounded-xl hover:shadow-xl hover:border-red-300">
                    <div
                      className="p-3 transition-colors cursor-pointer bg-gradient-to-r from-red-500 to-orange-500"
                      onClick={() => toggleExpanded(`udhar-${transaction.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                            <FileText className="w-3 h-3 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              #{transaction.number}
                            </h3>
                            <p className="text-xs text-white/80">ઉધાર ચલણ</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium text-white">
                            {totalQuantity} પ્લેટ
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-white" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Basic Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                            {transaction.client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">{transaction.client.name}</h4>
                            <p className="text-xs text-blue-600">ID: {transaction.client.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(transaction.date).toLocaleDateString('en-GB')}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            transaction.status === 'active' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {transaction.status === 'active' ? 'સક્રિય' : 'પૂર્ણ'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin className="w-3 h-3" />
                              <span>{transaction.client.site}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3" />
                              <span>{transaction.client.mobile_number}</span>
                            </div>
                          </div>

                          {transaction.driver_name && (
                            <div className="p-2 border border-gray-200 rounded bg-gray-50">
                              <div className="flex items-center gap-2 text-xs">
                                <User className="w-3 h-3 text-gray-500" />
                                <span className="font-medium text-gray-700">ડ્રાઈવર: {transaction.driver_name}</span>
                              </div>
                            </div>
                          )}

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border border-gray-200 rounded">
                              <thead>
                                <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                                  <th className="px-2 py-1 text-left">પ્લેટ સાઇઝ</th>
                                  <th className="px-2 py-1 text-center">માત્રા</th>
                                  {transaction.items.some(item => item.borrowed_stock > 0) && (
                                    <th className="px-2 py-1 text-center">બિજો ડેપો</th>
                                  )}
                                  <th className="px-2 py-1 text-left">નોંધ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transaction.items
                                  .filter(item => item.borrowed_quantity > 0 || item.borrowed_stock > 0)
                                  .map((item, index) => (
                                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-2 py-1 font-medium">{item.plate_size}</td>
                                    <td className="px-2 py-1 font-bold text-center">{item.borrowed_quantity}</td>
                                    {transaction.items.some(i => i.borrowed_stock > 0) && (
                                      <td className="px-2 py-1 font-bold text-center text-red-600">{item.borrowed_stock || 0}</td>
                                    )}
                                    <td className="px-2 py-1 text-gray-600">{item.partner_stock_notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <button
                            onClick={() => handleDownloadChallan(transaction)}
                            disabled={downloading === `udhar-${transaction.id}`}
                            className="flex items-center justify-center w-full gap-2 py-2 text-xs font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
                          >
                            {downloading === `udhar-${transaction.id}` ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                ડાઉનલોડ થઈ રહ્યું છે...
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                JPG ડાઉનલોડ કરો
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* Jama Section */}
        {showJama && (
          <section>
            <h2 className="mt-8 mb-2 text-sm font-semibold text-green-700">જમા ચલણ (Return Challans)</h2>

            {filteredJama.length === 0 ? (
              <div className="py-8 text-center bg-white border-2 border-green-100 shadow-lg rounded-xl">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-200 to-emerald-200">
                  <Package className="w-8 h-8 text-green-400" />
                </div>
                <p className="mb-1 font-medium text-gray-700">
                  {hasActiveFilters ? 'કોઈ જમા چلણ મળ્યું નથી' : 'હજી સુધી કોઈ જમા چلણ બનાવવામાં આવ્યું નથી'}
                </p>
                <p className="text-xs text-green-600">
                  {hasActiveFilters ? 'ફિલ્ટર બદલીને પ્રયત્ન કરો' : 'નવો જમા چلણ બનાવવાનું શરૂ કરો'}
                </p>
              </div>
            ) : (
              filteredJama.map((transaction) => {
                const isExpanded = expandedItems.has(`jama-${transaction.id}`);
                const totalQuantity = transaction.items.reduce((sum: number, item: any) => {
                  return sum + item.returned_quantity + (item.returned_borrowed_stock || 0);
                }, 0);

                return (
                  <div key={`jama-${transaction.id}`} className="overflow-hidden transition-all duration-200 bg-white border-2 border-green-100 shadow-lg rounded-xl hover:shadow-xl hover:border-green-300">
                    <div
                      className="p-3 transition-colors cursor-pointer bg-gradient-to-r from-green-500 to-emerald-500"
                      onClick={() => toggleExpanded(`jama-${transaction.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                            <Package className="w-3 h-3 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              #{transaction.number}
                            </h3>
                            <p className="text-xs text-white/80">જમા ચલણ</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium text-white">
                            {totalQuantity} પ્લેટ
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-white" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Basic Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                            {transaction.client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">{transaction.client.name}</h4>
                            <p className="text-xs text-blue-600">ID: {transaction.client.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(transaction.date).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin className="w-3 h-3" />
                              <span>{transaction.client.site}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3" />
                              <span>{transaction.client.mobile_number}</span>
                            </div>
                          </div>

                          {transaction.driver_name && (
                            <div className="p-2 border border-gray-200 rounded bg-gray-50">
                              <div className="flex items-center gap-2 text-xs">
                                <User className="w-3 h-3 text-gray-500" />
                                <span className="font-medium text-gray-700">ડ્રાઈવર: {transaction.driver_name}</span>
                              </div>
                            </div>
                          )}

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border border-gray-200 rounded">
                              <thead>
                                <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                                  <th className="px-2 py-1 text-left">પ્લેટ સાઇઝ</th>
                                  <th className="px-2 py-1 text-center">માત્રા</th>
                                  {transaction.items.some(item => item.returned_borrowed_stock > 0) && (
                                    <th className="px-2 py-1 text-center">બિજો ડેપો</th>
                                  )}
                                  <th className="px-2 py-1 text-left">નોંધ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transaction.items
                                  .filter(item => item.returned_quantity > 0 || item.returned_borrowed_stock > 0)
                                  .map((item, index) => (
                                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-2 py-1 font-medium">{item.plate_size}</td>
                                    <td className="px-2 py-1 font-bold text-center">{item.returned_quantity}</td>
                                    {transaction.items.some(i => i.returned_borrowed_stock > 0) && (
                                      <td className="px-2 py-1 font-bold text-center text-red-600">{item.returned_borrowed_stock || 0}</td>
                                    )}
                                    <td className="px-2 py-1 text-gray-600">{item.damage_notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <button
                            onClick={() => handleDownloadChallan(transaction)}
                            disabled={downloading === `jama-${transaction.id}`}
                            className="flex items-center justify-center w-full gap-2 py-2 text-xs font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
                          >
                            {downloading === `jama-${transaction.id}` ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                ડાઉનલોડ થઈ રહ્યું છે...
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                JPG ડાઉનલોડ કરો
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
    </div>
  );
}
