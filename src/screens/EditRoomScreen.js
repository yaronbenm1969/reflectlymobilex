import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { NestableScrollContainer, NestableDraggableFlatList, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Video } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';

import theme from '../theme/theme';
import { reflectionsService } from '../services/reflectionsService';
import { storiesService } from '../services/storiesService';
import { db } from '../services/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

function shuffleAvoidConsecutive(clips) {
  if (clips.length <= 1) return clips;
  const uniqueParticipants = new Set(clips.map(c => c.participantId).filter(Boolean));
  if (uniqueParticipants.size <= 1) {
    return [...clips].sort((a, b) => (a.clipNumber || 0) - (b.clipNumber || 0));
  }
  const shuffled = [...clips];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i].participantId && shuffled[i].participantId === shuffled[i - 1].participantId) {
      for (let j = i + 1; j < shuffled.length; j++) {
        if (shuffled[j].participantId !== shuffled[i - 1].participantId) {
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          break;
        }
      }
    }
  }
  return shuffled;
}

const ClipThumbnail = ({ videoUrl, style }) => {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    if (!videoUrl) return;
    VideoThumbnails.getThumbnailAsync(videoUrl, { time: 0 })
      .then(({ uri }) => setUri(uri))
      .catch(() => {});
  }, [videoUrl]);

  if (uri) {
    return <Image source={{ uri }} style={style} resizeMode="cover" />;
  }
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' }]}>
      <Ionicons name="videocam" size={24} color="white" />
    </View>
  );
};

export const EditRoomScreen = () => {
  const { t } = useTranslation();
  const { go, back } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const videoFormat = useAppState((state) => state.videoFormat);
  const privacySettings = useAppState((state) => state.privacySettings);
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const keyStoryUri = useAppState((state) => state.keyStoryUri);
  
  const setReflections = useAppState((state) => state.setReflections);
  const setReflectionsLoading = useAppState((state) => state.setReflectionsLoading);
  const setVideoFormat = useAppState((state) => state.setVideoFormat);
  const setSelectedMusic = useAppState((state) => state.setSelectedMusic);
  const setBackgroundStyle = useAppState((state) => state.setBackgroundStyle);
  const setKeyStoryUri = useAppState((state) => state.setKeyStoryUri);
  const reflections = useAppState((state) => state.reflections);
  const reflectionsLoading = useAppState((state) => state.reflectionsLoading);
  
  const setClipRenderOrder = useAppState((state) => state.setClipRenderOrder);

  const [editConfirmStep, setEditConfirmStep] = useState(0);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [storyVideoUrl, setStoryVideoUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [rejectionData, setRejectionData] = useState(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [confirmingDeleteClipId, setConfirmingDeleteClipId] = useState(null);
  const [orderedClips, setOrderedClips] = useState([]);
  const orderedClipsRef = useRef([]);

  const updateOrderedClips = useCallback((clips) => {
    orderedClipsRef.current = clips;
    setOrderedClips(clips);
    setClipRenderOrder(clips);
  }, [setClipRenderOrder]);

  const setPrivacySettings = useAppState((state) => state.setPrivacySettings);
  const unsubscribeRef = useRef(null);
  const storyUnsubscribeRef = useRef(null);

  useEffect(() => {
    const loadStoryDetails = async () => {
      if (currentStoryId) {
        try {
          const storyDoc = await getDoc(doc(db, 'stories', currentStoryId));
          if (storyDoc.exists()) {
            const storyData = storyDoc.data();
            const videoUrl = storyData.videoUrl || storyData.videoUri;
            console.log('📖 Story data loaded:', storyData.name, 'videoUrl:', videoUrl ? 'exists' : 'missing', 'format:', storyData.format);
            if (videoUrl) {
              setStoryVideoUrl(videoUrl);
            }
            if (storyData.format) {
              setVideoFormat(storyData.format);
              console.log('🎨 Loaded format from Firebase:', storyData.format);
            }
            if (storyData.music) {
              setSelectedMusic(storyData.music);
              console.log('🎵 Loaded music from Firebase:', storyData.music);
            }
            if (storyData.backgroundStyle) {
              setBackgroundStyle(storyData.backgroundStyle);
              console.log('🖼️ Loaded backgroundStyle from Firebase:', storyData.backgroundStyle);
            }
            
            if (storyData.hasRejections && storyData.participantApprovals) {
              const rejections = Object.entries(storyData.participantApprovals)
                .filter(([_, status]) => status === 'rejected');
              if (rejections.length > 0) {
                setRejectionData({
                  count: rejections.length,
                  approvalHistory: storyData.approvalHistory || []
                });
                setShowRejectionModal(true);
              }
            }
          }
        } catch (error) {
          console.error('Error loading story:', error);
        }
      }
    };
    
    loadStoryDetails();
    
    if (currentStoryId) {
      setReflectionsLoading(true);
      
      unsubscribeRef.current = reflectionsService.subscribeToReflections(
        currentStoryId,
        (newReflections) => {
          setReflections(newReflections);
          setReflectionsLoading(false);
        }
      );
      
      storyUnsubscribeRef.current = onSnapshot(
        doc(db, 'stories', currentStoryId),
        (docSnap) => {
          if (docSnap.exists()) {
            const storyData = docSnap.data();
            if (storyData.hasRejections && storyData.participantApprovals) {
              const rejections = Object.entries(storyData.participantApprovals)
                .filter(([_, status]) => status === 'rejected');
              if (rejections.length > 0 && !showRejectionModal) {
                setRejectionData({
                  count: rejections.length,
                  approvalHistory: storyData.approvalHistory || []
                });
                setShowRejectionModal(true);
              }
            }
          }
        }
      );
    }
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (storyUnsubscribeRef.current) {
        storyUnsubscribeRef.current();
      }
    };
  }, [currentStoryId]);

  // Build/update ordered flat clip list when reflections change
  useEffect(() => {
    const allStats = reflectionsService.getReflectionStats(reflections);
    const allClips = [];
    allStats.participants.forEach(p => {
      p.clips.forEach(clip => {
        allClips.push({
          id: clip.id,
          videoUrl: clip.videoUrl,
          clipNumber: clip.clipNumber,
          participantId: p.id,
          participantName: p.name,
        });
      });
    });

    if (allClips.length === 0) {
      updateOrderedClips([]);
      return;
    }

    const current = orderedClipsRef.current;
    const existingIds = new Set(current.map(c => c.id));
    const allIds = new Set(allClips.map(c => c.id));
    const newClips = allClips.filter(c => !existingIds.has(c.id));
    const cleaned = current.filter(c => allIds.has(c.id)); // remove deleted

    if (cleaned.length === 0) {
      // First load: shuffle all
      updateOrderedClips(shuffleAvoidConsecutive(allClips));
    } else if (newClips.length > 0) {
      // New clips arrived: keep existing order, append new ones at end
      updateOrderedClips([...cleaned, ...shuffleAvoidConsecutive(newClips)]);
    } else if (cleaned.length !== current.length) {
      // Only deletions: update without reordering
      updateOrderedClips(cleaned);
    }
  }, [reflections]);

  const effectiveKeyStoryUri = storyVideoUrl || keyStoryUri;

  console.log('📊 Raw reflections count:', reflections.length);
  reflections.forEach((r, i) => {
    console.log(`📹 Reflection ${i}: clipNumber=${r.clipNumber}, videoUrl=${r.videoUrl ? r.videoUrl.substring(0, 50) + '...' : 'MISSING'}`);
  });
  
  const stats = reflectionsService.getReflectionStats(reflections);
  const { participants, totalClips, completeParticipants, totalParticipants } = stats;
  
  console.log('👥 Participants count:', participants.length);
  participants.forEach((p, i) => {
    console.log(`👤 Participant ${i}: name=${p.name}, clips=${p.clips.length}`);
    p.clips.forEach((c, j) => {
      console.log(`  📼 Clip ${j}: clipNumber=${c.clipNumber}, hasVideoUrl=${!!c.videoUrl}`);
    });
  });

  const is3DFormat = videoFormat && videoFormat !== 'standard';

  const handleDeleteClip = async (reflectionId) => {
    await reflectionsService.deleteReflection(reflectionId);
    setConfirmingDeleteClipId(null);
  };

  const handleEditNow = () => {
    if (totalClips === 0) {
      Alert.alert(t('editRoom.no_clips_alert_title'), t('editRoom.no_clips_alert_text'));
      return;
    }
    
    if (editConfirmStep === 0) {
      setEditConfirmStep(1);
      setTimeout(() => {
        setEditConfirmStep((prev) => (prev === 1 ? 0 : prev));
      }, 3000);
    } else if (editConfirmStep === 1) {
      setEditConfirmStep(0);
      if (is3DFormat) {
        setKeyStoryUri(effectiveKeyStoryUri);
        go('FinalVideo');
      } else {
        go('Processing');
      }
    }
  };

  const handlePlayVideo = async (videoUrl) => {
    console.log('🎬 Playing video:', videoUrl);
    if (!videoUrl) {
      Alert.alert(t('common.error'), t('editRoom.error_not_uploaded'));
      return;
    }
    
    let finalUrl = videoUrl;
    if (videoUrl.includes('.webm')) {
      console.log('🔄 Converting webm to mp4...');
      setIsConverting(true);
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';
        console.log('📡 Calling API:', API_URL);
        const response = await fetch(`${API_URL}/api/convert-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrl })
        });
        console.log('📡 Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('📡 Response data:', JSON.stringify(data));
          if (data.convertedUrl) {
            finalUrl = data.convertedUrl;
            console.log('✅ Converted to:', finalUrl);
          } else if (data.error) {
            console.log('❌ Conversion error from API:', data.error);
            Alert.alert(t('editRoom.error_convert'), t('editRoom.error_convert_text'));
            setIsConverting(false);
            return;
          }
        } else {
          const text = await response.text();
          console.log('❌ API error response:', text.substring(0, 200));
          Alert.alert(t('common.error'), t('editRoom.error_server'));
          setIsConverting(false);
          return;
        }
      } catch (error) {
        console.log('⚠️ Conversion failed:', error.message);
        Alert.alert(t('common.error'), t('editRoom.error_network'));
        setIsConverting(false);
        return;
      }
      setIsConverting(false);
    }
    
    setPreviewVideo(finalUrl);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setPreviewVideo(null);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('editRoom.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <NestableScrollContainer style={styles.content}>
        <Text style={styles.storyHeading}>{storyName}</Text>

        <Card style={styles.videosCard}>
          <Text style={styles.sectionTitle}>{t('editRoom.section_clips')}</Text>
          {orderedClips.length > 0 && (
            <Text style={styles.dragHint}>{t('editRoom.drag_hint')}</Text>
          )}

          {reflectionsLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 20 }} />
          ) : orderedClips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>{t('editRoom.empty_text')}</Text>
              <Text style={styles.emptySubtext}>{t('editRoom.empty_subtext')}</Text>
            </View>
          ) : (
            <NestableDraggableFlatList
              data={orderedClips}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => updateOrderedClips(data)}
              renderItem={({ item, drag, isActive, getIndex }) => {
                const index = getIndex();
                return (
                  <ScaleDecorator>
                    <View style={[styles.clipRow, isActive && styles.clipRowActive]}>
                      {/* Drag zone: pos + thumb + info — long press triggers drag */}
                      <TouchableOpacity
                        style={styles.clipRowDragZone}
                        onLongPress={drag}
                        disabled={isActive}
                        activeOpacity={0.7}
                      >
                        <View style={styles.clipRowPos}>
                          <Text style={styles.clipRowPosText}>{index + 1}</Text>
                        </View>
                        <View style={styles.clipRowThumb}>
                          <ClipThumbnail videoUrl={item.videoUrl} style={{ width: '100%', height: '100%' }} />
                        </View>
                        <View style={styles.clipRowInfo}>
                          <Text style={styles.clipRowName} numberOfLines={1}>{item.participantName}</Text>
                          <Text style={styles.clipRowSub}>{t('editRoom.clip_n', { n: item.clipNumber })}</Text>
                        </View>
                        <Ionicons name="reorder-three" size={22} color={theme.colors.primary + '80'} />
                      </TouchableOpacity>
                      {/* Action buttons */}
                      <TouchableOpacity style={styles.clipRowPlay} onPress={() => handlePlayVideo(item.videoUrl)}>
                        <Ionicons name="play-circle" size={28} color={theme.colors.secondary} />
                      </TouchableOpacity>
                      {confirmingDeleteClipId === item.id ? (
                        <View style={styles.clipRowDeleteConfirm}>
                          <TouchableOpacity style={styles.clipConfirmYes} onPress={() => handleDeleteClip(item.id)}>
                            <Text style={styles.clipConfirmYesText}>{t('editRoom.confirm_delete_yes')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.clipConfirmNo} onPress={() => setConfirmingDeleteClipId(null)}>
                            <Text style={styles.clipConfirmNoText}>{t('editRoom.confirm_delete_no')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.clipRowDelete} onPress={() => setConfirmingDeleteClipId(item.id)}>
                          <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScaleDecorator>
                );
              }}
            />
          )}
        </Card>

        <Card style={styles.statusCard}>
          {reflectionsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <View style={styles.statusProgress}>
              <Text style={styles.statusCount}>
                {t('editRoom.status_clips', { total: totalClips, participants: totalParticipants })}
              </Text>

              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: totalParticipants > 0 ? `${(completeParticipants / totalParticipants) * 100}%` : '0%' }
                  ]} 
                />
              </View>
            </View>
          )}
        </Card>

        <Card style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>{t('editRoom.section_settings')}</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="musical-notes" size={20} color={theme.colors.accent} />
              <Text style={styles.settingLabel}>{t('editRoom.setting_music')}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{selectedMusic || t('editRoom.setting_none')}</Text>
              <TouchableOpacity style={styles.inlineChangeButton} onPress={() => go('MusicSelection')}>
                <Text style={styles.inlineChangeText}>{t('editRoom.setting_change')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="cube" size={20} color={theme.colors.secondary} />
              <Text style={styles.settingLabel}>{t('editRoom.setting_format')}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{videoFormat || t('editRoom.setting_standard')}</Text>
              <TouchableOpacity style={styles.inlineChangeButton} onPress={() => go('FormatSelection')}>
                <Text style={styles.inlineChangeText}>{t('editRoom.setting_change')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.secondary} />
              <Text style={styles.settingLabel}>{t('editRoom.setting_privacy')}</Text>
            </View>
            <Text style={styles.settingValue}>
              {privacySettings.allowSocialMedia ? t('editRoom.setting_public') : t('editRoom.setting_private')}
            </Text>
          </View>
        </Card>

        <View style={styles.exportActions}>
          <TouchableOpacity
            style={[
              styles.editNowButton,
              editConfirmStep === 1 && styles.editNowButtonConfirm,
              totalClips === 0 && styles.editNowButtonDisabled,
            ]}
            onPress={handleEditNow}
            disabled={totalClips === 0}
          >
            <View style={styles.editNowContent}>
              <Ionicons
                name={editConfirmStep === 1 ? "checkmark-circle" : "color-wand"}
                size={24}
                color="white"
              />
              <Text style={styles.editNowText}>
                {editConfirmStep === 1
                  ? t('editRoom.edit_btn_confirm')
                  : t('editRoom.edit_btn', { count: totalClips })}
              </Text>
            </View>
            {editConfirmStep === 0 && totalClips > 0 && completeParticipants < totalParticipants && (
              <Text style={styles.editNowHint}>
                {t('editRoom.edit_hint')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </NestableScrollContainer>

      <Modal
        visible={isConverting}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>{t('editRoom.converting')}</Text>
          <Text style={styles.loadingSubtext}>{t('editRoom.converting_subtext')}</Text>
        </View>
      </Modal>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            {previewVideo && (
              <Video
                source={{ uri: previewVideo }}
                style={styles.modalVideo}
                useNativeControls
                resizeMode="contain"
                shouldPlay
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRejectionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.rejectionModal]}>
            <Text style={styles.rejectionIcon}>⚠️</Text>
            <Text style={styles.rejectionTitle}>{t('editRoom.rejection_title')}</Text>
            <Text style={styles.rejectionText}>
              {t('editRoom.rejection_text', { count: rejectionData?.count })}
            </Text>
            <Text style={styles.rejectionSubtext}>{t('editRoom.rejection_question')}</Text>
            <View style={styles.rejectionActions}>
              <TouchableOpacity
                style={[styles.rejectionButton, styles.rejectionButtonPrivate]}
                onPress={async () => {
                  try {
                    const updatedPrivacy = { 
                      ...privacySettings, 
                      publishingEnabled: false 
                    };
                    await storiesService.updateStory(currentStoryId, {
                      privacySettings: updatedPrivacy,
                      hasRejections: false
                    });
                    setPrivacySettings(updatedPrivacy);
                    Alert.alert(t('editRoom.rejection_updated'), t('editRoom.rejection_updated_text'));
                  } catch (e) {
                    console.error(e);
                  }
                  setShowRejectionModal(false);
                }}
              >
                <Ionicons name="lock-closed" size={20} color="white" />
                <Text style={styles.rejectionButtonText}>{t('editRoom.rejection_btn_private')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectionButton, styles.rejectionButtonContinue]}
                onPress={() => {
                  setShowRejectionModal(false);
                  go('WhatsAppShare');
                }}
              >
                <Ionicons name="person-add" size={20} color="white" />
                <Text style={styles.rejectionButtonText}>{t('editRoom.rejection_btn_invite')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectionDismiss}
                onPress={() => setShowRejectionModal(false)}
              >
                <Text style={styles.rejectionDismissText}>{t('editRoom.rejection_btn_close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: 50,
    paddingBottom: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  previewCard: {
    padding: 0,
    marginBottom: theme.spacing[4],
    overflow: 'hidden',
  },
  videoPreview: {
    height: 200,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  noVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoText: {
    color: '#999',
    marginTop: 8,
  },
  previewTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    padding: theme.spacing[4],
    textAlign: 'center',
  },
  statusCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[3],
  },
  statusTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  statusProgress: {},
  statusCount: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing[1],
    textAlign: 'center',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  settingsCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'right',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  settingLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  inlineChangeButton: {
    backgroundColor: theme.colors.accent + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inlineChangeText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  settingValue: {
    ...theme.typography.body,
    color: theme.colors.secondary,
    fontWeight: 'bold',
  },
  storyHeading: {
    ...theme.typography.h1,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
    marginTop: theme.spacing[2],
  },
  videosCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing[3],
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: '#999',
    marginTop: theme.spacing[1],
    textAlign: 'center',
  },
  participantSection: {
    marginBottom: theme.spacing[4],
    paddingBottom: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing[2],
  },
  statusComplete: {
    backgroundColor: theme.colors.success,
  },
  statusPartial: {
    backgroundColor: '#FFA500',
  },
  participantName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: 'bold',
    flex: 1,
  },
  clipCount: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
  },
  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: theme.spacing[2],
  },
  clipRowActive: {
    backgroundColor: '#f5f0ff',
    borderRadius: 8,
  },
  clipRowPos: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipRowPosText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clipRowThumb: {
    width: 64,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  clipRowInfo: {
    flex: 1,
  },
  clipRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  clipRowSub: {
    fontSize: 11,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[3],
  },
  dragHint: {
    fontSize: 11,
    color: theme.colors.subtext,
    fontStyle: 'italic',
  },
  clipRowDragZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  clipRowPlay: {
    padding: 4,
  },
  clipRowDelete: {
    padding: 4,
  },
  clipRowDeleteConfirm: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  clipConfirmYes: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clipConfirmYesText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  clipConfirmNo: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clipConfirmNoText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '500',
  },
  exportActions: {
    paddingVertical: theme.spacing[4],
  },
  editNowButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    alignItems: 'center',
  },
  editNowButtonConfirm: {
    backgroundColor: '#4CAF50',
  },
  editNowButtonDisabled: {
    backgroundColor: '#ccc',
  },
  editNowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  editNowText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editNowHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: theme.spacing[1],
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    height: '70%',
    backgroundColor: '#000',
    borderRadius: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    padding: 8,
  },
  modalVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  rejectionModal: {
    height: 'auto',
    backgroundColor: 'white',
    padding: theme.spacing[6],
    alignItems: 'center',
  },
  rejectionIcon: {
    fontSize: 48,
    marginBottom: theme.spacing[3],
  },
  rejectionTitle: {
    ...theme.typography.h2,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  rejectionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  rejectionSubtext: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  rejectionActions: {
    width: '100%',
    gap: theme.spacing[3],
  },
  rejectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[4],
    borderRadius: theme.radii.lg,
    gap: theme.spacing[2],
  },
  rejectionButtonPrivate: {
    backgroundColor: theme.colors.primary,
  },
  rejectionButtonContinue: {
    backgroundColor: '#4CAF50',
  },
  rejectionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rejectionDismiss: {
    padding: theme.spacing[3],
    alignItems: 'center',
  },
  rejectionDismissText: {
    color: theme.colors.subtext,
    fontSize: 14,
  },
});
