import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import Constants from 'expo-constants';

const VIDEO_CONVERTER_URL = Constants.expoConfig?.extra?.videoConverterUrl || 
  'https://reflectly-mobile-x--yaronbenm1.replit.app';

function needsConversion(uri) {
  const lowerUri = uri.toLowerCase();
  return lowerUri.includes('.mov') || 
         lowerUri.includes('.hevc') || 
         lowerUri.includes('.m4v');
}

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

  uploadWithConversion: async (uri, storyId, videoType = 'key', onProgress = null) => {
    try {
      console.log('Uploading with server-side conversion...');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('video', {
        uri: uri,
        type: 'video/quicktime',
        name: `${storyId}_${videoType}.mov`
      });
      formData.append('storyId', storyId);
      formData.append('type', 'story');
      
      if (onProgress) onProgress(10);
      
      const uploadResponse = await fetch(`${VIDEO_CONVERTER_URL}:3001/api/convert-and-upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (onProgress) onProgress(90);
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Conversion failed');
      }
      
      const result = await uploadResponse.json();
      
      if (onProgress) onProgress(100);
      
      console.log('Video converted and uploaded:', result.url);
      return { 
        success: true, 
        url: result.url,
        converted: result.converted 
      };
      
    } catch (error) {
      console.error('Conversion upload error:', error.message);
      console.log('Falling back to direct upload...');
      return await storageService.uploadDirectToFirebase(uri, storyId, videoType, onProgress);
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

  uploadPlayerWithConversion: async (uri, storyId, participantId, videoNumber, onProgress = null) => {
    try {
      console.log('Uploading player video with conversion...');
      
      const formData = new FormData();
      formData.append('video', {
        uri: uri,
        type: 'video/quicktime',
        name: `player_${participantId}_video${videoNumber}.mov`
      });
      formData.append('storyId', storyId);
      formData.append('type', 'reflection');
      formData.append('recipientId', participantId);
      formData.append('clipNumber', String(videoNumber));
      
      if (onProgress) onProgress(10);
      
      const uploadResponse = await fetch(`${VIDEO_CONVERTER_URL}:3001/api/convert-and-upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (onProgress) onProgress(90);
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Conversion failed');
      }
      
      const result = await uploadResponse.json();
      
      if (onProgress) onProgress(100);
      
      console.log('Player video converted and uploaded:', result.url);
      return { 
        success: true, 
        url: result.url,
        converted: result.converted 
      };
      
    } catch (error) {
      console.error('Player conversion error:', error.message);
      console.log('Falling back to direct upload...');
      const response = await fetch(uri);
      const blob = await response.blob();
      const lowerUri = uri.toLowerCase();
      const extension = lowerUri.includes('.mov') ? 'mov' : 'mp4';
      const filename = `stories/${storyId}/players/${participantId}/video${videoNumber}_${Date.now()}.${extension}`;
      const storageRef = ref(storage, filename);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(progress);
          },
          (error) => reject({ success: false, error: error.message }),
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ success: true, url: downloadURL });
          }
        );
      });
    }
  }
};

export default storageService;
