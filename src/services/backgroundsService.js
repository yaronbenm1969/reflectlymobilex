import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'backgrounds';

/**
 * Fetch all active background options for players to choose from.
 * Filters active=true client-side to avoid requiring a composite Firestore index.
 */
export const backgroundsService = {
  async getActiveBackgrounds() {
    try {
      const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((d) => ({ firestoreId: d.id, ...d.data() }))
        .filter((d) => d.active !== false);
    } catch (err) {
      console.warn('⚠️ backgroundsService.getActiveBackgrounds failed:', err.message);
      return [];
    }
  },
};
