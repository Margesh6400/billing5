import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  Download, 
  Eye, 
  Search, 
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
  MapPin,
  Phone,
  Loader2,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator';
import { PrintableChallan } from './challans/PrintableChallan';
import { ChallanData } from './challans/types';
import { useAuth } from '../hooks/useAuth';
import { useChallanManagement, ChallanTransaction } from '../hooks/useChallanManagement';

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

type Client = Database['public']['Tables']['clients']['Row'];
type Stock = Database['public']['Tables']['stock']['Row'];

interface EditModalState {
  isOpen: boolean;
  transaction: ChallanTransaction | null;
  formData: {
    number: string;
    date: string;
    driver_name: string;
    items: Record<string, { quantity: number; borrowed_stock: number; notes: string }>;
  };
}

interface StockValidation {
  size: string;
  requested: number;
  available: number;
}

export function ChallanManagementPage() {
  const { user } = useAuth();
  const { loading: hookLoading, fetchTransactions, editTransaction, deleteTransaction } = useChallanManagement();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<ChallanTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<ChallanTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [stockData, setStockData] = useState<Stock[]>([]);
  const [stockValidation, setStockValidation] = useState<StockValidation[]>([]);
  const [previousDrivers, setPreviousDrivers] = useState<string[]>([]);
  
  // Edit modal state
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    transaction: null,
    formData: {
      number: '',
      date: '',
      driver_name: '',
      items: {}
    }
  });

  useEffect(() => {
    initializePage();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      filterTransactionsByClient();
    } else {
      setFilteredTransactions(transactions);
    }
  }, [selectedClient, transactions, searchTerm]);

  const initializePage = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchClients(),
        fetchAllTransactions(),
        fetchStockData(),
        fetchPreviousDriverNames()
      ]);
    } catch (error) {
      console.error('Error initializing page:', error);
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

  const fetchAllTransactions = async () => {
    try {
      const allTransactions = await fetchTransactions();
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

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

  const filterTransactionsByClient = () => {
    let filtered = transactions;
    
    if (selectedClient) {
      filtered = transactions.filter(t => t.client_id === selectedClient.id);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.driver_name && t.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredTransactions(filtered);
  };

  const openEditModal = (transaction: ChallanTransaction) => {
    if (!user?.isAdmin) {
      alert('આ કામગીરી માટે એડમિન અધિકાર જરૂરી છે.');
      return;
    }

    // Initialize form data
    const itemsData: Record<string, { quantity: number; borrowed_stock: number; notes: string }> = {};
    PLATE_SIZES.forEach(size => {
      itemsData[size] = { quantity: 0, borrowed_stock: 0, notes: '' };
    });

    // Fill with actual data
    transaction.items.forEach(item => {
      itemsData[item.plate_size] = {
        quantity: item.quantity,
        borrowed_stock: item.borrowed_stock || 0,
        notes: item.notes || ''
      };
    });

    setEditModal({
      isOpen: true,
      transaction,
      formData: {
        number: transaction.number,
        date: transaction.date,
        driver_name: transaction.driver_name || '',
        items: itemsData
      }
    });

    validateStockForEdit(itemsData, transaction);
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      transaction: null,
      formData: {
        number: '',
        date: '',
        driver_name: '',
        items: {}
      }
    });
    setStockValidation([]);
  };

  const validateStockForEdit = (
    items: Record<string, { quantity: number; borrowed_stock: number; notes: string }>,
    originalTransaction: ChallanTransaction
  ) => {
    if (originalTransaction.type !== 'udhar') {
      setStockValidation([]);
      return;
    }

    const insufficientStock: StockValidation[] = [];
    
    Object.entries(items).forEach(([size, data]) => {
      if (data.quantity > 0) {
        const stock = stockData.find(s => s.plate_size === size);
        const originalItem = originalTransaction.items.find(item => item.plate_size === size);
        const originalQuantity = originalItem?.quantity || 0;
        
        // Calculate available stock after reverting original transaction
        const availableAfterRevert = stock ? stock.available_quantity + originalQuantity : 0;
        
        if (stock && data.quantity > availableAfterRevert) {
          insufficientStock.push({
            size,
            requested: data.quantity,
            available: availableAfterRevert
          });
        }
      }
    });
    
    setStockValidation(insufficientStock);
  };

  const updateEditFormData = (field: keyof EditModalState['formData'], value: any) => {
    setEditModal(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value }
    }));
  };

  const updateEditItem = (size: string, field: 'quantity' | 'borrowed_stock' | 'notes', value: any) => {
    const newItems = {
      ...editModal.formData.items,
      [size]: {
        ...editModal.formData.items[size],
        [field]: value
      }
    };
    
    setEditModal(prev => ({
      ...prev,
      formData: { ...prev.formData, items: newItems }
    }));

    if (editModal.transaction) {
      validateStockForEdit(newItems, editModal.transaction);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal.transaction) return;

    try {
      const itemsArray = Object.entries(editModal.formData.items)
        .filter(([_, data]) => data.quantity > 0 || data.borrowed_stock > 0)
        .map(([size, data]) => ({
          plate_size: size,
          quantity: data.quantity,
          borrowed_stock: data.borrowed_stock,
          notes: data.notes
        }));

      if (itemsArray.length === 0) {
        alert('ઓછામાં ઓછી એક પ્લેટની માત્રા દાખલ કરો.');
        return;
      }

      if (stockValidation.length > 0) {
        alert('અપૂરતો સ્ટોક છે. કૃપા કરીને માત્રા ઘટાડો.');
        return;
      }

      await editTransaction(
        editModal.transaction.id,
        editModal.transaction.type,
        {
          number: editModal.formData.number,
          date: editModal.formData.date,
          driver_name: editModal.formData.driver_name,
          items: itemsArray
        }
      );

      closeEditModal();
      await fetchAllTransactions();
      await fetchStockData();
      alert('ચલણ સફળતાપૂર્વક અપડેટ થયું!');
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert(`ચલણ અપડેટ કરવામાં ભૂલ: ${error instanceof Error ? error.message : 'અજાણી ભૂલ'}`);
    }
  };

  const handleDelete = async () => {
    if (!editModal.transaction) return;

    const confirmDelete = confirm(
      `શું તમે ખરેખર આ ${editModal.transaction.type === 'udhar' ? 'ઉધાર' : 'જમા'} ચલણ ડિલીટ કરવા માંગો છો? આ ક્રિયા પૂર્વવત્ કરી શકાશે નહીં.`
    );
    
    if (!confirmDelete) return;

    try {
      await deleteTransaction(editModal.transaction.id, editModal.transaction.type);
      closeEditModal();
      await fetchAllTransactions();
      await fetchStockData();
      alert('ચલણ સફળતાપૂર્વક ડિલીટ થયું!');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert(`ચલણ ડિલીટ કરવામાં ભૂલ: ${error instanceof Error ? error.message : 'અજાણી ભૂલ'}`);
    }
  };

  const handleDownload = async (transaction: ChallanTransaction) => {
    try {
      setDownloading(transaction.id);
      
      const client = clients.find(c => c.id === transaction.client_id);
      if (!client) {
        alert('ગ્રાહકની માહિતી મળી નથી.');
        return;
      }

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
        driver_name: transaction.driver_name,
        plates: transaction.items.map(item => ({
          size: item.plate_size,
          quantity: item.quantity,
          borrowed_stock: item.borrowed_stock || 0,
          notes: item.notes || '',
        })),
        total_quantity: transaction.total_quantity
      };

      setChallanData(challanDataForPDF);
      await new Promise(resolve => setTimeout(resolve, 500));

      const jpgDataUrl = await generateJPGChallan(challanDataForPDF);
      downloadJPGChallan(jpgDataUrl, `${transaction.type}-challan-${transaction.number}`);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
            <h1 className="mb-1 text-base font-bold text-gray-900">લોડ થઈ રહ્યું છે...</h1>
            <p className="text-xs text-blue-600">ચલણ ડેટા લોડ કરી રહ્યા છીએ</p>
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
              {clients.filter(client =>
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.site.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((client) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg cursor-pointer rounded-xl hover:shadow-xl hover:border-blue-200"
                  onClick={() => setSelectedClient(client)}
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
              ))}
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
                    setSearchTerm('');
                  }}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">પાછા જાઓ</span>
                </button>
                <div className="text-center">
                  <h2 className="text-sm font-bold text-gray-900">{selectedClient.name}</h2>
                  <p className="text-xs text-blue-600">ID: {selectedClient.id}</p>
                </div>
                <div className="w-16"></div>
              </div>
            </div>

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
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
                    પ્લેટ પ્રવૃત્તિ ({filteredTransactions.length} ચલણ)
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                        <th className="px-2 py-2 font-bold text-left">ચલણ નં.</th>
                        <th className="px-2 py-2 font-bold text-center">તારીખ</th>
                        <th className="px-2 py-2 font-bold text-center">કુલ</th>
                        <th className="px-2 py-2 font-bold text-center">પ્રકાર</th>
                        <th className="px-2 py-2 font-bold text-center">ડ્રાઈવર</th>
                        <th className="px-2 py-2 font-bold text-center">ક્રિયાઓ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction) => (
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
                              {transaction.total_quantity}
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
                                  onClick={() => openEditModal(transaction)}
                                  className="p-1 text-blue-600 transition-colors rounded cursor-pointer hover:bg-blue-50"
                                  title="એડિટ"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                              ) : (
                                <div className="p-1 text-gray-400">
                                  <Lock className="w-3 h-3" />
                                </div>
                              )}
                              
                              {/* Download Button */}
                              <button
                                onClick={() => handleDownload(transaction)}
                                disabled={downloading === transaction.id}
                                className="p-1 text-green-600 transition-colors rounded hover:bg-green-50 disabled:opacity-50"
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
              </div>
            )}
          </>
        )}

        {/* Edit Modal */}
        {editModal.isOpen && editModal.transaction && user?.isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-900/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-4 border-blue-200">
              <div className="p-4 text-white bg-gradient-to-r from-blue-600 to-indigo-600">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    {editModal.transaction.type === 'udhar' ? 'ઉધાર' : 'જમા'} ચલણ એડિટ કરો - #{editModal.formData.number}
                  </h2>
                  <button
                    onClick={closeEditModal}
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
                      value={editModal.formData.number}
                      onChange={(e) => updateEditFormData('number', e.target.value)}
                      className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-blue-700">
                      તારીખ
                    </label>
                    <input
                      type="date"
                      value={editModal.formData.date}
                      onChange={(e) => updateEditFormData('date', e.target.value)}
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
                    value={editModal.formData.driver_name}
                    onChange={(e) => updateEditFormData('driver_name', e.target.value)}
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
                {stockValidation.length > 0 && editModal.transaction.type === 'udhar' && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg text-amber-600 bg-amber-50 border-amber-200">
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
                          <th className="px-3 py-2 font-medium text-left text-gray-700">સાઇઝ</th>
                          {editModal.transaction.type === 'udhar' && (
                            <th className="px-3 py-2 font-medium text-center text-gray-700">સ્ટોક</th>
                          )}
                          <th className="px-3 py-2 font-medium text-center text-gray-700">માત્રા</th>
                          <th className="px-3 py-2 font-medium text-center text-gray-700">બિજો ડેપો</th>
                          <th className="px-3 py-2 font-medium text-center text-gray-700">નોંધ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PLATE_SIZES.map(size => {
                          const stockInfo = getStockInfo(size);
                          const isInsufficient = isStockInsufficient(size);
                          const plateInfo = editModal.formData.items[size] || { quantity: 0, borrowed_stock: 0, notes: '' };
                          
                          return (
                            <tr key={size} className={`border-b hover:bg-gray-50 ${isInsufficient ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Package className="w-3 h-3 text-gray-500" />
                                  <span className="font-medium text-gray-900">{size}</span>
                                </div>
                              </td>
                              {editModal.transaction.type === 'udhar' && (
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
                                  value={plateInfo.quantity || ''}
                                  onChange={(e) => updateEditItem(size, 'quantity', parseInt(e.target.value) || 0)}
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
                                  value={plateInfo.borrowed_stock || ''}
                                  onChange={(e) => updateEditItem(size, 'borrowed_stock', parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 text-xs text-center border border-purple-300 rounded bg-purple-50 focus:ring-1 focus:ring-purple-200 focus:border-purple-500"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="text"
                                  value={plateInfo.notes || ''}
                                  onChange={(e) => updateEditItem(size, 'notes', e.target.value)}
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
                          {Object.values(editModal.formData.items).reduce((sum, data) => sum + (data.quantity || 0), 0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-2 bg-white border border-purple-200 rounded">
                      <div className="text-xs text-center">
                        <div className="font-medium text-purple-800">બિજો ડેપો</div>
                        <div className="text-lg font-bold text-purple-700">
                          {Object.values(editModal.formData.items).reduce((sum, data) => sum + (data.borrowed_stock || 0), 0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-2 rounded bg-gradient-to-r from-blue-500 to-indigo-500">
                      <div className="text-center">
                        <div className="text-xs font-medium text-blue-100">કુલ પ્લેટ</div>
                        <div className="text-lg font-bold text-white">
                          {Object.values(editModal.formData.items).reduce((sum, data) => sum + (data.quantity || 0) + (data.borrowed_stock || 0), 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-4 border-t-2 border-blue-100 sm:flex-row">
                  <button
                    onClick={handleSaveEdit}
                    disabled={hookLoading}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {hookLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    સેવ કરો
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={hookLoading}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    ડિલીટ કરો
                  </button>
                  <button
                    onClick={closeEditModal}
                    disabled={hookLoading}
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