import * as VideoThumbnails from 'expo-video-thumbnails';

const thumbnailCache = {};

export async function generateThumbnail(videoUri, clipId) {
  if (thumbnailCache[clipId]) {
    return thumbnailCache[clipId];
  }

  try {
    const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 0,
      quality: 0.7,
    });
    thumbnailCache[clipId] = result.uri;
    console.log(`✅ Thumbnail generated for ${clipId}`);
    return result.uri;
  } catch (error) {
    console.log(`⚠️ Thumbnail at time=0 failed for ${clipId}, trying time=100ms`);
    try {
      const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 100,
        quality: 0.7,
      });
      thumbnailCache[clipId] = result.uri;
      console.log(`✅ Thumbnail generated for ${clipId} at 100ms`);
      return result.uri;
    } catch (error2) {
      console.log(`❌ Thumbnail generation failed for ${clipId}:`, error2.message);
      return null;
    }
  }
}

export function getCachedThumbnail(clipId) {
  return thumbnailCache[clipId] || null;
}

export function clearThumbnailCache() {
  Object.keys(thumbnailCache).forEach(key => delete thumbnailCache[key]);
}

export async function generateAllThumbnails(clips) {
  const results = await Promise.all(
    clips.map(clip => generateThumbnail(clip.videoUri, clip.clipId))
  );
  return results;
}
