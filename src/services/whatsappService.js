import { Linking } from 'react-native';
import { formatMessage, generateStoryLink, getWhatsAppShareUrl } from './whatsappConfig';

export async function shareStoryForReflection(storyData, baseUrl) {
  const { title, storyId, duration } = storyData;
  const storyLink = generateStoryLink(storyId, title, baseUrl);

  const variables = {
    title: title || 'My Story',
    link: storyLink,
    direction: storyData.direction ? `Direction: ${storyData.direction}\n\n` : '',
    duration: (duration || 30).toString()
  };

  const message = formatMessage('storyShare', variables);
  const whatsappUrl = getWhatsAppShareUrl(message);

  try {
    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return {
        success: true,
        storyId,
        link: storyLink,
        message,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log('WhatsApp not available, trying web version');
      const webWhatsAppUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      await Linking.openURL(webWhatsAppUrl);
      return {
        success: true,
        storyId,
        link: storyLink,
        message,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Failed to open WhatsApp:', error);
    return {
      success: false,
      storyId,
      link: storyLink,
      message,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export async function shareCollaborativeInvite(storyData, baseUrl) {
  const { title, storyId, duration, direction } = storyData;
  const storyLink = generateStoryLink(storyId, title, baseUrl);

  const variables = {
    title: title || 'Collaborative Story',
    link: storyLink,
    direction: direction ? `Direction: ${direction}\n\n` : '',
    duration: (duration || 30).toString()
  };

  const message = formatMessage('collaborativeInvite', variables);
  const whatsappUrl = getWhatsAppShareUrl(message);

  try {
    await Linking.openURL(whatsappUrl);
    return {
      success: true,
      storyId,
      link: storyLink,
      message,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to share collaborative invite:', error);
    return {
      success: false,
      storyId,
      link: storyLink,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export async function shareReflectionInvite(title, storyId, baseUrl) {
  const storyLink = generateStoryLink(storyId, title, baseUrl);

  const variables = {
    title: title || 'My Story',
    link: storyLink
  };

  const message = formatMessage('reflectionInvite', variables);
  const whatsappUrl = getWhatsAppShareUrl(message);

  try {
    await Linking.openURL(whatsappUrl);
    return {
      success: true,
      storyId,
      link: storyLink,
      message,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to share reflection invite:', error);
    return {
      success: false,
      storyId,
      link: storyLink,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export function getAvailableTemplates() {
  return [
    { key: 'storyShare', title: 'Story Invitation', description: 'Simple invitation to reflect on your story' },
    { key: 'reflectionInvite', title: 'Reflect a Story', description: 'Personalized invitation with story title' },
    { key: 'collaborativeInvite', title: 'Collaborative Story', description: 'Full details with duration and direction' }
  ];
}
