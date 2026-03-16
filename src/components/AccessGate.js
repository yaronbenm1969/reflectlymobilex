import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { accessService } from '../services/accessService';
import theme from '../theme/theme';

export const AccessGate = ({ children }) => {
  const [status, setStatus] = useState('loading');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    setStatus('loading');

    if (!accessService.isAccessCodeConfigured()) {
      setStatus('unlocked');
      return;
    }

    const storedCode = await accessService.getStoredCode();

    if (storedCode) {
      const verifyResult = await accessService.verifyAccessCode(storedCode);
      if (verifyResult.valid) {
        setStatus('unlocked');
        return;
      } else {
        await accessService.clearStoredCode();
      }
    }

    setStatus('locked');
  };

  const handleSubmit = async () => {
    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setIsVerifying(true);
    setError('');

    const result = await accessService.verifyAccessCode(accessCode.trim());
    setIsVerifying(false);

    if (result.valid) {
      setStatus('unlocked');
    } else {
      setError('Invalid access code');
      setAccessCode('');
    }
  };

  if (status === 'loading') {
    return (
      <LinearGradient colors={['#8446b0', '#464fb0']} style={styles.container}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  if (status === 'maintenance') {
    return (
      <LinearGradient colors={['#8446b0', '#464fb0']} style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="construct" size={80} color={theme.colors.primary} />
          <Text style={styles.title}>Under Maintenance</Text>
          <Text style={styles.subtitle}>
            We're making improvements to give you a better experience.
            Please check back soon!
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={checkAccess}>
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.refreshText}>Check Again</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (status === 'locked') {
    return (
      <LinearGradient colors={['#8446b0', '#464fb0']} style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="lock-closed" size={60} color={theme.colors.primary} />
          <Text style={styles.title}>Access Required</Text>
          <Text style={styles.subtitle}>
            Enter your access code to continue
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter access code"
            placeholderTextColor="#999"
            value={accessCode}
            onChangeText={setAccessCode}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          
          {error ? <Text style={styles.error}>{error}</Text> : null}
          
          <TouchableOpacity 
            style={[styles.submitButton, isVerifying && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="key" size={20} color="white" />
                <Text style={styles.submitText}>Unlock</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: 'white',
    marginTop: 15,
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.subtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 15,
    textAlign: 'center',
  },
  error: {
    color: '#e74c3c',
    fontSize: 14,
    marginBottom: 15,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '100%',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 10,
  },
  refreshText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default AccessGate;
