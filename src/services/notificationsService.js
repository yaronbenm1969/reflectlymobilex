import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const notificationsService = {
  async registerForPushNotifications() {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('📵 Push notifications permission denied');
        return null;
      }
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      console.log('🔔 Push token:', token.substring(0, 30) + '...');
      return token;
    } catch (e) {
      console.warn('⚠️ Push token registration failed:', e.message);
      return null;
    }
  },

  addNotificationListener(handler) {
    return Notifications.addNotificationResponseReceivedListener(handler);
  },
};

export { notificationsService };
