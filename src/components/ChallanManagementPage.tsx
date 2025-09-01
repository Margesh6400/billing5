import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  Download, 
  Eye, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Hash, 
  FileText, 
  RotateCcw, 
  Edit, 
  Save, 
  X, 
  Trash2, 
  BookOpen, 
  Lock,
  ArrowLeft,
  Package,
  Plus,
  MapPin,
  Phone,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator';
import { PrintableChallan } from './challans/PrintableChallan';
import { ChallanData } from './challans/types';
import { useAuth } from '../hooks/useAuth';

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

type Client = Database['public']['Tables']['clients']['Row'];
type Stock = Database['public']['Tables']['stock']['Row'];

interface ChallanItem {
  id: number;
  challan_id: number;
  plate_size: string;
  borrowed_quantity: number;
  partner_stock_notes?: string | null;
  status: string;
  borrowed_stock: number;
}

interface ReturnLineItem {
  id: number;
  return_id: number;
  plate_size: string;
  returned_quantity: number;
  damage_notes?: string | null;
  damaged_quantity: number;
  lost_quantity: number;
  returned_borrowed_stock: number;
}

interface UdharChallan {
  id: number;
  challan_number: string;
  challan_date: string;
  status: 'active' | 'completed' | 'partial';
  client: Client;
  challan_items: ChallanItem[];
  total_plates: number;
  driver_name?: string | null;
}

interface JamaChallan {
  id: number;
  return_challan_number: string;
  return_date: string;
  client: Client;
  return_line_items: ReturnLineItem[];
  total_plates: number;
  driver_name?: string | null;
}

interface ClientLedger {
  client: Client;
  udhar_challans: UdharChallan[];
  jama_challans: JamaChallan[];
  total_outstanding: number;
  has_activity: boolean;
  all_transactions: Array<{
    type: 'udhar' | 'jama';
    id: number;
    number: string;
    date: string;
    client_id: string;
    items: Array<{
      plate_size: string;
      quantity: number;
      borrowed_stock?: number;
      returned_borrowed_stock?: number;
      notes?: string;
    }>;
    driver_name?: string;
  }>;
}

interface EditingChallan {
  id: number;
  type: 'udhar' | 'jama';
  challan_number: string;
  date: string;
  client_id: string;
  plates: Record<string, number>;
  borrowedStock: Record<string, number>;
  notes: Record<string, string>;
  driver_name: string;
}

interface StockValidation {
  size: string;
  requested: number;
  available: number;
}

export function ChallanManagementPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientLedger, setClientLedger] = useState<ClientLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [editingChallan, setEditingChallan] = useState<EditingChallan | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [stockData, setStockData] = useState<Stock[]>([]);
  const [stockValidation, setStockValidation] = useState<StockValidation[]>([]);
  const [previousDrivers, setPreviousDrivers] = useState<string[]>([]);

  useEffect(() => {
    fetchClients();
    fetchStockData();
    fetchPreviousDriverNames();
  }, []);

  const fetchStockData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('plate_size');

      if (error) throw error;
      setStockData(data || []);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
  };

  const fetchPreviousDriverNames = async () => {
    try {
      const [{ data: challanDrivers }, { data: returnDrivers }] = await Promise.all([
        supabase
          .from('challans')
          .select('driver_name')
          .not('driver_name', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('returns')
          .select('driver_name')
          .not('driver_name', 'is', null)
          .order('return_date', { ascending: false })
      ]);

      if (challanDrivers || returnDrivers) {
        const allDrivers = [...(challanDrivers || []), ...(returnDrivers || [])]
          .map(record => record.driver_name)
          .filter((name): name is string => name !== null && name.trim() !== '');
        
        const uniqueDrivers = [...new Set(allDrivers)];
        setPreviousDrivers(uniqueDrivers);
      }
    } catch (error) {
      console.error('Error fetching previous driver names:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const fetchClientLedger = async (client: Client) => {
    try {
      setLoading(true);
      
      // Fetch all challans and returns for this client
      const [challansResponse, returnsResponse] = await Promise.all([
        supabase
          .from('challans')
          .select(`*, challan_items (*)`)
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('returns')
          .select(`*, return_line_items (*)`)
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
      ]);

      if (challansResponse.error) throw challansResponse.error;
      if (returnsResponse.error) throw returnsResponse.error;

      const { data: challans } = challansResponse;
      const { data: returns } = returnsResponse;

      // Transform data
      const transformedUdharData = challans?.map(challan => ({
        id: challan.id,
        challan_number: challan.challan_number,
        challan_date: challan.challan_date,
        status: challan.status as 'active' | 'completed' | 'partial',
        client: client,
        challan_items: challan.challan_items as ChallanItem[],
        total_plates: challan.challan_items?.reduce(
          (sum: number, item: ChallanItem) => sum + (item.borrowed_quantity || 0) + (item.borrowed_stock || 0), 
          0
        ),
        driver_name: challan.driver_name
      })) || [];

      const transformedJamaData = returns?.map(returnRecord => ({
        id: returnRecord.id,
        return_challan_number: returnRecord.return_challan_number,
        return_date: returnRecord.return_date,
        client: client,
        return_line_items: returnRecord.return_line_items as ReturnLineItem[],
        total_plates: returnRecord.return_line_items?.reduce(
          (sum: number, item: ReturnLineItem) => sum + (item.returned_quantity || 0) + (item.returned_borrowed_stock || 0), 
          0
        ),
        driver_name: returnRecord.driver_name
      })) || [];

      // Calculate outstanding
      const totalBorrowed = transformedUdharData.reduce((sum, challan) => 
        sum + challan.challan_items.reduce((itemSum, item) => 
          itemSum + item.borrowed_quantity + (item.borrowed_stock || 0), 0), 0);
      const totalReturned = transformedJamaData.reduce((sum, returnRecord) => 
        sum + returnRecord.return_line_items.reduce((itemSum, item) => 
          itemSum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0), 0);
      const total_outstanding = totalBorrowed - totalReturned;

      // Create all transactions array
      const allTransactions = [
        ...transformedUdharData.map(challan => ({
          type: 'udhar' as const,
          id: challan.id,
          number: challan.challan_number,
          date: challan.challan_date,
          client_id: challan.client.id,
          items: challan.challan_items.map(item => ({
            plate_size: item.plate_size,
            quantity: item.borrowed_quantity,
            borrowed_stock: item.borrowed_stock || 0,
            notes: item.partner_stock_notes || ''
          })),
          driver_name: challan.driver_name
        })),
        ...transformedJamaData.map(returnRecord => ({
          type: 'jama' as const,
          id: returnRecord.id,
          number: returnRecord.return_challan_number,
          date: returnRecord.return_date,
          client_id: returnRecord.client.id,
          items: returnRecord.return_line_items.map(item => ({
            plate_size: item.plate_size,
            quantity: item.returned_quantity,
            returned_borrowed_stock: item.returned_borrowed_stock || 0,
            notes: item.damage_notes || ''
          })),
          driver_name: returnRecord.driver_name
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setClientLedger({
        client,
        udhar_challans: transformedUdharData,
        jama_challans: transformedJamaData,
        total_outstanding,
        has_activity: transformedUdharData.length > 0 || transformedJamaData.length > 0,
        all_transactions: allTransactions
      });
    } catch (error) {
      console.error('Error fetching client ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setExpandedClient(null);
    setEditingChallan(null);
    fetchClientLedger(client);
  };

  const handleEditChallan = async (transaction: any) => {
    try {
      if (transaction.type === 'udhar') {
        const { data, error } = await supabase
          .from('challans')
          .select(`*, challan_items(*)`)
          .eq('id', transaction.id)
          .single();

        if (error) throw error;

        const plates: Record<string, number> = {};
        const borrowedStock: Record<string, number> = {};
        const notes: Record<string, string> = {};
        
        (data.challan_items as ChallanItem[]).forEach((item: ChallanItem) => {
          plates[item.plate_size] = item.borrowed_quantity;
          borrowedStock[item.plate_size] = item.borrowed_stock || 0;
          notes[item.plate_size] = item.partner_stock_notes || '';
        });

        setEditingChallan({
          id: transaction.id,
          type: 'udhar',
          challan_number: data.challan_number,
          date: data.challan_date,
          client_id: data.client_id,
          plates,
          borrowedStock,
          notes,
          driver_name: data.driver_name || ''
        });
      } else {
        const { data, error } = await supabase
          .from('returns')
          .select(`*, return_line_items(*)`)
          .eq('id', transaction.id)
          .single();

        if (error) throw error;

        const plates: Record<string, number> = {};
        const borrowedStock: Record<string, number> = {};
        const notes: Record<string, string> = {};
        
        (data.return_line_items as ReturnLineItem[]).forEach((item: ReturnLineItem) => {
          plates[item.plate_size] = item.returned_quantity;
          borrowedStock[item.plate_size] = item.returned_borrowed_stock || 0;
          notes[item.plate_size] = item.damage_notes || '';
        });

        setEditingChallan({
          id: transaction.id,
          type: 'jama',
          challan_number: data.return_challan_number,
          date: data.return_date,
          client_id: data.client_id,
          plates,
          borrowedStock,
          notes,
          driver_name: data.driver_name || ''
        });
      }
    } catch (error) {
      console.error('Error fetching challan details:', error);
      alert('ચલણ વિગતો લોડ કરવામાં ભૂલ.');
    }
  };

  const validateStockAvailability = useCallback(() => {
    if (!editingChallan || editingChallan.type !== 'udhar') return;
    
    const insufficientStock: StockValidation[] = [];
    Object.entries(editingChallan.plates).forEach(([size, quantity]) => {
      if (quantity > 0) {
        const stock = stockData.find(s => s.plate_size === size);
        if (stock && quantity > stock.available_quantity) {
          insufficientStock.push({
            size,
            requested: quantity,
            available: stock.available_quantity
          });
        }
      }
    });
    setStockValidation(insufficientStock);
  }, [editingChallan, stockData]);

  useEffect(() => {
    validateStockAvailability();
  }, [validateStockAvailability]);

  const handleSaveEdit = async () => {
    if (!editingChallan) return;

    setEditLoading(true);
    try {
      if (editingChallan.type === 'udhar') {
        // Update challan
        const { error: challanError } = await supabase
          .from('challans')
          .update({
            challan_number: editingChallan.challan_number,
            challan_date: editingChallan.date,
            client_id: editingChallan.client_id,
            driver_name: editingChallan.driver_name || null
          })
          .eq('id', editingChallan.id);

        if (challanError) throw challanError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('challan_items')
          .delete()
          .eq('challan_id', editingChallan.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const newItems = Object.entries(editingChallan.plates)
          .filter(([_, quantity]) => quantity > 0 || editingChallan.borrowedStock[_] > 0)
          .map(([plate_size, quantity]) => ({
            challan_id: editingChallan.id,
            plate_size,
            borrowed_quantity: quantity,
            borrowed_stock: editingChallan.borrowedStock[plate_size] || 0,
            partner_stock_notes: editingChallan.notes[plate_size]?.trim() || null
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('challan_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      } else {
        // Update return
        const { error: returnError } = await supabase
          .from('returns')
          .update({
            return_challan_number: editingChallan.challan_number,
            return_date: editingChallan.date,
            client_id: editingChallan.client_id,
            driver_name: editingChallan.driver_name || null
          })
          .eq('id', editingChallan.id);

        if (returnError) throw returnError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('return_line_items')
          .delete()
          .eq('return_id', editingChallan.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const newItems = Object.entries(editingChallan.plates)
          .filter(([_, quantity]) => quantity > 0 || editingChallan.borrowedStock[_] > 0)
          .map(([plate_size, quantity]) => ({
            return_id: editingChallan.id,
            plate_size,
            returned_quantity: quantity,
            returned_borrowed_stock: editingChallan.borrowedStock[plate_size] || 0,
            damage_notes: editingChallan.notes[plate_size] || null
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('return_line_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      }

      setEditingChallan(null);
      if (selectedClient) {
        await fetchClientLedger(selectedClient);
      }
      alert('ચલણ સફળતાપૂર્વક અપડેટ થયું!');
    } catch (error) {
      console.error('Error updating challan:', error);
      alert('ચલણ અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteChallan = async () => {
    if (!editingChallan) return;

    const confirmDelete = confirm(`શું તમે ખરેખર આ ${editingChallan.type} ચલણ ડિલીટ કરવા માંગો છો? આ ક્રિયા પૂર્વવત્ કરી શકાશે નહીં.`);
    if (!confirmDelete) return;

    setEditLoading(true);
    try {
      if (editingChallan.type === 'udhar') {
        const { error } = await supabase
          .from('challans')
          .delete()
          .eq('id', editingChallan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('returns')
          .delete()
          .eq('id', editingChallan.id);

        if (error) throw error;
      }

      setEditingChallan(null);
      if (selectedClient) {
        await fetchClientLedger(selectedClient);
      }
      alert('ચલણ સફળતાપૂર્વક ડિલીટ થયું!');
    } catch (error) {
      console.error('Error deleting challan:', error);
      alert('ચલણ ડિલીટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDownload = async (transaction: any) => {
    try {
      setDownloading(transaction.id);
      
      const client = selectedClient!;
      const challanDataForPDF: ChallanData = {
        type: transaction.type === 'udhar' ? 'issue' : 'return',
        challan_number: transaction.number,
        date: transaction.date,
        client: {
          id: client.id,
          name: client.name,
          site: client.site || '',
          mobile: client.mobile_number || ''
        },
        driver_name: transaction.driver_name || undefined,
        plates: transaction.items.map((item: any) => ({
          size: item.plate_size,
          quantity: item.quantity,
          borrowed_stock: transaction.type === 'udhar' ? (item.borrowed_stock || 0) : (item.returned_borrowed_stock || 0),
          notes: item.notes || '',
        })),
        total_quantity: transaction.items.reduce((sum: number, item: any) => {
          const regularQty = item.quantity || 0;
          const borrowedQty = transaction.type === 'udhar' 
            ? (item.borrowed_stock || 0) 
            : (item.returned_borrowed_stock || 0);
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

  const getStockInfo = (size: string) => {
    return stockData.find(s => s.plate_size === size);
  };

  const isStockInsufficient = (size: string) => {
    return stockValidation.some(item => item.size === size);
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">ચલણ બૂક</h1>
          <p className="text-xs text-blue-600">ગ્રાહક પસંદ કરો અને ચલણ જુઓ</p>
        </div>

        {/* Client List or Selected Client View */}
        {!selectedClient ? (
          <>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute w-4 h-4 text-blue-400 -translate-y-1/2 left-3 top-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ગ્રાહક શોધો..."
                className="w-full py-3 pl-10 pr-4 text-sm transition-all duration-200 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>

            {/* Client List */}
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 bg-white border border-blue-100 shadow-sm rounded-xl animate-pulse">
                      <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
                      <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                  <User className="w-12 h-12 mx-auto mb-4 text-blue-300" />
                  <p className="mb-1 text-sm font-semibold text-gray-700">
                    {searchTerm ? 'કોઈ ગ્રાહક મળ્યો નથી' : 'કોઈ ગ્રાહક નથી'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {searchTerm ? 'શોધ માપદંડ બદલીને ફરી પ્રયાસ કરો' : 'નવા ગ્રાહકો ઉમેરો'}
                  </p>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200 cursor-pointer"
                    onClick={() => handleClientSelect(client)}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 text-sm font-bold text-white rounded-full shadow-md bg-gradient-to-r from-blue-500 to-indigo-500">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-900">{client.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-blue-600">
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {client.id}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {client.site}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {client.mobile_number}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Selected Client Header */}
            <div className="p-4 bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setClientLedger(null);
                    setExpandedClient(null);
                    setEditingChallan(null);
                  }}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">પાછા જાઓ</span>
                </button>
                <div className="text-center">
                  <h2 className="text-sm font-bold text-gray-900">{selectedClient.name}</h2>
                  <p className="text-xs text-blue-600">ID: {selectedClient.id}</p>
                  {clientLedger && (
                    <p className="text-xs text-red-600 font-medium">
                      કુલ બાકી: {clientLedger.total_outstanding} પ્લેટ્સ
                    </p>
                  )}
                </div>
                <div className="w-16"></div>
              </div>
            </div>

            {/* Client Ledger View */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-white border border-blue-100 shadow-sm rounded-xl animate-pulse">
                    <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
                    <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : !clientLedger?.has_activity ? (
              <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                <FileText className="w-12 h-12 mx-auto mb-4 text-blue-300" />
                <p className="mb-1 text-sm font-semibold text-gray-700">કોઈ ચલણ પ્રવૃત્તિ નથી</p>
                <p className="text-xs text-blue-600">આ ગ્રાહક માટે કોઈ ચલણ બનાવવામાં આવ્યું નથી</p>
              </div>
            ) : (
              <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Package className="w-4 h-4" />
                    પ્લેટ પ્રવૃત્તિ
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                        <th className="px-2 py-2 text-left font-bold">ચલણ નં.</th>
                        <th className="px-2 py-2 text-center font-bold">તારીખ</th>
                        <th className="px-2 py-2 text-center font-bold">કુલ</th>
                        <th className="px-2 py-2 text-center font-bold">પ્રકાર</th>
                        <th className="px-2 py-2 text-center font-bold">ડ્રાઈવર</th>
                        <th className="px-2 py-2 text-center font-bold">ક્રિયાઓ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientLedger?.all_transactions.map((transaction, index) => (
                        <tr 
                          key={`${transaction.type}-${transaction.id}`}
                          className={`border-b border-blue-100 hover:bg-blue-25 transition-colors ${
                            transaction.type === 'udhar' ? 'bg-red-50' : 'bg-green-50'
                          }`}
                        >
                          <td className="px-2 py-2">
                            <div className="text-xs font-semibold text-gray-900">
                              #{transaction.number}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="text-xs font-medium text-blue-600">
                              {format(new Date(transaction.date), 'dd/MM/yy')}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="text-xs font-medium text-blue-600">
                              {transaction.items.reduce((sum, item) => {
                                const regularQty = item.quantity || 0;
                                const borrowedQty = transaction.type === 'udhar' 
                                  ? (item.borrowed_stock || 0) 
                                  : (item.returned_borrowed_stock || 0);
                                return sum + regularQty + borrowedQty;
                              }, 0)}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.type === 'udhar' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {transaction.type === 'udhar' ? 'ઉધાર' : 'જમા'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="text-xs font-medium text-gray-600">
                              {transaction.driver_name || '-'}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit Button */}
                              {user?.isAdmin ? (
                                <button
                                  onClick={() => handleEditChallan(transaction)}
                                  className="p-1 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                  title="એડિટ"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                              ) : (
                                <div className="p-1 text-gray-400">
                                  <Lock className="w-3 h-3" />
                                </div>
                              )}
                              
                              {/* View Button */}
                              <button
                                onClick={() => setExpandedClient(
                                  expandedClient === `${transaction.type}-${transaction.id}` 
                                    ? null 
                                    : `${transaction.type}-${transaction.id}`
                                )}
                                className="p-1 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                title="જુઓ"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              
                              {/* Download Button */}
                              <button
                                onClick={() => handleDownload(transaction)}
                                disabled={downloading === transaction.id}
                                className="p-1 text-green-600 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                                title="ડાઉનલોડ"
                              >
                                {downloading === transaction.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Expanded Transaction Details */}
                <AnimatePresence>
                  {expandedClient && clientLedger?.all_transactions.map((transaction) => {
                    const isExpanded = expandedClient === `${transaction.type}-${transaction.id}`;
                    if (!isExpanded) return null;

                    return (
                      <motion.div
                        key={`expanded-${transaction.type}-${transaction.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50"
                      >
                        <div className="p-3 space-y-3">
                          <h4 className="text-sm font-bold text-blue-900">પ્લેટ વિગતો</h4>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            {transaction.items.map((item, index) => {
                              const regularQty = item.quantity || 0;
                              const borrowedQty = transaction.type === 'udhar' 
                                ? (item.borrowed_stock || 0) 
                                : (item.returned_borrowed_stock || 0);
                              
                              if (regularQty === 0 && borrowedQty === 0) return null;

                              return (
                                <div key={index} className="p-2 bg-white border border-blue-200 rounded-lg">
                                  <div className="text-xs font-medium text-gray-900">{item.plate_size}</div>
                                  <div className="flex items-center gap-1 mt-1">
                                    {regularQty > 0 && (
                                      <span className={`text-xs font-bold ${
                                        transaction.type === 'udhar' ? 'text-red-600' : 'text-green-600'
                                      }`}>
                                        {regularQty}
                                      </span>
                                    )}
                                    {borrowedQty > 0 && (
                                      <span className="text-xs font-bold text-purple-600">
                                        +{borrowedQty}*
                                      </span>
                                    )}
                                  </div>
                                  {item.notes && (
                                    <div className="mt-1 text-xs text-blue-500">{item.notes}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* Edit Modal */}
        {editingChallan && user?.isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-900/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-4 border-blue-200">
              <div className="p-4 text-white bg-gradient-to-r from-blue-600 to-indigo-600">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    {editingChallan.type === 'udhar' ? 'ઉધાર' : 'જમા'} ચલણ એડિટ કરો
                  </h2>
                  <button
                    onClick={() => setEditingChallan(null)}
                    className="p-2 transition-colors rounded-lg hover:bg-blue-500/20"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Basic Details */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-blue-700">
                      ચલણ નંબર
                    </label>
                    <input
                      type="text"
                      value={editingChallan.challan_number}
                      onChange={(e) => setEditingChallan({
                        ...editingChallan,
                        challan_number: e.target.value
                      })}
                      className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-blue-700">
                      તારીખ
                    </label>
                    <input
                      type="date"
                      value={editingChallan.date}
                      onChange={(e) => setEditingChallan({
                        ...editingChallan,
                        date: e.target.value
                      })}
                      className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Driver Name */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-blue-700">
                    ડ્રાઈવરનું નામ
                  </label>
                  <input
                    type="text"
                    value={editingChallan.driver_name}
                    onChange={(e) => setEditingChallan({
                      ...editingChallan,
                      driver_name: e.target.value
                    })}
                    list="driver-suggestions"
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
                  />
                  <datalist id="driver-suggestions">
                    {previousDrivers.map((driver, index) => (
                      <option key={index} value={driver} />
                    ))}
                  </datalist>
                </div>

                {/* Stock Warning */}
                {stockValidation.length > 0 && editingChallan.type === 'udhar' && (
                  <div className="flex items-center gap-2 p-3 text-amber-600 border rounded-lg bg-amber-50 border-amber-200">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">કેટલીક વસ્તુઓમાં અપૂરતો સ્ટોક છે.</span>
                  </div>
                )}

                {/* Plate Quantities Table */}
                <div>
                  <label className="block mb-3 text-sm font-medium text-blue-700">
                    પ્લેટ માત્રા
                  </label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left font-medium text-gray-700">સાઇઝ</th>
                          {editingChallan.type === 'udhar' && (
                            <th className="px-3 py-2 text-center font-medium text-gray-700">સ્ટોક</th>
                          )}
                          <th className="px-3 py-2 text-center font-medium text-gray-700">માત્રા</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">બિજો ડેપો</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">નોંધ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PLATE_SIZES.map(size => {
                          const stockInfo = getStockInfo(size);
                          const isInsufficient = isStockInsufficient(size);
                          
                          return (
                            <tr key={size} className={`border-b hover:bg-gray-50 ${isInsufficient ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Package className="w-3 h-3 text-gray-500" />
                                  <span className="font-medium text-gray-900">{size}</span>
                                </div>
                              </td>
                              {editingChallan.type === 'udhar' && (
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-xs ${stockInfo ? 'text-gray-600' : 'text-red-500'}`}>
                                    {stockInfo ? stockInfo.available_quantity : 'N/A'}
                                  </span>
                                </td>
                              )}
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={editingChallan.plates[size] || ''}
                                  onChange={(e) => setEditingChallan({
                                    ...editingChallan,
                                    plates: {
                                      ...editingChallan.plates,
                                      [size]: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className={`w-16 px-2 py-1 text-xs text-center border rounded focus:ring-1 ${
                                    isInsufficient 
                                      ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                                      : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                                  }`}
                                  placeholder="0"
                                />
                                {isInsufficient && (
                                  <div className="mt-1 text-xs text-red-600">
                                    સ્ટોક: {stockValidation.find(item => item.size === size)?.available}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={editingChallan.borrowedStock[size] || ''}
                                  onChange={(e) => setEditingChallan({
                                    ...editingChallan,
                                    borrowedStock: {
                                      ...editingChallan.borrowedStock,
                                      [size]: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="w-16 px-2 py-1 text-xs text-center border border-purple-300 rounded bg-purple-50 focus:ring-1 focus:ring-purple-200 focus:border-purple-500"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="text"
                                  value={editingChallan.notes[size] || ''}
                                  onChange={(e) => setEditingChallan({
                                    ...editingChallan,
                                    notes: {
                                      ...editingChallan.notes,
                                      [size]: e.target.value
                                    }
                                  })}
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-200 focus:border-blue-500"
                                  placeholder="નોંધ"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Display */}
                <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 p-2 bg-white border border-blue-200 rounded">
                      <div className="text-xs text-center">
                        <div className="font-medium text-blue-800">પોતાની પ્લેટ</div>
                        <div className="text-lg font-bold text-blue-700">
                          {Object.values(editingChallan.plates).reduce((sum, qty) => sum + (qty || 0), 0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-2 bg-white border border-purple-200 rounded">
                      <div className="text-xs text-center">
                        <div className="font-medium text-purple-800">બિજો ડેપો</div>
                        <div className="text-lg font-bold text-purple-700">
                          {Object.values(editingChallan.borrowedStock).reduce((sum, qty) => sum + (qty || 0), 0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-2 rounded bg-gradient-to-r from-blue-500 to-indigo-500">
                      <div className="text-center">
                        <div className="text-xs font-medium text-blue-100">કુલ પ્લેટ</div>
                        <div className="text-lg font-bold text-white">
                          {Object.values(editingChallan.plates).reduce((sum, qty) => sum + (qty || 0), 0) +
                           Object.values(editingChallan.borrowedStock).reduce((sum, qty) => sum + (qty || 0), 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-4 border-t-2 border-blue-100 sm:flex-row">
                  <button
                    onClick={handleSaveEdit}
                    disabled={editLoading}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {editLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    સેવ કરો
                  </button>
                  <button
                    onClick={handleDeleteChallan}
                    disabled={editLoading}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    ડિલીટ કરો
                  </button>
                  <button
                    onClick={() => setEditingChallan(null)}
                    disabled={editLoading}
                    className="flex-1 px-4 py-3 text-sm font-medium text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600 disabled:opacity-50"
                  >
                    રદ કરો
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}