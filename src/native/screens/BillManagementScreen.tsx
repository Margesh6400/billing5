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

type Client = Database['public']['Tables']['clients']['Row'];

interface Bill {
  id: number;
  bill_number: string;
  client_id: string;
  client: {
    name: string;
  };
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'overdue';
  generated_at: string;
}

export function BillManagementScreen() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          client:clients(name)
        `)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBills();
  };

  const updatePaymentStatus = async (billId: number, status: string) => {
    if (!user?.isAdmin) {
      Alert.alert('પ્રવેશ નકારવામાં આવ્યો', 'તમારી પાસે આ ક્રિયા કરવાની પરવાનગી નથી.');
      return;
    }

    try {
      const { error } = await supabase
        .from('bills')
        .update({ payment_status: status })
        .eq('id', billId);

      if (error) throw error;
      await fetchBills();
      Alert.alert('સફળતા', 'પેમેન્ટ સ્ટેટસ અપડેટ થયું!');
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('ભૂલ', 'પેમેન્ટ સ્ટેટસ અપડેટ કરવામાં ભૂલ.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#16a34a';
      case 'pending':
        return '#d97706';
      case 'overdue':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'paid':
        return '#dcfce7';
      case 'pending':
        return '#fef3c7';
      case 'overdue':
        return '#fef2f2';
      default:
        return '#f9fafb';
    }
  };

  const filteredBills = bills.filter(bill =>
    bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderBill = ({ item }: { item: Bill }) => (
    <View style={styles.billCard}>
      <View style={styles.billHeader}>
        <View style={styles.billInfo}>
          <Text style={styles.billNumber}>Bill #{item.bill_number}</Text>
          <Text style={styles.clientName}>{item.client.name}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusBg(item.payment_status) }
        ]}>
          <Text style={[
            styles.statusText,
            { color: getStatusColor(item.payment_status) }
          ]}>
            {item.payment_status.charAt(0).toUpperCase() + item.payment_status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.billDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Period</Text>
          <Text style={styles.detailValue}>
            {new Date(item.billing_period_start).toLocaleDateString()} - {new Date(item.billing_period_end).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>₹{item.total_amount.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {user?.isAdmin && (
        <View style={styles.billActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#16a34a' }]}
            onPress={() => updatePaymentStatus(item.id, 'paid')}
          >
            <Icon name="check" size={16} color="white" />
            <Text style={styles.actionButtonText}>Mark Paid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2563eb' }]}
            onPress={() => {/* TODO: Implement download */}}
          >
            <Icon name="download" size={16} color="white" />
            <Text style={styles.actionButtonText}>Download</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="receipt" size={32} color="#dc2626" />
        <Text style={styles.headerTitle}>બિલ વ્યવસ્થાપન</Text>
        <Text style={styles.headerSubtitle}>બિલ અને પેમેન્ટ મેનેજ કરો</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="બિલ નંબર અથવા ગ્રાહક નામથી શોધો..."
        />
      </View>

      {/* Bills List */}
      <FlatList
        data={filteredBills}
        renderItem={renderBill}
        keyExtractor={(item) => item.id.toString()}
        style={styles.billsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="receipt" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>કોઈ બિલ મળ્યું નથી</Text>
          </View>
        }
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  billsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  billCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  billInfo: {
    flex: 1,
  },
  billNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  clientName: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  billDetails: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  billActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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