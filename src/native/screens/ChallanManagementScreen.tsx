import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

type Client = Database['public']['Tables']['clients']['Row'];

interface ChallanItem {
  id: number;
  challan_id: number;
  plate_size: string;
  borrowed_quantity: number;
  partner_stock_notes?: string | null;
  status: string;
  borrowed_stock: number;
}

interface ReturnLineItem {
  id: number;
  return_id: number;
  plate_size: string;
  returned_quantity: number;
  damage_notes?: string | null;
  damaged_quantity: number;
  lost_quantity: number;
  returned_borrowed_stock: number;
}

interface Transaction {
  type: 'udhar' | 'jama';
  id: number;
  number: string;
  date: string;
  client_id: string;
  items: Array<{
    plate_size: string;
    quantity: number;
    borrowed_stock?: number;
    returned_borrowed_stock?: number;
    notes?: string;
  }>;
  driver_name?: string;
}

interface ClientLedger {
  client: Client;
  all_transactions: Transaction[];
  total_outstanding: number;
  has_activity: boolean;
}

export function ChallanManagementScreen() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientLedger, setClientLedger] = useState<ClientLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchClientLedger = async (client: Client) => {
    try {
      setLoading(true);
      
      const [challansResponse, returnsResponse] = await Promise.all([
        supabase
          .from('challans')
          .select(`*, challan_items (*)`)
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('returns')
          .select(`*, return_line_items (*)`)
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
      ]);

      if (challansResponse.error) throw challansResponse.error;
      if (returnsResponse.error) throw returnsResponse.error;

      const { data: challans } = challansResponse;
      const { data: returns } = returnsResponse;

      const allTransactions = [
        ...challans?.map(challan => ({
          type: 'udhar' as const,
          id: challan.id,
          number: challan.challan_number,
          date: challan.challan_date,
          client_id: challan.client_id,
          items: challan.challan_items.map((item: ChallanItem) => ({
            plate_size: item.plate_size,
            quantity: item.borrowed_quantity,
            borrowed_stock: item.borrowed_stock || 0,
            notes: item.partner_stock_notes || ''
          })),
          driver_name: challan.driver_name
        })) || [],
        ...returns?.map(returnRecord => ({
          type: 'jama' as const,
          id: returnRecord.id,
          number: returnRecord.return_challan_number,
          date: returnRecord.return_date,
          client_id: returnRecord.client_id,
          items: returnRecord.return_line_items.map((item: ReturnLineItem) => ({
            plate_size: item.plate_size,
            quantity: item.returned_quantity,
            returned_borrowed_stock: item.returned_borrowed_stock || 0,
            notes: item.damage_notes || ''
          })),
          driver_name: returnRecord.driver_name
        })) || []
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalBorrowed = challans?.reduce((sum, challan) => 
        sum + challan.challan_items.reduce((itemSum: number, item: ChallanItem) => 
          itemSum + item.borrowed_quantity + (item.borrowed_stock || 0), 0), 0) || 0;
      const totalReturned = returns?.reduce((sum, returnRecord) => 
        sum + returnRecord.return_line_items.reduce((itemSum: number, item: ReturnLineItem) => 
          itemSum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0), 0) || 0;
      const total_outstanding = totalBorrowed - totalReturned;

      setClientLedger({
        client,
        all_transactions: allTransactions,
        total_outstanding,
        has_activity: allTransactions.length > 0
      });
    } catch (error) {
      console.error('Error fetching client ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setShowClientModal(false);
    fetchClientLedger(client);
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedClient) {
      fetchClientLedger(selectedClient);
    } else {
      fetchClients();
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderClient = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={styles.clientItem}
      onPress={() => handleClientSelect(item)}
    >
      <View style={styles.clientAvatar}>
        <Text style={styles.clientAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.clientDetails}>
        <Text style={styles.clientName}>{item.name}</Text>
        <Text style={styles.clientId}>ID: {item.id}</Text>
        <Text style={styles.clientSite}>{item.site}</Text>
        <Text style={styles.clientMobile}>{item.mobile_number}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isExpanded = expandedTransaction === `${item.type}-${item.id}`;
    const totalQuantity = item.items.reduce((sum, i) => {
      const regularQty = i.quantity || 0;
      const borrowedQty = item.type === 'udhar' 
        ? (i.borrowed_stock || 0) 
        : (i.returned_borrowed_stock || 0);
      return sum + regularQty + borrowedQty;
    }, 0);

    return (
      <View style={styles.transactionCard}>
        <TouchableOpacity
          style={styles.transactionHeader}
          onPress={() => setExpandedTransaction(isExpanded ? null : `${item.type}-${item.id}`)}
        >
          <View style={styles.transactionInfo}>
            <View style={[
              styles.transactionIcon,
              { backgroundColor: item.type === 'udhar' ? '#fef3c7' : '#d1fae5' }
            ]}>
              <Icon 
                name={item.type === 'udhar' ? 'add-circle-outline' : 'check-circle'} 
                size={20} 
                color={item.type === 'udhar' ? '#f59e0b' : '#22c55e'} 
              />
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionNumber}>#{item.number}</Text>
              <Text style={styles.transactionDate}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              <Text style={styles.transactionDriver}>
                ડ્રાઈવર: {item.driver_name || '-'}
              </Text>
            </View>
          </View>
          
          <View style={styles.transactionSummary}>
            <View style={[
              styles.typeBadge,
              { backgroundColor: item.type === 'udhar' ? '#fef3c7' : '#d1fae5' }
            ]}>
              <Text style={[
                styles.typeText,
                { color: item.type === 'udhar' ? '#92400e' : '#065f46' }
              ]}>
                {item.type === 'udhar' ? 'ઉધાર' : 'જમા'}
              </Text>
            </View>
            <Text style={styles.totalQuantity}>{totalQuantity} પ્લેટ</Text>
            <Icon 
              name={isExpanded ? 'expand-less' : 'expand-more'} 
              size={24} 
              color="#6b7280" 
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.itemsTitle}>પ્લેટ વિગતો</Text>
            {item.items.map((plateItem, index) => {
              const regularQty = plateItem.quantity || 0;
              const borrowedQty = item.type === 'udhar' 
                ? (plateItem.borrowed_stock || 0) 
                : (plateItem.returned_borrowed_stock || 0);
              
              if (regularQty === 0 && borrowedQty === 0) return null;

              return (
                <View key={index} style={styles.plateItem}>
                  <Text style={styles.plateSize}>{plateItem.plate_size}</Text>
                  <View style={styles.plateQuantities}>
                    {regularQty > 0 && (
                      <Text style={[
                        styles.plateQuantity,
                        { color: item.type === 'udhar' ? '#dc2626' : '#16a34a' }
                      ]}>
                        {regularQty}
                      </Text>
                    )}
                    {borrowedQty > 0 && (
                      <Text style={styles.borrowedQuantity}>
                        +{borrowedQty}*
                      </Text>
                    )}
                  </View>
                  {plateItem.notes && (
                    <Text style={styles.plateNotes}>{plateItem.notes}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  if (!selectedClient) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="book" size={32} color="#2563eb" />
          <Text style={styles.headerTitle}>ચલણ બૂક</Text>
          <Text style={styles.headerSubtitle}>ગ્રાહક પસંદ કરો અને ચલણ જુઓ</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="ગ્રાહક શોધો..."
          />
        </View>

        {/* Clients List */}
        <FlatList
          data={filteredClients}
          renderItem={renderClient}
          keyExtractor={(item) => item.id}
          style={styles.clientsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="people" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>કોઈ ગ્રાહક મળ્યો નથી</Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Selected Client Header */}
      <View style={styles.selectedClientHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedClient(null);
            setClientLedger(null);
            setExpandedTransaction(null);
          }}
        >
          <Icon name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <View style={styles.selectedClientInfo}>
          <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
          <Text style={styles.selectedClientId}>ID: {selectedClient.id}</Text>
          {clientLedger && (
            <Text style={styles.outstandingText}>
              કુલ બાકી: {clientLedger.total_outstanding} પ્લેટ્સ
            </Text>
          )}
        </View>
      </View>

      {/* Transactions List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>લોડ થઈ રહ્યું છે...</Text>
        </View>
      ) : !clientLedger?.has_activity ? (
        <View style={styles.emptyContainer}>
          <Icon name="description" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>કોઈ ચલણ પ્રવૃત્તિ નથી</Text>
          <Text style={styles.emptySubtext}>આ ગ્રાહક માટે કોઈ ચલણ બનાવવામાં આવ્યું નથી</Text>
        </View>
      ) : (
        <FlatList
          data={clientLedger.all_transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          style={styles.transactionsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  clientsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  clientId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  clientSite: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  clientMobile: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
    marginTop: 2,
  },
  selectedClientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  selectedClientInfo: {
    flex: 1,
    alignItems: 'center',
  },
  selectedClientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  selectedClientId: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 2,
  },
  outstandingText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
    marginTop: 2,
  },
  transactionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transactionCard: {
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
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  transactionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  transactionDriver: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  transactionSummary: {
    alignItems: 'flex-end',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  plateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  plateSize: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  plateQuantities: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
  },
  borrowedQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8b5cf6',
  },
  plateNotes: {
    fontSize: 12,
    color: '#2563eb',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});