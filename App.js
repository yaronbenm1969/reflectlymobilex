import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Linking, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Quicksand_400Regular } from '@expo-google-fonts/quicksand/400Regular';
import { Quicksand_500Medium } from '@expo-google-fonts/quicksand/500Medium';
import { Quicksand_600SemiBold } from '@expo-google-fonts/quicksand/600SemiBold';
import { Quicksand_700Bold } from '@expo-google-fonts/quicksand/700Bold';
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
  ThankYouScreen,
  WatchExperienceScreen
} from './src/screens';
import { SideMenu } from './src/components/SideMenu';
import { AccessGate } from './src/components/AccessGate';
import { useAppState } from './src/state/appState';
import { authService } from './src/services/authService';
import { storiesService } from './src/services/storiesService';

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  console.log('🚀 Reflectly Mobile App Starting...');
  console.log('✅ Hamburger ready');
  
  const currentScreen = useAppState((state) => state.currentScreen);
  const navigationParams = useAppState((state) => state.navigationParams);
  const isSideMenuOpen = useAppState((state) => state.isSideMenuOpen);
  const setSideMenuOpen = useAppState((state) => state.setSideMenuOpen);
  const setUser = useAppState((state) => state.setUser);
  const navigateTo = useAppState((state) => state.navigateTo);
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);
  const setVideoFormat = useAppState((state) => state.setVideoFormat);
  const setReflections = useAppState((state) => state.setReflections);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);
  const setStoryName = useAppState((state) => state.setStoryName);

  // DEV: jump straight to FinalVideoScreen with 3 players × 3 clips (cube-3d)
  const devTestFactory = () => {
    const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    const mockReflections = [
      ...['אבא','אמא','ילד'].flatMap((name, pi) =>
        [1,2,3].map(ci => ({
          id: `p${pi}c${ci}`, videoUrl: SAMPLE,
          playerName: name, participantName: name, clipNumber: ci,
        }))
      ),
    ];
    setStoryName('סרטון בדיקה - 3 שחקנים');
    setCurrentStoryId('dev-test-story');
    setReflections(mockReflections);
    setVideoFormat('cube-3d');
    navigateTo('FinalVideo');
  };

  // Handle deep links for player mode
  const handleDeepLink = (url) => {
    if (!url) return;
    console.log('🔗 Deep link received:', url);
    
    // Parse the URL to extract storyId
    // Expected formats: 
    // - reflectly://story/STORY_ID
    // - reflectly://s/STORY_ID
    // - reflectly://play/STORY_ID
    // - https://reflectly.app/s/STORY_ID
    // - https://reflectly.app/story/STORY_ID
    // - exp://...--s/STORY_ID
    try {
      // Extract storyId from various URL formats
      let storyId = null;
      
      // Check for /s/STORY_ID pattern (primary format from WhatsApp)
      const sMatch = url.match(/\/s\/([^/?#]+)/);
      if (sMatch) {
        storyId = decodeURIComponent(sMatch[1]);
      }
      
      // Check for /story/STORY_ID pattern
      const storyMatch = url.match(/\/story\/([^/?#]+)/);
      if (!storyId && storyMatch) {
        storyId = decodeURIComponent(storyMatch[1]);
      }
      
      // Check for /play/STORY_ID pattern (legacy)
      const playMatch = url.match(/\/play\/([^/?#]+)/);
      if (!storyId && playMatch) {
        storyId = decodeURIComponent(playMatch[1]);
      }
      
      // Check for --s/STORY_ID pattern (Expo URL)
      const expoSMatch = url.match(/--s\/([^/?#]+)/);
      if (!storyId && expoSMatch) {
        storyId = decodeURIComponent(expoSMatch[1]);
      }
      
      // Check for --play/STORY_ID pattern (Expo URL legacy)
      const expoMatch = url.match(/--play\/([^/?#]+)/);
      if (!storyId && expoMatch) {
        storyId = decodeURIComponent(expoMatch[1]);
      }
      
      // Check for storyId query param
      const queryMatch = url.match(/[?&]storyId=([^&#]+)/);
      if (!storyId && queryMatch) {
        storyId = decodeURIComponent(queryMatch[1]);
      }
      
      // Check for reflectly://STORY_ID (direct scheme)
      if (!storyId && url.startsWith('reflectly://')) {
        const schemeMatch = url.match(/reflectly:\/\/([^/?#]+)/);
        if (schemeMatch && !['s', 'story', 'play', 'home'].includes(schemeMatch[1])) {
          storyId = decodeURIComponent(schemeMatch[1]);
        }
      }
      
      if (storyId) {
        console.log('🎬 Entering player mode for story:', storyId);
        enterPlayerMode(storyId, null); // navigate immediately
        // Fetch story data in background so PlayerRecordScreen gets clipCount etc.
        storiesService.getStory(storyId).then(res => {
          if (res.success && res.story) {
            useAppState.getState().setPlayerStoryData(res.story);
            console.log('📖 Player story data loaded:', res.story.name, 'clips:', res.story.clipCount);
          }
        }).catch(() => {});
      } else {
        console.log('⚠️ No storyId found in URL');
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
      case 'WatchExperience':
        return <WatchExperienceScreen />;
      default:
        return <HomeScreen />;
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8446b0" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AccessGate>
          <View style={styles.container}>
            <StatusBar style="auto" backgroundColor="#F5F0FA" />
            {renderScreen()}
            
            <SideMenu
              isOpen={isSideMenuOpen}
              onClose={() => setSideMenuOpen(false)}
            />

            {/* DEV-only: quick jump to factory animation test */}
            {__DEV__ && (
              <TouchableOpacity
                onPress={devTestFactory}
                style={{
                  position: 'absolute', bottom: 90, left: 12,
                  backgroundColor: '#ff4081', borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 6, zIndex: 9999,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🏭 DEV</Text>
              </TouchableOpacity>
            )}
          </View>
        </AccessGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F0FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F0FA',
  },
});
