import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Building2, Package } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface PartnerSelectorProps {
  selectedPartnerId: string;
  onPartnerSelect: (partnerId: string) => void;
  disabled?: boolean;
  showStockInfo?: boolean;
  plateSize?: string;
}

export function PartnerSelector({ 
  selectedPartnerId, 
  onPartnerSelect, 
  disabled = false,
  showStockInfo = false,
  plateSize 
}: PartnerSelectorProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerStock, setPartnerStock] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners();
    if (showStockInfo && plateSize) {
      fetchPartnerStock();
    }
  }, [showStockInfo, plateSize]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .order('id');

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerStock = async () => {
    if (!plateSize) return;

    try {
      const { data, error } = await supabase
        .from('partner_stock')
        .select(`
          partner_id,
          available_quantity,
          on_rent_quantity,
          total_quantity
        `)
        .eq('plate_size', plateSize);

      if (error) throw error;

      const stockMap = {};
      data?.forEach(stock => {
        stockMap[stock.partner_id] = stock;
      });
      setPartnerStock(stockMap);
    } catch (error) {
      console.error('Error fetching partner stock:', error);
    }
  };

  const getPartnerIcon = (partnerId: string) => {
    switch (partnerId) {
      case 'MAIN':
        return <Building2 className="w-4 h-4" />;
      case 'SS':
      case 'SK':
        return <Users className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getPartnerColor = (partnerId: string) => {
    switch (partnerId) {
      case 'MAIN':
        return 'from-blue-500 to-blue-600';
      case 'SS':
        return 'from-green-500 to-green-600';
      case 'SK':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Partner Selection
        </label>
        <div className="animate-pulse bg-gray-200 h-12 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Partner Selection *
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {partners.map((partner) => {
          const isSelected = selectedPartnerId === partner.id;
          const stock = partnerStock[partner.id];
          
          return (
            <button
              key={partner.id}
              type="button"
              onClick={() => onPartnerSelect(partner.id)}
              disabled={disabled}
              className={`
                relative p-4 border-2 rounded-lg transition-all duration-200 text-left
                ${isSelected 
                  ? `border-transparent bg-gradient-to-r ${getPartnerColor(partner.id)} text-white shadow-lg transform scale-105` 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${
                  isSelected 
                    ? 'bg-white/20' 
                    : `bg-gradient-to-r ${getPartnerColor(partner.id)} text-white`
                }`}>
                  {getPartnerIcon(partner.id)}
                </div>
                <div>
                  <h3 className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {partner.name}
                  </h3>
                  <p className={`text-sm ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                    {partner.description}
                  </p>
                </div>
              </div>

              {showStockInfo && stock && (
                <div className={`text-xs space-y-1 ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className="font-medium">{stock.available_quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>On Rent:</span>
                    <span className="font-medium">{stock.on_rent_quantity}</span>
                  </div>
                </div>
              )}

              {isSelected && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {showStockInfo && plateSize && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Stock Summary for {plateSize}
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-600">Total Available</div>
              <div className="font-bold text-green-600">
                {Object.values(partnerStock).reduce((sum: number, stock: any) => sum + (stock?.available_quantity || 0), 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Total On Rent</div>
              <div className="font-bold text-blue-600">
                {Object.values(partnerStock).reduce((sum: number, stock: any) => sum + (stock?.on_rent_quantity || 0), 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Total Stock</div>
              <div className="font-bold text-purple-600">
                {Object.values(partnerStock).reduce((sum: number, stock: any) => sum + (stock?.total_quantity || 0), 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}