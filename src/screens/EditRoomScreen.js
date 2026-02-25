import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';
import { reflectionsService } from '../services/reflectionsService';
import { storiesService } from '../services/storiesService';
import { db } from '../services/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export const EditRoomScreen = () => {
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
  
  const [editConfirmStep, setEditConfirmStep] = useState(0);
  const [publishConfirmStep, setPublishConfirmStep] = useState(0);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [approvedClips, setApprovedClips] = useState({});
  const [storyVideoUrl, setStoryVideoUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [rejectionData, setRejectionData] = useState(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  
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

  const handleEditNow = () => {
    if (totalClips === 0) {
      Alert.alert('אין שיקופים', 'עדיין לא התקבלו שיקופים מהמשתתפים');
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

  const handleExport = () => {
    if (privacySettings.allowSocialMedia) {
      if (publishConfirmStep === 0) {
        setPublishConfirmStep(1);
        setTimeout(() => {
          setPublishConfirmStep((prev) => (prev === 1 ? 0 : prev));
        }, 3000);
      } else if (publishConfirmStep === 1) {
        setPublishConfirmStep(0);
        setKeyStoryUri(effectiveKeyStoryUri);
        go('FinalVideo');
      }
    } else {
      setKeyStoryUri(effectiveKeyStoryUri);
      go('FinalVideo');
    }
  };

  const handlePlayVideo = async (videoUrl) => {
    console.log('🎬 Playing video:', videoUrl);
    if (!videoUrl) {
      Alert.alert('שגיאה', 'הסרטון עדיין לא הועלה - נסה שוב עוד כמה רגעים');
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
            Alert.alert('שגיאה בהמרה', 'לא ניתן להמיר את הסרטון. נסה שוב.');
            setIsConverting(false);
            return;
          }
        } else {
          const text = await response.text();
          console.log('❌ API error response:', text.substring(0, 200));
          Alert.alert('שגיאה', 'השרת לא זמין. נסה שוב מאוחר יותר.');
          setIsConverting(false);
          return;
        }
      } catch (error) {
        console.log('⚠️ Conversion failed:', error.message);
        Alert.alert('שגיאה', 'בעיית רשת. בדוק את החיבור לאינטרנט.');
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

  const getClipKey = (participantId, clipNumber) => `${participantId}_${clipNumber}`;

  const toggleClipApproval = (participantId, clipNumber) => {
    const key = getClipKey(participantId, clipNumber);
    setApprovedClips(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isClipApproved = (participantId, clipNumber) => {
    const key = getClipKey(participantId, clipNumber);
    return approvedClips[key] === true;
  };

  const approvedCount = Object.values(approvedClips).filter(Boolean).length;

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
        <Text style={styles.title}>חדר עריכה</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.previewCard}>
          <View style={styles.videoPreview}>
            {effectiveKeyStoryUri ? (
              <Video
                source={{ uri: effectiveKeyStoryUri }}
                style={styles.previewVideoPlayer}
                useNativeControls
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noVideoPlaceholder}>
                <Ionicons name="videocam-off" size={48} color="#999" />
                <Text style={styles.noVideoText}>אין סרטון מפתח</Text>
              </View>
            )}
          </View>
          <Text style={styles.previewTitle}>{storyName}</Text>
        </Card>

        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons name="people" size={24} color={theme.colors.accent} />
            <Text style={styles.statusTitle}>סטטוס שיקופים</Text>
          </View>
          
          {reflectionsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <View style={styles.statusProgress}>
              <Text style={styles.statusCount}>
                {totalClips} קליפים מ-{totalParticipants} משתתפים
              </Text>
              <Text style={styles.statusSubtext}>
                {completeParticipants} השלימו 3 שיקופים
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
          <Text style={styles.sectionTitle}>הגדרות נוכחיות</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="musical-notes" size={20} color={theme.colors.accent} />
              <Text style={styles.settingLabel}>מוזיקה</Text>
            </View>
            <Text style={styles.settingValue}>{selectedMusic || 'ללא'}</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="cube" size={20} color={theme.colors.secondary} />
              <Text style={styles.settingLabel}>פורמט</Text>
            </View>
            <Text style={styles.settingValue}>{videoFormat || 'סטנדרטי'}</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.secondary} />
              <Text style={styles.settingLabel}>פרטיות</Text>
            </View>
            <Text style={styles.settingValue}>
              {privacySettings.allowSocialMedia ? 'לפרסום' : 'פרטי'}
            </Text>
          </View>
        </Card>

        <Card style={styles.videosCard}>
          <Text style={styles.sectionTitle}>שיקופים שהתקבלו</Text>
          
          {reflectionsLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 20 }} />
          ) : participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>ממתין לשיקופים מהמשתתפים...</Text>
              <Text style={styles.emptySubtext}>שלח את הלינק לחברים כדי שיוכלו להקליט</Text>
            </View>
          ) : (
            participants.map((participant) => (
              <View key={participant.id} style={styles.participantSection}>
                <View style={styles.participantHeader}>
                  <View style={[
                    styles.statusDot,
                    participant.status === 'complete' ? styles.statusComplete : styles.statusPartial
                  ]} />
                  <Text style={styles.participantName}>{participant.name}</Text>
                  <Text style={styles.clipCount}>{participant.totalClips}/3 קליפים</Text>
                </View>
                
                <View style={styles.clipsRow}>
                  {participant.clips.map((clip, index) => {
                    const approved = isClipApproved(participant.id, clip.clipNumber);
                    return (
                      <View key={index} style={styles.clipContainer}>
                        <View style={[styles.clipPreview, approved && styles.clipPreviewApproved]}>
                          <Ionicons name="videocam" size={24} color="white" />
                          {approved && (
                            <View style={styles.approvedBadge}>
                              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.clipLabel}>שיקוף {clip.clipNumber}</Text>
                        <View style={styles.clipActions}>
                          <TouchableOpacity 
                            style={styles.clipActionButton}
                            onPress={() => handlePlayVideo(clip.videoUrl)}
                          >
                            <Ionicons name="play" size={16} color={theme.colors.secondary} />
                            <Text style={styles.clipActionText}>צפה</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.clipActionButton, approved && styles.clipActionButtonApproved]}
                            onPress={() => toggleClipApproval(participant.id, clip.clipNumber)}
                          >
                            <Ionicons 
                              name={approved ? "checkmark-circle" : "add-circle-outline"} 
                              size={16} 
                              color={approved ? "#4CAF50" : theme.colors.accent} 
                            />
                            <Text style={[styles.clipActionText, approved && styles.clipActionTextApproved]}>
                              {approved ? "מאושר" : "הוסף"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>פעולות</Text>
          
          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => go('MusicSelection')}
          >
            <Ionicons name="musical-notes" size={24} color={theme.colors.accent} />
            <Text style={styles.actionText}>שנה מוזיקה</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => go('FormatSelection')}
          >
            <Ionicons name="cube" size={24} color={theme.colors.secondary} />
            <Text style={styles.actionText}>שנה פורמט הקרנה</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.subtext} />
          </TouchableOpacity>
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
                  ? 'לחץ שוב לאישור עריכה' 
                  : `ערוך עכשיו (${approvedCount > 0 ? approvedCount : totalClips} קליפים)`}
              </Text>
            </View>
            {editConfirmStep === 0 && totalClips > 0 && completeParticipants < totalParticipants && (
              <Text style={styles.editNowHint}>
                ניתן לערוך גם ללא כל השיקופים
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>או</Text>
            <View style={styles.dividerLine} />
          </View>

          {privacySettings.allowSocialMedia ? (
            <TouchableOpacity
              style={[
                styles.publishButton,
                publishConfirmStep === 1 && styles.publishButtonConfirm,
              ]}
              onPress={handleExport}
            >
              <Ionicons 
                name={publishConfirmStep === 1 ? "checkmark-circle" : "share-social"} 
                size={24} 
                color="white" 
              />
              <Text style={styles.publishButtonText}>
                {publishConfirmStep === 1 
                  ? 'לחץ שוב לאישור פרסום' 
                  : 'ייצא ופרסם'}
              </Text>
            </TouchableOpacity>
          ) : (
            <AppButton
              title="ייצא סרטון סופי"
              onPress={handleExport}
              variant="primary"
              size="lg"
              fullWidth
            />
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isConverting}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>ממיר סרטון לפורמט תואם...</Text>
          <Text style={styles.loadingSubtext}>זה עשוי לקחת עד 30 שניות</Text>
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
            <Text style={styles.rejectionTitle}>יש משתתפים שדחו את הפרסום</Text>
            <Text style={styles.rejectionText}>
              {rejectionData?.count} משתתפ/ים לא אישרו את פרסום הסרטון הסופי.
            </Text>
            <Text style={styles.rejectionSubtext}>מה תרצה לעשות?</Text>
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
                    Alert.alert('עודכן', 'הסיפור הפך לפרויקט אישי ללא פרסום');
                  } catch (e) {
                    console.error(e);
                  }
                  setShowRejectionModal(false);
                }}
              >
                <Ionicons name="lock-closed" size={20} color="white" />
                <Text style={styles.rejectionButtonText}>הפוך לפרויקט אישי</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectionButton, styles.rejectionButtonContinue]}
                onPress={() => {
                  setShowRejectionModal(false);
                  go('WhatsAppShare');
                }}
              >
                <Ionicons name="person-add" size={20} color="white" />
                <Text style={styles.rejectionButtonText}>הזמן שחקנים אחרים</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectionDismiss}
                onPress={() => setShowRejectionModal(false)}
              >
                <Text style={styles.rejectionDismissText}>סגור</Text>
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
  statusSubtext: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 4,
  },
  settingsCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[3],
    textAlign: 'right',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  settingValue: {
    ...theme.typography.body,
    color: theme.colors.secondary,
    fontWeight: 'bold',
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
  clipsRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
    flexWrap: 'wrap',
  },
  clipContainer: {
    alignItems: 'center',
    width: 90,
  },
  clipPreview: {
    width: 80,
    height: 60,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  clipPreviewApproved: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  approvedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  clipLabel: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: 4,
    textAlign: 'center',
  },
  clipActions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  clipActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  clipActionButtonApproved: {
    backgroundColor: '#E8F5E9',
  },
  clipActionText: {
    fontSize: 10,
    color: theme.colors.secondary,
  },
  clipActionTextApproved: {
    color: '#4CAF50',
  },
  actionsCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: theme.spacing[3],
  },
  actionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing[4],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    paddingHorizontal: theme.spacing[3],
    color: theme.colors.subtext,
    fontSize: 14,
  },
  publishButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  publishButtonConfirm: {
    backgroundColor: '#4CAF50',
  },
  publishButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
