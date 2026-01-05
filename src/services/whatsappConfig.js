export const whatsappConfig = {
  baseUrl: "https://wa.me/",
  businessApiUrl: undefined,
  templates: {
    reflectionInvite: {
      title: "Reflect a Story",
      message: "Hi! I'd love for you to reflect my story titled: {title}\nClick the button below to get started\n{link}",
      linkPrefix: "/participate/",
      variables: ["title", "link"]
    },
    storyShare: {
      title: "Story Invitation",
      message: "Hi! I'd love for you to reflect my story by recording 3 short creative clips.\nJust click the button below to begin\n{link}",
      linkPrefix: "/participate/",
      variables: ["link"]
    },
    collaborativeInvite: {
      title: "Collaborative Story",
      message: "*{title}*\n\nYou're invited to participate in a collaborative story!\n\n{direction}Record 3 clips of {duration} seconds each\n\nClick to participate: {link}",
      linkPrefix: "/participate/",
      variables: ["title", "direction", "duration", "link"]
    }
  }
};

export function formatMessage(templateKey, variables) {
  const template = whatsappConfig.templates[templateKey];
  if (!template) {
    throw new Error(`WhatsApp template "${templateKey}" not found`);
  }

  let message = template.message;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return message;
}

export function generateStoryLink(storyId, title, baseUrl) {
  if (!baseUrl) {
    console.warn('No baseUrl provided for story link');
    return '';
  }

  const encodedTitle = title ? encodeURIComponent(title) : '';
  const titleParam = encodedTitle ? `&title=${encodedTitle}` : '';
  return `${baseUrl}/s/${storyId}${titleParam ? '?' + titleParam.substring(1) : ''}`;
}

export function getWhatsAppShareUrl(message) {
  const encodedMessage = encodeURIComponent(message);
  return `${whatsappConfig.baseUrl}?text=${encodedMessage}`;
}
