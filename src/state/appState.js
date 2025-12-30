import { create } from 'zustand';

export const useAppState = create((set, get) => ({
  // Initial state
  currentScreen: 'Splash',
  navigationParams: null,
  screenHistory: [],
  
  // User state (Firebase Auth)
  user: null,
  isAuthenticated: false,
  
  // Story state
  storyName: '',
  currentStoryId: null,
  currentInviteCode: null,
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
  
  // Player mode (when accessed via shared link)
  isPlayerMode: false,
  playerStoryId: null,
  
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
  
  // User actions
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user 
  }),
  
  logout: () => set({ 
    user: null, 
    isAuthenticated: false 
  }),
  
  // Story ID for Firestore
  setCurrentStoryId: (id) => set({ currentStoryId: id }),
  setCurrentInviteCode: (code) => set({ currentInviteCode: code }),
  
  // Player mode actions
  enterPlayerMode: (storyId) => set({ 
    isPlayerMode: true, 
    playerStoryId: storyId,
    currentScreen: 'PlayerView',
    screenHistory: [],
  }),
  exitPlayerMode: () => set({ 
    isPlayerMode: false, 
    playerStoryId: null 
  }),
  
  // UI actions
  setSideMenuOpen: (open) => set({ isSideMenuOpen: open }),
  
  // Reset story (start fresh)
  resetStory: () => set({
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
  }),
}));
