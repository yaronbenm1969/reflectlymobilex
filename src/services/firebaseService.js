import { db, storage, firebase, firebaseInitialized } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

const COLLECTIONS = {
  STORIES: 'stories',
  INVITATIONS: 'invitations',
  PARTICIPANTS: 'participants',
  VIDEOS: 'videos',
};

const demoStories = new Map();
const demoInvitations = new Map();
const demoVideos = new Map();

export const firebaseService = {
  isInitialized() {
    return firebaseInitialized;
  },

  async createStory(storyData) {
    const storyId = uuidv4();
    const storyRecord = {
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!firebaseInitialized) {
      demoStories.set(storyId, storyRecord);
      console.log('Demo mode: Story created locally', storyId);
      return storyId;
    }
    
    await db.collection(COLLECTIONS.STORIES).doc(storyId).set({
      ...storyRecord,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    return storyId;
  },

  async getStory(storyId) {
    if (!firebaseInitialized) {
      return demoStories.get(storyId) || null;
    }

    const doc = await db.collection(COLLECTIONS.STORIES).doc(storyId).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async updateStory(storyId, updates) {
    if (!firebaseInitialized) {
      const story = demoStories.get(storyId);
      if (story) {
        demoStories.set(storyId, { ...story, ...updates, updatedAt: new Date() });
      }
      return;
    }

    await db.collection(COLLECTIONS.STORIES).doc(storyId).update({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async uploadVideo(uri, storyId, videoType, onProgress) {
    if (!firebaseInitialized) {
      const videoId = uuidv4();
      const demoUrl = `demo://video/${storyId}/${videoId}`;
      demoVideos.set(videoId, { id: videoId, storyId, type: videoType, url: uri });
      if (onProgress) onProgress(100);
      console.log('Demo mode: Video saved locally', videoId);
      return { videoId, url: uri };
    }

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
    const inviteRecord = {
      id: inviteId,
      storyId,
      phoneNumber,
      participantName,
      status: 'pending',
      createdAt: new Date(),
    };

    if (!firebaseInitialized) {
      demoInvitations.set(inviteId, inviteRecord);
      console.log('Demo mode: Invitation created locally', inviteId);
      return inviteId;
    }
    
    await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).set({
      ...inviteRecord,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    return inviteId;
  },

  async getInvitation(inviteId) {
    if (!firebaseInitialized) {
      return demoInvitations.get(inviteId) || null;
    }

    const doc = await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async updateInvitationStatus(inviteId, status) {
    if (!firebaseInitialized) {
      const invite = demoInvitations.get(inviteId);
      if (invite) {
        demoInvitations.set(inviteId, { ...invite, status, updatedAt: new Date() });
      }
      return;
    }

    await db.collection(COLLECTIONS.INVITATIONS).doc(inviteId).update({ 
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async addParticipantVideo(storyId, inviteId, videoNumber, videoUrl) {
    const participantVideoId = uuidv4();

    if (!firebaseInitialized) {
      console.log('Demo mode: Participant video added locally', participantVideoId);
      return participantVideoId;
    }
    
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
    if (!firebaseInitialized) {
      return [];
    }

    const snapshot = await db.collection(COLLECTIONS.PARTICIPANTS)
      .where('storyId', '==', storyId)
      .orderBy('uploadedAt', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getStoryInvitations(storyId) {
    if (!firebaseInitialized) {
      return Array.from(demoInvitations.values()).filter(inv => inv.storyId === storyId);
    }

    const snapshot = await db.collection(COLLECTIONS.INVITATIONS)
      .where('storyId', '==', storyId)
      .orderBy('createdAt', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  subscribeToStory(storyId, callback) {
    if (!firebaseInitialized) {
      const story = demoStories.get(storyId);
      if (story) callback(story);
      return () => {};
    }

    return db.collection(COLLECTIONS.STORIES).doc(storyId).onSnapshot((doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  },

  subscribeToParticipantVideos(storyId, callback) {
    if (!firebaseInitialized) {
      callback([]);
      return () => {};
    }

    return db.collection(COLLECTIONS.PARTICIPANTS)
      .where('storyId', '==', storyId)
      .orderBy('uploadedAt', 'asc')
      .onSnapshot((snapshot) => {
        const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(videos);
      });
  },

  subscribeToInvitations(storyId, callback) {
    if (!firebaseInitialized) {
      callback(Array.from(demoInvitations.values()).filter(inv => inv.storyId === storyId));
      return () => {};
    }

    return db.collection(COLLECTIONS.INVITATIONS)
      .where('storyId', '==', storyId)
      .orderBy('createdAt', 'asc')
      .onSnapshot((snapshot) => {
        const invitations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(invitations);
      });
  },

  async getUserStories(userId) {
    if (!firebaseInitialized) {
      return Array.from(demoStories.values()).filter(s => s.creatorId === userId);
    }

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
