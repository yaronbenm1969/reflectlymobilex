import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';
const EXPECTED_ACCESS_CODE = process.env.EXPO_PUBLIC_ACCESS_CODE;
const STORAGE_KEY = '@reflectly/access_code';

let storedAccessCode = null;

export const accessService = {
  async checkMaintenanceStatus() {
    try {
      const response = await fetch(`${API_URL}/api/maintenance-status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to check maintenance status:', error);
      return { maintenance: false, error: true };
    }
  },

  async verifyAccessCode(code) {
    try {
      const expected = typeof EXPECTED_ACCESS_CODE === 'string' ? EXPECTED_ACCESS_CODE.trim() : '';
      if (!expected) {
        console.warn('⚠️ Access code missing in env - skipping gate');
        return { valid: true, codeRequired: false };
      }

      const entered = typeof code === 'string' ? code.trim() : '';
      const isValid = entered === expected;

      if (isValid) {
        storedAccessCode = entered;
        await AsyncStorage.setItem(STORAGE_KEY, entered);
      }

      return { valid: isValid, codeRequired: true };
    } catch (error) {
      console.error('Failed to verify access code:', error);
      return { valid: false, error: true };
    }
  },

  async getStoredCode() {
    try {
      const code = await AsyncStorage.getItem(STORAGE_KEY);
      if (code) {
        storedAccessCode = code;
      }
      return code;
    } catch (error) {
      console.error('Failed to get stored code:', error);
      return null;
    }
  },

  async clearStoredCode() {
    try {
      storedAccessCode = null;
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear stored code:', error);
    }
  },

  getAccessCode() {
    return storedAccessCode;
  },

  isAccessCodeConfigured() {
    return typeof EXPECTED_ACCESS_CODE === 'string' && EXPECTED_ACCESS_CODE.trim().length > 0;
  },

  getAuthHeaders() {
    return storedAccessCode ? { 'x-app-access-code': storedAccessCode } : {};
  },

  async securedFetch(url, options = {}) {
    const headers = {
      ...options.headers,
      ...this.getAuthHeaders(),
    };
    return fetch(url, { ...options, headers });
  },
};

export default accessService;
