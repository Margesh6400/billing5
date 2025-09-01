import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

type Stock = Database['public']['Tables']['stock']['Row'];

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function StockScreen() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStock();
  };

  const handleEdit = (item: Stock) => {
    setEditingItem(item.id);
    setEditValue(item.total_quantity.toString());
  };

  const handleSave = async () => {
    if (!editingItem) return;

    try {
      const currentItem = stockItems.find(item => item.id === editingItem);
      if (!currentItem) return;

      const newTotalQuantity = parseInt(editValue) || 0;
      const newAvailableQuantity = newTotalQuantity - currentItem.on_rent_quantity;

      const { error } = await supabase
        .from('stock')
        .update({
          total_quantity: newTotalQuantity,
          available_quantity: Math.max(0, newAvailableQuantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem);

      if (error) throw error;

      setEditingItem(null);
      setEditValue('');
      await fetchStock();
      Alert.alert('સફળતા', 'સ્ટોક સફળતાપૂર્વક અપડેટ થયું!');
    } catch (error) {
      console.error('Error updating stock:', error);
      Alert.alert('ભૂલ', 'સ્ટોક અપડેટ કરવામાં ભૂલ.');
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setEditValue('');
  };

  const getStockStatus = (item: Stock) => {
    if (item.total_quantity === 0) return { status: 'empty', color: '#6b7280', bg: '#f9fafb' };
    if (item.available_quantity < 10) return { status: 'low', color: '#dc2626', bg: '#fef2f2' };
    if (item.available_quantity < 50) return { status: 'medium', color: '#d97706', bg: '#fffbeb' };
    return { status: 'good', color: '#16a34a', bg: '#f0fdf4' };
  };

  const renderStockItem = ({ item }: { item: Stock }) => {
    const stockStatus = getStockStatus(item);
    const isEditing = editingItem === item.id;

    return (
      <View style={[styles.stockCard, { backgroundColor: stockStatus.bg }]}>
        <View style={styles.stockHeader}>
          <View style={styles.stockInfo}>
            <Icon name="inventory" size={24} color={stockStatus.color} />
            <Text style={styles.plateSize}>{item.plate_size}</Text>
          </View>
          
          {!isEditing && user?.isAdmin ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEdit(item)}
            >
              <Icon name="edit" size={20} color="#2563eb" />
            </TouchableOpacity>
          ) : !isEditing && !user?.isAdmin ? (
            <Icon name="lock" size={20} color="#9ca3af" />
          ) : user?.isAdmin ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Icon name="check" size={20} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Icon name="close" size={20} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <Icon name="lock" size={20} color="#9ca3af" />
          )}
        </View>

        <View style={styles.stockDetails}>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>ઉપલબ્ધ</Text>
            <Text style={[styles.stockValue, { color: stockStatus.color }]}>
              {item.available_quantity}
            </Text>
          </View>
          
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>ભાડે</Text>
            <Text style={styles.stockValue}>{item.on_rent_quantity}</Text>
          </View>
          
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>કુલ જથ્થો</Text>
            {isEditing && user?.isAdmin ? (
              <TextInput
                style={styles.editInput}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <Text style={styles.stockValue}>{item.total_quantity}</Text>
            )}
          </View>
        </View>

        {/* Stock Status Indicator */}
        <View style={styles.statusIndicator}>
          <Icon 
            name={stockStatus.status === 'good' ? 'check-circle' : 'warning'} 
            size={16} 
            color={stockStatus.color} 
          />
          <Text style={[styles.statusText, { color: stockStatus.color }]}>
            {stockStatus.status === 'low' && 'ઓછો સ્ટોક'}
            {stockStatus.status === 'medium' && 'મધ્યમ સ્ટોક'}
            {stockStatus.status === 'good' && 'સારો સ્ટોક'}
            {stockStatus.status === 'empty' && 'કોઈ સ્ટોક નથી'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="inventory" size={32} color="#8b5cf6" />
        <Text style={styles.headerTitle}>સ્ટોક</Text>
        <Text style={styles.headerSubtitle}>ઇન્વેન્ટરી જુઓ</Text>
      </View>

      {/* Stock List */}
      <FlatList
        data={stockItems}
        renderItem={renderStockItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.stockList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inventory" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>કોઈ પ્લેટ સાઇઝ કોન્ફિગર નથી</Text>
          </View>
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  stockList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  stockCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateSize: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 8,
  },
  editButton: {
    padding: 4,
  },
  editActions: {
    flexDirection: 'row',
  },
  saveButton: {
    padding: 4,
    marginRight: 4,
  },
  cancelButton: {
    padding: 4,
  },
  stockDetails: {
    marginBottom: 12,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stockLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  stockValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
    textAlign: 'center',
    minWidth: 60,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
});