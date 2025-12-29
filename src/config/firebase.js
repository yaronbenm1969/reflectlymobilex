import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: extra.firebaseApiKey || process.env.FIREBASE_API_KEY,
  authDomain: extra.firebaseAuthDomain || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: extra.firebaseProjectId || process.env.FIREBASE_PROJECT_ID,
  storageBucket: extra.firebaseStorageBucket || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.firebaseMessagingSenderId || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.firebaseAppId || process.env.FIREBASE_APP_ID,
};

let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app();
}

const db = firebase.firestore();
const storage = firebase.storage();

export { app, db, storage, firebase };
export default app;
