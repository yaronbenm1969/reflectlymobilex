import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const EditRoomScreen = () => {
  const { go, back } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const videoFormat = useAppState((state) => state.videoFormat);
  const receivedVideos = useAppState((state) => state.receivedVideos);
  const privacySettings = useAppState((state) => state.privacySettings);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [editConfirmStep, setEditConfirmStep] = useState(0);
  const [publishConfirmStep, setPublishConfirmStep] = useState(0);

  const mockReceivedVideos = [
    { id: 1, name: 'דני', duration: '0:32', status: 'received' },
    { id: 2, name: 'מיכל', duration: '0:28', status: 'received' },
    { id: 3, name: 'יוסי', duration: '0:45', status: 'pending' },
  ];

  const receivedCount = mockReceivedVideos.filter(v => v.status === 'received').length;
  const totalCount = mockReceivedVideos.length;

  const handleEditNow = () => {
    if (editConfirmStep === 0) {
      setEditConfirmStep(1);
      setTimeout(() => {
        if (editConfirmStep === 1) setEditConfirmStep(0);
      }, 3000);
    } else {
      go('Processing');
    }
  };

  const handleExport = () => {
    if (privacySettings.allowSocialMedia) {
      if (publishConfirmStep === 0) {
        setPublishConfirmStep(1);
        setTimeout(() => {
          if (publishConfirmStep === 1) setPublishConfirmStep(0);
        }, 3000);
      } else {
        go('FinalVideo');
      }
    } else {
      go('FinalVideo');
    }
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
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={48}
                color="white"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.previewTitle}>{storyName}</Text>
        </Card>

        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.statusTitle}>סטטוס שיקופים</Text>
          </View>
          <View style={styles.statusProgress}>
            <Text style={styles.statusCount}>
              {receivedCount} מתוך {totalCount} התקבלו
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(receivedCount / totalCount) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </Card>

        <Card style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>הגדרות נוכחיות</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
              <Text style={styles.settingLabel}>מוזיקה</Text>
            </View>
            <Text style={styles.settingValue}>{selectedMusic || 'ללא'}</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="cube" size={20} color={theme.colors.primary} />
              <Text style={styles.settingLabel}>פורמט</Text>
            </View>
            <Text style={styles.settingValue}>{videoFormat || 'סטנדרטי'}</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
              <Text style={styles.settingLabel}>פרטיות</Text>
            </View>
            <Text style={styles.settingValue}>
              {privacySettings.allowSocialMedia ? 'לפרסום' : 'פרטי'}
            </Text>
          </View>
        </Card>

        <Card style={styles.videosCard}>
          <Text style={styles.sectionTitle}>סרטונים שהתקבלו</Text>
          
          {mockReceivedVideos.map((video) => (
            <View key={video.id} style={styles.videoRow}>
              <View style={styles.videoInfo}>
                <View style={[
                  styles.statusDot,
                  video.status === 'received' ? styles.statusReceived : styles.statusPending
                ]} />
                <Text style={styles.videoName}>{video.name}</Text>
              </View>
              <Text style={styles.videoDuration}>{video.duration}</Text>
              {video.status === 'received' && (
                <TouchableOpacity style={styles.playSmallButton}>
                  <Ionicons name="play-circle" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>פעולות</Text>
          
          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => go('MusicSelection')}
          >
            <Ionicons name="musical-notes" size={24} color={theme.colors.primary} />
            <Text style={styles.actionText}>שנה מוזיקה</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => go('FormatSelection')}
          >
            <Ionicons name="cube" size={24} color={theme.colors.primary} />
            <Text style={styles.actionText}>שנה פורמט הקרנה</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.subtext} />
          </TouchableOpacity>
        </Card>

        <View style={styles.exportActions}>
          <TouchableOpacity
            style={[
              styles.editNowButton,
              editConfirmStep === 1 && styles.editNowButtonConfirm,
            ]}
            onPress={handleEditNow}
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
                  : `ערוך עכשיו (${receivedCount}/${totalCount})`}
              </Text>
            </View>
            {editConfirmStep === 0 && receivedCount < totalCount && (
              <Text style={styles.editNowHint}>
                ניתן לערוך גם ללא כל הסרטונים
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
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: theme.spacing[2],
    textAlign: 'center',
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
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  videosCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  videoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusReceived: {
    backgroundColor: theme.colors.success,
  },
  statusPending: {
    backgroundColor: '#FFA500',
  },
  videoName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  videoDuration: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginRight: theme.spacing[3],
  },
  playSmallButton: {
    padding: theme.spacing[1],
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
    backgroundColor: '#FF9800',
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    alignItems: 'center',
  },
  editNowButtonConfirm: {
    backgroundColor: '#4CAF50',
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
});
