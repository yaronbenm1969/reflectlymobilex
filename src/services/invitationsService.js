import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import Constants from 'expo-constants';

const INVITATIONS_COLLECTION = 'invitations';
const CONSENT_VERSION = '1.0';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.videoConverterUrl ||
  'https://reflectlymobilex.onrender.com';

export const invitationsService = {
  /**
   * Create a new invitation (called from WhatsAppShareScreen).
   * Returns { invitationId, token, inviteUrl }
   */
  createInvitation: async (storyId, participantName, participantPhone = null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/invitations/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, participantName, participantPhone }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ createInvitation error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Resolve an invitation token → storyId + participantName + storyData.
   * Called from App.js when /invite/:token deep link is opened.
   */
  resolveToken: async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/invitations/resolve/${token}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ resolveToken error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Save consent for a specific invitation.
   * Called from PlayerRecordScreen after player agrees.
   */
  saveConsent: async (invitationId, {
    platformConsent,
    projectConsent,
    publicPublishingConsent = null,
    communityConsent = null,
  }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformConsent,
          projectConsent,
          publicPublishingConsent,
          communityConsent,
          consentVersion: CONSENT_VERSION,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return { success: true };
    } catch (error) {
      console.error('❌ saveConsent error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Mark invitation as declined + notify creator.
   * Called from PlayerRecordScreen when player taps "can't participate".
   */
  declineInvitation: async (invitationId, reason = 'publishing_conflict') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return { success: true };
    } catch (error) {
      console.error('❌ declineInvitation error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all invitations for a story (for creator dashboard).
   */
  getStoryInvitations: async (storyId) => {
    try {
      const q = query(
        collection(db, INVITATIONS_COLLECTION),
        where('storyId', '==', storyId)
      );
      const snap = await getDocs(q);
      return {
        success: true,
        invitations: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      };
    } catch (error) {
      console.error('❌ getStoryInvitations error:', error.message);
      return { success: false, error: error.message };
    }
  },

  CONSENT_VERSION,
};

export default invitationsService;
