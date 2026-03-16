import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

const REFLECTIONS_COLLECTION = 'reflections';

export const reflectionsService = {
  saveReflection: async (storyId, clipNumber, videoUrl, participantId, participantName) => {
    try {
      const docRef = await addDoc(collection(db, REFLECTIONS_COLLECTION), {
        storyId,
        clipNumber,
        videoUrl,
        convertedUrl: null,
        conversionStatus: 'pending',
        participantId,
        participantName: participantName || `משתתף`,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      console.log(`✅ Reflection saved to Firestore: ${docRef.id}`);
      return { success: true, docId: docRef.id };
    } catch (error) {
      console.error('❌ Save reflection error:', error.message);
      return { success: false, error: error.message };
    }
  },

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
    
    const sortedReflections = [...reflections].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    
    let anonymousCounter = 0;
    const timeGroups = {};
    
    sortedReflections.forEach(reflection => {
      let participantId = reflection.recipientId || reflection.participantId;
      let participantName = reflection.participantName || reflection.recipientName;
      
      if (!participantId) {
        const createdTime = reflection.createdAt ? new Date(reflection.createdAt).getTime() : 0;
        const clipNum = reflection.clipNumber || 0;
        
        let foundGroup = null;
        for (const [groupId, groupData] of Object.entries(timeGroups)) {
          const timeDiff = Math.abs(createdTime - groupData.lastTime);
          const hasClipNum = groupData.clipNumbers.includes(clipNum);
          
          if (timeDiff < 5 * 60 * 1000 && !hasClipNum) {
            foundGroup = groupId;
            groupData.lastTime = createdTime;
            groupData.clipNumbers.push(clipNum);
            break;
          }
        }
        
        if (foundGroup) {
          participantId = foundGroup;
          participantName = grouped[foundGroup]?.name;
        } else {
          anonymousCounter++;
          participantId = `anon_${anonymousCounter}_${createdTime}`;
          participantName = `משתתף ${anonymousCounter}`;
          timeGroups[participantId] = { lastTime: createdTime, clipNumbers: [clipNum] };
        }
      }
      
      if (!participantName) {
        participantName = `משתתף ${Object.keys(grouped).length + 1}`;
      }
      
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
        id: reflection.id,
        clipNumber: reflection.clipNumber,
        videoUrl: reflection.videoUrl,
        convertedUrl: reflection.convertedUrl,
        conversionStatus: reflection.conversionStatus,
        createdAt: reflection.createdAt,
        status: reflection.status || 'received'
      });
      
      grouped[participantId].clips.sort((a, b) => (a.clipNumber || 0) - (b.clipNumber || 0));
      grouped[participantId].totalClips = grouped[participantId].clips.length;
      
      if (grouped[participantId].clips.length === 3) {
        grouped[participantId].status = 'complete';
      } else if (grouped[participantId].clips.length > 0) {
        grouped[participantId].status = 'partial';
      }
    });
    
    return Object.values(grouped);
  },

  deleteReflection: async (reflectionId) => {
    try {
      await deleteDoc(doc(db, REFLECTIONS_COLLECTION, reflectionId));
      console.log(`🗑️ Reflection deleted: ${reflectionId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Delete reflection error:', error.message);
      return { success: false, error: error.message };
    }
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
