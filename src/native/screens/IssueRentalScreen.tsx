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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

type Client = Database['public']['Tables']['clients']['Row'];
type Stock = Database['public']['Tables']['stock']['Row'];

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function IssueRentalScreen() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [driverName, setDriverName] = useState('');
  const [stockData, setStockData] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  useEffect(() => {
    fetchStockData();
    generateNextChallanNumber();
  }, []);

  const fetchStockData = async () => {
    try {
      const { data, error } = await supabase.from('stock').select('*').order('plate_size');
      if (error) throw error;
      setStockData(data || []);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
  };

  const generateNextChallanNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('challans')
        .select('challan_number')
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      let nextNumber = '1';
      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].challan_number) || 0;
        nextNumber = (lastNumber + 1).toString();
      }
      
      setChallanNumber(nextNumber);
    } catch (error) {
      console.error('Error generating challan number:', error);
      setChallanNumber('1');
    }
  };

  const handleSubmit = async () => {
    if (!selectedClient) {
      Alert.alert('ભૂલ', 'કૃપા કરીને ગ્રાહક પસંદ કરો.');
      return;
    }

    if (!challanNumber.trim()) {
      Alert.alert('ભૂલ', 'ચલણ નંબર દાખલ કરો.');
      return;
    }

    const validItems = PLATE_SIZES.filter(size => quantities[size] > 0);
    if (validItems.length === 0) {
      Alert.alert('ભૂલ', 'ઓછામાં ઓછી એક પ્લેટની માત્રા દાખલ કરો.');
      return;
    }

    setLoading(true);

    try {
      const { data: challan, error: challanError } = await supabase
        .from('challans')
        .insert([{
          challan_number: challanNumber,
          client_id: selectedClient.id,
          challan_date: challanDate,
          driver_name: driverName || null
        }])
        .select()
        .single();

      if (challanError) throw challanError;

      const lineItems = validItems.map(size => ({
        challan_id: challan.id,
        plate_size: size,
        borrowed_quantity: quantities[size]
      }));

      const { error: lineItemsError } = await supabase
        .from('challan_items')
        .insert(lineItems);

      if (lineItemsError) throw lineItemsError;

      // Reset form
      setQuantities({});
      setDriverName('');
      setSelectedClient(null);
      
      Alert.alert('સફળતા', `ચલણ ${challan.challan_number} સફળતાપૂર્વક બનાવવામાં આવ્યું!`);
      await fetchStockData();
      await generateNextChallanNumber();
    } catch (error) {
      console.error('Error creating challan:', error);
      Alert.alert('ભૂલ', 'ચલણ બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setLoading(false);
    }
  };

  const getStockInfo = (size: string) => {
    return stockData.find(s => s.plate_size === size);
  };

  if (!user?.isAdmin) {
    return (
      <View style={styles.accessDeniedContainer}>
        <Icon name="lock" size={64} color="#9ca3af" />
        <Text style={styles.accessDeniedTitle}>પ્રવેશ નકારવામાં આવ્યો</Text>
        <Text style={styles.accessDeniedText}>
          તમારી પાસે માત્ર જોવાની પરવાનગી છે. નવા ચલણ બનાવવા માટે Admin સાથે સંપર્ક કરો.
        </Text>
        <Text style={styles.adminEmail}>Admin: nilkanthplatdepo@gmail.com</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="add-circle-outline" size={32} color="#ef4444" />
        <Text style={styles.headerTitle}>ઉધાર ચલણ</Text>
        <Text style={styles.headerSubtitle}>નવો ભાડો બનાવો</Text>
      </View>

      {/* Client Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ગ્રાહક</Text>
        {selectedClient ? (
          <View style={styles.selectedClientCard}>
            <View style={styles.clientInfo}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>
                  {selectedClient.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.clientDetails}>
                <Text style={styles.clientName}>{selectedClient.name}</Text>
                <Text style={styles.clientId}>ID: {selectedClient.id}</Text>
                <Text style={styles.clientSite}>{selectedClient.site}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.changeClientButton}
              onPress={() => setShowClientModal(true)}
            >
              <Text style={styles.changeClientText}>ગ્રાહક બદલવો</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.selectClientButton}
            onPress={() => setShowClientModal(true)}
          >
            <Icon name="person-add" size={24} color="#2563eb" />
            <Text style={styles.selectClientText}>ગ્રાહક પસંદ કરો</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Issue Form */}
      {selectedClient && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>પ્લેટ ઇશ્યૂ</Text>
          
          {/* Basic Details */}
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.label}>ચલણ નંબર *</Text>
              <TextInput
                style={styles.input}
                value={challanNumber}
                onChangeText={setChallanNumber}
                placeholder="ચલણ નંબર"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>તારીખ *</Text>
              <TextInput
                style={styles.input}
                value={challanDate}
                onChangeText={setChallanDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.label}>ડ્રાઈવરનું નામ</Text>
            <TextInput
              style={styles.input}
              value={driverName}
              onChangeText={setDriverName}
              placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
            />
          </View>

          {/* Plates Table */}
          <View style={styles.platesSection}>
            <Text style={styles.label}>પ્લેટ માત્રા</Text>
            {PLATE_SIZES.map(size => {
              const stockInfo = getStockInfo(size);
              return (
                <View key={size} style={styles.plateRow}>
                  <View style={styles.plateInfo}>
                    <Text style={styles.plateSize}>{size}</Text>
                    <Text style={styles.stockInfo}>
                      સ્ટોક: {stockInfo?.available_quantity || 0}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantities[size]?.toString() || ''}
                    onChangeText={(value) => {
                      const quantity = parseInt(value) || 0;
                      setQuantities(prev => ({ ...prev, [size]: quantity }));
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </View>

          {/* Total */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>
              કુલ પ્લેટ: {Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Icon name="save" size={20} color="white" />
            <Text style={styles.submitButtonText}>
              {loading ? 'બનાવી રહ્યા છીએ...' : 'ઉધાર ચલણ બનાવો'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Client Selection Modal */}
      <ClientSelectionModal
        visible={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSelectClient={(client) => {
          setSelectedClient(client);
          setShowClientModal(false);
        }}
      />
    </ScrollView>
  );
}

// Client Selection Modal Component
function ClientSelectionModal({ visible, onClose, onSelectClient }: {
  visible: boolean;
  onClose: () => void;
  onSelectClient: (client: Client) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      fetchClients();
    }
  }, [visible]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('id');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
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
      onPress={() => onSelectClient(item)}
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>ગ્રાહક પસંદ કરો</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="ગ્રાહક શોધો..."
          />
        </View>

        <FlatList
          data={filteredClients}
          renderItem={renderClient}
          keyExtractor={(item) => item.id}
          style={styles.clientsList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fef3e2',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 24,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  adminEmail: {
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'center',
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
  section: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  selectedClientCard: {
    backgroundColor: '#fef3e2',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    color: 'white',
    fontSize: 16,
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
  },
  clientSite: {
    fontSize: 12,
    color: '#6b7280',
  },
  clientMobile: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  changeClientButton: {
    alignSelf: 'flex-start',
  },
  changeClientText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  selectClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  selectClientText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 8,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  formField: {
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  platesSection: {
    marginTop: 16,
  },
  plateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  plateInfo: {
    flex: 1,
  },
  plateSize: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  stockInfo: {
    fontSize: 12,
    color: '#6b7280',
  },
  quantityInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  totalContainer: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#166534',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
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
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
});