import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppState } from '../state/appState';
import { useNav } from '../hooks/useNav';
import theme from '../theme/theme';

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

export const SideMenu = ({ isOpen, onClose }) => {
  const { go } = useNav();
  const setSideMenuOpen = useAppState((state) => state.setSideMenuOpen);

  const handleClose = async () => {
    try {
      await Haptics.selectionAsync();
    } catch (e) {}
    setSideMenuOpen(false);
    onClose();
  };

  const menuItems = [
    {
      id: 'new-story',
      icon: 'videocam',
      title: 'Start a New Story',
      action: () => go('Record'),
    },
    {
      id: 'my-stories',
      icon: 'library',
      title: 'My Stories',
      action: () => go('MyStories'),
    },
    {
      id: 'music',
      icon: 'musical-notes',
      title: 'Music & Sound',
      action: () => go('MusicSelection'),
    },
    {
      id: 'camera',
      icon: 'camera',
      title: 'Camera Settings',
      action: () => go('CameraSettings'),
    },
    {
      id: 'about',
      icon: 'information-circle',
      title: 'About',
      action: () => go('About'),
    },
    {
      id: 'help',
      icon: 'help-circle',
      title: 'Help / FAQ',
      action: () => go('Help'),
    },
  ];

  const handleMenuItemPress = async (item) => {
    try {
      await Haptics.selectionAsync();
    } catch (e) {}
    handleClose();
    setTimeout(() => item.action(), 100);
  };

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
          <LinearGradient
            colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Reflectly</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          <ScrollView style={styles.menuContent}>
            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Main Actions</Text>
              {menuItems.slice(0, 2).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => handleMenuItemPress(item)}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.menuItemText}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Settings</Text>
              {menuItems.slice(2, 4).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => handleMenuItemPress(item)}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.menuItemText}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Support</Text>
              {menuItems.slice(4).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => handleMenuItemPress(item)}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.menuItemText}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
                </TouchableOpacity>
              ))}
            </View>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuContainer: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: theme.colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    paddingBottom: theme.spacing[4],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.white,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    paddingHorizontal: theme.spacing[4],
  },
  menuSection: {
    marginVertical: theme.spacing[4],
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing[3],
    marginLeft: theme.spacing[2],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing[1],
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[3],
  },
  menuItemText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
});