import { 
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

const STORIES_COLLECTION = 'stories';
const INVITATIONS_COLLECTION = 'invitations';

const generateUniqueInviteCode = async (storyName) => {
  const baseName = storyName.trim();
  let code = baseName;
  let counter = 1;
  
  while (true) {
    const q = query(
      collection(db, STORIES_COLLECTION),
      where('inviteCode', '==', code)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return code;
    }
    
    counter++;
    code = `${baseName} ${counter}`;
  }
};

export const storiesService = {
  createStory: async (userId, storyData, userInfo = {}) => {
    try {
      const inviteCode = await generateUniqueInviteCode(storyData.name);
      const docRef = await addDoc(collection(db, STORIES_COLLECTION), {
        userId,
        creatorName: userInfo.displayName || userInfo.name || '',
        creatorEmail: userInfo.email || '',
        name: storyData.name,
        inviteCode,
        videoUri: storyData.videoUri || null,
        format: storyData.format || 'standard',
        music: storyData.music || 'none',
        instructions: storyData.instructions || '',
        videoTimings: storyData.videoTimings || { video1: 30, video2: 30, video3: 30 },
        maxParticipants: storyData.maxParticipants || '1-10',
        clipCount: storyData.clipCount || 3,
        maxClipDuration: storyData.maxClipDuration || 60,
        privacySettings: storyData.privacySettings || { allowSocialMedia: false },
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('✅ Story created:', docRef.id, 'Invite code:', inviteCode);
      return { success: true, storyId: docRef.id, inviteCode };
    } catch (error) {
      console.error('❌ Create story error:', error.message);
      return { success: false, error: error.message };
    }
  },

  getStoryByInviteCode: async (inviteCode) => {
    try {
      const q = query(
        collection(db, STORIES_COLLECTION),
        where('inviteCode', '==', inviteCode.trim())
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { success: true, story: { id: doc.id, ...doc.data() } };
      }
      return { success: false, error: 'Story not found' };
    } catch (error) {
      console.error('❌ Get story by code error:', error.message);
      return { success: false, error: error.message };
    }
  },

  getStory: async (storyId) => {
    try {
      const docRef = doc(db, STORIES_COLLECTION, storyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: true, story: { id: docSnap.id, ...docSnap.data() } };
      }
      return { success: false, error: 'Story not found' };
    } catch (error) {
      console.error('❌ Get story error:', error.message);
      return { success: false, error: error.message };
    }
  },

  getUserStories: async (userId) => {
    try {
      const q = query(
        collection(db, STORIES_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const stories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return { success: true, stories };
    } catch (error) {
      console.error('❌ Get user stories error:', error.message);
      return { success: false, error: error.message };
    }
  },

  updateStory: async (storyId, updates) => {
    try {
      const docRef = doc(db, STORIES_COLLECTION, storyId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Story updated:', storyId);
      return { success: true };
    } catch (error) {
      console.error('❌ Update story error:', error.message);
      return { success: false, error: error.message };
    }
  },

  deleteStory: async (storyId) => {
    try {
      await deleteDoc(doc(db, STORIES_COLLECTION, storyId));
      console.log('✅ Story deleted:', storyId);
      return { success: true };
    } catch (error) {
      console.error('❌ Delete story error:', error.message);
      return { success: false, error: error.message };
    }
  },

  createInvitation: async (storyId, invitedPhone, creatorName) => {
    try {
      const docRef = await addDoc(collection(db, INVITATIONS_COLLECTION), {
        storyId,
        invitedPhone,
        creatorName,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      console.log('✅ Invitation created:', docRef.id);
      return { success: true, invitationId: docRef.id };
    } catch (error) {
      console.error('❌ Create invitation error:', error.message);
      return { success: false, error: error.message };
    }
  }
};

export default storiesService;
