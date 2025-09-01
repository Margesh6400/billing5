import { Alert, Linking, Platform } from 'react-native';

export const showAlert = (title: string, message: string, onPress?: () => void) => {
  Alert.alert(title, message, onPress ? [{ text: 'OK', onPress }] : undefined);
};

export const showConfirmAlert = (
  title: string, 
  message: string, 
  onConfirm: () => void,
  onCancel?: () => void
) => {
  Alert.alert(
    title,
    message,
    [
      { text: 'રદ કરો', style: 'cancel', onPress: onCancel },
      { text: 'પુષ્ટિ કરો', onPress: onConfirm }
    ]
  );
};

export const openPhoneDialer = (phoneNumber: string) => {
  const url = `tel:${phoneNumber}`;
  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        return Linking.openURL(url);
      } else {
        showAlert('ભૂલ', 'ફોન ડાયલર ખોલી શકાયું નથી');
      }
    })
    .catch((err) => console.error('Error opening phone dialer:', err));
};

export const openMaps = (address: string) => {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const latLng = `${address}`;
  const label = address;
  const url = Platform.select({
    ios: `${scheme}${label}@${latLng}`,
    android: `${scheme}${latLng}(${label})`
  });

  if (url) {
    Linking.openURL(url);
  }
};

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN');
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

export const hapticFeedback = () => {
  // Note: In a real React Native app, you'd use react-native-haptic-feedback
  // For now, this is a placeholder
  console.log('Haptic feedback triggered');
};