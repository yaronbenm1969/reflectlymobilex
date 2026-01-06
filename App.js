import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { 
  AuthScreen,
  SplashScreen,
  HomeScreen, 
  RecordScreen, 
  ReviewScreen, 
  MusicSelectionScreen,
  FormatSelectionScreen,
  InstructionsScreen,
  WhatsAppShareScreen,
  ProcessingScreen,
  EditRoomScreen,
  FinalVideoScreen,
  PlayerViewScreen,
  PlayerRecordScreen,
  MyStoriesScreen, 
  SettingsScreen,
  CameraSettingsScreen,
  AboutScreen,
  HelpScreen,
  TermsScreen,
  ThankYouScreen 
} from './src/screens';
import { SideMenu } from './src/components/SideMenu';
import { useAppState } from './src/state/appState';
import { authService } from './src/services/authService';

export default function App() {
  console.log('🚀 Reflectly Mobile App Starting...');
  console.log('✅ Hamburger ready');
  
  const currentScreen = useAppState((state) => state.currentScreen);
  const navigationParams = useAppState((state) => state.navigationParams);
  const isSideMenuOpen = useAppState((state) => state.isSideMenuOpen);
  const setSideMenuOpen = useAppState((state) => state.setSideMenuOpen);
  const setUser = useAppState((state) => state.setUser);
  const navigateTo = useAppState((state) => state.navigateTo);
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);

  // Handle deep links for player mode
  const handleDeepLink = (url) => {
    if (!url) return;
    console.log('🔗 Deep link received:', url);
    
    // Parse the URL to extract storyId
    // Expected formats: 
    // - reflectly://play/STORY_ID
    // - https://reflectly.app/play/STORY_ID
    // - exp://...--play/STORY_ID
    try {
      // Extract storyId from various URL formats
      let storyId = null;
      
      // Check for /play/STORY_ID pattern
      const playMatch = url.match(/\/play\/([^/?]+)/);
      if (playMatch) {
        storyId = playMatch[1];
      }
      
      // Check for --play/STORY_ID pattern (Expo URL)
      const expoMatch = url.match(/--play\/([^/?]+)/);
      if (!storyId && expoMatch) {
        storyId = expoMatch[1];
      }
      
      // Check for storyId query param
      const queryMatch = url.match(/[?&]storyId=([^&]+)/);
      if (!storyId && queryMatch) {
        storyId = queryMatch[1];
      }
      
      if (storyId) {
        console.log('🎬 Entering player mode for story:', storyId);
        enterPlayerMode(storyId);
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  };

  useEffect(() => {
    // Auth state listener - creators must register/login
    const unsubscribe = authService.onAuthChange((user) => {
      if (user) {
        console.log('🔐 User logged in:', user.email || user.uid);
        setUser(user);
      } else {
        console.log('🔐 No user session - will redirect to Auth');
        setUser(null);
      }
    });

    // Check for initial deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for deep links while app is open
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      unsubscribe();
      linkingSubscription?.remove();
    };
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Splash':
        return <SplashScreen />;
      case 'Auth':
        return <AuthScreen />;
      case 'Record':
        return <RecordScreen />;
      case 'Review':
        return (
          <ReviewScreen 
            route={{ params: navigationParams || {} }} 
          />
        );
      case 'MusicSelection':
        return (
          <MusicSelectionScreen 
            route={{ params: navigationParams || {} }} 
          />
        );
      case 'FormatSelection':
        return (
          <FormatSelectionScreen 
            route={{ params: navigationParams || {} }} 
          />
        );
      case 'Instructions':
        return <InstructionsScreen />;
      case 'WhatsAppShare':
        return <WhatsAppShareScreen />;
      case 'Processing':
        return <ProcessingScreen />;
      case 'EditRoom':
        return <EditRoomScreen />;
      case 'FinalVideo':
        return <FinalVideoScreen />;
      case 'PlayerView':
        return <PlayerViewScreen />;
      case 'PlayerRecord':
        return <PlayerRecordScreen />;
      case 'MyStories':
        return <MyStoriesScreen />;
      case 'Settings':
        return <SettingsScreen />;
      case 'CameraSettings':
        return <CameraSettingsScreen />;
      case 'About':
        return <AboutScreen />;
      case 'Help':
        return <HelpScreen />;
      case 'Terms':
        return <TermsScreen />;
      case 'ThankYou':
        return <ThankYouScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <StatusBar style="auto" backgroundColor="#FFEFF4" />
          {renderScreen()}
          
          <SideMenu 
            isOpen={isSideMenuOpen}
            onClose={() => setSideMenuOpen(false)}
          />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEFF4',
  },
});
