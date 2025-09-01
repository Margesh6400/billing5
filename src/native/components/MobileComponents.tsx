import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface FloatingActionButtonProps {
  iconName: string;
  onPress: () => void;
  label?: string;
  backgroundColor?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  iconName,
  onPress,
  label,
  backgroundColor = '#2563eb'
}) => (
  <TouchableOpacity 
    style={[styles.fab, { backgroundColor }]} 
    onPress={onPress}
  >
    <Icon name={iconName} size={24} color="white" />
    {label && <Text style={styles.fabLabel}>{label}</Text>}
  </TouchableOpacity>
);

interface MobileCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export const MobileCard: React.FC<MobileCardProps> = ({ children, onPress, style }) => (
  <TouchableOpacity
    style={[styles.card, style]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    {children}
  </TouchableOpacity>
);

interface MobileSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}

export const MobileSelect: React.FC<MobileSelectProps> = ({
  label,
  options,
  value,
  onValueChange,
  error
}) => (
  <View style={styles.selectContainer}>
    <Text style={styles.selectLabel}>{label}</Text>
    <View style={styles.selectWrapper}>
      {/* Note: In a real React Native app, you'd use @react-native-picker/picker */}
      <Text style={styles.selectValue}>
        {options.find(opt => opt.value === value)?.label || 'Select...'}
      </Text>
      <Icon name="arrow-drop-down" size={24} color="#6b7280" />
    </View>
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

interface StatusBadgeProps {
  status: string;
  color: string;
  backgroundColor: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, color, backgroundColor }) => (
  <View style={[styles.statusBadge, { backgroundColor }]}>
    <Text style={[styles.statusText, { color }]}>{status}</Text>
  </View>
);

interface EmptyStateProps {
  iconName: string;
  title: string;
  subtitle?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ iconName, title, subtitle }) => (
  <View style={styles.emptyState}>
    <Icon name={iconName} size={64} color="#d1d5db" />
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  card: {
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
  selectContainer: {
    marginBottom: 16,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  selectWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    minHeight: 44,
  },
  selectValue: {
    fontSize: 16,
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
});