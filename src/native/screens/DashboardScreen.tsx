import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface DashboardStats {
  activeUdharChallans: number;
  pendingJamaReturns: number;
  onRentPlates: number;
  totalClients: number;
  lowStockItems: number;
  overdueChallans: number;
  totalStock: number;
}

interface RecentActivity {
  id: number;
  type: 'udhar' | 'jama';
  challan_number: string;
  client_name: string;
  created_at: string;
  status: string;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [stats, setStats] = useState<DashboardStats>({
    activeUdharChallans: 0,
    pendingJamaReturns: 0,
    onRentPlates: 0,
    totalClients: 0,
    lowStockItems: 0,
    overdueChallans: 0,
    totalStock: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        clientsResult,
        challansResult,
        stockResult,
        returnsResult
      ] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact' }),
        supabase.from('challans').select('id, status, challan_date, challan_number, client:clients(name)', { count: 'exact' }),
        supabase.from('stock').select('*'),
        supabase.from('returns').select('id, return_challan_number, client:clients(name), created_at', { count: 'exact' })
      ]);

      const totalClients = clientsResult.count || 0;
      const activeUdharChallans = challansResult.data?.filter(c => c.status === 'active').length || 0;
      const pendingJamaReturns = activeUdharChallans;
      
      const stockData = stockResult.data || [];
      const onRentPlates = stockData.reduce((sum, item) => sum + item.on_rent_quantity, 0);
      const lowStockItems = stockData.filter(item => item.available_quantity < 10).length;
      const totalStock = stockData.reduce((sum, item) => sum + item.total_quantity, 0);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const overdueChallans = challansResult.data?.filter(c => 
        c.status === 'active' && new Date(c.challan_date) < thirtyDaysAgo
      ).length || 0;

      setStats({
        activeUdharChallans,
        pendingJamaReturns,
        onRentPlates,
        totalClients,
        lowStockItems,
        overdueChallans,
        totalStock
      });

      const recentChallans = challansResult.data?.slice(0, 3).map(c => ({
        id: c.id,
        type: 'udhar' as const,
        challan_number: c.challan_number,
        client_name: c.client?.name || 'Unknown',
        created_at: c.challan_date,
        status: c.status
      })) || [];

      const recentReturns = returnsResult.data?.slice(0, 2).map(r => ({
        id: r.id,
        type: 'jama' as const,
        challan_number: r.return_challan_number,
        client_name: r.client?.name || 'Unknown',
        created_at: r.created_at,
        status: 'returned'
      })) || [];

      setRecentActivity([...recentChallans, ...recentReturns].slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const QuickAccessCard = ({ title, subtitle, icon, count, onPress, color }: any) => (
    <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: color }]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Icon name={icon} size={24} color="white" />
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Date Header */}
      <View style={styles.dateHeader}>
        <Icon name="calendar-today" size={24} color="#2563eb" />
        <Text style={styles.dateText}>આજનો દિવસ</Text>
      </View>

      {/* Quick Access Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ઝડપી પ્રવેશ</Text>
        <View style={styles.quickAccessGrid}>
          {user?.isAdmin ? (
            <>
              <QuickAccessCard
                title="ઉધાર ચલણ"
                subtitle="નવું ઉધાર બનાવો"
                icon="add-circle-outline"
                count={stats.activeUdharChallans}
                color="#ef4444"
                onPress={() => navigation.navigate('Issue')}
              />
              <QuickAccessCard
                title="જમા ચલણ"
                subtitle="પ્લેટ્સ પરત કરો"
                icon="keyboard-return"
                count={stats.pendingJamaReturns}
                color="#22c55e"
                onPress={() => navigation.navigate('Return')}
              />
            </>
          ) : (
            <>
              <View style={[styles.quickAccessCard, { backgroundColor: '#9ca3af', opacity: 0.6 }]}>
                <View style={styles.cardHeader}>
                  <Icon name="add-circle-outline" size={24} color="white" />
                  <View style={styles.countBadge}>
                    <Icon name="lock" size={12} color="white" />
                  </View>
                </View>
                <Text style={styles.cardTitle}>ઉધાર ચલણ</Text>
                <Text style={styles.cardSubtitle}>માત્ર જોવા માટે</Text>
              </View>
              <View style={[styles.quickAccessCard, { backgroundColor: '#9ca3af', opacity: 0.6 }]}>
                <View style={styles.cardHeader}>
                  <Icon name="keyboard-return" size={24} color="white" />
                  <View style={styles.countBadge}>
                    <Icon name="lock" size={12} color="white" />
                  </View>
                </View>
                <Text style={styles.cardTitle}>જમા ચલણ</Text>
                <Text style={styles.cardSubtitle}>માત્ર જોવા માટે</Text>
              </View>
            </>
          )}
          
          <QuickAccessCard
            title="ખાતાવહી"
            subtitle="ગ્રાહક બાકી જુઓ"
            icon="book"
            count={stats.activeUdharChallans}
            color="#f59e0b"
            onPress={() => navigation.navigate('Ledger')}
          />
          <QuickAccessCard
            title="સ્ટોક"
            subtitle="ઇન્વેન્ટરી જુઓ"
            icon="inventory"
            count={stats.totalStock}
            color="#8b5cf6"
            onPress={() => navigation.navigate('Stock')}
          />
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>તાજેતરની પ્રવૃત્તિ</Text>
        <View style={styles.activityContainer}>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Icon name="description" size={48} color="#d1d5db" />
              <Text style={styles.emptyActivityText}>કોઈ તાજેતરની પ્રવૃત્તિ નથી</Text>
              <Text style={styles.emptyActivitySubtext}>નવું ચલણ બનાવવા માટે શરૂ કરો</Text>
            </View>
          ) : (
            recentActivity.map((activity, index) => (
              <View key={`${activity.type}-${activity.id}`} style={styles.activityItem}>
                <View style={[
                  styles.activityIcon,
                  { backgroundColor: activity.type === 'udhar' ? '#fef3c7' : '#d1fae5' }
                ]}>
                  <Icon 
                    name={activity.type === 'udhar' ? 'add-circle-outline' : 'check-circle'} 
                    size={16} 
                    color={activity.type === 'udhar' ? '#f59e0b' : '#22c55e'} 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>#{activity.challan_number}</Text>
                  <Text style={styles.activityClient}>{activity.client_name}</Text>
                </View>
                <View style={styles.activityStatus}>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: activity.status === 'active' ? '#dbeafe' : '#d1fae5' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: activity.status === 'active' ? '#2563eb' : '#16a34a' }
                    ]}>
                      {activity.status === 'active' ? 'ચાલુ' : 'પરત'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginLeft: 8,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAccessCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  activityContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyActivityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyActivitySubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  activityClient: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  activityStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});