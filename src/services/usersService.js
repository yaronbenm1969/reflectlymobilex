import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const USERS_COLLECTION = 'users';

export const usersService = {
  createUserProfile: async (uid, { email, displayName }) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(docRef, {
        uid,
        email: email || '',
        displayName: displayName || '',
        bio: '',
        photoUrl: null,
        communityMember: false,
        status: 'pending',
        createdAt: serverTimestamp(),
        approvedAt: null,
      });
      console.log('✅ User profile created:', uid);
      return { success: true };
    } catch (error) {
      console.error('❌ Create user profile error:', error.message);
      return { success: false, error: error.message };
    }
  },

  getUserProfile: async (uid) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { success: true, profile: snap.data() };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('❌ Get user profile error:', error.message);
      return { success: false, error: error.message };
    }
  },

  updateUserProfile: async (uid, updates) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
      console.log('✅ User profile updated:', uid);
      return { success: true };
    } catch (error) {
      console.error('❌ Update user profile error:', error.message);
      return { success: false, error: error.message };
    }
  },
};

export default usersService;
