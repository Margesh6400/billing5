import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Plus, Edit3, Save, X, Users, Building2, AlertTriangle, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface Partner {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface PartnerStock {
  id: number;
  partner_id: string;
  plate_size: string;
  total_quantity: number;
  available_quantity: number;
  on_rent_quantity: number;
  updated_at: string;
}

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function PartnerStockPage() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerStock, setPartnerStock] = useState<PartnerStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<PartnerStock>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [partnersResult, stockResult] = await Promise.all([
        supabase.from('partners').select('*').eq('is_active', true).order('id'),
        supabase.from('partner_stock').select('*').order('partner_id, plate_size')
      ]);

      if (partnersResult.error) throw partnersResult.error;
      if (stockResult.error) throw stockResult.error;

      setPartners(partnersResult.data || []);
      setPartnerStock(stockResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (stock: PartnerStock) => {
    setEditingStock(stock.id);
    setEditValues({ total_quantity: stock.total_quantity });
  };

  const handleSave = async () => {
    if (!editingStock || !editValues) return;

    try {
      const currentStock = partnerStock.find(stock => stock.id === editingStock);
      if (!currentStock) return;

      const newAvailableQuantity = (editValues.total_quantity || currentStock.total_quantity) - currentStock.on_rent_quantity;

      const { error } = await supabase
        .from('partner_stock')
        .update({
          total_quantity: editValues.total_quantity,
          available_quantity: Math.max(0, newAvailableQuantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingStock);

      if (error) throw error;

      setEditingStock(null);
      setEditValues({});
      await fetchData();
    } catch (error) {
      console.error('Error updating partner stock:', error);
      alert('Error updating stock. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditingStock(null);
    setEditValues({});
  };

  const getPartnerIcon = (partnerId: string) => {
    switch (partnerId) {
      case 'MAIN':
        return <Building2 className="w-5 h-5 text-blue-600" />;
      case 'SS':
        return <Users className="w-5 h-5 text-green-600" />;
      case 'SK':
        return <Users className="w-5 h-5 text-purple-600" />;
      default:
        return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPartnerColor = (partnerId: string) => {
    switch (partnerId) {
      case 'MAIN':
        return 'border-blue-200 bg-blue-50';
      case 'SS':
        return 'border-green-200 bg-green-50';
      case 'SK':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStockStatus = (stock: PartnerStock) => {
    const total = stock.total_quantity;
    if (total === 0) return { status: 'empty', color: 'text-gray-500', bg: 'bg-gray-50' };
    if (stock.available_quantity < 5) return { status: 'low', color: 'text-red-600', bg: 'bg-red-50' };
    if (stock.available_quantity < 20) return { status: 'medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const getConsolidatedStock = (plateSize: string) => {
    const stocks = partnerStock.filter(stock => stock.plate_size === plateSize);
    return {
      total: stocks.reduce((sum, stock) => sum + stock.total_quantity, 0),
      available: stocks.reduce((sum, stock) => sum + stock.available_quantity, 0),
      onRent: stocks.reduce((sum, stock) => sum + stock.on_rent_quantity, 0)
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Partner Stock Management</h1>
          <p className="text-gray-600">Loading partner inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Partner Stock Management</h1>
        <p className="text-gray-600">Manage inventory across all partners</p>
      </div>

      {/* Partners Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Partners</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {partners.map((partner) => (
            <div key={partner.id} className={`p-4 rounded-lg border-2 ${getPartnerColor(partner.id)}`}>
              <div className="flex items-center gap-3">
                {getPartnerIcon(partner.id)}
                <div>
                  <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                  <p className="text-sm text-gray-600">{partner.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Overview by Plate Size */}
      <div className="space-y-6">
        {PLATE_SIZES.map((plateSize) => {
          const consolidated = getConsolidatedStock(plateSize);
          const partnerStocks = partnerStock.filter(stock => stock.plate_size === plateSize);
          
          return (
            <div key={plateSize} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{plateSize}</h3>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total Available</div>
                  <div className="text-2xl font-bold text-green-600">{consolidated.available}</div>
                </div>
              </div>

              {/* Partner Stock Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {partners.map((partner) => {
                  const stock = partnerStocks.find(s => s.partner_id === partner.id);
                  const stockStatus = stock ? getStockStatus(stock) : { status: 'empty', color: 'text-gray-500', bg: 'bg-gray-50' };
                  const isEditing = editingStock === stock?.id;
                  
                  return (
                    <div key={partner.id} className={`p-4 rounded-lg border ${getPartnerColor(partner.id)}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getPartnerIcon(partner.id)}
                          <span className="font-medium text-gray-900">{partner.name}</span>
                        </div>
                        
                        {stock && !isEditing && user?.isAdmin ? (
                          <button
                            onClick={() => handleEdit(stock)}
                            className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        ) : !stock || !user?.isAdmin ? (
                          <div className="text-gray-400 p-1">
                            <Lock className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={handleSave}
                              className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total:</span>
                          {isEditing && user?.isAdmin ? (
                            <input
                              type="number"
                              min="0"
                              value={editValues.total_quantity || 0}
                              onChange={(e) => setEditValues({
                                ...editValues,
                                total_quantity: parseInt(e.target.value) || 0
                              })}
                              className="w-16 px-1 py-0.5 text-xs text-center border border-gray-300 rounded"
                            />
                          ) : (
                            <span className="font-medium text-purple-600">{stock?.total_quantity || 0}</span>
                          )}
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Available:</span>
                          <span className={`font-medium ${stockStatus.color}`}>
                            {stock?.available_quantity || 0}
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">On Rent:</span>
                          <span className="font-medium text-blue-600">{stock?.on_rent_quantity || 0}</span>
                        </div>
                      </div>

                      {/* Stock Status Indicator */}
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          {stockStatus.status === 'low' && (
                            <>
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-xs text-red-600 font-medium">Low Stock</span>
                            </>
                          )}
                          {stockStatus.status === 'medium' && (
                            <>
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              <span className="text-xs text-yellow-600 font-medium">Medium Stock</span>
                            </>
                          )}
                          {stockStatus.status === 'good' && (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-xs text-green-600 font-medium">Good Stock</span>
                            </>
                          )}
                          {stockStatus.status === 'empty' && (
                            <>
                              <AlertTriangle className="w-4 h-4 text-gray-500" />
                              <span className="text-xs text-gray-500 font-medium">No Stock</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Consolidated Summary */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">Consolidated Total:</span>
                  <div className="flex gap-4">
                    <span className="text-purple-600 font-bold">Total: {consolidated.total}</span>
                    <span className="text-green-600 font-bold">Available: {consolidated.available}</span>
                    <span className="text-blue-600 font-bold">On Rent: {consolidated.onRent}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}