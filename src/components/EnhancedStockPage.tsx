import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Edit3, Save, X, AlertTriangle, CheckCircle, Lock, Building2, Users, Layers, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function EnhancedStockPage() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<EnhancedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<EnhancedStock>>({});

  useEffect(() => {
    fetchStock();
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

  const handleEdit = (item: EnhancedStock) => {
    setEditingItem(item.id);
    setEditValues({
      total_quantity: item.total_quantity,
      ss: item.ss,
      sk: item.sk,
      etc: item.etc
    });
  };

  const handleSave = async () => {
    if (!editingItem || !editValues) return;

    try {
      const { error } = await supabase
        .from('stock')
        .update({
          total_quantity: editValues.total_quantity,
          ss: editValues.ss,
          sk: editValues.sk,
          etc: editValues.etc
        })
        .eq('id', editingItem);

      if (error) throw error;

      setEditingItem(null);
      setEditValues({});
      await fetchStock();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Error updating stock. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setEditValues({});
  };

  const getStockStatus = (item: EnhancedStock) => {
    const total = item.available_quantity;
    if (total === 0) return { status: 'empty', color: 'text-gray-500', bg: 'bg-gray-50' };
    if (total < 10) return { status: 'low', color: 'text-red-600', bg: 'bg-red-50' };
    if (total < 50) return { status: 'medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bg: 'bg-green-50' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Stock Management</h1>
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Stock Management</h1>
        <p className="text-gray-600">Manage inventory across Own Stock and Partner Stock (SS, SK, ETC) - Admin Only</p>
      </div>

      {/* Access Control */}
      {!user?.isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-700">View-Only Access</h3>
          <p className="mb-4 text-gray-500">
            You have read-only access. Only the admin can edit stock quantities.
          </p>
          <p className="text-sm text-blue-600">
            Admin: nilkanthplatdepo@gmail.com
          </p>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Real-time Stock Tracking
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            All calculations are automatic. Only edit the input fields to update stock.
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Plate Size
                </th>
                
                {/* Own Stock Section */}
                <th className="px-4 py-3 text-center text-sm font-medium text-blue-700 bg-blue-100 border-l-2 border-blue-300">
                  <div className="flex items-center justify-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <div>
                      <div>Own Stock</div>
                      <div className="text-xs text-blue-600 font-normal">(Editable)</div>
                    </div>
                  </div>
                </th>
                
                {/* Partner Stock Section Headers */}
                <th className="px-2 py-3 text-center text-sm font-medium text-green-700 bg-green-100 border-l-2 border-green-300">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-4 h-4" />
                    <div>
                      <div>SS</div>
                      <div className="text-xs text-green-600 font-normal">(Editable)</div>
                    </div>
                  </div>
                </th>
                <th className="px-2 py-3 text-center text-sm font-medium text-purple-700 bg-purple-100 border-l-2 border-purple-300">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-4 h-4" />
                    <div>
                      <div>SK</div>
                      <div className="text-xs text-purple-600 font-normal">(Editable)</div>
                    </div>
                  </div>
                </th>
                <th className="px-2 py-3 text-center text-sm font-medium text-orange-700 bg-orange-100 border-l-2 border-orange-300">
                  <div className="flex items-center justify-center gap-1">
                    <Package className="w-4 h-4" />
                    <div>
                      <div>ETC</div>
                      <div className="text-xs text-orange-600 font-normal">(Editable)</div>
                    </div>
                  </div>
                </th>
                
                {/* Calculated Fields */}
                <th className="px-3 py-3 text-center text-sm font-medium text-gray-700 bg-gray-200 border-l-2 border-gray-400">
                  <div className="flex items-center justify-center gap-1">
                    <Layers className="w-4 h-4" />
                    <div>
                      <div>Total Available</div>
                      <div className="text-xs text-gray-600 font-normal">(Auto)</div>
                    </div>
                  </div>
                </th>
                <th className="px-3 py-3 text-center text-sm font-medium text-red-700 bg-red-100 border-l-2 border-red-300">
                  <div>
                    <div>On Rent</div>
                    <div className="text-xs text-red-600 font-normal">(Auto)</div>
                  </div>
                </th>
                
                {/* Actions */}
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {stockItems.map((item) => {
                const stockStatus = getStockStatus(item);
                const isEditing = editingItem === item.id;
                
                return (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className={`w-4 h-4 ${stockStatus.color}`} />
                        <span className="font-medium text-gray-900">{item.plate_size}</span>
                      </div>
                    </td>

                    {/* Own Stock */}
                    <td className="px-4 py-3 text-center bg-blue-50 border-l-2 border-blue-200">
                      {isEditing && user?.isAdmin ? (
                        <input
                          type="number"
                          min="0"
                          value={editValues.total_quantity || 0}
                          onChange={(e) => setEditValues({
                            ...editValues,
                            total_quantity: parseInt(e.target.value) || 0
                          })}
                          className="w-20 px-2 py-2 text-center border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      ) : (
                        <div className="text-center">
                          <span className="text-xl font-bold text-blue-700">{item.total_quantity}</span>
                          <div className="text-xs text-blue-600 mt-1">Own Plates</div>
                        </div>
                      )}
                    </td>

                    {/* SS Stock */}
                    <td className="px-2 py-3 text-center bg-green-50 border-l-2 border-green-200">
                      {isEditing && user?.isAdmin ? (
                        <input
                          type="number"
                          min="0"
                          value={editValues.ss || 0}
                          onChange={(e) => setEditValues({
                            ...editValues,
                            ss: parseInt(e.target.value) || 0
                          })}
                          className="w-16 px-1 py-2 text-center border-2 border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 font-medium"
                        />
                      ) : (
                        <div className="text-center">
                          <span className="text-xl font-bold text-green-700">{item.ss}</span>
                          <div className="text-xs text-green-600 mt-1">SS Plates</div>
                        </div>
                      )}
                    </td>

                    {/* SK Stock */}
                    <td className="px-2 py-3 text-center bg-purple-50 border-l-2 border-purple-200">
                      {isEditing && user?.isAdmin ? (
                        <input
                          type="number"
                          min="0"
                          value={editValues.sk || 0}
                          onChange={(e) => setEditValues({
                            ...editValues,
                            sk: parseInt(e.target.value) || 0
                          })}
                          className="w-16 px-1 py-2 text-center border-2 border-purple-400 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                        />
                      ) : (
                        <div className="text-center">
                          <span className="text-xl font-bold text-purple-700">{item.sk}</span>
                          <div className="text-xs text-purple-600 mt-1">SK Plates</div>
                        </div>
                      )}
                    </td>

                    {/* ETC Stock */}
                    <td className="px-2 py-3 text-center bg-orange-50 border-l-2 border-orange-200">
                      {isEditing && user?.isAdmin ? (
                        <input
                          type="number"
                          min="0"
                          value={editValues.etc || 0}
                          onChange={(e) => setEditValues({
                            ...editValues,
                            etc: parseInt(e.target.value) || 0
                          })}
                          className="w-16 px-1 py-2 text-center border-2 border-orange-400 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                        />
                      ) : (
                        <div className="text-center">
                          <span className="text-xl font-bold text-orange-700">{item.etc}</span>
                          <div className="text-xs text-orange-600 mt-1">ETC Plates</div>
                        </div>
                      )}
                    </td>

                    {/* Total Available (Auto-calculated) */}
                    <td className="px-3 py-3 text-center bg-gray-100 border-l-2 border-gray-300">
                      <div className="text-center">
                        <span className={`text-xl font-bold ${stockStatus.color}`}>
                          {item.available_quantity}
                        </span>
                        <div className="text-xs text-gray-600 mt-1">
                          {item.new_and_old} - {item.on_rent_quantity}
                        </div>
                      </div>
                    </td>

                    {/* On Rent (Auto-updated) */}
                    <td className="px-3 py-3 text-center bg-red-100 border-l-2 border-red-300">
                      <div className="text-center">
                        <span className="text-xl font-bold text-red-700">{item.on_rent_quantity}</span>
                        <div className="text-xs text-red-600 mt-1">Currently Issued</div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      {!isEditing && user?.isAdmin ? (
                        <button
                          onClick={() => handleEdit(item)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                      ) : !isEditing && !user?.isAdmin ? (
                        <div className="bg-gray-200 text-gray-500 px-3 py-2 rounded-lg flex items-center gap-2 mx-auto">
                          <Lock className="w-4 h-4" />
                          Locked
                        </div>
                      ) : user?.isAdmin ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-200 text-gray-500 px-3 py-2 rounded-lg flex items-center gap-2 mx-auto">
                          <Lock className="w-4 h-4" />
                          Locked
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {/* Summary Row */}
              <tr className="bg-gradient-to-r from-gray-200 to-gray-300 border-t-4 border-gray-400">
                <td className="px-4 py-4 font-bold text-gray-900">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    TOTALS
                  </div>
                </td>
                <td className="px-4 py-4 text-center font-bold text-blue-800 bg-blue-200 border-l-2 border-blue-400">
                  {stockItems.reduce((sum, item) => sum + item.total_quantity, 0)}
                </td>
                <td className="px-2 py-4 text-center font-bold text-green-800 bg-green-200 border-l-2 border-green-400">
                  {stockItems.reduce((sum, item) => sum + item.ss, 0)}
                </td>
                <td className="px-2 py-4 text-center font-bold text-purple-800 bg-purple-200 border-l-2 border-purple-400">
                  {stockItems.reduce((sum, item) => sum + item.sk, 0)}
                </td>
                <td className="px-2 py-4 text-center font-bold text-orange-800 bg-orange-200 border-l-2 border-orange-400">
                  {stockItems.reduce((sum, item) => sum + item.etc, 0)}
                </td>
                <td className="px-3 py-4 text-center font-bold text-gray-900 bg-gray-300 border-l-2 border-gray-500 text-xl">
                  {stockItems.reduce((sum, item) => sum + item.available_quantity, 0)}
                </td>
                <td className="px-3 py-4 text-center font-bold text-red-900 bg-red-200 border-l-2 border-red-400 text-xl">
                  {stockItems.reduce((sum, item) => sum + item.on_rent_quantity, 0)}
                </td>
                <td className="px-4 py-4 text-center">
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-blue-600">Total Own Stock</p>
              <p className="text-2xl font-bold text-blue-700">
                {stockItems.reduce((sum, item) => sum + item.total_quantity, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-green-600">Total SS Stock</p>
              <p className="text-2xl font-bold text-green-700">
                {stockItems.reduce((sum, item) => sum + item.ss, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-purple-600">Total SK Stock</p>
              <p className="text-2xl font-bold text-purple-700">
                {stockItems.reduce((sum, item) => sum + item.sk, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-sm text-orange-600">Total ETC Stock</p>
              <p className="text-2xl font-bold text-orange-700">
                {stockItems.reduce((sum, item) => sum + item.etc, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Management Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Editable Fields (Admin Only):</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• <span className="text-blue-600 font-medium">Own Stock</span> - Company owned plates</li>
              <li>• <span className="text-green-600 font-medium">SS Stock</span> - SS partner plates</li>
              <li>• <span className="text-purple-600 font-medium">SK Stock</span> - SK partner plates</li>
              <li>• <span className="text-orange-600 font-medium">ETC Stock</span> - Other partner plates</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Auto-calculated Fields:</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• <span className="text-gray-600 font-medium">Total Available</span> - All stock minus on-rent</li>
              <li>• <span className="text-red-600 font-medium">On Rent</span> - Currently issued plates</li>
              <li>• <span className="text-gray-600 font-medium">Borrowed Stock</span> - SS + SK + ETC</li>
              <li>• <span className="text-gray-600 font-medium">New & Old</span> - Own + Borrowed</li>
            </ul>
          </div>
        </div>
      </div>

      {stockItems.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No plate sizes configured</p>
          <p className="text-sm text-gray-400 mt-1">Add your first plate size to get started</p>
        </div>
      )}
    </div>
  );
}