import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const storageService = {
  uploadVideo: async (uri, storyId, videoType = 'key', onProgress = null) => {
    try {
      console.log('Starting video upload for:', storyId);
      console.log('Uploading directly to Firebase Storage...');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const lowerUri = uri.toLowerCase();
      const extension = lowerUri.includes('.mov') ? 'mov' : lowerUri.includes('.webm') ? 'webm' : 'mp4';
      const filename = `stories/${storyId}/${videoType}_${Date.now()}.${extension}`;
      const storageRef = ref(storage, filename);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${progress.toFixed(0)}%`);
            if (onProgress) onProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error.message);
            reject({ success: false, error: error.message });
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Video uploaded:', downloadURL);
            resolve({ success: true, url: downloadURL });
          }
        );
      });
    } catch (error) {
      console.error('Upload error:', error.message);
      return { success: false, error: error.message };
    }
  },

  uploadDirectToFirebase: async (uri, storyId, videoType = 'key', onProgress = null) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const lowerUri2 = uri.toLowerCase();
      const extension = lowerUri2.includes('.mov') ? 'mov' : lowerUri2.includes('.webm') ? 'webm' : 'mp4';
      const filename = `stories/${storyId}/${videoType}_${Date.now()}.${extension}`;
      const storageRef = ref(storage, filename);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Direct upload progress: ${progress.toFixed(0)}%`);
            if (onProgress) onProgress(progress);
          },
          (error) => {
            console.error('Direct upload error:', error.message);
            reject({ success: false, error: error.message });
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Video uploaded directly:', downloadURL);
            resolve({ success: true, url: downloadURL, converted: false });
          }
        );
      });
    } catch (error) {
      console.error('Direct upload error:', error.message);
      return { success: false, error: error.message };
    }
  },

  uploadPlayerVideo: async (uri, storyId, participantId, videoNumber, onProgress = null) => {
    try {
      console.log(`Uploading player video ${videoNumber} directly to Firebase...`);
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const lowerUri = uri.toLowerCase();
      const extension = lowerUri.includes('.mov') ? 'mov' : lowerUri.includes('.webm') ? 'webm' : 'mp4';
      const filename = `stories/${storyId}/players/${participantId}/video${videoNumber}_${Date.now()}.${extension}`;
      const storageRef = ref(storage, filename);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Player video upload: ${progress.toFixed(0)}%`);
            if (onProgress) onProgress(progress);
          },
          (error) => {
            console.error('Player video upload error:', error.message);
            reject({ success: false, error: error.message });
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Player video uploaded:', downloadURL);
            resolve({ success: true, url: downloadURL });
          }
        );
      });
    } catch (error) {
      console.error('Player video upload error:', error.message);
      return { success: false, error: error.message };
    }
  },

};

export default storageService;
