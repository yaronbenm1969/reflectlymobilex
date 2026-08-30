import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../state/appState';
import { useNav } from '../hooks/useNav';

// Haptics fallback
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (error) {
  Haptics = {
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    NotificationFeedbackType: { Success: 'success' },
  };
}

const GOLD       = 'rgba(200,155,70,0.90)';
const GOLD_DIM   = 'rgba(200,155,70,0.40)';
const GOLD_BG    = 'rgba(200,155,70,0.10)';
const TEAL       = '#5ab4cc';
const DARK_BG    = '#0d0e14';
const HEADER_BG  = 'rgba(22,24,34,1.0)';
const ITEM_BG    = 'rgba(255,255,255,0.05)';
const TEXT_WHITE = 'rgba(255,255,255,0.92)';
const TEXT_DIM   = 'rgba(255,255,255,0.38)';
const DIVIDER    = 'rgba(255,255,255,0.07)';

export const SideMenu = ({ isOpen, onClose }) => {
  const { go } = useNav();
  const { t } = useTranslation();
  const setSideMenuOpen = useAppState((state) => state.setSideMenuOpen);

  const handleClose = async () => {
    try { await Haptics.selectionAsync(); } catch (e) {}
    setSideMenuOpen(false);
    onClose();
  };

  const handleMenuItemPress = async (item) => {
    try { await Haptics.selectionAsync(); } catch (e) {}
    handleClose();
    setTimeout(() => item.action(), 100);
  };

  const sections = [
    {
      key: 'main',
      label: t('sideMenu.section_main'),
      items: [
        { id: 'new-story',  icon: 'videocam-outline',          color: TEAL,  title: t('sideMenu.new_story'),       action: () => go('Record') },
        { id: 'my-stories', icon: 'library-outline',           color: TEAL,  title: t('sideMenu.my_stories'),      action: () => go('MyStories') },
        { id: 'community',  icon: 'people-outline',            color: TEAL,  title: t('sideMenu.community'),       action: () => go('CommunityFeed') },
      ],
    },
    {
      key: 'settings',
      label: t('sideMenu.section_settings'),
      items: [
        { id: 'music',  icon: 'musical-notes-outline', color: GOLD, title: t('sideMenu.music'),           action: () => go('MusicSelection') },
        { id: 'camera', icon: 'camera-outline',        color: GOLD, title: t('sideMenu.camera_settings'), action: () => go('CameraSettings') },
      ],
    },
    {
      key: 'support',
      label: t('sideMenu.section_support'),
      items: [
        { id: 'about', icon: 'information-circle-outline', color: TEXT_DIM, title: t('sideMenu.about'), action: () => go('About') },
        { id: 'help',  icon: 'help-circle-outline',        color: TEXT_DIM, title: t('sideMenu.help'),  action: () => go('Help') },
      ],
    },
  ];

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.menuContainer}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/rilio-logo-primary.png.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
              <Ionicons name="close" size={22} color={GOLD} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerDivider} />

          {/* ── Sections ── */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, si) => (
              <View key={section.key} style={si > 0 ? styles.sectionMargin : undefined}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.menuItem}
                    onPress={() => handleMenuItemPress(item)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.iconCircle, { borderColor: item.color + '55' }]}>
                      <Ionicons name={item.icon} size={18} color={item.color} />
                    </View>
                    <Text style={styles.itemText}>{item.title}</Text>
                    <Ionicons name="chevron-forward" size={14} color={TEXT_DIM} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  menuContainer: {
    width: '78%',
    maxWidth: 310,
    backgroundColor: DARK_BG,
    borderLeftWidth: 1,
    borderLeftColor: DIVIDER,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HEADER_BG,
    paddingHorizontal: 18,
    paddingVertical: 14,
    paddingTop: 52,
  },
  logo: {
    width: 88,
    height: 22,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD_BG,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: DIVIDER,
  },

  /* ── Scroll ── */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 22 },

  /* ── Section ── */
  sectionMargin: { marginTop: 22 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: GOLD_DIM,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  /* ── Item ── */
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ITEM_BG,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_WHITE,
  },

  bottomSpacer: { height: 40 },
});
