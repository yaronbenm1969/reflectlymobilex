import { useAppState } from '../state/appState';

// Haptics fallback
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (error) {
  console.warn('Expo Haptics not available, using fallback');
  Haptics = {
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    NotificationFeedbackType: { Success: 'success' },
  };
}

export const useNav = () => {
  const navigateTo = useAppState((state) => state.navigateTo);
  const goBack = useAppState((state) => state.goBack);
  
  const go = async (screenName, params) => {
    console.log(`🧭 useNav.go called: ${screenName}`, params);
    try {
      await Haptics.selectionAsync();
    } catch (e) {}
    console.log(`🧭 Calling navigateTo: ${screenName}`);
    navigateTo(screenName, params);
    console.log(`🧭 navigateTo completed`);
  };
  
  const back = async () => {
    console.log('🧭 useNav.back called');
    try {
      await Haptics.selectionAsync();
    } catch (e) {}
    goBack();
  };
  
  return { go, back };
};