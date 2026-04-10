import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'backgrounds';

/**
 * Fetch all active background options for players to choose from.
 * Returns blur/gradient built-ins plus any video backgrounds stored in Firestore.
 */
export const backgroundsService = {
  async getActiveBackgrounds() {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('active', '==', true),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ firestoreId: d.id, ...d.data() }));
    } catch (err) {
      console.warn('⚠️ backgroundsService.getActiveBackgrounds failed:', err.message);
      return [];
    }
  },
};
