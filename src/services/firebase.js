import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const getEnvVar = (key) => {
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[`EXPO_PUBLIC_${key}`];
  }
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY') || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN') || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: getEnvVar('FIREBASE_PROJECT_ID') || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET') || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID') || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: getEnvVar('FIREBASE_APP_ID') || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app = null;
let auth = null;
let db = null;
let storage = null;

const initializeFirebase = () => {
  try {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('⚠️ Firebase config missing - running in demo mode');
      return false;
    }

    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('🔥 Firebase app initialized');
    } else {
      app = getApps()[0];
      console.log('🔥 Using existing Firebase app');
    }
    
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (authError) {
      auth = getAuth(app);
    }
    
    db = getFirestore(app);
    storage = getStorage(app);
    
    console.log('🔥 Firebase services ready');
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    return false;
  }
};

const isInitialized = initializeFirebase();

export { app, auth, db, storage, isInitialized };
export default app;
