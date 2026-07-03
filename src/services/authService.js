import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import Constants from 'expo-constants';
import { auth } from './firebase';
import { usersService } from './usersService';

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
      // Create Firestore user profile (fire-and-forget — don't block signup)
      usersService.createUserProfile(userCredential.user.uid, {
        email: userCredential.user.email,
        displayName,
      });
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

  /**
   * Permanently delete the current user's account and all their data.
   * The server deletes: all owned stories, their Storage files, associated
   * reflections/invitations/applications, the Firestore user profile, and the
   * Firebase Auth record. Stories created by OTHER users are never touched.
   */
  deleteAccount: async () => {
    try {
      if (!auth || !auth.currentUser) {
        return { success: false, error: 'Not signed in' };
      }
      const idToken = await auth.currentUser.getIdToken();
      const serverUrl = Constants.expoConfig?.extra?.videoConverterUrl || 'https://reflectlymobilex.onrender.com';
      const resp = await fetch(`${serverUrl}/api/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${resp.status}`);
      }
      // Firebase Auth user is now deleted on the server.
      // Sign out locally to clear cached credentials and trigger onAuthStateChanged(null).
      await signOut(auth).catch(() => {});
      console.log('✅ Account deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Delete account error:', error.message);
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
