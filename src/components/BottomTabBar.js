import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../state/appState';
import { useNav } from '../hooks/useNav';

// Screens on which the tab bar is visible
const TAB_SCREENS = ['Home', 'CommunityFeed', 'MyStories'];

export const BottomTabBar = () => {
  const { t } = useTranslation();
  const currentScreen = useAppState((state) => state.currentScreen);
  const storyCreationMode = useAppState((state) => state.storyCreationMode);
  const setStoryCreationMode = useAppState((state) => state.setStoryCreationMode);
  const { go } = useNav();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // null currentScreen renders HomeScreen (default case in App.js switch)
  const screen = currentScreen || 'Home';

  if (!TAB_SCREENS.includes(screen) || keyboardVisible) return null;

  const activeTab = screen === 'MyStories' ? 'projects'
    : (screen === 'Home' || screen === null) && storyCreationMode === 'community' ? 'community'
    : null;

  const handleCommunityTab = () => {
    setStoryCreationMode('community');
    go('Home');
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <TouchableOpacity
        style={styles.tab}
        onPress={handleCommunityTab}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === 'community' ? 'people' : 'people-outline'}
          size={36}
          color={activeTab === 'community' ? '#ff6600' : 'rgba(255,102,0,0.6)'}
        />
        <Text style={[styles.label, activeTab === 'community' && styles.labelActive]}>
          {t('bottomTab.community')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => go('MyStories')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === 'projects' ? 'folder' : 'folder-outline'}
          size={36}
          color={activeTab === 'projects' ? '#ff6600' : 'rgba(255,102,0,0.6)'}
        />
        <Text style={[styles.label, activeTab === 'projects' && styles.labelActive]}>
          {t('bottomTab.projects')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingBottom: 2,
  },
  label: {
    fontSize: 16,
    color: 'rgba(255,102,0,0.6)',
    fontWeight: '500',
  },
  labelActive: {
    color: '#ff6600',
    fontWeight: '600',
  },
});
