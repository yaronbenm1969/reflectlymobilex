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
  storyClipCount: 3,
  storyMaxClipDuration: 60,
  
  // Recording settings
  isCountdownEnabled: true,
  recordingDuration: 0,
  
  // Format & Music
  selectedMusic: null,
  videoFormat: null,
  backgroundStyle: null,
  backgroundVideoUrl: null,    // URL of selected background video/image
  backgroundMediaType: null,   // 'video' | 'image' | null
  clipMusicMode: 'none', // 'headphones' | 'none' | 'performance'
  generatedMusicUrl: null,
  
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
    publishingEnabled: true,
  },
  
  // Participants (friends who received invitation)
  participants: [],
  receivedVideos: [],
  
  // Reflections from players (loaded from Firebase)
  reflections: [],
  reflectionsLoading: false,
  reflectionsError: null,
  clipRenderOrder: [],
  
  // Processing state
  processingStatus: 'idle',
  processingProgress: 0,
  finalVideoUri: null,
  
  // Player mode (when accessed via shared link)
  isPlayerMode: false,
  playerStoryId: null,
  playerStoryData: null,
  
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
  setStoryClipCount: (n) => set({ storyClipCount: n }),
  setStoryMaxClipDuration: (n) => set({ storyMaxClipDuration: n }),
  
  // Recording actions
  setLastRecording: (uri) => set({ lastRecordingUri: uri }),
  setCountdownEnabled: (enabled) => set({ isCountdownEnabled: enabled }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  
  // Music actions
  setSelectedMusic: (music) => set({ selectedMusic: music }),
  
  // Format & Style actions
  setVideoFormat: (format) => set({ videoFormat: format }),
  setBackgroundStyle: (style) => set({ backgroundStyle: style }),
  setBackgroundVideoUrl: (url) => set({ backgroundVideoUrl: url }),
  setBackgroundMediaType: (type) => set({ backgroundMediaType: type }),
  setClipMusicMode: (mode) => set({ clipMusicMode: mode }),
  setGeneratedMusicUrl: (url) => set({ generatedMusicUrl: url }),
  
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
  
  // Reflections actions
  setReflections: (reflections) => set({ reflections }),
  setReflectionsLoading: (loading) => set({ reflectionsLoading: loading }),
  setReflectionsError: (error) => set({ reflectionsError: error }),
  setClipRenderOrder: (order) => set({ clipRenderOrder: order }),
  
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
  enterPlayerMode: (storyId, storyData = null) => set({
    isPlayerMode: true,
    playerStoryId: storyId,
    playerStoryData: storyData,
    currentScreen: 'PlayerView',
    screenHistory: [],
  }),
  setPlayerStoryData: (data) => set({ playerStoryData: data }),
  exitPlayerMode: () => set({
    isPlayerMode: false,
    playerStoryId: null,
    playerStoryData: null
  }),
  
  // UI actions
  setSideMenuOpen: (open) => set({ isSideMenuOpen: open }),
  
  // Reset story (start fresh)
  resetStory: () => set({
    storyName: '',
    keyStoryUri: null,
    lastRecordingUri: null,
    storyClipCount: 3,
    storyMaxClipDuration: 60,
    selectedMusic: null,
    videoFormat: null,
    backgroundStyle: null,
    backgroundVideoUrl: null,
    backgroundMediaType: null,
    playerInstructions: {
      generic: '',
      video1Time: 30,
      video2Time: 30,
      video3Time: 30,
    },
    privacySettings: {
      allowSocialMedia: false,
      privateOnly: true,
      publishingEnabled: true,
    },
    participants: [],
    receivedVideos: [],
    clipRenderOrder: [],
    processingStatus: 'idle',
    processingProgress: 0,
    finalVideoUri: null,
    generatedMusicUrl: null,
    clipMusicMode: 'none',
  }),
}));
