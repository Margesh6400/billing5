import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { ClientSelector } from './ClientSelector';
import { 
  FileText, 
  Package, 
  Save, 
  Loader2, 
  Calendar, 
  AlertTriangle, 
  Lock, 
  Building2, 
  Users,
  Hash,
  MapPin,
  Search,
  Plus,
  ArrowLeft,
  User
} from 'lucide-react';
import { PrintableChallan } from './challans/PrintableChallan';
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator';
import { ChallanData } from './challans/types';
import { useAuth } from '../hooks/useAuth';

type Client = Database['public']['Tables']['clients']['Row'];

interface EnhancedStock {
  id: number;
  plate_size: string;
  total_quantity: number;
  ss: number;
  sk: number;
  etc: number;
  borrowed_stock: number;
  new_and_old: number;
  available_quantity: number;
  on_rent_quantity: number;
  updated_at: string;
}

interface StockQuantities {
  own: number;
  ss: number;
  sk: number;
  etc: number;
}

interface StockValidation {
  size: string;
  type: 'own' | 'ss' | 'sk' | 'etc';
  requested: number;
  available: number;
}

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function EnhancedIssueRental() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [suggestedChallanNumber, setSuggestedChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverName, setDriverName] = useState('');
  const [quantities, setQuantities] = useState<Record<string, StockQuantities>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [stockData, setStockData] = useState<EnhancedStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [stockValidation, setStockValidation] = useState<StockValidation[]>([]);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [previousDrivers, setPreviousDrivers] = useState<string[]>([]);

  useEffect(() => {
    fetchStockData();
    generateNextChallanNumber();
    fetchPreviousDriverNames();
  }, []);

  useEffect(() => {
    validateStockAvailability();
  }, [quantities, stockData]);

  async function fetchPreviousDriverNames() {
    try {
      const { data } = await supabase
        .from('challans')
        .select('driver_name')
        .not('driver_name', 'is', null)
        .order('created_at', { ascending: false });

      if (data) {
        const uniqueDrivers = [...new Set(data
          .map(challan => challan.driver_name)
          .filter(name => name && name.trim()))] as string[];
        setPreviousDrivers(uniqueDrivers);
      }
    } catch (error) {
      console.error('Error fetching previous driver names:', error);
    }
  }

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

  const generateNextChallanNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('challans')
        .select('challan_number')
        .order('id', { ascending: false });

      if (error) throw error;

      let maxNumber = 0;
      if (data && data.length > 0) {
        data.forEach(challan => {
          const match = challan.challan_number.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });
      }

      const nextNumber = (maxNumber + 1).toString();
      setSuggestedChallanNumber(nextNumber);
      
      if (!challanNumber) {
        setChallanNumber(nextNumber);
      }
    } catch (error) {
      console.error('Error generating challan number:', error);
      const fallback = '1';
      setSuggestedChallanNumber(fallback);
      if (!challanNumber) {
        setChallanNumber(fallback);
      }
    }
  };

  const handleChallanNumberChange = (value: string) => {
    setChallanNumber(value);
    if (!value.trim()) {
      setChallanNumber(suggestedChallanNumber);
    }
  };

  const validateStockAvailability = () => {
    const insufficientStock: StockValidation[] = [];
    
    Object.entries(quantities).forEach(([size, stockQty]) => {
      const stock = stockData.find(s => s.plate_size === size);
      if (!stock) return;

      if (stockQty.own > stock.total_quantity) {
        insufficientStock.push({
          size,
          type: 'own',
          requested: stockQty.own,
          available: stock.total_quantity
        });
      }
      if (stockQty.ss > stock.ss) {
        insufficientStock.push({
          size,
          type: 'ss',
          requested: stockQty.ss,
          available: stock.ss
        });
      }
      if (stockQty.sk > stock.sk) {
        insufficientStock.push({
          size,
          type: 'sk',
          requested: stockQty.sk,
          available: stock.sk
        });
      }
      if (stockQty.etc > stock.etc) {
        insufficientStock.push({
          size,
          type: 'etc',
          requested: stockQty.etc,
          available: stock.etc
        });
      }
    });
    
    setStockValidation(insufficientStock);
  };

  const handleQuantityChange = (size: string, type: keyof StockQuantities, value: string) => {
    const quantity = parseInt(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [size]: {
        ...prev[size] || { own: 0, ss: 0, sk: 0, etc: 0 },
        [type]: quantity
      }
    }));
  };

  const getTotalQuantityForSize = (size: string) => {
    const stockQty = quantities[size];
    if (!stockQty) return 0;
    return stockQty.own + stockQty.ss + stockQty.sk + stockQty.etc;
  };

  const getGrandTotal = () => {
    return PLATE_SIZES.reduce((sum, size) => sum + getTotalQuantityForSize(size), 0);
  };

  const checkChallanNumberExists = async (challanNumber: string) => {
    const { data, error } = await supabase
      .from('challans')
      .select('challan_number')
      .eq('challan_number', challanNumber)
      .limit(1);

    return data && data.length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!challanNumber.trim()) {
        alert('ચલણ નંબર દાખલ કરો.');
        return;
      }

      const exists = await checkChallanNumberExists(challanNumber);
      if (exists) {
        alert('ચલણ નંબર પહેલેથી અસ્તિત્વમાં છે. બીજો નંબર વાપરો.');
        return;
      }

      const validItems = PLATE_SIZES.filter(size => getTotalQuantityForSize(size) > 0);
      
      if (validItems.length === 0) {
        alert('ઓછામાં ઓછી એક પ્લેટની માત્રા દાખલ કરો.');
        return;
      }

      if (stockValidation.length > 0) {
        alert('સ્ટોક વેલિડેશન એરર ઠીક કરો.');
        return;
      }

      const { data: challan, error: challanError } = await supabase
        .from('challans')
        .insert([{
          challan_number: challanNumber,
          client_id: selectedClient!.id,
          challan_date: challanDate,
          driver_name: driverName || null,
          partner_id: 'MAIN'
        }])
        .select()
        .single();

      if (challanError) throw challanError;

      const lineItems = validItems.map(size => {
        const stockQty = quantities[size];
        const totalQty = getTotalQuantityForSize(size);
        
        return {
          challan_id: challan.id,
          plate_size: size,
          borrowed_quantity: totalQty,
          own_quantity: stockQty.own,
          ss_quantity: stockQty.ss,
          sk_quantity: stockQty.sk,
          etc_quantity: stockQty.etc,
          stock_source: 'mixed',
          partner_stock_notes: notes[size]?.trim() || null,
          partner_id: 'MAIN'
        };
      });

      const { error: lineItemsError } = await supabase
        .from('challan_items')
        .insert(lineItems);

      if (lineItemsError) throw lineItemsError;

      const newChallanData: ChallanData = {
        type: 'issue',
        challan_number: challan.challan_number,
        date: challanDate,
        client: {
          id: selectedClient!.id,
          name: selectedClient!.name,
          site: selectedClient!.site || '',
          mobile: selectedClient!.mobile_number || ''
        },
        driver_name: driverName,
        plates: validItems.map(size => ({
          size,
          quantity: getTotalQuantityForSize(size),
          notes: notes[size] || '',
        })),
        total_quantity: getGrandTotal()
      };

      setChallanData(newChallanData);
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const jpgDataUrl = await generateJPGChallan(newChallanData);
        downloadJPGChallan(jpgDataUrl, `enhanced-issue-challan-${challan.challan_number}`);

        setQuantities({});
        setNotes({});
        setChallanNumber('');
        setDriverName('');
        setSelectedClient(null);
        setStockValidation([]);
        setChallanData(null);
        setShowClientSelector(false);
        
        alert(`ચલણ ${challan.challan_number} સફળતાપૂર્વક બનાવવામાં આવ્યું અને ડાઉનલોડ થયું!`);
        await fetchStockData();
      } catch (error) {
        console.error('JPG generation failed:', error);
        alert('JPG જનરેશનમાં ભૂલ. ચલણ બન્યું પણ ડાઉનલોડ ન થયું.');
      }
    } catch (error) {
      console.error('Error creating challan:', error);
      alert('ચલણ બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setLoading(false);
    }
  };

  const getStockInfo = (size: string) => {
    return stockData.find(s => s.plate_size === size);
  };

  const isStockInsufficient = (size: string, type: keyof StockQuantities) => {
    return stockValidation.some(item => item.size === size && item.type === type);
  };

  // Enhanced Client Selector Component for Mobile
  function CompactClientSelector() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newClientData, setNewClientData] = useState({
      id: "",
      name: "",
      site: "",
      mobile_number: ""
    });

    useEffect(() => {
      fetchClients();
    }, []);

    async function fetchClients() {
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .order("id");
        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    }

    async function handleAddClient() {
      if (!newClientData.id.trim()) {
        alert("ગ્રાહક ID દાખલ કરો");
        return;
      }
      if (!newClientData.name.trim()) {
        alert("ગ્રાહકનું નામ દાખલ કરો");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("clients")
          .insert([newClientData])
          .select()
          .single();

        if (error) throw error;

        setClients(prev => [...prev, data]);
        setNewClientData({ id: "", name: "", site: "", mobile_number: "" });
        setShowAddForm(false);
        alert("નવો ગ્રાહક ઉમેરવામાં આવ્યો!");
      } catch (error) {
        console.error("Error adding client:", error);
        alert("ગ્રાહક ઉમેરવામાં ભૂલ થઈ. કદાચ આ ID પહેલેથી અસ્તિત્વમાં છે.");
      }
    }

    const filteredClients = clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.site || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showAddForm) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-900">નવો ગ્રાહક ઉમેરો</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block mb-1 text-xs font-medium" style={{ color: '#CC0000' }}>
                ગ્રાહક ID *
              </label>
              <input
                type="text"
                placeholder="ગ્રાહક ID દાખલ કરો (જેમ કે: A001)"
                value={newClientData.id}
                onChange={e => setNewClientData(prev => ({ ...prev, id: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:border-red-400"
                style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium" style={{ color: '#CC0000' }}>
                ગ્રાહકનું નામ *
              </label>
              <input
                type="text"
                placeholder="ગ્રાહકનું નામ દાખલ કરો"
                value={newClientData.name}
                onChange={e => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:border-red-400"
                style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium" style={{ color: '#CC0000' }}>
                સાઇટ
              </label>
              <input
                type="text"
                placeholder="સાઇટનું નામ દાખલ કરો"
                value={newClientData.site}
                onChange={e => setNewClientData(prev => ({ ...prev, site: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:border-red-400"
                style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium" style={{ color: '#CC0000' }}>
                મોબાઇલ નંબર
              </label>
              <input
                type="tel"
                placeholder="મોબાઇલ નંબર દાખલ કરો"
                value={newClientData.mobile_number}
                onChange={e => setNewClientData(prev => ({ ...prev, mobile_number: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:border-red-400"
                style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
              />
            </div>
          </div>

          <button
            onClick={handleAddClient}
            className="w-full py-2 text-xs font-medium text-white transition-colors rounded"
            style={{ backgroundColor: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#7C0A02'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#CC0000'}
          >
            ગ્રાહક ઉમેરો
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" style={{ color: '#CC0000' }} />
            <h3 className="text-xs font-medium text-gray-900">ગ્રાહક પસંદ કરો</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs font-medium hover:opacity-80"
            style={{ color: '#CC0000' }}
          >
            <Plus className="w-3 h-3" />
            નવો ઉમેરો
          </button>
        </div>

        <div className="relative">
          <Search className="absolute w-3 h-3 text-gray-400 -translate-y-1/2 left-2 top-1/2" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:border-red-400 transition-all"
            style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
            placeholder="ગ્રાહક શોધો..."
          />
        </div>

        <div className="p-1 space-y-1 overflow-y-auto border border-gray-200 rounded max-h-80 bg-gray-50">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-4 h-4 mx-auto mb-2 animate-spin" style={{ color: '#CC0000' }} />
              <p className="text-xs text-gray-500">લોડ થઈ રહ્યું છે...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <User className="w-6 h-6 mx-auto mb-2 text-gray-300" />
              <p className="text-xs font-medium">કોઈ ગ્રાહક મળ્યો નથી</p>
              <p className="mt-1 text-xs">શોધ શબ્દ બદલીને પ્રયત્ન કરો</p>
            </div>
          ) : (
            filteredClients.map(client => (
              <button
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setShowClientSelector(false);
                }}
                className="w-full p-2 text-xs text-left transition-all bg-white border border-gray-200 rounded shadow-sm hover:shadow-md"
                style={{ '--hover-border': '#CB4154', '--hover-bg': '#fef2f2' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#CB4154';
                  e.currentTarget.style.backgroundColor = '#fef2f2';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full shadow-sm"
                    style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{client.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Hash className="w-2 h-2" />
                        {client.id}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2 h-2" />
                        {client.site}
                      </span>
                    </div>
                    <div className="text-xs font-medium" style={{ color: '#CC0000' }}>{client.mobile_number}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fef7ed 50%, #fdf2f8 100%)' }}>
        <div className="p-3 space-y-3">
          <div className="pt-2 text-center">
            <div 
              className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg"
              style={{ background: 'linear-gradient(to right, #6b7280, #4b5563)' }}
            >
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
              તમારી પાસે માત્ર જોવાની પરવાનગી છે. નવા ચલણ બનાવવા માટે Admin સાથે સંપર્ક કરો.
            </p>
            <p className="text-xs" style={{ color: '#CC0000' }}>
              Admin: nilkanthplatdepo@gmail.com
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fef7ed 50%, #fdf2f8 100%)' }}>
      {/* Hidden Printable Challan */}
      <div style={{ 
        position: 'absolute', 
        top: '-10000px', 
        left: '0', 
        width: '800px', 
        height: 'auto',
        backgroundColor: 'white'
      }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`} style={{ 
            transform: 'scale(1)', 
            transformOrigin: 'top left',
            width: '100%'
          }}>
            <PrintableChallan data={challanData} />
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Compact Header */}
        <div className="pt-2 text-center">
          <div 
            className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg"
            style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
          >
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">એન્હાન્સ્ડ ઉધાર ચલણ</h1>
          <p className="text-xs text-gray-600">વિગતવાર સ્ટોક ટ્રેકિંગ સાથે નવો ભાડો બનાવો</p>
        </div>

        {/* Enhanced Client Selection */}
        <div className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
          <div 
            className="p-2"
            style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
          >
            <h2 className="flex items-center gap-1 text-xs font-bold text-white">
              <User className="w-3 h-3" />
              ગ્રાહક
            </h2>
          </div>
          
          <div className="p-2">
            {!selectedClient || showClientSelector ? (
              <CompactClientSelector />
            ) : (
              <div className="space-y-2">
                <div 
                  className="p-2 border rounded"
                  style={{ 
                    borderColor: '#E2725B',
                    background: 'linear-gradient(to right, #fef2f2, #fef7ed)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full"
                      style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
                    >
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-gray-900">{selectedClient.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="flex items-center gap-0.5">
                          <Hash className="w-2 h-2" />
                          {selectedClient.id}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2 h-2" />
                          {selectedClient.site}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowClientSelector(true)}
                  className="text-xs font-medium hover:opacity-80"
                  style={{ color: '#CC0000' }}
                >
                  ગ્રાહક બદલવો
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Enhanced Issue Form */}
        {selectedClient && !showClientSelector && (
          <form onSubmit={handleSubmit} className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
            <div 
              className="p-2"
              style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
            >
              <h2 className="flex items-center gap-1 text-xs font-bold text-white">
                <Package className="w-3 h-3" />
                એન્હાન્સ્ડ પ્લેટ ઇશ્યૂ
              </h2>
            </div>

            <div className="p-2 space-y-2">
              {/* Compact Form Header */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    ચલણ નંબર *
                  </label>
                  <input
                    type="text"
                    value={challanNumber}
                    onChange={(e) => handleChallanNumberChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:border-red-400"
                    style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
                    placeholder={suggestedChallanNumber}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    તારીખ *
                  </label>
                  <input
                    type="date"
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    required
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:border-red-400"
                    style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
                  />
                </div>
              </div>

              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  ડ્રાઈવરનું નામ
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    list="driver-suggestions"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:border-red-400"
                    style={{ '--tw-ring-color': '#E2725B' } as React.CSSProperties}
                    placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
                  />
                  <datalist id="driver-suggestions">
                    {previousDrivers.map((driver, index) => (
                      <option key={index} value={driver} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Stock Validation Warnings */}
              {stockValidation.length > 0 && (
                <div className="flex items-center gap-1 p-1 text-red-700 border border-red-200 rounded bg-red-50">
                  <AlertTriangle className="w-3 h-3" />
                  <div className="text-xs">
                    સ્ટોક એરર: {stockValidation.map(error => 
                      `${error.size}-${error.type.toUpperCase()}(${error.requested}>${error.available})`
                    ).join(', ')}
                  </div>
                </div>
              )}

              {/* Enhanced Compact Table */}
              <div className="overflow-x-auto">
                <table className="w-full overflow-hidden text-xs rounded">
                  <thead>
                    <tr 
                      className="text-white"
                      style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
                    >
                      <th className="px-1 py-1 font-medium text-left">સાઇઝ</th>
                      <th className="px-1 py-1 font-medium text-center">
                        <div className="flex flex-col items-center">
                          <Building2 className="w-2 h-2 mb-0.5" />
                          <span>પોતે</span>
                        </div>
                      </th>
                      <th className="px-1 py-1 font-medium text-center">
                        <div className="flex flex-col items-center">
                          <Users className="w-2 h-2 mb-0.5" />
                          <span>SS</span>
                        </div>
                      </th>
                      <th className="px-1 py-1 font-medium text-center">
                        <div className="flex flex-col items-center">
                          <Users className="w-2 h-2 mb-0.5" />
                          <span>SK</span>
                        </div>
                      </th>
                      <th className="px-1 py-1 font-medium text-center">
                        <div className="flex flex-col items-center">
                          <Package className="w-2 h-2 mb-0.5" />
                          <span>ETC</span>
                        </div>
                      </th>
                      <th className="px-1 py-1 font-medium text-center">કુલ</th>
                      <th className="px-1 py-1 font-medium text-center">નોંધ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLATE_SIZES.map((size, index) => {
                      const stockInfo = getStockInfo(size);
                      const stockQty = quantities[size] || { own: 0, ss: 0, sk: 0, etc: 0 };
                      const rowTotal = getTotalQuantityForSize(size);
                      
                      return (
                        <tr key={size} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                          <td className="px-1 py-1 font-medium">{size}</td>
                          
                          {/* Own Stock */}
                          <td className="px-1 py-1 text-center">
                            <div className="text-xs mb-0.5" style={{ color: '#CC0000' }}>
                              {stockInfo?.total_quantity || 0}
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={stockInfo?.total_quantity || 0}
                              value={stockQty.own || ""}
                              onChange={e => handleQuantityChange(size, 'own', e.target.value)}
                              className={`w-8 px-0.5 py-0.5 border rounded text-center ${
                                isStockInsufficient(size, 'own') 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-red-300'
                              }`}
                              placeholder="0"
                              style={{ borderColor: isStockInsufficient(size, 'own') ? '#fca5a5' : '#CB4154' }}
                            />
                          </td>
                          
                          {/* SS Stock */}
                          <td className="px-1 py-1 text-center">
                            <div className="text-xs mb-0.5" style={{ color: '#B7410E' }}>
                              {stockInfo?.ss || 0}
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={stockInfo?.ss || 0}
                              value={stockQty.ss || ""}
                              onChange={e => handleQuantityChange(size, 'ss', e.target.value)}
                              className={`w-8 px-0.5 py-0.5 border rounded text-center ${
                                isStockInsufficient(size, 'ss') 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-orange-600'
                              }`}
                              placeholder="0"
                              style={{ borderColor: isStockInsufficient(size, 'ss') ? '#fca5a5' : '#B7410E' }}
                            />
                          </td>
                          
                          {/* SK Stock */}
                          <td className="px-1 py-1 text-center">
                            <div className="text-xs mb-0.5" style={{ color: '#E2725B' }}>
                              {stockInfo?.sk || 0}
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={stockInfo?.sk || 0}
                              value={stockQty.sk || ""}
                              onChange={e => handleQuantityChange(size, 'sk', e.target.value)}
                              className={`w-8 px-0.5 py-0.5 border rounded text-center ${
                                isStockInsufficient(size, 'sk') 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-orange-300'
                              }`}
                              placeholder="0"
                              style={{ borderColor: isStockInsufficient(size, 'sk') ? '#fca5a5' : '#E2725B' }}
                            />
                          </td>
                          
                          {/* ETC Stock */}
                          <td className="px-1 py-1 text-center">
                            <div className="text-xs mb-0.5" style={{ color: '#7C0A02' }}>
                              {stockInfo?.etc || 0}
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={stockInfo?.etc || 0}
                              value={stockQty.etc || ""}
                              onChange={e => handleQuantityChange(size, 'etc', e.target.value)}
                              className={`w-8 px-0.5 py-0.5 border rounded text-center ${
                                isStockInsufficient(size, 'etc') 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-red-800'
                              }`}
                              placeholder="0"
                              style={{ borderColor: isStockInsufficient(size, 'etc') ? '#fca5a5' : '#7C0A02' }}
                            />
                          </td>
                          
                          {/* Row Total */}
                          <td className="px-1 py-1 text-center">
                            <span 
                              className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded"
                              style={{ background: 'linear-gradient(to right, #CC0000, #CB4154)' }}
                            >
                              {rowTotal}
                            </span>
                          </td>
                          
                          {/* Notes */}
                          <td className="px-1 py-1 text-center">
                            <input
                              type="text"
                              className="w-16 px-0.5 py-0.5 border border-gray-300 rounded text-xs"
                              value={notes[size] || ""}
                              onChange={e => setNotes(prev => ({
                                ...prev,
                                [size]: e.target.value
                              }))}
                              placeholder="નોંધ"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  
                  {/* Grand Total Footer */}
                  <tfoot>
                    <tr style={{ backgroundColor: '#fef2f2', borderTop: '2px solid #E2725B' }}>
                      <td className="px-1 py-2 text-xs font-bold" style={{ color: '#7C0A02' }}>કુલ</td>
                      <td className="px-1 py-2 text-xs font-bold text-center" style={{ color: '#CC0000' }}>
                        {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.own || 0), 0)}
                      </td>
                      <td className="px-1 py-2 text-xs font-bold text-center" style={{ color: '#B7410E' }}>
                        {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.ss || 0), 0)}
                      </td>
                      <td className="px-1 py-2 text-xs font-bold text-center" style={{ color: '#E2725B' }}>
                        {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.sk || 0), 0)}
                      </td>
                      <td className="px-1 py-2 text-xs font-bold text-center" style={{ color: '#7C0A02' }}>
                        {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.etc || 0), 0)}
                      </td>
                      <td className="px-1 py-2 text-center">
                        <span 
                          className="inline-flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full"
                          style={{ background: 'linear-gradient(to right, #7C0A02, #CC0000)' }}
                        >
                          {getGrandTotal()}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-xs text-center">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Compact Submit Button */}
              <button
                type="submit"
                disabled={loading || stockValidation.length > 0}
                className="flex items-center justify-center w-full gap-1 py-2 text-xs font-medium text-white transition-all rounded disabled:opacity-50"
                style={{ 
                  background: loading || stockValidation.length > 0 
                    ? '#9ca3af' 
                    : 'linear-gradient(to right, #7C0A02, #CC0000)'
                }}
                onMouseEnter={e => {
                  if (!loading && stockValidation.length === 0) {
                    e.currentTarget.style.background = 'linear-gradient(to right, #7C0A02, #B7410E)';
                  }
                }}
                onMouseLeave={e => {
                  if (!loading && stockValidation.length === 0) {
                    e.currentTarget.style.background = 'linear-gradient(to right, #7C0A02, #CC0000)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    એન્હાન્સ્ડ ચલણ બનાવો
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
