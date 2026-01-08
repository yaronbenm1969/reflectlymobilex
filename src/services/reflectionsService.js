import { 
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

const REFLECTIONS_COLLECTION = 'reflections';

export const reflectionsService = {
  getReflectionsForStory: async (storyId) => {
    try {
      console.log('📥 Fetching reflections for story:', storyId);
      
      const q = query(
        collection(db, REFLECTIONS_COLLECTION),
        where('storyId', '==', storyId),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const reflections = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      
      console.log(`✅ Found ${reflections.length} reflections`);
      return { success: true, reflections };
    } catch (error) {
      console.error('❌ Get reflections error:', error.message);
      return { success: false, error: error.message, reflections: [] };
    }
  },

  subscribeToReflections: (storyId, callback) => {
    console.log('🔔 Subscribing to reflections for story:', storyId);
    
    const q = query(
      collection(db, REFLECTIONS_COLLECTION),
      where('storyId', '==', storyId),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reflections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      
      console.log(`📬 Reflections update: ${reflections.length} items`);
      callback(reflections);
    }, (error) => {
      console.error('❌ Reflections subscription error:', error);
      callback([]);
    });
    
    return unsubscribe;
  },

  groupReflectionsByParticipant: (reflections) => {
    const grouped = {};
    
    reflections.forEach(reflection => {
      const participantId = reflection.recipientId || reflection.participantId || 'anonymous';
      const participantName = reflection.participantName || reflection.recipientName || `משתתף ${Object.keys(grouped).length + 1}`;
      
      if (!grouped[participantId]) {
        grouped[participantId] = {
          id: participantId,
          name: participantName,
          clips: [],
          totalClips: 0,
          status: 'pending'
        };
      }
      
      grouped[participantId].clips.push({
        clipNumber: reflection.clipNumber,
        videoUrl: reflection.videoUrl,
        createdAt: reflection.createdAt,
        status: reflection.status || 'received'
      });
      
      grouped[participantId].totalClips = grouped[participantId].clips.length;
      
      if (grouped[participantId].clips.length === 3) {
        grouped[participantId].status = 'complete';
      } else if (grouped[participantId].clips.length > 0) {
        grouped[participantId].status = 'partial';
      }
    });
    
    return Object.values(grouped);
  },

  getReflectionStats: (reflections) => {
    const participants = reflectionsService.groupReflectionsByParticipant(reflections);
    const totalClips = reflections.length;
    const completeParticipants = participants.filter(p => p.status === 'complete').length;
    const totalParticipants = participants.length;
    
    return {
      totalClips,
      totalParticipants,
      completeParticipants,
      participants
    };
  }
};

export default reflectionsService;
