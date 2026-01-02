import { bucket, getPublicUrl, sanitizeFilename } from './firebase-admin';

export interface VideoMetadata {
  storyId: string;
  recipientId?: string;
  clipNumber?: number;
  filename: string;
  publicUrl: string;
  uploadedAt: string;
  type: 'story' | 'reflection';
}

export class VideoStorageService {
  private isFirebaseAvailable(): boolean {
    try {
      if (!bucket) {
        console.log('Firebase bucket not initialized - using local storage');
        return false;
      }
      console.log('Firebase Storage ACTIVE');
      return true;
    } catch (error) {
      console.log('Firebase Storage not available:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async uploadStoryVideo(storyId: string, videoBuffer: Buffer, originalFilename: string): Promise<VideoMetadata> {
    if (this.isFirebaseAvailable()) {
      try {
        const result = await this.uploadToFirebase(storyId, videoBuffer, originalFilename, 'story');
        console.log('Firebase upload successful:', result.publicUrl);
        return result;
      } catch (error) {
        console.error('Firebase upload failed:', error);
        console.log('Falling back to local storage');
      }
    } else {
      console.log('Firebase Storage not available, using local storage');
    }

    const metadata: VideoMetadata = {
      storyId,
      filename: `stories/${storyId}.mp4`,
      publicUrl: `/api/videos/local/${storyId}`,
      uploadedAt: new Date().toISOString(),
      type: 'story'
    };
    console.log('Using local storage for video:', storyId);
    return metadata;
  }

  private async uploadToFirebase(
    storyId: string,
    videoBuffer: Buffer,
    originalFilename: string,
    type: 'story' | 'reflection',
    recipientId?: string,
    clipNumber?: number
  ): Promise<VideoMetadata> {
    if (!bucket) {
      throw new Error('Firebase Storage not initialized');
    }

    const sanitizedFilename = sanitizeFilename(originalFilename);

    let fileName: string;
    if (type === 'story') {
      fileName = `stories/${storyId}.mp4`;
    } else {
      const clipSuffix = clipNumber ? `_clip${clipNumber}` : '';
      const recipientPrefix = recipientId || 'anonymous';
      fileName = `reflections/${storyId}/${recipientPrefix}${clipSuffix}.mp4`;
    }

    const file = bucket.file(fileName);

    await file.save(videoBuffer, {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          storyId,
          recipientId: recipientId || '',
          clipNumber: clipNumber?.toString() || '',
          type,
          originalFilename: sanitizedFilename,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    await file.makePublic();

    const publicUrl = getPublicUrl(fileName);

    const metadata: VideoMetadata = {
      storyId,
      recipientId,
      clipNumber,
      filename: fileName,
      publicUrl,
      uploadedAt: new Date().toISOString(),
      type
    };

    console.log('Video uploaded successfully to Firebase:', metadata.publicUrl);
    return metadata;
  }

  async uploadReflectionVideo(
    storyId: string,
    recipientId: string,
    clipNumber: number,
    videoBuffer: Buffer,
    originalFilename: string
  ): Promise<VideoMetadata> {
    if (this.isFirebaseAvailable()) {
      try {
        const result = await this.uploadToFirebase(storyId, videoBuffer, originalFilename, 'reflection', recipientId, clipNumber);
        console.log('Firebase reflection upload successful:', result.publicUrl);
        return result;
      } catch (error) {
        console.error('Firebase upload failed:', error);
        console.log('Falling back to local storage');
      }
    }

    const metadata: VideoMetadata = {
      storyId,
      recipientId,
      clipNumber,
      filename: `reflections/${storyId}/${recipientId}_clip${clipNumber}.mp4`,
      publicUrl: `/api/videos/local/${storyId}_${recipientId}_clip${clipNumber}`,
      uploadedAt: new Date().toISOString(),
      type: 'reflection'
    };
    console.log('Using local storage for reflection video:', storyId, recipientId, clipNumber);
    return metadata;
  }

  async getStoryVideoUrl(storyId: string): Promise<string | null> {
    if (this.isFirebaseAvailable()) {
      try {
        const fileName = `stories/${storyId}.mp4`;
        const file = bucket!.file(fileName);
        const [exists] = await file.exists();

        if (exists) {
          return getPublicUrl(fileName);
        }
      } catch (error) {
        console.error('Error checking Firebase story video:', error);
      }
    }

    return `/api/videos/local/${storyId}`;
  }

  async getReflectionVideos(storyId: string): Promise<VideoMetadata[]> {
    if (this.isFirebaseAvailable()) {
      try {
        const [files] = await bucket!.getFiles({
          prefix: `reflections/${storyId}/`
        });

        return files.map(file => {
          const fileName = file.name;
          const parts = fileName.split('/');
          const fileNamePart = parts[parts.length - 1];
          const [recipientPart, clipPart] = fileNamePart.split('_clip');
          const clipNumber = parseInt(clipPart.replace('.mp4', ''));

          return {
            storyId,
            recipientId: recipientPart,
            clipNumber,
            filename: fileName,
            publicUrl: getPublicUrl(fileName),
            uploadedAt: new Date().toISOString(),
            type: 'reflection' as const
          };
        });
      } catch (error) {
        console.error('Error getting Firebase reflection videos:', error);
      }
    }

    return [];
  }

  async storyExists(storyId: string): Promise<boolean> {
    if (this.isFirebaseAvailable()) {
      try {
        const fileName = `stories/${storyId}.mp4`;
        const file = bucket!.file(fileName);
        const [exists] = await file.exists();
        return exists;
      } catch (error) {
        console.error('Error checking story existence:', error);
      }
    }

    return true;
  }

  async deleteStory(storyId: string): Promise<void> {
    if (this.isFirebaseAvailable()) {
      try {
        console.log(`Starting comprehensive deletion for story ${storyId}`);

        try {
          const storyFile = bucket!.file(`stories/${storyId}.mp4`);
          await storyFile.delete();
          console.log(`Main story ${storyId}.mp4 deleted`);
        } catch (storyError) {
          console.log(`Main story ${storyId}.mp4 not found`);
        }

        try {
          const [storyFiles] = await bucket!.getFiles({
            prefix: `stories/${storyId}/`
          });

          if (storyFiles.length > 0) {
            await Promise.all(storyFiles.map(file => file.delete()));
            console.log(`Deleted ${storyFiles.length} files from stories/${storyId}/`);
          }
        } catch (storyFolderError) {
          console.log(`Could not delete files from stories/${storyId}/`);
        }

        try {
          const [reflectionFiles] = await bucket!.getFiles({
            prefix: `reflections/${storyId}/`
          });

          if (reflectionFiles.length > 0) {
            await Promise.all(reflectionFiles.map(file => file.delete()));
            console.log(`Deleted ${reflectionFiles.length} reflection files`);
          }
        } catch (reflectionError) {
          console.log(`Could not delete reflection files for ${storyId}`);
        }

        console.log(`Comprehensive deletion completed for story ${storyId}`);

      } catch (error) {
        console.error(`Error during deletion for ${storyId}:`, error);
        throw error;
      }
    } else {
      console.log(`Firebase not available, skipping deletion for ${storyId}`);
    }

    console.log(`Story ${storyId} deletion completed`);
  }
}

export const videoStorageService = new VideoStorageService();
