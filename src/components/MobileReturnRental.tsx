import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Database } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { 
  RotateCcw, 
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

interface OutstandingPlates {
  [key: string]: number;
}

interface BorrowedStockData {
  [key: string]: number;
}

export function MobileReturnRental() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [returnChallanNumber, setReturnChallanNumber] = useState("");
  const [suggestedChallanNumber, setSuggestedChallanNumber] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [driverName, setDriverName] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [damagedQuantities, setDamagedQuantities] = useState<Record<string, number>>({});
  const [lostQuantities, setLostQuantities] = useState<Record<string, number>>({});
  const [borrowedStockReturns, setBorrowedStockReturns] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [outstandingPlates, setOutstandingPlates] = useState<OutstandingPlates>({});
  const [outstandingBorrowedStock, setOutstandingBorrowedStock] = useState<BorrowedStockData>({});
  const [previousDrivers, setPreviousDrivers] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Stock[]>([]);

  useEffect(() => { 
    generateNextChallanNumber(); 
    fetchPreviousDriverNames();
    fetchStockData();
  }, []);
  
  useEffect(() => { 
    if (selectedClient) {
      fetchOutstandingPlates();
      fetchOutstandingBorrowedStock();
    }
  }, [selectedClient]);

  async function fetchStockData() {
    try {
      const { data, error } = await supabase.from("stock").select("*").order("plate_size");
      if (error) throw error;
      setStockData(data || []);
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  }

  async function fetchPreviousDriverNames() {
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
  }

  async function fetchOutstandingPlates() {
    if (!selectedClient) return;
    
    try {
      // Get all issued plates for this client1
      const { data: challans } = await supabase
        .from("challans")
        .select("challan_items (plate_size, borrowed_quantity)")
        .eq("client_id", selectedClient.id);

      // Get all returned plates for this client
      const { data: returns } = await supabase
        .from("returns")
        .select("return_line_items (plate_size, returned_quantity)")
        .eq("client_id", selectedClient.id);

      const outstanding: OutstandingPlates = {};
      
      // Add issued quantities
      challans?.forEach((challan) => {
        challan.challan_items.forEach(item => {
          outstanding[item.plate_size] = (outstanding[item.plate_size] || 0) + item.borrowed_quantity;
        });
      });

      // Subtract returned quantities
      returns?.forEach((returnRecord) => {
        returnRecord.return_line_items.forEach(item => {
          outstanding[item.plate_size] = (outstanding[item.plate_size] || 0) - item.returned_quantity;
        });
      });

      setOutstandingPlates(outstanding);
    } catch (error) {
      console.error("Error fetching outstanding plates:", error);
      setOutstandingPlates({});
    }
  }

  async function fetchOutstandingBorrowedStock() {
    if (!selectedClient) return;
    
    try {
      // Get all borrowed stock for this client from active challans
      const { data: challans } = await supabase
        .from("challans")
        .select("challan_items (plate_size, borrowed_stock)")
        .eq("client_id", selectedClient.id)
        .eq("status", "active");

      // Get all returned borrowed stock for this client
      const { data: returns } = await supabase
        .from("returns")
        .select("return_line_items (plate_size, returned_borrowed_stock)")
        .eq("client_id", selectedClient.id);

      const outstandingBorrowed: BorrowedStockData = {};
      
      // Add borrowed stock quantities
      challans?.forEach((challan) => {
        challan.challan_items.forEach(item => {
          if (item.borrowed_stock > 0) {
            outstandingBorrowed[item.plate_size] = (outstandingBorrowed[item.plate_size] || 0) + item.borrowed_stock;
          }
        });
      });

      // Subtract returned borrowed stock quantities
      returns?.forEach((returnRecord) => {
        returnRecord.return_line_items.forEach(item => {
          if (item.returned_borrowed_stock > 0) {
            outstandingBorrowed[item.plate_size] = (outstandingBorrowed[item.plate_size] || 0) - item.returned_borrowed_stock;
          }
        });
      });

      setOutstandingBorrowedStock(outstandingBorrowed);
    } catch (error) {
      console.error("Error fetching outstanding borrowed stock:", error);
      setOutstandingBorrowedStock({});
    }
  }

  async function generateNextChallanNumber() {
    try {
      const { data, error } = await supabase
        .from("returns")
        .select("return_challan_number")
        .order("id", { ascending: false })
        .limit(1);

      if (error) throw error;
      
      let nextNumber = "1";
      
      if (data && data.length > 0) {
        const lastChallanNumber = data[0].return_challan_number;
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
      if (!returnChallanNumber) setReturnChallanNumber(nextNumber);
      
    } catch (error) {
      console.error("Error generating challan number:", error);
      const fallback = "1";
      setSuggestedChallanNumber(fallback);
      if (!returnChallanNumber) setReturnChallanNumber(fallback);
    }
  }

  function handleChallanNumberChange(value: string) {
    setReturnChallanNumber(value);
    if (!value.trim()) setReturnChallanNumber(suggestedChallanNumber);
  }

  function handleQuantityChange(size: string, value: string) {
    const quantity = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [size]: quantity }));
  }

  function handleDamagedQuantityChange(size: string, value: string) {
    const quantity = parseInt(value) || 0;
    setDamagedQuantities(prev => ({ ...prev, [size]: quantity }));
  }

  function handleLostQuantityChange(size: string, value: string) {
    const quantity = parseInt(value) || 0;
    setLostQuantities(prev => ({ ...prev, [size]: quantity }));
  }

  function handleBorrowedStockReturnChange(size: string, value: string) {
    const quantity = parseInt(value) || 0;
    setBorrowedStockReturns(prev => ({ ...prev, [size]: quantity }));
  }

  function handleNoteChange(size: string, value: string) {
    setNotes(prev => ({ ...prev, [size]: value }));
  }

  async function updateStockAfterReturn() {
    try {
      // Update stock quantities for returned plates
      for (const [plateSize, returnedQty] of Object.entries(quantities)) {
        if (returnedQty > 0) {
          const stockItem = stockData.find(s => s.plate_size === plateSize);
          if (stockItem) {
            const damagedQty = damagedQuantities[plateSize] || 0;
            const lostQty = lostQuantities[plateSize] || 0;
            const goodReturnedQty = returnedQty - damagedQty - lostQty;
            
            // Update stock: add good returned plates back to available stock
            const newAvailableQuantity = stockItem.available_quantity + goodReturnedQty;
            const newOnRentQuantity = Math.max(0, stockItem.on_rent_quantity - returnedQty);
            
            const { error } = await supabase
              .from('stock')
              .update({
                available_quantity: newAvailableQuantity,
                on_rent_quantity: newOnRentQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockItem.id);

            if (error) throw error;
          }
        }
      }
      
      // Refresh stock data
      await fetchStockData();
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  async function checkReturnChallanNumberExists(challanNumber: string) {
    const { data, error } = await supabase
      .from("returns")
      .select("return_challan_number")
      .eq("return_challan_number", challanNumber)
      .limit(1);
    return data && data.length > 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (!returnChallanNumber.trim()) {
        alert("જમા ચલણ નંબર દાખલ કરો.");
        return;
      }

      const exists = await checkReturnChallanNumberExists(returnChallanNumber);
      if (exists) {
        alert("જમા ચલણ નંબર પહેલેથી અસ્તિત્વમાં છે. બીજો નંબર વાપરો.");
        return;
      }

      const validItems = PLATE_SIZES.filter(size => quantities[size] > 0);
      if (validItems.length === 0) {
        alert("ઓછામાં ઓછી એક પ્લેટની માત્રા દાખલ કરો.");
        return;
      }

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from("returns")
        .insert([{
          return_challan_number: returnChallanNumber,
          client_id: selectedClient!.id,
          return_date: returnDate,
          driver_name: driverName || null
        }])
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return line items with borrowed stock tracking
      const lineItems = validItems.map(size => ({
        return_id: returnRecord.id,
        plate_size: size,
        returned_quantity: quantities[size],
        damaged_quantity: damagedQuantities[size] || 0,
        lost_quantity: lostQuantities[size] || 0,
        returned_borrowed_stock: borrowedStockReturns[size] || 0,
        damage_notes: notes[size]?.trim() || null
      }));

      const { error: lineItemsError } = await supabase
        .from("return_line_items")
        .insert(lineItems);

      if (lineItemsError) throw lineItemsError;

      // Update stock quantities
      await updateStockAfterReturn();

      // Prepare challan data for PDF
      const newChallanData: ChallanData = {
        type: "return",
        challan_number: returnRecord.return_challan_number,
        date: returnDate,
        client: {
          id: selectedClient!.id,
          name: selectedClient!.name,
          site: selectedClient!.site || "",
          mobile: selectedClient!.mobile_number || ""
        },
        driver_name: driverName || undefined,
        plates: validItems.map(size => ({
          size,
          quantity: quantities[size],
          damaged_quantity: damagedQuantities[size] || 0,
          lost_quantity: lostQuantities[size] || 0,
          notes: notes[size] || "",
        })),
        total_quantity: validItems.reduce((sum, size) => sum + quantities[size], 0)
      };

      setChallanData(newChallanData);
      await new Promise(resolve => setTimeout(resolve, 500));

      const jpgDataUrl = await generateJPGChallan(newChallanData);
      downloadJPGChallan(jpgDataUrl, `return-challan-${returnRecord.return_challan_number}`);

      // Reset form
      setQuantities({});
      setNotes({});
      setDamagedQuantities({});
      setLostQuantities({});
      setBorrowedStockReturns({});
      setReturnChallanNumber("");
      setSelectedClient(null);
      setChallanData(null);
      setShowClientSelector(false);
      setOutstandingPlates({});
      setOutstandingBorrowedStock({});
      setDriverName("");

      alert(`જમા ચલણ ${returnRecord.return_challan_number} સફળતાપૂર્વક બનાવવામાં આવ્યું અને ડાઉનલોડ થયું!`);
    } catch (error) {
      console.error("Error creating return challan:", error);
      alert("જમા ચલણ બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.");
    } finally {
      setLoading(false);
    }
  }

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
              <label className="block mb-1 text-xs font-medium text-blue-700">
                ગ્રાહક ID *
              </label>
              <input
                type="text"
                placeholder="ગ્રાહક ID દાખલ કરો (જેમ કે: A001)"
                value={newClientData.id}
                onChange={e => setNewClientData(prev => ({ ...prev, id: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-200 focus:border-green-400"
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
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-200 focus:border-green-400"
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
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-200 focus:border-green-400"
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
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-200 focus:border-green-400"
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
            <User className="w-3 h-3 text-green-500" />
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
            className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-200 focus:border-green-400 transition-all"
            placeholder="ગ્રાહક શોધો..."
          />
        </div>

        <div className="p-1 space-y-1 overflow-y-auto border border-gray-200 rounded max-h-80 bg-gray-50">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-4 h-4 mx-auto mb-2 text-green-500 animate-spin" />
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
                className="w-full p-2 text-xs text-left transition-all bg-white border border-gray-200 rounded shadow-sm hover:border-green-300 hover:bg-green-50 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full shadow-sm bg-gradient-to-r from-green-400 to-emerald-500">
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
                    <div className="text-xs font-medium text-green-600">{client.mobile_number}</div>
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
      <div className="min-h-screen pb-20 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="p-3 space-y-3">
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
              તમારી પાસે માત્ર જોવાની પરવાનગી છે. પ્લેટ પરત કરવા માટે Admin સાથે સંપર્ક કરો.
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
    <div className="min-h-screen pb-20 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="p-3 space-y-3">
        {/* Compact Header */}
        <div className="pt-2 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-green-500 to-emerald-500">
            <RotateCcw className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">જમા ચલણ</h1>
          <p className="text-xs text-gray-600">પ્લેટ પરત કરો</p>
        </div>

        {/* Enhanced Client Selection */}
        <div className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500">
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
                <div className="p-2 border border-green-200 rounded bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-gradient-to-r from-green-500 to-emerald-500">
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
                  className="text-xs font-medium text-green-600 hover:text-green-700"
                >
                  ગ્રાહક બદલવો
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Return Form */}
        {selectedClient && !showClientSelector && (
          <form onSubmit={handleSubmit} className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500">
              <h2 className="flex items-center gap-1 text-xs font-bold text-white">
                <RotateCcw className="w-3 h-3" />
                પ્લેટ જમા
              </h2>
            </div>

            <div className="p-2 space-y-2">
              {/* Form Header */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    જમા ચલણ નંબર *
                  </label>
                  <input
                    type="text"
                    value={returnChallanNumber}
                    onChange={(e) => handleChallanNumberChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-200 focus:border-green-400"
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
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    required
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-200 focus:border-green-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    ડ્રાઈવરનું નામ
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      list="driver-suggestions"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-200 focus:border-green-400"
                      placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
                    />
                    <datalist id="driver-suggestions">
                      {previousDrivers.map((driver, index) => (
                        <option key={index} value={driver} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Enhanced Table with Borrowed Stock tracking */}
              <div className="overflow-x-auto">
                <table className="w-full overflow-hidden text-xs rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-green-500 to-emerald-500">
                      <th className="px-1 py-1 font-medium text-left">સાઇઝ</th>
                      <th className="px-1 py-1 font-medium text-center">બાકી</th>
                      <th className="px-1 py-1 font-medium text-center">પરત</th>
                      <th className="px-1 py-1 font-medium text-center">ઉધાર બાકી</th>
                      <th className="px-1 py-1 font-medium text-center">ઉધાર પરત</th>
                      <th className="px-1 py-1 font-medium text-center">ખરાબ</th>
                      <th className="px-1 py-1 font-medium text-center">ગુમ</th>
                      <th className="px-1 py-1 font-medium text-center">નોંધ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLATE_SIZES.map((size, index) => {
                      const outstandingCount = outstandingPlates[size] || 0;
                      const outstandingBorrowedCount = outstandingBorrowedStock[size] || 0;
                      const returnQuantity = quantities[size] || 0;
                      const damagedQuantity = damagedQuantities[size] || 0;
                      const lostQuantity = lostQuantities[size] || 0;
                      const borrowedStockReturn = borrowedStockReturns[size] || 0;
                      const totalProcessed = returnQuantity + damagedQuantity + lostQuantity;
                      const isExcess = totalProcessed > outstandingCount;
                      const isBorrowedExcess = borrowedStockReturn > outstandingBorrowedCount;
                      
                      return (
                        <tr key={size} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${(isExcess && outstandingCount > 0) || (isBorrowedExcess && outstandingBorrowedCount > 0) ? 'bg-orange-50' : ''}`}>
                          <td className="px-1 py-1 font-medium">{size}</td>
                          <td className="px-1 py-1 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 font-bold rounded ${
                              outstandingCount > 0 
                                ? 'text-red-700 bg-red-100' 
                                : outstandingCount < 0 
                                  ? 'text-green-700 bg-green-100'
                                  : 'text-gray-700 bg-gray-100'
                            }`}>
                              {outstandingCount}
                            </span>
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              value={quantities[size] || ""}
                              onChange={e => handleQuantityChange(size, e.target.value)}
                              className={`w-10 px-0.5 py-0.5 border rounded text-center ${
                                isExcess && outstandingCount >= 0
                                  ? 'border-orange-300 bg-orange-50' 
                                  : 'border-gray-300'
                              }`}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 font-bold rounded ${
                              outstandingBorrowedCount > 0 
                                ? 'text-purple-700 bg-purple-100' 
                                : 'text-gray-700 bg-gray-100'
                            }`}>
                              {outstandingBorrowedCount}
                            </span>
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              value={borrowedStockReturns[size] || ""}
                              onChange={e => handleBorrowedStockReturnChange(size, e.target.value)}
                              className={`w-10 px-0.5 py-0.5 border rounded text-center ${
                                isBorrowedExcess && outstandingBorrowedCount >= 0
                                  ? 'border-orange-300 bg-orange-50' 
                                  : 'border-purple-300 bg-purple-50'
                              }`}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              value={damagedQuantities[size] || ""}
                              onChange={e => handleDamagedQuantityChange(size, e.target.value)}
                              className="w-10 px-0.5 py-0.5 border border-red-300 rounded text-center bg-red-50"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              value={lostQuantities[size] || ""}
                              onChange={e => handleLostQuantityChange(size, e.target.value)}
                              className="w-10 px-0.5 py-0.5 border border-gray-400 rounded text-center bg-gray-100"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="text"
                              className="w-16 px-0.5 py-0.5 border border-gray-300 rounded"
                              value={notes[size] || ""}
                              onChange={e => handleNoteChange(size, e.target.value)}
                              placeholder="નોંધ"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Total with borrowed stock breakdown */}
              <div className="p-2 bg-green-100 border border-green-200 rounded">
                <div className="text-center space-y-1">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-green-800">પરત: </span>
                      <span className="text-sm font-bold text-green-700">
                        {Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-purple-800">ઉધાર પરત: </span>
                      <span className="text-sm font-bold text-purple-700">
                        {Object.values(borrowedStockReturns).reduce((sum, qty) => sum + (qty || 0), 0)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-red-800">ખરાબ: </span>
                      <span className="text-sm font-bold text-red-700">
                        {Object.values(damagedQuantities).reduce((sum, qty) => sum + (qty || 0), 0)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">ગુમ: </span>
                      <span className="text-sm font-bold text-gray-700">
                        {Object.values(lostQuantities).reduce((sum, qty) => sum + (qty || 0), 0)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-green-300">
                    <span className="font-medium text-green-800">કુલ પ્રક્રિયા: </span>
                    <span className="text-base font-bold text-green-700">
                      {Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0) +
                       Object.values(borrowedStockReturns).reduce((sum, qty) => sum + (qty || 0), 0) +
                       Object.values(damagedQuantities).reduce((sum, qty) => sum + (qty || 0), 0) +
                       Object.values(lostQuantities).reduce((sum, qty) => sum + (qty || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center w-full gap-1 py-2 text-xs font-medium text-white transition-all rounded bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    જમા ચલણ બનાવો
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