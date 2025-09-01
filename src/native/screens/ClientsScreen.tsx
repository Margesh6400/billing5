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

export function ClientsScreen() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({
    id: '',
    name: '',
    site: '',
    mobile_number: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

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

  const handleAddClient = async () => {
    if (!newClient.id.trim() || !newClient.name.trim()) {
      Alert.alert('ભૂલ', 'કૃપા કરીને બધી જરૂરી માહિતી દાખલ કરો.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([newClient])
        .select()
        .single();

      if (error) throw error;

      setClients([data, ...clients]);
      setShowAddModal(false);
      setNewClient({ id: '', name: '', site: '', mobile_number: '' });
      Alert.alert('સફળતા', 'ગ્રાહક સફળતાપૂર્વક ઉમેરવામાં આવ્યો!');
    } catch (error) {
      console.error('Error adding client:', error);
      Alert.alert('ભૂલ', 'ગ્રાહક ઉમેરવામાં ભૂલ. કૃપા કરીને તપાસો કે ID અનન્ય છે.');
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          site: editingClient.site,
          mobile_number: editingClient.mobile_number
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      setClients(clients.map(client => 
        client.id === editingClient.id ? editingClient : client
      ));
      setEditingClient(null);
      Alert.alert('સફળતા', 'ગ્રાહક સફળતાપૂર્વક અપડેટ થયો!');
    } catch (error) {
      console.error('Error updating client:', error);
      Alert.alert('ભૂલ', 'ગ્રાહક અપડેટ કરવામાં ભૂલ.');
    }
  };

  const handleDeleteClient = (clientId: string) => {
    Alert.alert(
      'પુષ્ટિ કરો',
      'શું તમે ખરેખર આ ગ્રાહકને ડિલીટ કરવા માંગો છો?',
      [
        { text: 'રદ કરો', style: 'cancel' },
        { 
          text: 'ડિલીટ કરો', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', clientId);

              if (error) throw error;

              setClients(clients.filter(client => client.id !== clientId));
              Alert.alert('સફળતા', 'ગ્રાહક સફળતાપૂર્વક ડિલીટ થયો!');
            } catch (error) {
              console.error('Error deleting client:', error);
              Alert.alert('ભૂલ', 'ગ્રાહક ડિલીટ કરવામાં ભૂલ.');
            }
          }
        }
      ]
    );
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.clientCard}>
      <View style={styles.clientHeader}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.name}</Text>
          <Text style={styles.clientId}>ID: {item.id}</Text>
          <Text style={styles.clientSite}>{item.site}</Text>
          <Text style={styles.clientMobile}>{item.mobile_number}</Text>
        </View>
        {user?.isAdmin && (
          <View style={styles.clientActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setEditingClient(item)}
            >
              <Icon name="edit" size={20} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteClient(item.id)}
            >
              <Icon name="delete" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="people" size={32} color="#2563eb" />
        <Text style={styles.headerTitle}>ગ્રાહકો</Text>
        <Text style={styles.headerSubtitle}>તમારા ગ્રાહકોનું સંચાલન</Text>
      </View>

      {/* Search and Add */}
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="ગ્રાહકો શોધો..."
          />
        </View>
        
        {user?.isAdmin && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Icon name="add" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Clients List */}
      <FlatList
        data={filteredClients}
        renderItem={renderClient}
        keyExtractor={(item) => item.id}
        style={styles.clientsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="people" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {searchTerm ? 'કોઈ ગ્રાહક મળ્યો નથી' : 'હજુ સુધી કોઈ ગ્રાહક ઉમેરવામાં આવ્યો નથી'}
            </Text>
          </View>
        }
      />

      {/* Add Client Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>નવો ગ્રાહક ઉમેરો</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Icon name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.label}>ગ્રાહક ID *</Text>
              <TextInput
                style={styles.input}
                value={newClient.id}
                onChangeText={(value) => setNewClient({ ...newClient, id: value })}
                placeholder="અનન્ય ID દાખલ કરો"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>નામ *</Text>
              <TextInput
                style={styles.input}
                value={newClient.name}
                onChangeText={(value) => setNewClient({ ...newClient, name: value })}
                placeholder="ગ્રાહકનું નામ"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>સાઇટ *</Text>
              <TextInput
                style={styles.input}
                value={newClient.site}
                onChangeText={(value) => setNewClient({ ...newClient, site: value })}
                placeholder="સાઇટ સ્થાન"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>મોબાઇલ નંબર *</Text>
              <TextInput
                style={styles.input}
                value={newClient.mobile_number}
                onChangeText={(value) => setNewClient({ ...newClient, mobile_number: value })}
                placeholder="મોબાઇલ નંબર"
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddClient}>
              <Icon name="save" size={20} color="white" />
              <Text style={styles.submitButtonText}>ગ્રાહક ઉમેરો</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Client Modal */}
      <Modal visible={!!editingClient} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ગ્રાહક એડિટ કરો</Text>
            <TouchableOpacity onPress={() => setEditingClient(null)}>
              <Icon name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {editingClient && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.formField}>
                <Text style={styles.label}>નામ *</Text>
                <TextInput
                  style={styles.input}
                  value={editingClient.name}
                  onChangeText={(value) => setEditingClient({ ...editingClient, name: value })}
                  placeholder="ગ્રાહકનું નામ"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>સાઇટ *</Text>
                <TextInput
                  style={styles.input}
                  value={editingClient.site}
                  onChangeText={(value) => setEditingClient({ ...editingClient, site: value })}
                  placeholder="સાઇટ સ્થાન"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>મોબાઇલ નંબર *</Text>
                <TextInput
                  style={styles.input}
                  value={editingClient.mobile_number}
                  onChangeText={(value) => setEditingClient({ ...editingClient, mobile_number: value })}
                  placeholder="મોબાઇલ નંબર"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleUpdateClient}>
                <Icon name="save" size={20} color="white" />
                <Text style={styles.submitButtonText}>સેવ કરો</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
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
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clientsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  clientCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  clientInfo: {
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
  clientActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
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
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formField: {
    marginBottom: 16,
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
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});