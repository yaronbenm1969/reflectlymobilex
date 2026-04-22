import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';
import CubeProjectorView from '../components/cube3d/CubeProjectorView';
import ProjectedVideoOverlay from '../components/cube3d/ProjectedVideoOverlay';
import ClipsCarousel from '../components/cube3d/ClipsCarousel';
import Fallback2DView from '../components/cube3d/Fallback2DView';
import { generateAllThumbnails, getCachedThumbnail } from '../services/thumbnailService';
import useAppState from '../state/appState';
import useNav from '../hooks/useNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ENABLE_3D_CUBE = true;

export default function WatchExperienceScreen() {
  const { t } = useTranslation();
  const nav = useNav();
  const { storyData } = useAppState();
  const cubeRef = useRef(null);

  const [clips, setClips] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [faces, setFaces] = useState([null, null, null, null, null, null]);
  const [queue, setQueue] = useState([]);
  const [activeFaceIndex, setActiveFaceIndex] = useState(-1);
  const [targetFaceIndex, setTargetFaceIndex] = useState(-1);
  const [activeClipId, setActiveClipId] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const lastPlayedClipId = useRef(null);
  const [use3D, setUse3D] = useState(ENABLE_3D_CUBE);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('cube');
  const [clipDuration, setClipDuration] = useState(8000);

  useEffect(() => {
    loadClips();
  }, []);

  const loadClips = async () => {
    setIsLoading(true);
    setActiveFaceIndex(-1);
    setActiveClipId(null);
    setIsVideoPlaying(false);
    setIsAdvancing(false);
    lastPlayedClipId.current = null;

    const sampleClips = storyData?.reflections?.map((ref, i) => ({
      clipId: ref.id || `clip_${i}`,
      title: ref.participantName || t('watchExperience.clip_n', { n: i + 1 }),
      videoUri: ref.videoUrl,
    })) || [];

    if (sampleClips.length === 0) {
      sampleClips.push(
        { clipId: 'demo1', title: t('watchExperience.clip_n', { n: 1 }), videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
        { clipId: 'demo2', title: t('watchExperience.clip_n', { n: 2 }), videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
        { clipId: 'demo3', title: t('watchExperience.clip_n', { n: 3 }), videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
      );
    }

    setClips(sampleClips);

    console.log(`📹 Loading ${sampleClips.length} clips`);
    await generateAllThumbnails(sampleClips);

    const thumbMap = {};
    sampleClips.forEach(clip => {
      const thumb = getCachedThumbnail(clip.clipId);
      if (thumb) thumbMap[clip.clipId] = thumb;
    });
    setThumbnails(thumbMap);

    const initialFaces = [];
    const remaining = [];
    sampleClips.forEach((clip, index) => {
      if (index < 6) {
        initialFaces.push({
          faceIndex: index,
          clipId: clip.clipId,
          videoUri: clip.videoUri,
          posterThumbUri: thumbMap[clip.clipId] || null,
        });
      } else {
        remaining.push(clip);
      }
    });

    while (initialFaces.length < 6) {
      initialFaces.push(null);
    }

    setFaces(initialFaces);
    setQueue(remaining);
    setIsLoading(false);

    console.log(`🎲 Cube initialized with ${initialFaces.filter(f => f).length} faces, ${remaining.length} in queue`);

    setTimeout(() => {
      setTargetFaceIndex(0);
    }, 1000);
  };

  const handleFaceChange = useCallback((faceIndex, action) => {
    console.log(`🎯 Face ${faceIndex} ${action}, isAdvancing: ${isAdvancing}`);

    if (action === 'enter') {
      if (isAdvancing) {
        console.log(`⏸️ Ignoring enter during advance`);
        return;
      }

      const face = faces[faceIndex];
      if (face && face.videoUri) {
        if (face.clipId === lastPlayedClipId.current) {
          console.log(`⏸️ Same clip as last played, waiting for rotation`);
          return;
        }

        setActiveClipId(face.clipId);
        setIsVideoPlaying(true);
        lastPlayedClipId.current = face.clipId;
        console.log(`▶️ Starting playback for clip: ${face.clipId}`);
      }
    } else if (action === 'exit') {
      setIsVideoPlaying(false);
      setActiveClipId(null);
    }
  }, [faces, isAdvancing]);

  const handleVideoEnd = useCallback(() => {
    console.log(`🎬 Video ended for face ${activeFaceIndex}`);
    
    setIsAdvancing(true);
    setIsVideoPlaying(false);
    setActiveClipId(null);

    const currentFaceIdx = activeFaceIndex;
    setActiveFaceIndex(-1);

    let nextFaceIdx = -1;
    const validFaces = faces.map((f, i) => ({ face: f, index: i })).filter(item => item.face !== null);
    
    if (validFaces.length > 1) {
      nextFaceIdx = (currentFaceIdx + 1) % 6;
      let attempts = 0;
      while ((!faces[nextFaceIdx] || nextFaceIdx === currentFaceIdx) && attempts < 6) {
        nextFaceIdx = (nextFaceIdx + 1) % 6;
        attempts++;
      }
    } else if (validFaces.length === 1) {
      nextFaceIdx = currentFaceIdx;
    }

    if (queue.length > 0 && currentFaceIdx !== -1) {
      const nextClip = queue[0];
      const newQueue = queue.slice(1);

      setFaces(prev => {
        const updated = [...prev];
        updated[currentFaceIdx] = {
          faceIndex: currentFaceIdx,
          clipId: nextClip.clipId,
          videoUri: nextClip.videoUri,
          posterThumbUri: thumbnails[nextClip.clipId] || null,
        };
        return updated;
      });

      setQueue(newQueue);
      console.log(`🔄 Replaced face ${currentFaceIdx} with clip ${nextClip.clipId}, ${newQueue.length} remaining in queue`);
    }

    setTimeout(() => {
      if (nextFaceIdx !== -1 && nextFaceIdx !== currentFaceIdx) {
        console.log(`➡️ Rotating to next face: ${nextFaceIdx}`);
        setTargetFaceIndex(nextFaceIdx);
      }
      
      setTimeout(() => {
        setIsAdvancing(false);
        console.log(`✅ Advance complete, ready for next clip`);
      }, 1500);
    }, 500);
  }, [activeFaceIndex, queue, thumbnails, faces]);

  const handleDurationKnown = useCallback((duration) => {
    setClipDuration(duration);
    console.log(`⏱️ Clip duration known: ${duration}ms`);
  }, []);

  const handlePlaybackStatusUpdate = useCallback((status) => {
  }, []);

  const handle3DError = useCallback((error) => {
    console.log('❌ 3D failed, switching to 2D fallback');
    setUse3D(false);
  }, []);

  const handleClipPress = useCallback((clip, index) => {
    console.log(`👆 Clip pressed: ${clip.clipId}`);
    const faceIdx = faces.findIndex(f => f?.clipId === clip.clipId);
    if (faceIdx !== -1) {
      setTargetFaceIndex(faceIdx);
    }
  }, [faces]);

  const handleFallbackClipEnd = useCallback((clipId, nextIndex) => {
    console.log(`📺 Fallback: clip ${clipId} ended, next index: ${nextIndex}`);
  }, []);

  const shuffleQueue = useCallback(() => {
    const allClips = [...clips];
    for (let i = allClips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allClips[i], allClips[j]] = [allClips[j], allClips[i]];
    }

    const newFaces = [];
    const newQueue = [];
    allClips.forEach((clip, index) => {
      if (index < 6) {
        newFaces.push({
          faceIndex: index,
          clipId: clip.clipId,
          videoUri: clip.videoUri,
          posterThumbUri: thumbnails[clip.clipId] || null,
        });
      } else {
        newQueue.push(clip);
      }
    });

    while (newFaces.length < 6) {
      newFaces.push(null);
    }

    setFaces(newFaces);
    setQueue(newQueue);
    setActiveFaceIndex(-1);
    setActiveClipId(null);
    setIsVideoPlaying(false);
    setIsAdvancing(false);
    lastPlayedClipId.current = null;
    console.log('🔀 Queue shuffled');
  }, [clips, thumbnails]);

  const activeVideoUri = useMemo(() => {
    if (activeFaceIndex === -1) return null;
    return faces[activeFaceIndex]?.videoUri || null;
  }, [activeFaceIndex, faces]);

  const currentFaceClips = useMemo(() => {
    return faces.filter(f => f !== null);
  }, [faces]);

  if (isLoading) {
    return (
      <LinearGradient colors={['#8446b0', '#464fb0']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>{t('watchExperience.loading')}</Text>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#8446b0', '#464fb0']} style={styles.header}>
        <TouchableOpacity onPress={() => nav.goTo('Home')} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('watchExperience.title')}</Text>
        <TouchableOpacity onPress={() => setUse3D(!use3D)} style={styles.toggleButton}>
          <Ionicons name={use3D ? 'cube' : 'square'} size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        {['cube', 'clips', 'resonances'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, currentTab === tab && styles.activeTab]}
            onPress={() => setCurrentTab(tab)}
          >
            <Text style={[styles.tabText, currentTab === tab && styles.activeTabText]}>
              {tab === 'cube' ? t('watchExperience.tab_cube') : tab === 'clips' ? t('watchExperience.tab_clips') : t('watchExperience.tab_resonances')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {currentTab === 'cube' && (
          <>
            {use3D ? (
              <View style={styles.cubeContainer}>
                <CubeProjectorView
                  ref={cubeRef}
                  faces={faces}
                  onFaceChange={handleFaceChange}
                  activeFaceIndex={activeFaceIndex}
                  setActiveFaceIndex={setActiveFaceIndex}
                  targetFaceIndex={targetFaceIndex}
                  isVideoPlaying={isVideoPlaying}
                  isAdvancing={isAdvancing}
                  onError={handle3DError}
                />
                <ProjectedVideoOverlay
                  videoUri={activeVideoUri}
                  isActive={activeFaceIndex !== -1 && isVideoPlaying}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  onVideoEnd={handleVideoEnd}
                  onDurationKnown={handleDurationKnown}
                  style={styles.videoOverlay}
                />
              </View>
            ) : (
              <Fallback2DView
                clips={clips}
                thumbnails={thumbnails}
                onClipEnd={handleFallbackClipEnd}
              />
            )}
          </>
        )}

        {currentTab === 'clips' && (
          <Fallback2DView
            clips={clips}
            thumbnails={thumbnails}
            onClipEnd={handleFallbackClipEnd}
          />
        )}

        {currentTab === 'resonances' && (
          <View style={styles.resonancesPlaceholder}>
            <Text style={styles.placeholderText}>{t('watchExperience.resonances_placeholder')}</Text>
          </View>
        )}
      </View>

      {currentTab === 'cube' && use3D && (
        <ClipsCarousel
          clips={clips}
          thumbnails={thumbnails}
          currentFaceClips={currentFaceClips}
          activeClipId={activeClipId}
          onClipPress={handleClipPress}
        />
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={loadClips}>
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
          <Text style={styles.controlText}>{t('watchExperience.reset')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={shuffleQueue}>
          <Ionicons name="shuffle" size={20} color={theme.colors.primary} />
          <Text style={styles.controlText}>{t('watchExperience.shuffle')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="repeat" size={20} color={theme.colors.primary} />
          <Text style={styles.controlText}>{t('watchExperience.loop')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  toggleButton: {
    padding: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  cubeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    top: '25%',
    left: '25%',
  },
  resonancesPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: theme.colors.subtext,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  controlButton: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 4,
  },
});
