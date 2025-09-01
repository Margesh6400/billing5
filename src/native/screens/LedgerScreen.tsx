import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];

interface PlateBalance {
  plate_size: string;
  total_borrowed: number;
  total_returned: number;
  outstanding: number;
}

interface ClientLedger {
  client: Client;
  plate_balances: PlateBalance[];
  total_outstanding: number;
  has_activity: boolean;
  all_transactions: Array<{
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
  }>;
}

export function LedgerScreen() {
  const [clientLedgers, setClientLedgers] = useState<ClientLedger[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchClientLedgers();
  }, []);

  const fetchClientLedgers = async () => {
    try {
      const [clientsResponse, challansResponse, returnsResponse] = await Promise.all([
        supabase.from('clients').select('*').order('id'),
        supabase.from('challans').select(`*, challan_items (*)`).order('created_at', { ascending: false }),
        supabase.from('returns').select(`*, return_line_items (*)`).order('created_at', { ascending: false })
      ]);

      if (clientsResponse.error) throw clientsResponse.error;
      if (challansResponse.error) throw challansResponse.error;
      if (returnsResponse.error) throw returnsResponse.error;

      const { data: clients } = clientsResponse;
      const { data: challans } = challansResponse;
      const { data: returns } = returnsResponse;

      const ledgers: ClientLedger[] = clients.map(client => {
        const clientChallans = challans.filter(c => c.client_id === client.id);
        const clientReturns = returns.filter(r => r.client_id === client.id);

        const plateBalanceMap = new Map<string, PlateBalance>();

        clientChallans.forEach(challan => {
          challan.challan_items.forEach(item => {
            const existing = plateBalanceMap.get(item.plate_size) || {
              plate_size: item.plate_size,
              total_borrowed: 0,
              total_returned: 0,
              outstanding: 0
            };
            existing.total_borrowed += item.borrowed_quantity;
            plateBalanceMap.set(item.plate_size, existing);
          });
        });

        clientReturns.forEach(returnRecord => {
          returnRecord.return_line_items.forEach(item => {
            const existing = plateBalanceMap.get(item.plate_size);
            if (existing) {
              existing.total_returned += item.returned_quantity;
            }
          });
        });

        const plate_balances = Array.from(plateBalanceMap.values()).map(balance => ({
          ...balance,
          outstanding: balance.total_borrowed - balance.total_returned
        })).filter(balance => balance.total_borrowed > 0);

        const total_outstanding = plate_balances.reduce((sum, balance) => sum + balance.outstanding, 0);

        const allTransactions = [
          ...clientChallans.map(challan => ({
            type: 'udhar' as const,
            id: challan.id,
            number: challan.challan_number,
            date: challan.challan_date,
            client_id: challan.client_id,
            items: challan.challan_items.map(item => ({
              plate_size: item.plate_size,
              quantity: item.borrowed_quantity,
              borrowed_stock: item.borrowed_stock || 0,
              notes: item.partner_stock_notes || ''
            })),
            driver_name: challan.driver_name
          })),
          ...clientReturns.map(returnRecord => ({
            type: 'jama' as const,
            id: returnRecord.id,
            number: returnRecord.return_challan_number,
            date: returnRecord.return_date,
            client_id: returnRecord.client_id,
            items: returnRecord.return_line_items.map(item => ({
              plate_size: item.plate_size,
              quantity: item.returned_quantity,
              returned_borrowed_stock: item.returned_borrowed_stock || 0,
              notes: item.damage_notes || ''
            })),
            driver_name: returnRecord.driver_name
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const has_activity = clientChallans.length > 0 || clientReturns.length > 0;

        return {
          client,
          plate_balances,
          total_outstanding,
          has_activity,
          all_transactions: allTransactions
        };
      });

      setClientLedgers(ledgers);
    } catch (error) {
      console.error('Error fetching client ledgers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchClientLedgers();
  };

  const toggleClientExpansion = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const filteredLedgers = clientLedgers.filter(ledger =>
    ledger.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ledger.client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ledger.client.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderClientLedger = ({ item: ledger }: { item: ClientLedger }) => {
    const isExpanded = expandedClients.has(ledger.client.id);
    
    return (
      <View style={styles.ledgerCard}>
        <TouchableOpacity
          style={styles.ledgerHeader}
          onPress={() => toggleClientExpansion(ledger.client.id)}
        >
          <View style={styles.clientInfo}>
            <View style={[
              styles.clientAvatar,
              { backgroundColor: ledger.total_outstanding > 0 ? '#ef4444' : '#22c55e' }
            ]}>
              <Text style={styles.clientAvatarText}>
                {ledger.client.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.clientDetails}>
              <Text style={styles.clientName}>{ledger.client.name}</Text>
              <Text style={styles.clientId}>ID: {ledger.client.id}</Text>
              <Text style={styles.clientSite}>{ledger.client.site}</Text>
            </View>
          </View>
          
          <View style={styles.outstandingInfo}>
            <Text style={[
              styles.outstandingText,
              { color: ledger.total_outstanding > 0 ? '#dc2626' : '#16a34a' }
            ]}>
              {ledger.total_outstanding}
            </Text>
            <Text style={styles.outstandingLabel}>બાકી પ્લેટ</Text>
            <Icon 
              name={isExpanded ? 'expand-less' : 'expand-more'} 
              size={24} 
              color="#6b7280" 
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {!ledger.has_activity ? (
              <View style={styles.noActivity}>
                <Icon name="trending-up" size={32} color="#d1d5db" />
                <Text style={styles.noActivityText}>કોઈ ભાડા પ્રવૃત્તિ નથી</Text>
              </View>
            ) : (
              <View style={styles.transactionsContainer}>
                <Text style={styles.transactionsTitle}>તાજેતરના વ્યવહારો</Text>
                {ledger.all_transactions.slice(0, 5).map((transaction) => (
                  <View key={`${transaction.type}-${transaction.id}`} style={styles.transactionItem}>
                    <View style={[
                      styles.transactionIcon,
                      { backgroundColor: transaction.type === 'udhar' ? '#fef3c7' : '#d1fae5' }
                    ]}>
                      <Icon 
                        name={transaction.type === 'udhar' ? 'add-circle-outline' : 'check-circle'} 
                        size={16} 
                        color={transaction.type === 'udhar' ? '#f59e0b' : '#22c55e'} 
                      />
                    </View>
                    <View style={styles.transactionContent}>
                      <Text style={styles.transactionNumber}>#{transaction.number}</Text>
                      <Text style={styles.transactionDate}>
                        {new Date(transaction.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.transactionQuantity}>
                      <Text style={styles.quantityText}>
                        {transaction.items.reduce((sum, item) => sum + item.quantity, 0)} પ્લેટ
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="book" size={32} color="#2563eb" />
        <Text style={styles.headerTitle}>ખાતાવહી</Text>
        <Text style={styles.headerSubtitle}>ગ્રાહક ભાડા ઇતિહાસ</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="નામ, ID અથવા સાઇટથી શોધો..."
        />
      </View>

      {/* Client Ledgers List */}
      <FlatList
        data={filteredLedgers}
        renderItem={renderClientLedger}
        keyExtractor={(item) => item.client.id}
        style={styles.ledgersList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="book" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>કોઈ ગ્રાહક મળ્યો નથી</Text>
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
  ledgersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  ledgerCard: {
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
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  outstandingInfo: {
    alignItems: 'center',
  },
  outstandingText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  outstandingLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  noActivity: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noActivityText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  transactionsContainer: {
    marginTop: 8,
  },
  transactionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  transactionQuantity: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
});