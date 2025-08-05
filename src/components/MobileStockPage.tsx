import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { Package, Plus, Edit3, Save, X, AlertTriangle, CheckCircle, Search, BarChart3, Lock, Users } from 'lucide-react';
import { T } from '../contexts/LanguageContext';
import { useAuth } from '../hooks/useAuth';

type Stock = Database['public']['Tables']['stock']['Row'];

interface BorrowedStockData {
  plate_size: string;
  total_borrowed: number;
}

interface DamageStockData {
  plate_size: string;
  total_damaged: number;
  total_lost: number;
}
const PLATE_SIZES = [
  '2 X 3',
  '21 X 3', 
  '18 X 3',
  '15 X 3',
  '12 X 3',
  '9 X 3',
  'પતરા',
  '2 X 2',
  '2 ફુટ'
];

interface StockRowProps {
  plateSize: string;
  stockData: Stock | undefined;
  borrowedStock: number;
  outstandingBorrowedStock: number;
  damageData: { damaged: number; lost: number };
  onUpdate: (plateSize: string, values: Partial<Stock>) => Promise<void>;
  isAdmin: boolean;
}

function StockRow({ plateSize, stockData, borrowedStock, outstandingBorrowedStock, damageData, onUpdate, isAdmin }: StockRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    total_quantity: stockData?.total_quantity || 0
  });

  const handleSave = async () => {
    try {
      await onUpdate(plateSize, { total_quantity: editValues.total_quantity });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('સ્ટોક અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    }
  };

  const handleCancel = () => {
    setEditValues({
      total_quantity: stockData?.total_quantity || 0
    });
    setIsEditing(false);
  };

  const getAvailabilityColor = (available: number) => {
    if (available > 20) return 'bg-green-100 text-green-700 border-green-200';
    if (available > 5) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const totalOnRent = (stockData?.on_rent_quantity || 0) + borrowedStock;

  return (
    <tr className="transition-colors border-b border-blue-100 hover:bg-blue-25">
      {/* Plate Size */}
      <td className="px-1.5 py-2 text-[12px] font-semibold text-gray-800 border-r border-blue-100">
        <div className="min-w-[45px]">{plateSize}</div>
      </td>
      
      {/* Total Stock */}
      <td className="px-1.5 py-2 text-center border-r border-blue-100">
        {isEditing ? (
          <input
            type="number"
            min="0"
            value={editValues.total_quantity}
            onChange={(e) => setEditValues(prev => ({
              ...prev, 
              total_quantity: parseInt(e.target.value) || 0
            }))}
            className="w-12 px-1 py-1 text-[12px] text-center border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        ) : (
          <span className="text-[12px] font-bold text-purple-600">
            {stockData?.total_quantity || 0}
          </span>
        )}
      </td>

      {/* Available */}
      <td className="px-1.5 py-2 text-center border-r border-blue-100">
        {isEditing ? (
          <div className="text-[12px] text-gray-500">
            <div>{stockData?.available_quantity || 0}</div>
            <div className="text-blue-400">ઓટો</div>
          </div>
        ) : (
          <span className={`px-1.5 py-0.5 rounded-full text-[12px] font-medium border ${getAvailabilityColor(stockData?.available_quantity || 0)}`}>
            {stockData?.available_quantity || 0}
          </span>
        )}
      </td>

      {/* Total On Rent */}
      <td className="px-1.5 py-2 text-center border-r border-blue-100">
        <div className="flex flex-col items-center">
          <span className="text-[12px] font-bold text-blue-600">
            {totalOnRent}
          </span>
          <div className="text-[11px] text-gray-500 leading-none">
            ({stockData?.on_rent_quantity || 0}+{borrowedStock})
          </div>
        </div>
      </td>

      {/* Borrowed */}
      <td className="px-1.5 py-2 text-center border-r border-blue-100">
        <span className="px-1.5 py-0.5 rounded-full text-[12px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
          {borrowedStock}
        </span>
      </td>

      {/* Outstanding Borrowed */}
      <td className="px-1.5 py-2 text-center border-r border-blue-100">
        <span className="px-1.5 py-0.5 rounded-full text-[12px] font-medium bg-purple-100 text-purple-700 border border-purple-200">
          {outstandingBorrowedStock}
        </span>
      </td>

      {/* Damage/Loss */}
      <td className="px-1.5 py-2 text-center border-r border-blue-100">
        <div className="flex flex-col items-center">
          <span className="text-[12px] font-bold text-red-600">
            {damageData.damaged + damageData.lost}
          </span>
          <div className="text-[11px] text-gray-500 leading-none">
            ({damageData.damaged}+{damageData.lost})
          </div>
        </div>
      </td>

      {/* Actions */}
      <td className="px-1.5 py-2 text-center">
        {isEditing ? (
          <div className="flex justify-center gap-1">
            <button
              onClick={handleSave}
              className="p-1 text-white transition-colors bg-green-500 rounded hover:bg-green-600"
              title="સેવ"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-white transition-colors bg-gray-500 rounded hover:bg-gray-600"
              title="કેન્સલ"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          isAdmin && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-blue-600 transition-colors rounded hover:bg-blue-100"
              title="એડિટ"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )
        )}
      </td>
    </tr>
  );
}

export function MobileStockPage() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<Stock[]>([]);
  const [borrowedStockData, setBorrowedStockData] = useState<BorrowedStockData[]>([]);
  const [damageStockData, setDamageStockData] = useState<DamageStockData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlateSize, setNewPlateSize] = useState('');

  useEffect(() => {
    fetchStock();
    fetchBorrowedStock();
    fetchDamageStock();
  }, []);

  const fetchStock = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('plate_size');

      if (error) throw error;
      setStockItems(data || []);
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBorrowedStock = async () => {
    try {
      const { data, error } = await supabase
        .from('challan_items')
        .select(`
          plate_size,
          borrowed_stock,
          challans!inner(status)
        `)
        .eq('challans.status', 'active');

      if (error) throw error;

      const aggregated = (data || []).reduce((acc, item) => {
        const existing = acc.find(a => a.plate_size === item.plate_size);
        if (existing) {
          existing.total_borrowed += item.borrowed_stock || 0;
        } else {
          acc.push({
            plate_size: item.plate_size,
            total_borrowed: item.borrowed_stock || 0
          });
        }
        return acc;
      }, [] as BorrowedStockData[]);

      setBorrowedStockData(aggregated);
    } catch (error) {
      console.error('Error fetching borrowed stock:', error);
    }
  };

  const handleUpdateStock = async (plateSize: string, values: Partial<Stock>) => {
    try {
      const stockItem = stockItems.find(item => item.plate_size === plateSize);
      if (!stockItem) return;

      const newAvailableQuantity = (values.total_quantity || stockItem.total_quantity) - stockItem.on_rent_quantity;

      const { error } = await supabase
        .from('stock')
        .update({
          total_quantity: values.total_quantity,
          available_quantity: Math.max(0, newAvailableQuantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockItem.id);

      if (error) throw error;

      await fetchStock();
      await fetchBorrowedStock();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('સ્ટોક અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    }
  };

  const stockMap = stockItems.reduce((acc, item) => {
    acc[item.plate_size] = item;
    return acc;
  }, {} as Record<string, Stock>);

  const borrowedStockMap = borrowedStockData.reduce((acc, item) => {
    acc[item.plate_size] = item.total_borrowed;
    return acc;
  }, {} as Record<string, number>);

  const filteredPlateSizes = PLATE_SIZES.filter(size =>
    size.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotals = () => {
    const filteredStockItems = filteredPlateSizes
      .map(size => stockMap[size])
      .filter(Boolean);

    const totalBorrowedStock = filteredPlateSizes
      .reduce((sum, size) => sum + (borrowedStockMap[size] || 0), 0);

    return {
      totalStock: filteredStockItems.reduce((sum, item) => sum + (item?.total_quantity || 0), 0),
      totalAvailable: filteredStockItems.reduce((sum, item) => sum + (item?.available_quantity || 0), 0),
      totalOnRent: filteredStockItems.reduce((sum, item) => sum + (item?.on_rent_quantity || 0), 0),
      totalBorrowedStock
    };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-2 space-y-2">
          <div className="pt-2 text-center">
            <div className="w-24 h-4 mx-auto mb-1 bg-blue-200 rounded animate-pulse"></div>
            <div className="w-32 h-3 mx-auto bg-blue-200 rounded animate-pulse"></div>
          </div>
          <div className="p-2 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
            <div className="w-full h-32 bg-blue-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-2 space-y-3">
        {/* Header */}
        <div className="pt-2 text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 mb-1 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <Package className="w-4 h-4 text-white" />
          </div>
          <h1 className="mb-0.5 text-sm font-bold text-gray-900">સ્ટોક મેનેજમેન્ટ</h1>
          <p className="text-[10px] text-blue-600">ઇન્વેન્ટરી ટ્રેકિંગ</p>
        </div>

        {/* Stock Table */}
        <div className="overflow-hidden bg-white border border-blue-200 rounded-lg shadow-lg">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500">
            <h2 className="flex items-center gap-1 text-[11px] font-bold text-white">
              <Package className="w-3 h-3" />
              સ્ટોક ટેબલ
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] table-fixed">
              <thead>
                <tr className="border-b border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-100">
                  <th className="w-12 px-1.5 py-1.5 text-[12px] font-bold text-left text-blue-900 border-r border-blue-200">
                    સાઇઝ
                  </th>
                  <th className="w-12 px-1.5 py-1.5 text-[12px] font-bold text-center text-blue-900 border-r border-blue-200">
                    કુલ
                  </th>
                  <th className="w-12 px-1.5 py-1.5 text-[12px] font-bold text-center text-blue-900 border-r border-blue-200">
                    ઉપલબ્ધ
                  </th>
                  <th className="w-16 px-1.5 py-1.5 text-[12px] font-bold text-center text-blue-900 border-r border-blue-200">
                    કુલ બહાર
                  </th>
                  <th className="w-12 px-1.5 py-1.5 text-[12px] font-bold text-center text-blue-900 border-r border-blue-200">
                    બીજો ડેપો
                  </th>
                  <th className="px-1.5 py-1.5 text-[12px] font-bold text-center text-blue-900 border-r border-blue-200">
                    ઉધાર બાકી
                  </th>
                  <th className="w-8 px-1.5 py-1.5 text-[12px] font-bold text-center text-blue-900">
                    ઉમેરો
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlateSizes.map((plateSize) => (
                  <StockRow
                    key={plateSize}
                    plateSize={plateSize}
                    stockData={stockMap[plateSize]}
                    borrowedStock={borrowedStockMap[plateSize] || 0}
                    outstandingBorrowedStock={borrowedStockData.find(b => b.plate_size === plateSize)?.outstanding_borrowed || 0}
                    damageData={{ damaged: 0, lost: 0 }}
                    onUpdate={handleUpdateStock}
                    isAdmin={user?.isAdmin || false}
                  />
                ))}
                
                {/* Totals Row */}
                <tr className="border-t-2 border-green-400 bg-gradient-to-r from-green-100 to-emerald-100">
                  <td className="px-1.5 py-2 text-[12px] font-bold text-green-800 border-r border-green-300">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      કુલ
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-[12px] font-bold text-center text-purple-700 border-r border-green-200 bg-purple-50">
                    {totals.totalStock}
                  </td>
                  <td className="px-1.5 py-2 text-center border-r border-green-200">
                    <span className="px-1.5 py-0.5 text-[12px] font-bold text-green-700 bg-green-200 rounded-full border border-green-300">
                      {totals.totalAvailable}
                    </span>
                  </td>
                  <td className="px-1.5 py-2 text-center border-r border-green-200">
                    <div className="flex flex-col items-center">
                      <span className="text-[12px] font-bold text-blue-700">
                        {totals.totalOnRent + totals.totalBorrowedStock}
                      </span>
                      <div className="text-[11px] text-gray-600 leading-none">
                        ({totals.totalOnRent}+{totals.totalBorrowedStock})
                      </div>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-center border-r border-green-200">
                    <span className="px-1.5 py-0.5 text-[12px] font-bold text-orange-700 bg-orange-200 rounded-full border border-orange-300">
                      {totals.totalBorrowedStock}
                    </span>
                  </td>
                  <td className="px-1.5 py-2 text-center border-r border-green-200">
                    <span className="px-1.5 py-0.5 text-[12px] font-bold text-purple-700 bg-purple-200 rounded-full border border-purple-300">
                      {borrowedStockData.reduce((sum, item) => sum + item.outstanding_borrowed, 0)}
                    </span>
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    <div className="w-3 h-3 mx-auto bg-green-300 rounded-full"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {filteredPlateSizes.length === 0 && (
          <div className="p-4 text-center bg-white border border-blue-100 rounded-lg shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <p className="mb-1 text-[11px] font-medium text-gray-700">
              {searchTerm ? 'કોઈ મેચિંગ પ્લેટ સાઇઝ મળ્યો નથી' : 'કોઈ પ્લેટ સાઇઝ કોન્ફિગર નથી'}
            </p>
            <p className="text-[10px] text-blue-600">
              {searchTerm ? 'શોધ શબ્દ બદલીને પ્રયત્ન કરો' : 'નવા પ્લેટ સાઇઝ ઉમેરો'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}