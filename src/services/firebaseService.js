import { db, storage } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  uploadBytesResumable 
} from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const COLLECTIONS = {
  STORIES: 'stories',
  INVITATIONS: 'invitations',
  PARTICIPANTS: 'participants',
  VIDEOS: 'videos',
};

export const firebaseService = {
  async createStory(storyData) {
    const storyId = uuidv4();
    const storyRef = doc(db, COLLECTIONS.STORIES, storyId);
    
    await setDoc(storyRef, {
      id: storyId,
      name: storyData.name,
      creatorId: storyData.creatorId || 'anonymous',
      keyStoryUrl: null,
      videoFormat: storyData.videoFormat || 'standard',
      backgroundStyle: storyData.backgroundStyle || null,
      selectedMusic: storyData.selectedMusic || null,
      playerInstructions: storyData.playerInstructions || {
        generic: '',
        video1Time: 30,
        video2Time: 30,
        video3Time: 30,
      },
      privacySettings: storyData.privacySettings || {
        allowSocialMedia: false,
        privateOnly: true,
      },
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return storyId;
  },

  async getStory(storyId) {
    const storyRef = doc(db, COLLECTIONS.STORIES, storyId);
    const storySnap = await getDoc(storyRef);
    
    if (storySnap.exists()) {
      return { id: storySnap.id, ...storySnap.data() };
    }
    return null;
  },

  async updateStory(storyId, updates) {
    const storyRef = doc(db, COLLECTIONS.STORIES, storyId);
    await updateDoc(storyRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async uploadVideo(uri, storyId, videoType, onProgress) {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const videoId = uuidv4();
    const fileName = `${storyId}/${videoType}_${videoId}.mp4`;
    const storageRef = ref(storage, `videos/${fileName}`);
    
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, blob);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const videoRef = doc(db, COLLECTIONS.VIDEOS, videoId);
          await setDoc(videoRef, {
            id: videoId,
            storyId,
            type: videoType,
            url: downloadURL,
            uploadedAt: serverTimestamp(),
          });
          
          resolve({ videoId, url: downloadURL });
        }
      );
    });
  },

  async createInvitation(storyId, phoneNumber, participantName) {
    const inviteId = uuidv4();
    const inviteRef = doc(db, COLLECTIONS.INVITATIONS, inviteId);
    
    await setDoc(inviteRef, {
      id: inviteId,
      storyId,
      phoneNumber,
      participantName,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    
    return inviteId;
  },

  async getInvitation(inviteId) {
    const inviteRef = doc(db, COLLECTIONS.INVITATIONS, inviteId);
    const inviteSnap = await getDoc(inviteRef);
    
    if (inviteSnap.exists()) {
      return { id: inviteSnap.id, ...inviteSnap.data() };
    }
    return null;
  },

  async updateInvitationStatus(inviteId, status) {
    const inviteRef = doc(db, COLLECTIONS.INVITATIONS, inviteId);
    await updateDoc(inviteRef, { 
      status,
      updatedAt: serverTimestamp(),
    });
  },

  async addParticipantVideo(storyId, inviteId, videoNumber, videoUrl) {
    const participantVideoId = uuidv4();
    const participantRef = doc(db, COLLECTIONS.PARTICIPANTS, participantVideoId);
    
    await setDoc(participantRef, {
      id: participantVideoId,
      storyId,
      inviteId,
      videoNumber,
      videoUrl,
      uploadedAt: serverTimestamp(),
    });
    
    const inviteRef = doc(db, COLLECTIONS.INVITATIONS, inviteId);
    await updateDoc(inviteRef, { 
      status: videoNumber === 3 ? 'completed' : 'in_progress',
      updatedAt: serverTimestamp(),
    });
    
    return participantVideoId;
  },

  async getParticipantVideos(storyId) {
    const q = query(
      collection(db, COLLECTIONS.PARTICIPANTS),
      where('storyId', '==', storyId),
      orderBy('uploadedAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getStoryInvitations(storyId) {
    const q = query(
      collection(db, COLLECTIONS.INVITATIONS),
      where('storyId', '==', storyId),
      orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  subscribeToStory(storyId, callback) {
    const storyRef = doc(db, COLLECTIONS.STORIES, storyId);
    return onSnapshot(storyRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  },

  subscribeToParticipantVideos(storyId, callback) {
    const q = query(
      collection(db, COLLECTIONS.PARTICIPANTS),
      where('storyId', '==', storyId),
      orderBy('uploadedAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(videos);
    });
  },

  subscribeToInvitations(storyId, callback) {
    const q = query(
      collection(db, COLLECTIONS.INVITATIONS),
      where('storyId', '==', storyId),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const invitations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(invitations);
    });
  },

  async getUserStories(userId) {
    const q = query(
      collection(db, COLLECTIONS.STORIES),
      where('creatorId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  generateInviteLink(inviteId) {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'reflectly.app';
    return `https://${baseUrl}/invite/${inviteId}`;
  },

  generateWhatsAppMessage(storyName, inviteLink, creatorName = '') {
    const message = `היי! ${creatorName ? creatorName + ' ' : ''}הזמין/ה אותך להשתתף בסטורי "${storyName}" באפליקציית Reflectly. לחץ/י על הקישור לצפייה והקלטה: ${inviteLink}`;
    return encodeURIComponent(message);
  },
};

export default firebaseService;
