import { create } from 'zustand';

let firebaseService = null;
const getFirebaseService = () => {
  if (!firebaseService) {
    try {
      firebaseService = require('../services/firebaseService').firebaseService;
    } catch (e) {
      console.warn('Firebase service not available:', e.message);
      firebaseService = {
        isInitialized: () => false,
        createStory: async () => 'demo-' + Date.now(),
        updateStory: async () => {},
        uploadVideo: async (uri) => ({ videoId: 'demo', url: uri }),
        generateInviteLink: (id) => `https://reflectly.app/invite/${id}`,
        generateWhatsAppMessage: (name, link) => encodeURIComponent(`הזמנה ל-${name}: ${link}`),
      };
    }
  }
  return firebaseService;
};

export const useAppState = create((set, get) => ({
  // Initial state
  currentScreen: 'Splash',
  navigationParams: null,
  screenHistory: [],
  
  // Firebase state
  currentStoryId: null,
  isUploading: false,
  uploadProgress: 0,
  firebaseError: null,
  
  // Story state
  storyName: '',
  lastRecordingUri: null,
  keyStoryUri: null,
  
  // Recording settings
  isCountdownEnabled: true,
  recordingDuration: 0,
  
  // Format & Music
  selectedMusic: null,
  videoFormat: null,
  backgroundStyle: null,
  
  // Player instructions
  playerInstructions: {
    generic: '',
    video1Time: 30,
    video2Time: 30,
    video3Time: 30,
  },
  
  // Privacy settings
  privacySettings: {
    allowSocialMedia: false,
    privateOnly: true,
  },
  
  // Participants (friends who received invitation)
  participants: [],
  receivedVideos: [],
  
  // Processing state
  processingStatus: 'idle',
  processingProgress: 0,
  finalVideoUri: null,
  
  // UI state
  isSideMenuOpen: false,
  
  // Navigation actions
  navigateTo: (screen, params) => {
    const { currentScreen, screenHistory } = get();
    set({
      currentScreen: screen,
      navigationParams: params || null,
      screenHistory: [...screenHistory, currentScreen],
    });
  },
  
  goBack: () => {
    const { screenHistory } = get();
    if (screenHistory.length > 0) {
      const previousScreen = screenHistory[screenHistory.length - 1];
      const newHistory = screenHistory.slice(0, -1);
      set({
        currentScreen: previousScreen,
        navigationParams: null,
        screenHistory: newHistory,
      });
    }
  },
  
  // Story actions
  setStoryName: (name) => set({ storyName: name }),
  setKeyStoryUri: (uri) => set({ keyStoryUri: uri }),
  
  // Recording actions
  setLastRecording: (uri) => set({ lastRecordingUri: uri }),
  setCountdownEnabled: (enabled) => set({ isCountdownEnabled: enabled }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  
  // Music actions
  setSelectedMusic: (music) => set({ selectedMusic: music }),
  
  // Format & Style actions
  setVideoFormat: (format) => set({ videoFormat: format }),
  setBackgroundStyle: (style) => set({ backgroundStyle: style }),
  
  // Player instructions actions
  setPlayerInstructions: (instructions) => set({ 
    playerInstructions: { ...get().playerInstructions, ...instructions } 
  }),
  
  // Privacy actions
  setPrivacySettings: (settings) => set({ 
    privacySettings: { ...get().privacySettings, ...settings } 
  }),
  
  // Participants actions
  addParticipant: (participant) => set({ 
    participants: [...get().participants, participant] 
  }),
  removeParticipant: (id) => set({ 
    participants: get().participants.filter(p => p.id !== id) 
  }),
  
  // Received videos actions
  addReceivedVideo: (video) => set({ 
    receivedVideos: [...get().receivedVideos, video] 
  }),
  
  // Processing actions
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setProcessingProgress: (progress) => set({ processingProgress: progress }),
  setFinalVideoUri: (uri) => set({ finalVideoUri: uri }),
  
  // UI actions
  setSideMenuOpen: (open) => set({ isSideMenuOpen: open }),
  
  // Reset story (start fresh)
  resetStory: () => set({
    currentStoryId: null,
    storyName: '',
    keyStoryUri: null,
    lastRecordingUri: null,
    selectedMusic: null,
    videoFormat: null,
    backgroundStyle: null,
    playerInstructions: {
      generic: '',
      video1Time: 30,
      video2Time: 30,
      video3Time: 30,
    },
    privacySettings: {
      allowSocialMedia: false,
      privateOnly: true,
    },
    participants: [],
    receivedVideos: [],
    processingStatus: 'idle',
    processingProgress: 0,
    finalVideoUri: null,
    isUploading: false,
    uploadProgress: 0,
    firebaseError: null,
  }),
  
  // Firebase actions
  createStoryInFirebase: async () => {
    const state = get();
    try {
      set({ firebaseError: null });
      const storyId = await getFirebaseService().createStory({
        name: state.storyName,
        videoFormat: state.videoFormat,
        backgroundStyle: state.backgroundStyle,
        selectedMusic: state.selectedMusic,
        playerInstructions: state.playerInstructions,
        privacySettings: state.privacySettings,
      });
      set({ currentStoryId: storyId });
      return storyId;
    } catch (error) {
      console.error('Error creating story:', error);
      set({ firebaseError: error.message });
      throw error;
    }
  },
  
  uploadKeyStoryVideo: async (uri) => {
    const state = get();
    if (!state.currentStoryId) {
      throw new Error('No story created yet');
    }
    
    try {
      set({ isUploading: true, uploadProgress: 0, firebaseError: null });
      
      const result = await getFirebaseService().uploadVideo(
        uri,
        state.currentStoryId,
        'key_story',
        (progress) => set({ uploadProgress: progress })
      );
      
      await getFirebaseService().updateStory(state.currentStoryId, {
        keyStoryUrl: result.url,
        status: 'ready_for_invites',
      });
      
      set({ isUploading: false, uploadProgress: 100, keyStoryUri: result.url });
      return result;
    } catch (error) {
      console.error('Error uploading video:', error);
      set({ isUploading: false, firebaseError: error.message });
      throw error;
    }
  },
  
  sendInvitation: async (phoneNumber, participantName) => {
    const state = get();
    if (!state.currentStoryId) {
      throw new Error('No story created yet');
    }
    
    try {
      set({ firebaseError: null });
      const inviteId = await getFirebaseService().createInvitation(
        state.currentStoryId,
        phoneNumber,
        participantName
      );
      
      const inviteLink = getFirebaseService().generateInviteLink(inviteId);
      const whatsappMessage = getFirebaseService().generateWhatsAppMessage(
        state.storyName,
        inviteLink
      );
      
      set({
        participants: [...state.participants, {
          id: inviteId,
          name: participantName,
          phone: phoneNumber,
          status: 'pending',
        }],
      });
      
      return { inviteId, inviteLink, whatsappMessage };
    } catch (error) {
      console.error('Error sending invitation:', error);
      set({ firebaseError: error.message });
      throw error;
    }
  },
  
  loadStory: async (storyId) => {
    try {
      set({ firebaseError: null });
      const story = await getFirebaseService().getStory(storyId);
      if (story) {
        set({
          currentStoryId: story.id,
          storyName: story.name,
          keyStoryUri: story.keyStoryUrl,
          videoFormat: story.videoFormat,
          backgroundStyle: story.backgroundStyle,
          selectedMusic: story.selectedMusic,
          playerInstructions: story.playerInstructions,
          privacySettings: story.privacySettings,
        });
      }
      return story;
    } catch (error) {
      console.error('Error loading story:', error);
      set({ firebaseError: error.message });
      throw error;
    }
  },
  
  subscribeToStoryUpdates: (storyId) => {
    return getFirebaseService().subscribeToParticipantVideos(storyId, (videos) => {
      set({ receivedVideos: videos });
    });
  },
}));
