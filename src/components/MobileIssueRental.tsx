import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Database } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { 
  FileText, 
  Package, 
  Save, 
  Loader2, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  User,
  Hash,
  MapPin,
  Search,
  Plus,
  ArrowLeft,
  Lock
} from "lucide-react";
import { generateJPGChallan, downloadJPGChallan } from "../utils/jpgChallanGenerator";
import { ChallanData } from "./challans/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Stock = Database["public"]["Tables"]["stock"]["Row"];

const PLATE_SIZES = [
  "2 X 3", "21 X 3", "18 X 3", "15 X 3", "12 X 3",
  "9 X 3", "પતરા", "2 X 2", "2 ફુટ"
];

interface StockValidation {
  size: string;
  requested: number;
  available: number;
}

// Optimized toast function
const showToast = (message: string, isSuccess: boolean = true, challanNumber?: string) => {
  const toastDiv = document.createElement('div');
  toastDiv.className = 'fixed inset-0 z-50 flex items-center justify-center';
  toastDiv.innerHTML = `
    <div class="animate-toast-slide-up">
      <div class="flex flex-col items-center gap-3 px-6 py-4 ${isSuccess ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-red-600 to-red-700'} rounded-xl shadow-xl max-w-sm mx-4">
        <div class="flex items-center justify-center w-12 h-12 bg-white/20 rounded-full">
          <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isSuccess ? 'M5 13l4 4L19 7' : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'}" />
          </svg>
        </div>
        <div class="text-center">
          <div class="text-base font-medium text-white">${message}</div>
          ${challanNumber ? `<div class="mt-1 text-sm text-orange-100">ચલણ નંબર: ${challanNumber}</div>` : ''}
        </div>
        ${isSuccess ? '<div class="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full"><svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></div>' : ''}
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-slide-up {
      0% { transform: scale(0.9); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .animate-toast-slide-up {
      animation: toast-slide-up 0.3s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toastDiv);

  setTimeout(() => {
    toastDiv.style.transition = 'all 0.3s ease-out';
    toastDiv.style.opacity = '0';
    toastDiv.style.transform = 'scale(0.9)';
    setTimeout(() => {
      document.body.removeChild(toastDiv);
      document.head.removeChild(style);
    }, 300);
  }, 3000);
};

export function MobileIssueRental() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [challanNumber, setChallanNumber] = useState("");
  const [suggestedChallanNumber, setSuggestedChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split("T")[0]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [borrowedStock, setBorrowedStock] = useState<Record<string, number>>({});
  const [driverName, setDriverName] = useState("");
  const [stockData, setStockData] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [stockValidation, setStockValidation] = useState<StockValidation[]>([]);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [previousDrivers, setPreviousDrivers] = useState<string[]>([]);
  const [showBorrowedColumn, setShowBorrowedColumn] = useState(false);

  // Enhanced refs for tab navigation
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Optimized callbacks
  const fetchStockData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("stock").select("*").order("plate_size");
      if (error) throw error;
      setStockData(data || []);
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  }, []);

  const fetchPreviousDriverNames = useCallback(async () => {
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
  }, []);

  const generateNextChallanNumber = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("challans")
        .select("challan_number")
        .order("id", { ascending: false })
        .limit(1);

      if (error) throw error;
      
      let nextNumber = "1";
      
      if (data && data.length > 0) {
        const lastChallanNumber = data[0].challan_number;
        const match = lastChallanNumber.match(/^(.*)(\d+)$/);
        
        if (match) {
          const prefix = match[1];
          const lastNumber = parseInt(match[2]);
          const incrementedNumber = lastNumber + 1;
          const digitCount = match[2].length;
          const paddedNumber = incrementedNumber.toString().padStart(digitCount, '0');
          nextNumber = prefix + paddedNumber;
        } else {
          nextNumber = lastChallanNumber + "1";
        }
      }
      
      setSuggestedChallanNumber(nextNumber);
      if (!challanNumber) setChallanNumber(nextNumber);
      
    } catch (error) {
      console.error("Error generating challan number:", error);
      const fallback = "1";
      setSuggestedChallanNumber(fallback);
      if (!challanNumber) setChallanNumber(fallback);
    }
  }, [challanNumber]);

  const validateStockAvailability = useCallback(() => {
    const insufficientStock: StockValidation[] = [];
    Object.entries(quantities).forEach(([size, quantity]) => {
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
  }, [quantities, stockData]);

  // Enhanced input handlers with tab navigation
  const handleQuantityChange = useCallback((size: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [size]: quantity }));
  }, []);

  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent, currentSize: string) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const currentIndex = PLATE_SIZES.indexOf(currentSize);
      const nextIndex = (currentIndex + 1) % PLATE_SIZES.length;
      const nextSize = PLATE_SIZES[nextIndex];
      const nextInput = quantityInputRefs.current[nextSize];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const currentIndex = PLATE_SIZES.indexOf(currentSize);
      const prevIndex = currentIndex === 0 ? PLATE_SIZES.length - 1 : currentIndex - 1;
      const prevSize = PLATE_SIZES[prevIndex];
      const prevInput = quantityInputRefs.current[prevSize];
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleQuantityChange(currentSize, (e.target as HTMLInputElement).value);
    }
  }, [handleQuantityChange]);

  const handleNoteChange = useCallback((size: string, value: string) => {
    setNotes(prev => ({ ...prev, [size]: value }));
  }, []);

  const handleBorrowedStockChange = useCallback((size: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setBorrowedStock(prev => ({ ...prev, [size]: quantity }));
  }, []);

  const handleChallanNumberChange = useCallback((value: string) => {
    setChallanNumber(value);
    if (!value.trim()) setChallanNumber(suggestedChallanNumber);
  }, [suggestedChallanNumber]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!challanNumber.trim()) {
        alert("ચલણ નંબર દાખલ કરો.");
        return;
      }

      // Check if challan number exists
      const { data: existingChallan } = await supabase
        .from("challans")
        .select("challan_number")
        .eq("challan_number", challanNumber)
        .limit(1);

      if (existingChallan && existingChallan.length > 0) {
        alert("ચલણ નંબર પહેલેથી અસ્તિત્વમાં છે. બીજો નંબર વાપરો.");
        return;
      }

      const validItems = PLATE_SIZES.filter(size => 
        (quantities[size] > 0) || (borrowedStock[size] > 0)
      );
      
      if (validItems.length === 0) {
        alert("ઓછામાં ઓછી એક પ્લેટની માત્રા અથવા બિજો ડેપો માત્રા દાખલ કરો.");
        return;
      }

      // Create challan
      const { data: challan, error: challanError } = await supabase
        .from("challans")
        .insert([{
          challan_number: challanNumber,
          client_id: selectedClient!.id,
          challan_date: challanDate,
          driver_name: driverName || null
        }])
        .select()
        .single();

      if (challanError) throw challanError;

      // Create line items
      const lineItems = validItems.map(size => ({
        challan_id: challan.id,
        plate_size: size,
        borrowed_quantity: quantities[size] || 0,
        borrowed_stock: borrowedStock[size] || 0,
        partner_stock_notes: notes[size]?.trim() || null
      }));

      const { error: lineItemsError } = await supabase
        .from("challan_items")
        .insert(lineItems);

      if (lineItemsError) throw lineItemsError;

      // Update stock quantities
      const stockUpdates = validItems
        .filter(size => quantities[size] > 0)
        .map(async (size) => {
          const regularQuantity = quantities[size];
          const stockItem = stockData.find(s => s.plate_size === size);
          if (stockItem) {
            const newAvailableQuantity = Math.max(0, stockItem.available_quantity - regularQuantity);
            const newOnRentQuantity = stockItem.on_rent_quantity + regularQuantity;
            
            return supabase
              .from('stock')
              .update({
                available_quantity: newAvailableQuantity,
                on_rent_quantity: newOnRentQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockItem.id);
          }
        });

      await Promise.all(stockUpdates.filter(Boolean));

      // Generate and download challan
      const newChallanData: ChallanData = {
        type: "issue",
        challan_number: challan.challan_number,
        date: challanDate,
        client: {
          id: selectedClient!.id,
          name: selectedClient!.name,
          site: selectedClient!.site || "",
          mobile: selectedClient!.mobile_number || ""
        },
        driver_name: driverName,
        plates: validItems.map(size => {
          const regularQty = quantities[size] || 0;
          const borrowedQty = borrowedStock[size] || 0;
          return {
            size,
            quantity: regularQty,
            borrowed_stock: borrowedQty,
            notes: notes[size] || "",
          };
        }),
        total_quantity: validItems.reduce((sum, size) => sum + (quantities[size] || 0), 0)
      };

      setChallanData(newChallanData);
      await new Promise(resolve => setTimeout(resolve, 500));

      const jpgDataUrl = await generateJPGChallan(newChallanData);
      downloadJPGChallan(jpgDataUrl, `issue-challan-${challan.challan_number}`);

      // Reset form
      setQuantities({});
      setNotes({});
      setBorrowedStock({});
      setChallanNumber("");
      setDriverName("");
      setSelectedClient(null);
      setStockValidation([]);
      setChallanData(null);
      setShowClientSelector(false);

      showToast("ચલણ સફળતાપૂર્વક બનાવવામાં આવ્યું!", true, challan.challan_number);
      await fetchStockData();
      await generateNextChallanNumber();
    } catch (error) {
      console.error("Error creating challan:", error);
      showToast("ચલણ બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.", false);
    } finally {
      setLoading(false);
    }
  }, [challanNumber, selectedClient, challanDate, driverName, quantities, borrowedStock, notes, stockData, fetchStockData, generateNextChallanNumber]);

  // Effects
  useEffect(() => { 
    fetchStockData(); 
    generateNextChallanNumber();
    fetchPreviousDriverNames();
  }, [fetchStockData, generateNextChallanNumber, fetchPreviousDriverNames]);
  
  useEffect(() => { 
    if (Object.keys(quantities).length > 0) validateStockAvailability(); 
  }, [validateStockAvailability]);

  // Enhanced Client Selector Component
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

    const fetchClients = useCallback(async () => {
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
    }, []);

    useEffect(() => {
      fetchClients();
    }, [fetchClients]);

    const handleAddClient = useCallback(async () => {
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
    }, [newClientData]);

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
              <label className="block mb-1 text-xs font-medium text-blue-700">
                ગ્રાહક ID *
              </label>
              <input
                type="text"
                placeholder="ગ્રાહક ID દાખલ કરો (જેમ કે: A001)"
                value={newClientData.id}
                onChange={e => setNewClientData(prev => ({ ...prev, id: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-200 focus:border-red-400"
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-blue-700">
                ગ્રાહકનું નામ *
              </label>
              <input
                type="text"
                placeholder="ગ્રાહકનું નામ દાખલ કરો"
                value={newClientData.name}
                onChange={e => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-200 focus:border-red-400"
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-blue-700">
                સાઇટ
              </label>
              <input
                type="text"
                placeholder="સાઇટનું નામ દાખલ કરો"
                value={newClientData.site}
                onChange={e => setNewClientData(prev => ({ ...prev, site: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-200 focus:border-red-400"
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-blue-700">
                મોબાઇલ નંબર
              </label>
              <input
                type="tel"
                placeholder="મોબાઇલ નંબર દાખલ કરો"
                value={newClientData.mobile_number}
                onChange={e => setNewClientData(prev => ({ ...prev, mobile_number: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-200 focus:border-red-400"
              />
            </div>
          </div>

          <button
            onClick={handleAddClient}
            className="w-full py-2 text-xs font-medium text-white transition-colors bg-green-500 rounded hover:bg-green-600"
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
            <User className="w-3 h-3 text-red-500" />
            <h3 className="text-xs font-medium text-gray-900">ગ્રાહક પસંદ કરો</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
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
            className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-200 focus:border-red-400 transition-all"
            placeholder="ગ્રાહક શોધો..."
          />
        </div>

        <div className="p-1 space-y-1 overflow-y-auto border border-gray-200 rounded max-h-80 bg-gray-50">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-4 h-4 mx-auto mb-2 text-red-500 animate-spin" />
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
                className="w-full p-2 text-xs text-left transition-all bg-white border border-gray-200 rounded shadow-sm hover:border-red-300 hover:bg-red-50 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full shadow-sm bg-gradient-to-r from-red-400 to-orange-500">
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
                    <div className="text-xs font-medium text-red-600">{client.mobile_number}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Memoized helper functions
  const getStockInfo = useCallback((size: string) => stockData.find(s => s.plate_size === size), [stockData]);
  const isStockInsufficient = useCallback((size: string) => stockValidation.some(item => item.size === size), [stockValidation]);

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
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
              તમારી પાસે માત્ર જોવાની પરવાનગી છે. નવા ચલણ બનાવવા માટે Admin સાથે સંપર્ક કરો.
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="p-4 space-y-4">
        {/* Compact Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-red-500 to-orange-500">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">ઉધાર ચલણ</h1>
          <p className="text-xs text-gray-600">નવો ભાડો બનાવો</p>
        </div>

        {/* Enhanced Client Selection */}
        <div className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500">
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
                <div className="p-2 border border-red-200 rounded bg-gradient-to-r from-red-50 to-orange-50">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-gradient-to-r from-red-500 to-orange-500">
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
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  ગ્રાહક બદલવો
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Issue Form */}
        {selectedClient && !showClientSelector && (
          <form onSubmit={handleSubmit} className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500">
              <h2 className="flex items-center gap-1 text-xs font-bold text-white">
                <Package className="w-3 h-3" />
                પ્લેટ ઇશ્યૂ
              </h2>
            </div>

            <div className="p-2 space-y-2">
              <div className="space-y-2">
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
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-200 focus:border-red-400"
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
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-200 focus:border-red-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-500" />
                        ડ્રાઈવરનું નામ
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={driverName}
                        onChange={e => setDriverName(e.target.value)}
                        list="driver-suggestions"
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-200 focus:border-red-400"
                        placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
                      />
                      <datalist id="driver-suggestions">
                        {previousDrivers.map((driver, index) => (
                          <option key={index} value={driver} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-transparent mb-0.5">.</label>
                    <button
                      type="button"
                      onClick={() => setShowBorrowedColumn(!showBorrowedColumn)}
                      className="flex items-center justify-center w-full gap-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded bg-blue-50 hover:bg-blue-100"
                    >
                      {showBorrowedColumn ? 'બિજો ડેપો છુપાવો' : 'બિજો ડેપો બતાવો'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stock Warning */}
              {stockValidation.length > 0 && (
                <div className="flex items-center gap-1 p-1 border rounded text-amber-700 bg-amber-50 border-amber-200">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">અપૂરતો સ્ટોક</span>
                </div>
              )}

              {/* Enhanced Table with Tab Navigation */}
              <div className="overflow-x-auto">
                <table className="w-full overflow-hidden text-xs rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-red-500 to-orange-500">
                      <th className="px-1 py-1 font-medium text-left">સાઇઝ</th>
                      <th className="px-1 py-1 font-medium text-center">સ્ટોક</th>
                      <th className="px-1 py-1 font-medium text-center">ઇશ્યૂ</th>
                      {showBorrowedColumn && (
                        <th className="px-1 py-1 font-medium text-center">બિજો ડેપો</th>
                      )}
                      {showBorrowedColumn && (
                        <th className="px-1 py-1 font-medium text-center">નોંધ</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {PLATE_SIZES.map((size, index) => {
                      const stockInfo = getStockInfo(size);
                      const isInsufficient = isStockInsufficient(size);
                      return (
                        <tr key={size} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${isInsufficient ? 'bg-red-50' : ''}`}>
                          <td className="px-1 py-1 font-medium">{size}</td>
                          <td className="px-1 py-1 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded font-bold ${
                              isInsufficient ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {stockInfo?.available_quantity || 0}
                            </span>
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              ref={el => quantityInputRefs.current[size] = el}
                              type="number"
                              min={0}
                              value={quantities[size] || ""}
                              onChange={e => handleQuantityChange(size, e.target.value)}
                              onKeyDown={e => handleQuantityKeyDown(e, size)}
                              onFocus={e => e.target.select()}
                              className={`w-10 px-0.5 py-0.5 border rounded text-center transition-all ${
                                isInsufficient ? 'border-red-300 bg-red-50' : 'border-gray-300'
                              } focus:ring-1 focus:ring-red-200 focus:border-red-400`}
                              placeholder="0"
                            />
                            {isInsufficient && (
                              <div className="text-xs text-red-600 mt-0.5">
                                માત્ર {stockValidation.find(item => item.size === size)?.available}
                              </div>
                            )}
                          </td>
                          {showBorrowedColumn && (
                            <>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  value={borrowedStock[size] || ""}
                                  onChange={e => handleBorrowedStockChange(size, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  className="w-10 px-0.5 py-0.5 border border-blue-300 rounded text-center bg-blue-50 focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="text"
                                  className="w-16 px-0.5 py-0.5 border border-gray-300 rounded focus:ring-1 focus:ring-red-200 focus:border-red-400"
                                  value={notes[size] || ""}
                                  onChange={e => handleNoteChange(size, e.target.value)}
                                  placeholder="નોંધ"
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Total with borrowed stock breakdown */}
              <div className="p-3 border border-red-200 rounded bg-red-50">
                <div className="flex items-center justify-between gap-2">
                  {/* Own Stock Issues */}
                  <div className="flex-1 p-2 bg-white border border-red-200 rounded">
                    <div className="text-xs text-center">
                      <div className="font-medium text-red-800">પોતાની પ્લેટ</div>
                      <div className="text-lg font-bold text-red-700">
                        {Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)}
                      </div>
                    </div>
                  </div>

                  {/* Borrowed Stock Issues */}
                  <div className={`flex-1 p-2 bg-white border rounded transition-all ${
                    showBorrowedColumn ? 'border-blue-200' : 'border-gray-200'
                  }`}>
                    <div className="text-xs text-center">
                      <div className={`font-medium ${
                        showBorrowedColumn ? 'text-blue-800' : 'text-gray-400'
                      }`}>
                        બિજો ડેપો
                      </div>
                      <div className={`text-lg font-bold ${
                        showBorrowedColumn ? 'text-blue-700' : 'text-gray-400'
                      }`}>
                        {showBorrowedColumn 
                          ? Object.values(borrowedStock).reduce((sum, qty) => sum + (qty || 0), 0)
                          : 0}
                      </div>
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="flex-1 p-2 rounded bg-gradient-to-r from-red-500 to-orange-500">
                    <div className="text-center">
                      <div className="text-xs font-medium text-red-100">કુલ પ્લેટ</div>
                      <div className="text-lg font-bold text-white">
                        {Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0) +
                         (showBorrowedColumn ? Object.values(borrowedStock).reduce((sum, qty) => sum + (qty || 0), 0) : 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center w-full gap-1 py-2 text-xs font-medium text-white transition-all rounded bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    ઉધાર ચલણ બનાવો
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
