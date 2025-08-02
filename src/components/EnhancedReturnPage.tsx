import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { ClientSelector } from './ClientSelector';
import { RotateCcw, Package, Save, Loader2, Calendar, Lock, Building2, Users } from 'lucide-react';
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

interface OutstandingPlates {
  [plateSize: string]: {
    own: number;
    ss: number;
    sk: number;
    etc: number;
  };
}

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function EnhancedReturnPage() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [returnChallanNumber, setReturnChallanNumber] = useState('');
  const [suggestedChallanNumber, setSuggestedChallanNumber] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverName, setDriverName] = useState('');
  const [quantities, setQuantities] = useState<Record<string, StockQuantities>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [stockData, setStockData] = useState<EnhancedStock[]>([]);
  const [outstandingPlates, setOutstandingPlates] = useState<OutstandingPlates>({});
  const [loading, setLoading] = useState(false);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);

  useEffect(() => {
    fetchStockData();
    generateNextChallanNumber();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchOutstandingPlates();
    }
  }, [selectedClient]);

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

  const fetchOutstandingPlates = async () => {
    if (!selectedClient) return;
    
    try {
      // Get all issued plates for this client with stock breakdown
      const { data: challans } = await supabase
        .from('challans')
        .select(`
          challan_items (
            plate_size, 
            own_quantity, 
            ss_quantity, 
            sk_quantity, 
            etc_quantity
          )
        `)
        .eq('client_id', selectedClient.id);

      // Get all returned plates for this client with stock breakdown
      const { data: returns } = await supabase
        .from('returns')
        .select(`
          return_line_items (
            plate_size, 
            own_quantity, 
            ss_quantity, 
            sk_quantity, 
            etc_quantity
          )
        `)
        .eq('client_id', selectedClient.id);

      const outstanding: OutstandingPlates = {};
      
      // Initialize all plate sizes
      PLATE_SIZES.forEach(size => {
        outstanding[size] = { own: 0, ss: 0, sk: 0, etc: 0 };
      });

      // Add issued quantities
      challans?.forEach((challan) => {
        challan.challan_items.forEach(item => {
          if (!outstanding[item.plate_size]) {
            outstanding[item.plate_size] = { own: 0, ss: 0, sk: 0, etc: 0 };
          }
          outstanding[item.plate_size].own += item.own_quantity || 0;
          outstanding[item.plate_size].ss += item.ss_quantity || 0;
          outstanding[item.plate_size].sk += item.sk_quantity || 0;
          outstanding[item.plate_size].etc += item.etc_quantity || 0;
        });
      });

      // Subtract returned quantities
      returns?.forEach((returnRecord) => {
        returnRecord.return_line_items.forEach(item => {
          if (outstanding[item.plate_size]) {
            outstanding[item.plate_size].own -= item.own_quantity || 0;
            outstanding[item.plate_size].ss -= item.ss_quantity || 0;
            outstanding[item.plate_size].sk -= item.sk_quantity || 0;
            outstanding[item.plate_size].etc -= item.etc_quantity || 0;
          }
        });
      });

      setOutstandingPlates(outstanding);
    } catch (error) {
      console.error('Error fetching outstanding plates:', error);
      setOutstandingPlates({});
    }
  };

  const generateNextChallanNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('returns')
        .select('return_challan_number')
        .order('id', { ascending: false });

      if (error) throw error;
      
      let maxNumber = 0;
      if (data && data.length > 0) {
        data.forEach(returnChallan => {
          const match = returnChallan.return_challan_number.match(/\d+/);
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
      
      if (!returnChallanNumber) {
        setReturnChallanNumber(nextNumber);
      }
    } catch (error) {
      console.error('Error generating return challan number:', error);
      const fallback = '1';
      setSuggestedChallanNumber(fallback);
      if (!returnChallanNumber) {
        setReturnChallanNumber(fallback);
      }
    }
  };

  const handleChallanNumberChange = (value: string) => {
    setReturnChallanNumber(value);
    if (!value.trim()) {
      setReturnChallanNumber(suggestedChallanNumber);
    }
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

  const checkReturnChallanNumberExists = async (challanNumber: string) => {
    const { data, error } = await supabase
      .from('returns')
      .select('return_challan_number')
      .eq('return_challan_number', challanNumber)
      .limit(1);

    return data && data.length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedClient) {
        alert('Please select a client.');
        return;
      }

      if (!returnChallanNumber.trim()) {
        alert('Please enter a return challan number.');
        return;
      }

      const exists = await checkReturnChallanNumberExists(returnChallanNumber);
      if (exists) {
        alert('Return challan number already exists. Please use a different number.');
        return;
      }

      const validItems = PLATE_SIZES.filter(size => getTotalQuantityForSize(size) > 0);

      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert([{
          return_challan_number: returnChallanNumber,
          client_id: selectedClient.id,
          return_date: returnDate,
          driver_name: driverName || null,
          partner_id: 'MAIN'
        }])
        .select()
        .single();

      if (returnError) throw returnError;

      if (validItems.length > 0) {
        const lineItems = validItems.map(size => {
          const stockQty = quantities[size];
          const totalQty = getTotalQuantityForSize(size);
          
          return {
            return_id: returnRecord.id,
            plate_size: size,
            returned_quantity: totalQty,
            own_quantity: stockQty.own,
            ss_quantity: stockQty.ss,
            sk_quantity: stockQty.sk,
            etc_quantity: stockQty.etc,
            damage_notes: notes[size]?.trim() || null,
            partner_stock_notes: notes[size]?.trim() || null,
            partner_id: 'MAIN'
          };
        });

        const { error: lineItemsError } = await supabase
          .from('return_line_items')
          .insert(lineItems);

        if (lineItemsError) throw lineItemsError;
      }

      const newChallanData: ChallanData = {
        type: 'return',
        challan_number: returnRecord.return_challan_number,
        date: returnDate,
        client: {
          id: selectedClient.id,
          name: selectedClient.name,
          site: selectedClient.site || '',
          mobile: selectedClient.mobile_number || ''
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
        downloadJPGChallan(jpgDataUrl, `return-challan-${returnRecord.return_challan_number}`);

        setQuantities({});
        setNotes({});
        setReturnChallanNumber('');
        setDriverName('');
        setSelectedClient(null);
        setChallanData(null);
        setOutstandingPlates({});
        
        const message = validItems.length > 0 
          ? `Return challan ${returnRecord.return_challan_number} created and downloaded successfully with ${validItems.length} items!`
          : `Return challan ${returnRecord.return_challan_number} created and downloaded successfully (no items returned).`;
        
        alert(message);
      } catch (error) {
        console.error('JPG generation failed:', error);
        alert('Error generating challan image. Please try again.');
      }
    } catch (error) {
      console.error('Error creating return:', error);
      alert('Error creating return. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Return</h1>
          <p className="text-gray-600">Access Denied - Admin Only</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-700">View-Only Access</h3>
          <p className="mb-4 text-gray-500">
            You have read-only access. Only the admin can process plate returns.
          </p>
          <p className="text-sm text-blue-600">
            Admin: nilkanthplatdepo@gmail.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hidden Printable Challan */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`}>
            <PrintableChallan data={challanData} />
          </div>
        )}
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Return</h1>
        <p className="text-gray-600">Process plate returns with detailed stock tracking</p>
      </div>

      <ClientSelector 
        onClientSelect={setSelectedClient}
        selectedClient={selectedClient}
      />

      {selectedClient && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              Return Plates with Stock Tracking
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Return Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 rounded-lg p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Challan Number *
                </label>
                <input
                  type="text"
                  value={returnChallanNumber}
                  onChange={(e) => handleChallanNumberChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder={`Suggested: ${suggestedChallanNumber}`}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Return Date *
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Enter driver name"
                />
              </div>
            </div>

            {/* Enhanced Return Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">
                      Plate Size
                    </th>
                    
                    {/* Own Stock Section */}
                    <th className="px-4 py-3 text-center text-sm font-medium text-blue-700 bg-blue-50 border-l border-blue-200">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Building2 className="w-4 h-4" />
                        Own Stock
                      </div>
                      <div className="text-xs text-blue-600">Outstanding</div>
                    </th>
                    
                    {/* Partner Stock Section Headers */}
                    <th className="px-3 py-3 text-center text-sm font-medium text-green-700 bg-green-50 border-l border-green-200">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-4 h-4" />
                        SS Stock
                      </div>
                      <div className="text-xs text-green-600">Outstanding</div>
                    </th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-purple-700 bg-purple-50 border-l border-purple-200">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-4 h-4" />
                        SK Stock
                      </div>
                      <div className="text-xs text-purple-600">Outstanding</div>
                    </th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-orange-700 bg-orange-50 border-l border-orange-200">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Package className="w-4 h-4" />
                        ETC Stock
                      </div>
                      <div className="text-xs text-orange-600">Outstanding</div>
                    </th>
                    
                    {/* Row Total */}
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 bg-gray-100 border-l border-gray-300">
                      Row Total
                    </th>
                    
                    {/* Notes */}
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-l border-gray-200">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLATE_SIZES.map(size => {
                    const outstanding = outstandingPlates[size] || { own: 0, ss: 0, sk: 0, etc: 0 };
                    const stockQty = quantities[size] || { own: 0, ss: 0, sk: 0, etc: 0 };
                    const rowTotal = getTotalQuantityForSize(size);
                    
                    return (
                      <tr key={size} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{size}</span>
                          </div>
                        </td>

                        {/* Own Stock Column */}
                        <td className="px-4 py-3 text-center bg-blue-25 border-l border-blue-100">
                          <div className="text-xs text-blue-600 mb-1">
                            Outstanding: {outstanding.own}
                          </div>
                          <input
                            type="number"
                            min="0"
                            className="w-16 px-2 py-1 border border-blue-300 rounded text-center focus:ring-1 focus:ring-blue-500"
                            value={stockQty.own || ''}
                            onChange={(e) => handleQuantityChange(size, 'own', e.target.value)}
                            placeholder="0"
                          />
                        </td>

                        {/* SS Stock Column */}
                        <td className="px-3 py-3 text-center bg-green-25 border-l border-green-100">
                          <div className="text-xs text-green-600 mb-1">
                            Outstanding: {outstanding.ss}
                          </div>
                          <input
                            type="number"
                            min="0"
                            className="w-14 px-1 py-1 border border-green-300 rounded text-center focus:ring-1 focus:ring-green-500"
                            value={stockQty.ss || ''}
                            onChange={(e) => handleQuantityChange(size, 'ss', e.target.value)}
                            placeholder="0"
                          />
                        </td>

                        {/* SK Stock Column */}
                        <td className="px-3 py-3 text-center bg-purple-25 border-l border-purple-100">
                          <div className="text-xs text-purple-600 mb-1">
                            Outstanding: {outstanding.sk}
                          </div>
                          <input
                            type="number"
                            min="0"
                            className="w-14 px-1 py-1 border border-purple-300 rounded text-center focus:ring-1 focus:ring-purple-500"
                            value={stockQty.sk || ''}
                            onChange={(e) => handleQuantityChange(size, 'sk', e.target.value)}
                            placeholder="0"
                          />
                        </td>

                        {/* ETC Stock Column */}
                        <td className="px-3 py-3 text-center bg-orange-25 border-l border-orange-100">
                          <div className="text-xs text-orange-600 mb-1">
                            Outstanding: {outstanding.etc}
                          </div>
                          <input
                            type="number"
                            min="0"
                            className="w-14 px-1 py-1 border border-orange-300 rounded text-center focus:ring-1 focus:ring-orange-500"
                            value={stockQty.etc || ''}
                            onChange={(e) => handleQuantityChange(size, 'etc', e.target.value)}
                            placeholder="0"
                          />
                        </td>

                        {/* Row Total */}
                        <td className="px-4 py-3 text-center bg-gray-100 border-l border-gray-300">
                          <span className="text-lg font-bold text-gray-700">
                            {rowTotal}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3 border-l border-gray-200">
                          <textarea
                            value={notes[size] || ''}
                            onChange={(e) => setNotes(prev => ({
                              ...prev,
                              [size]: e.target.value
                            }))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                            rows={2}
                            placeholder="Enter notes..."
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                
                {/* Grand Total Row */}
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="px-4 py-3 font-bold text-blue-900">
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-100">
                      {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.own || 0), 0)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-green-700 bg-green-100">
                      {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.ss || 0), 0)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-purple-700 bg-purple-100">
                      {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.sk || 0), 0)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-orange-700 bg-orange-100">
                      {PLATE_SIZES.reduce((sum, size) => sum + (quantities[size]?.etc || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900 bg-gray-200 text-xl">
                      {getGrandTotal()}
                    </td>
                    <td className="px-4 py-3 border-l border-gray-200">
                      -
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? 'Processing Return...' : 'Submit Enhanced Return'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}