import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from './firebase';

export const authService = {
  signUp: async (email, password, displayName) => {
    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      console.log('✅ User signed up:', userCredential.user.email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('❌ Sign up error:', error.message);
      return { success: false, error: error.message };
    }
  },

  signIn: async (email, password) => {
    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ User signed in:', userCredential.user.email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('❌ Sign in error:', error.message);
      return { success: false, error: error.message };
    }
  },

  signOutUser: async () => {
    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }
      await signOut(auth);
      console.log('✅ User signed out');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out error:', error.message);
      return { success: false, error: error.message };
    }
  },

  signInAsGuest: async () => {
    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }
      const userCredential = await signInAnonymously(auth);
      console.log('✅ Guest signed in:', userCredential.user.uid);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('❌ Guest sign in error:', error.message);
      return { success: false, error: error.message };
    }
  },

  getCurrentUser: () => {
    return auth ? auth.currentUser : null;
  },

  onAuthChange: (callback) => {
    if (!auth) {
      console.warn('⚠️ Firebase auth missing - skipping auth listener');
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  }
};

export default authService;
