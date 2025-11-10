import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { 
  HomeScreen, 
  RecordScreen, 
  ReviewScreen, 
  MyStoriesScreen, 
  SettingsScreen,
  MusicSelectionScreen,
  CameraSettingsScreen,
  AboutScreen,
  HelpScreen,
  TermsScreen 
} from './src/screens';
import { SideMenu } from './src/components/SideMenu';
import { useAppState } from './src/state/appState';

export default function App() {
  console.log('🚀 Reflectly Mobile App Starting...');
  console.log('✅ Hamburger ready');
  
  const currentScreen = useAppState((state) => state.currentScreen);
  const navigationParams = useAppState((state) => state.navigationParams);
  const isSideMenuOpen = useAppState((state) => state.isSideMenuOpen);
  const setSideMenuOpen = useAppState((state) => state.setSideMenuOpen);

  const renderScreen = () => {
    switch (currentScreen) {
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
      default:
        return <HomeScreen />;
    }
  };

  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEFF4',
  },
});