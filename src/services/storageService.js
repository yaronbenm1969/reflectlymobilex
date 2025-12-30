import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const storageService = {
  uploadVideo: async (uri, storyId, videoType = 'key') => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const filename = `stories/${storyId}/${videoType}_${Date.now()}.mp4`;
      const storageRef = ref(storage, filename);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📤 Upload progress: ${progress.toFixed(0)}%`);
          },
          (error) => {
            console.error('❌ Upload error:', error.message);
            reject({ success: false, error: error.message });
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ Video uploaded:', downloadURL);
            resolve({ success: true, url: downloadURL });
          }
        );
      });
    } catch (error) {
      console.error('❌ Upload error:', error.message);
      return { success: false, error: error.message };
    }
  },

  uploadPlayerVideo: async (uri, storyId, participantId, videoNumber) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const filename = `stories/${storyId}/players/${participantId}/video${videoNumber}_${Date.now()}.mp4`;
      const storageRef = ref(storage, filename);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📤 Player video upload: ${progress.toFixed(0)}%`);
          },
          (error) => {
            console.error('❌ Player video upload error:', error.message);
            reject({ success: false, error: error.message });
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ Player video uploaded:', downloadURL);
            resolve({ success: true, url: downloadURL });
          }
        );
      });
    } catch (error) {
      console.error('❌ Player video upload error:', error.message);
      return { success: false, error: error.message };
    }
  },
};

export default storageService;
