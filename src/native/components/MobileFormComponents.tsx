import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface MobileFormGroupProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const MobileFormGroup: React.FC<MobileFormGroupProps> = ({ children, style }) => (
  <View style={[styles.formGroup, style]}>
    {children}
  </View>
);

interface MobileFormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export const MobileFormField: React.FC<MobileFormFieldProps> = ({ label, error, children }) => (
  <View style={styles.formField}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

interface MobileNumberInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

export const MobileNumberInput: React.FC<MobileNumberInputProps> = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  error 
}) => (
  <MobileFormField label={label} error={error}>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType="numeric"
    />
  </MobileFormField>
);

interface MobileDateInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
}

export const MobileDateInput: React.FC<MobileDateInputProps> = ({ 
  label, 
  value, 
  onChangeText, 
  error 
}) => (
  <MobileFormField label={label} error={error}>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder="YYYY-MM-DD"
    />
  </MobileFormField>
);

interface MobileSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export const MobileSearchInput: React.FC<MobileSearchInputProps> = ({ 
  value, 
  onChangeText, 
  placeholder 
}) => (
  <View style={styles.searchContainer}>
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  </View>
);

interface MobileTextareaProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  numberOfLines?: number;
}

export const MobileTextarea: React.FC<MobileTextareaProps> = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  error,
  numberOfLines = 4
}) => (
  <MobileFormField label={label} error={error}>
    <TextInput
      style={[styles.input, styles.textarea]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline
      numberOfLines={numberOfLines}
    />
  </MobileFormField>
);

interface MobileSubmitButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const MobileSubmitButton: React.FC<MobileSubmitButtonProps> = ({
  title,
  onPress,
  loading,
  disabled,
  style
}) => (
  <TouchableOpacity
    style={[
      styles.submitButton,
      disabled && styles.submitButtonDisabled,
      style
    ]}
    onPress={onPress}
    disabled={disabled || loading}
  >
    <Text style={styles.submitButtonText}>
      {loading ? 'લોડ થઈ રહ્યું છે...' : title}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  formGroup: {
    marginBottom: 16,
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
    minHeight: 44,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    minHeight: 44,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
});