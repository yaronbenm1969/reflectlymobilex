import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from './firebase';
import Constants from 'expo-constants';

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
        language: storyData.language || 'he',
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
      // Attempt full cascade delete via server (Storage + reflections + invitations + applications + Firestore doc).
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
      if (idToken) {
        const serverUrl = Constants.expoConfig?.extra?.videoConverterUrl || 'https://reflectlymobilex.onrender.com';
        const resp = await fetch(`${serverUrl}/api/delete-story`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId, idToken }),
        });
        if (resp.ok) {
          console.log('✅ Story deleted (full cascade):', storyId);
          return { success: true };
        }
        console.warn('⚠️ Server cascade delete failed, falling back to Firestore-only delete');
      }
      // Fallback: delete Firestore doc only (Storage files will remain, but the story disappears from the UI).
      await deleteDoc(doc(db, STORIES_COLLECTION, storyId));
      console.log('✅ Story deleted (Firestore only):', storyId);
      return { success: true };
    } catch (error) {
      console.error('❌ Delete story error:', error.message);
      return { success: false, error: error.message };
    }
  },

  getCommunityStories: async () => {
    try {
      const q = query(
        collection(db, STORIES_COLLECTION),
        where('communitySettings.communityMode', '==', true),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const stories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, stories };
    } catch (error) {
      console.error('❌ Get community stories error:', error.message);
      return { success: false, error: error.message };
    }
  },

  applyToStory: async (storyId, uid, displayName, incrementPlayers = false, creatorUid = null, profileSnapshot = null, storyName = null) => {
    try {
      const applicationId = `${storyId}_${uid}`;
      const appRef = doc(db, 'applications', applicationId);
      await setDoc(appRef, {
        storyId,
        uid,
        displayName: displayName || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        ...(creatorUid && { creatorUid }),
        ...(profileSnapshot && { profileSnapshot }),
        ...(storyName && { storyName }),
      });
      if (incrementPlayers) {
        await updateDoc(doc(db, STORIES_COLLECTION, storyId), {
          currentPlayers: increment(1),
        });
      }
      console.log('✅ Application submitted:', applicationId);

      // Notify creator (fire-and-forget)
      if (!incrementPlayers && creatorUid) {
        try {
          const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
          if (idToken) {
            const serverUrl = Constants.expoConfig?.extra?.videoConverterUrl || 'https://reflectlymobilex.onrender.com';
            fetch(`${serverUrl}/api/notify-new-application`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storyId, applicantName: displayName || '', creatorUid, idToken }),
            }).catch(() => {});
          }
        } catch (_) {}
      }

      return { success: true, applicationId };
    } catch (error) {
      console.error('❌ Apply to story error:', error.message);
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
  },

  getApprovedApplicationsForPlayer: async (uid) => {
    try {
      const appsQuery = query(
        collection(db, 'applications'),
        where('uid', '==', uid),
        where('status', '==', 'approved')
      );
      const snapshot = await getDocs(appsQuery);
      const applications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, applications };
    } catch (error) {
      console.error('❌ Get approved applications error:', error.message);
      return { success: false, applications: [] };
    }
  },

  // pending + approved apps submitted by this player (for HomeScreen banners)
  getMyApplications: async (uid) => {
    try {
      const snapshot = await getDocs(query(
        collection(db, 'applications'),
        where('uid', '==', uid)
      ));
      const applications = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.status === 'pending' || a.status === 'approved');
      return { success: true, applications };
    } catch (error) {
      console.error('❌ Get my applications error:', error.message);
      return { success: false, applications: [] };
    }
  },

  getPendingApplicationsForCreator: async (creatorUid) => {
    try {
      const appsQuery = query(
        collection(db, 'applications'),
        where('creatorUid', '==', creatorUid),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(appsQuery);
      const applications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, applications };
    } catch (error) {
      console.error('❌ Get creator applications error:', error.message);
      return { success: false, applications: [] };
    }
  },

  getPendingApplications: async (storyId) => {
    try {
      const appsQuery = query(
        collection(db, 'applications'),
        where('storyId', '==', storyId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(appsQuery);
      const applications = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      return { success: true, applications };
    } catch (error) {
      console.error('❌ Get pending applications error:', error.message);
      return { success: false, applications: [] };
    }
  },

  approveApplication: async (applicationId, storyId) => {
    try {
      const appRef = doc(db, 'applications', applicationId);
      const storyRef = doc(db, STORIES_COLLECTION, storyId);
      let playerUid = null;
      await runTransaction(db, async (transaction) => {
        const appSnap = await transaction.get(appRef);
        if (!appSnap.exists() || appSnap.data().status !== 'pending') {
          throw new Error('already_processed');
        }
        playerUid = appSnap.data().uid;
        transaction.update(appRef, { status: 'approved', reviewedAt: serverTimestamp() });
        transaction.update(storyRef, { currentPlayers: increment(1) });
      });
      // Fire-and-forget: push notification to the approved player
      if (playerUid) {
        try {
          const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
          if (idToken) {
            const serverUrl = Constants.expoConfig?.extra?.videoConverterUrl || 'https://reflectlymobilex.onrender.com';
            fetch(`${serverUrl}/api/notify-player-approved`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storyId, playerUid, idToken }),
            }).catch(() => {});
          }
        } catch (_) {}
      }
      console.log('✅ Application approved:', applicationId);
      return { success: true };
    } catch (error) {
      if (error.message === 'already_processed') {
        console.warn('⚠️ Application already processed:', applicationId);
        return { success: false, error: 'already_processed' };
      }
      console.error('❌ Approve application error:', error.message);
      return { success: false, error: error.message };
    }
  },

  rejectApplication: async (applicationId) => {
    try {
      const appRef = doc(db, 'applications', applicationId);
      await updateDoc(appRef, { status: 'rejected', reviewedAt: serverTimestamp() });
      console.log('✅ Application rejected:', applicationId);
      return { success: true };
    } catch (error) {
      console.error('❌ Reject application error:', error.message);
      return { success: false, error: error.message };
    }
  },

  markApplicationJoined: async (storyId, uid) => {
    try {
      const applicationId = `${storyId}_${uid}`;
      await updateDoc(doc(db, 'applications', applicationId), { status: 'joined', joinedAt: serverTimestamp() });
      console.log('✅ Application marked joined:', applicationId);
      return { success: true };
    } catch (error) {
      console.error('❌ Mark joined error:', error.message);
      return { success: false };
    }
  },

  getStoryReflections: async (storyId, maxCount = 4) => {
    try {
      const q = query(
        collection(db, 'reflections'),
        where('storyId', '==', storyId),
        limit(maxCount)
      );
      const snapshot = await getDocs(q);
      const reflections = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, reflections };
    } catch (error) {
      console.error('❌ Get story reflections error:', error.message);
      return { success: false, reflections: [] };
    }
  },
};

export default storiesService;
