import { create } from 'zustand';

export const useAppState = create((set, get) => ({
  // Initial state
  currentScreen: 'Home',
  navigationParams: null,
  screenHistory: [],
  lastRecordingUri: null,
  isCountdownEnabled: true,
  recordingDuration: 0,
  selectedMusic: null,
  videoFormat: null,
  backgroundStyle: null,
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
  
  // Recording actions
  setLastRecording: (uri) => set({ lastRecordingUri: uri }),
  setCountdownEnabled: (enabled) => set({ isCountdownEnabled: enabled }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  
  // Music actions
  setSelectedMusic: (music) => set({ selectedMusic: music }),
  
  // Format & Style actions
  setVideoFormat: (format) => set({ videoFormat: format }),
  setBackgroundStyle: (style) => set({ backgroundStyle: style }),
  
  // UI actions
  setSideMenuOpen: (open) => set({ isSideMenuOpen: open }),
}));