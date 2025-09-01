import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../hooks/useAuth';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const { signIn, signUp } = useAuth();

  const handleSubmit = async () => {
    setLoading(true);

    if (!email.trim()) {
      Alert.alert('ભૂલ', 'કૃપા કરીને તમારું ઇમેઇલ એડ્રેસ દાખલ કરો');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      Alert.alert('ભૂલ', 'કૃપા કરીને તમારો પાસવર્ડ દાખલ કરો');
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        Alert.alert('ભૂલ', 'પાસવર્ડ ઓછામાં ઓછા 6 અક્ષરોનો હોવો જોઈએ');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('ભૂલ', 'પાસવર્ડ અને કન્ફર્મ પાસવર્ડ મેળ ખાતા નથી');
        setLoading(false);
        return;
      }
    }

    try {
      const { error } = mode === 'signup' 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('ભૂલ', mode === 'signin' 
            ? 'ખોટું ઇમેઇલ અથવા પાસવર્ડ. કૃપા કરીને તપાસો અને ફરી પ્રયત્ન કરો.'
            : 'એકાઉન્ટ બનાવવામાં અસમર્થ. કૃપા કરીને ફરી પ્રયત્ન કરો.'
          );
        } else {
          Alert.alert('ભૂલ', error.message);
        }
      } else if (mode === 'signup') {
        Alert.alert('સફળતા', 'એકાઉન્ટ સફળતાપૂર્વક બનાવવામાં આવ્યું! હવે તમે સાઇન ઇન કરી શકો છો.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      Alert.alert('ભૂલ', 'કનેક્શન એરર. કૃપા કરીને તમારું ઇન્ટરનેટ કનેક્શન તપાસો અને ફરી પ્રયત્ન કરો.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>NT</Text>
            </View>
            <Text style={styles.title}>NO WERE TECH</Text>
            <Text style={styles.subtitle}>સેન્ટરિંગ પ્લેટ્સ ભાડા સિસ્ટમ</Text>
            <Text style={styles.welcomeText}>
              {mode === 'signup' ? 'નવું એકાઉન્ટ બનાવો' : 'સ્વાગત છે'}
            </Text>
          </View>

          {/* Email Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>ઇમેઇલ એડ્રેસ</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="તમારું ઇમેઇલ દાખલ કરો"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>પાસવર્ડ</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="તમારો પાસવર્ડ દાખલ કરો"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Icon 
                  name={showPassword ? 'visibility-off' : 'visibility'} 
                  size={24} 
                  color="#6b7280" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Field - Only for Sign Up */}
          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>પાસવર્ડ કન્ફર્મ કરો</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="પાસવર્ડ ફરીથી દાખલ કરો"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Icon 
                    name={showConfirmPassword ? 'visibility-off' : 'visibility'} 
                    size={24} 
                    color="#6b7280" 
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Icon 
              name={mode === 'signup' ? 'person-add' : 'login'} 
              size={20} 
              color="white" 
            />
            <Text style={styles.submitButtonText}>
              {loading ? 'લોડ થઈ રહ્યું છે...' : mode === 'signup' ? 'એકાઉન્ટ બનાવો' : 'સાઇન ઇન કરો'}
            </Text>
          </TouchableOpacity>

          {/* Mode Switch */}
          <TouchableOpacity
            style={styles.modeSwitch}
            onPress={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            <Icon 
              name={mode === 'signup' ? 'arrow-back' : 'person-add'} 
              size={16} 
              color="#2563eb" 
            />
            <Text style={styles.modeSwitchText}>
              {mode === 'signup' 
                ? 'પહેલેથી એકાઉન્ટ છે? સાઇન ઇન કરો'
                : 'એકાઉન્ટ નથી? સાઇન અપ કરો'
              }
            </Text>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              સુરક્ષિત અને વિશ્વસનીય પ્લેટ ભાડા વ્યવસ્થાપન
            </Text>
            <Text style={styles.adminText}>
              Admin: nilkanthplatdepo@gmail.com | Others: View-only access
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  inputContainer: {
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
  modeSwitch: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  modeSwitchText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  footer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  adminText: {
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'center',
    marginTop: 4,
  },
});