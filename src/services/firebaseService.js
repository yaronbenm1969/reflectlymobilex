import { db, storage, firebase } from '../config/firebase';
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
    
    await db.collection(COLLECTIONS.STORIES).doc(storyId).set({
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
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    return storyId;
  },

  async getStory(storyId) {
    const doc = await db.collection(COLLECTIONS.STORIES).doc(storyId).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async updateStory(storyId, updates) {
    await db.collection(COLLECTIONS.STORIES).doc(storyId).update({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async uploadVideo(uri, storyId, videoType, onProgress) {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const videoId = uuidv4();
    const fileName = `videos/${storyId}/${videoType}_${videoId}.mp4`;
    const storageRef = storage.ref(fileName);
    
    return new Promise((resolve, reject) => {
      const uploadTask = storageRef.put(blob);
      
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
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          await db.collection(COLLECTIONS.VIDEOS).doc(videoId).set({
            id: videoId,
            storyId,
            type: videoType,
            url: downloadURL,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          
          resolve({ videoId, url: downloadURL });
        }
      );
    });
  },

  async createInvitation(storyId, phoneNumber, participantName) {
    const inviteId = uuidv4();
    
    await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).set({
      id: inviteId,
      storyId,
      phoneNumber,
      participantName,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    return inviteId;
  },

  async getInvitation(inviteId) {
    const doc = await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async updateInvitationStatus(inviteId, status) {
    await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).update({ 
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async addParticipantVideo(storyId, inviteId, videoNumber, videoUrl) {
    const participantVideoId = uuidv4();
    
    await db.collection(COLLECTIONS.PARTICIPANTS).doc(participantVideoId).set({
      id: participantVideoId,
      storyId,
      inviteId,
      videoNumber,
      videoUrl,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).update({ 
      status: videoNumber === 3 ? 'completed' : 'in_progress',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    return participantVideoId;
  },

  async getParticipantVideos(storyId) {
    const snapshot = await db.collection(COLLECTIONS.PARTICIPANTS)
      .where('storyId', '==', storyId)
      .orderBy('uploadedAt', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getStoryInvitations(storyId) {
    const snapshot = await db.collection(COLLECTIONS.INVITATIONS)
      .where('storyId', '==', storyId)
      .orderBy('createdAt', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  subscribeToStory(storyId, callback) {
    return db.collection(COLLECTIONS.STORIES).doc(storyId).onSnapshot((doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  },

  subscribeToParticipantVideos(storyId, callback) {
    return db.collection(COLLECTIONS.PARTICIPANTS)
      .where('storyId', '==', storyId)
      .orderBy('uploadedAt', 'asc')
      .onSnapshot((snapshot) => {
        const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(videos);
      });
  },

  subscribeToInvitations(storyId, callback) {
    return db.collection(COLLECTIONS.INVITATIONS)
      .where('storyId', '==', storyId)
      .orderBy('createdAt', 'asc')
      .onSnapshot((snapshot) => {
        const invitations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(invitations);
      });
  },

  async getUserStories(userId) {
    const snapshot = await db.collection(COLLECTIONS.STORIES)
      .where('creatorId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
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
