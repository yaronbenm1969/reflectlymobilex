import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { backgroundsService } from '../services/backgroundsService';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

// Generates a thumbnail from the first frame of a video URL
const VideoThumb = ({ uri, style }) => {
  const [thumb, setThumb] = useState(null);
  useEffect(() => {
    if (!uri) return;
    VideoThumbnails.getThumbnailAsync(uri, { time: 0 })
      .then(({ uri: t }) => setThumb(t))
      .catch(() => {});
  }, [uri]);
  if (!thumb) {
    return (
      <View style={[style, styles.thumbFallback]}>
        <Ionicons name="videocam" size={26} color="#a78bfa" />
      </View>
    );
  }
  return <Image source={{ uri: thumb }} style={style} />;
};

// Full-screen video preview modal
const VideoPreviewModal = ({ item, onSelect, onClose }) => {
  const { t } = useTranslation();
  const player = useVideoPlayer(item?.url || '', (p) => { p.loop = true; });
  useEffect(() => {
    if (item?.url) player.play();
    else player.pause();
  }, [item?.url]);
  return (
    <Modal visible={!!item} animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewModal}>
        <VideoView player={player} style={styles.previewImage} contentFit="contain" nativeControls />
        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.previewSelectBtn}
            onPress={() => { onSelect(item.url, item.mediaType); onClose(); }}
          >
            <Text style={styles.previewSelectBtnText}>{t('playerRecord.bg_select')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={onClose}>
            <Text style={styles.previewCloseBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Pick the right name field based on current language, fallback to nameHe
const LANG_FIELD = { he: 'nameHe', en: 'nameEn', es: 'nameEs', fr: 'nameFr' };
const getBgName = (item, lang) => item[LANG_FIELD[lang]] || item.nameHe || item.nameEn || '';

export const BackgroundSelectionScreen = () => {
  const { t, i18n } = useTranslation();
  const { go, back } = useNav();
  const insets = useSafeAreaInsets();
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const backgroundVideoUrl = useAppState((state) => state.backgroundVideoUrl);
  const backgroundMediaType = useAppState((state) => state.backgroundMediaType);
  const setBackgroundVideoUrl = useAppState((state) => state.setBackgroundVideoUrl);
  const setBackgroundMediaType = useAppState((state) => state.setBackgroundMediaType);

  const [bgMediaList, setBgMediaList] = useState([]);
  const [bgFilter, setBgFilter] = useState('all');
  const [previewBg, setPreviewBg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    backgroundsService.getActiveBackgrounds().then((list) => {
      setBgMediaList(list);
      setIsLoading(false);
    });
  }, []);

  const selectBg = (url, mediaType) => {
    setBackgroundVideoUrl(url);
    setBackgroundMediaType(mediaType);
  };

  const resetBg = () => {
    setBackgroundVideoUrl(null);
    setBackgroundMediaType(null);
  };

  const handleContinue = async () => {
    if (currentStoryId) {
      await storiesService.updateStory(currentStoryId, {
        backgroundVideoUrl: backgroundVideoUrl || null,
        backgroundMediaType: backgroundMediaType || null,
      });
    }
    go('MusicSelection');
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const isImage = asset.type === 'image';
      selectBg(
        isImage ? `data:image/jpeg;base64,${asset.base64}` : asset.uri,
        isImage ? 'image' : 'video'
      );
    }
  };

  const filters = [
    ['all', t('playerRecord.bg_filter_all')],
    ['image', t('playerRecord.bg_filter_images')],
    ['video', t('playerRecord.bg_filter_videos')],
  ];

  const listData = [
    { firestoreId: '__default__', nameHe: t('playerRecord.bg_default'), mediaType: 'default', url: null },
    ...bgMediaList.filter((b) => bgFilter === 'all' || b.mediaType === bgFilter),
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backButton} onPress={back}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('playerRecord.bg_modal_title')}</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {filters.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterTab, bgFilter === key && styles.filterTabActive]}
            onPress={() => setBgFilter(key)}
          >
            <Text style={[styles.filterTabText, bgFilter === key && styles.filterTabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.listArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.firestoreId}
            numColumns={3}
            style={styles.list}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
            const isSelected =
              item.url === backgroundVideoUrl ||
              (item.url === null && !backgroundVideoUrl);
            return (
              <TouchableOpacity
                style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                onPress={() => (item.url === null ? resetBg() : selectBg(item.url, item.mediaType))}
              >
                {item.mediaType === 'default' ? (
                  <View style={styles.thumb}>
                    <Ionicons name="sparkles" size={28} color="#a78bfa" />
                  </View>
                ) : item.mediaType === 'image' ? (
                  <Image source={{ uri: item.url }} style={styles.thumb} />
                ) : (
                  <VideoThumb uri={item.url} style={styles.thumb} />
                )}
                {(item.mediaType === 'default' || i18n.language === 'he') && (
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.mediaType === 'default'
                      ? t('playerRecord.bg_default')
                      : item.nameHe || ''}
                  </Text>
                )}
                {(item.mediaType === 'image' || item.mediaType === 'video') && (
                  <View style={[styles.typeBadge, item.mediaType === 'video' && styles.typeBadgeVideo]}>
                    <Ionicons
                      name={item.mediaType === 'image' ? 'image-outline' : 'videocam-outline'}
                      size={10}
                      color={item.mediaType === 'image' ? theme.colors.secondary : '#7c3aed'}
                    />
                    <Text style={[styles.typeBadgeText, item.mediaType === 'video' && styles.typeBadgeTextVideo]}>
                      {item.mediaType === 'image' ? t('playerRecord.bg_type_image') : t('playerRecord.bg_type_video')}
                    </Text>
                  </View>
                )}
                {(item.mediaType === 'image' || item.mediaType === 'video') && (
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() => setPreviewBg(item)}
                  >
                    <Text style={styles.previewBtnText}>{t('playerRecord.bg_preview')}</Text>
                  </TouchableOpacity>
                )}
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          />
        )}
      </View>

      {/* Bottom bar: gallery + continue */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.galleryBtnText}>{t('playerRecord.bg_gallery')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>{t('common.continue')}</Text>
          <Ionicons name="arrow-forward" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Image preview modal */}
      {previewBg?.mediaType === 'image' && (
        <Modal visible animationType="fade" onRequestClose={() => setPreviewBg(null)}>
          <View style={styles.previewModal}>
            <Image source={{ uri: previewBg.url }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewSelectBtn}
                onPress={() => { selectBg(previewBg.url, previewBg.mediaType); setPreviewBg(null); }}
              >
                <Text style={styles.previewSelectBtnText}>{t('playerRecord.bg_select')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewBg(null)}>
                <Text style={styles.previewCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Video preview modal */}
      <VideoPreviewModal
        item={previewBg?.mediaType === 'video' ? previewBg : null}
        onSelect={selectBg}
        onClose={() => setPreviewBg(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingBottom: theme.spacing[4],
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: `${theme.colors.secondary}15`,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
  },
  filterTabText: {
    color: theme.colors.subtext,
    fontSize: 14,
  },
  filterTabTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  gridItem: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  gridItemSelected: {
    borderColor: theme.colors.primary,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbVideo: {
    backgroundColor: `${theme.colors.secondary}20`,
  },
  thumbFallback: {
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    color: theme.colors.text,
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${theme.colors.secondary}15`,
  },
  typeBadgeVideo: {
    backgroundColor: '#ede9fe',
  },
  typeBadgeText: {
    fontSize: 9,
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  typeBadgeTextVideo: {
    color: '#7c3aed',
  },
  previewBtn: {
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: `${theme.colors.primary}15`,
  },
  previewBtnText: {
    color: theme.colors.primary,
    fontSize: 11,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  bottomBar: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
  },
  continueBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: 'white',
  },
  galleryBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  previewModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  previewImage: {
    width: '100%',
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: 'white',
  },
  previewSelectBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  previewSelectBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewCloseBtn: {
    flex: 1,
    backgroundColor: `${theme.colors.secondary}15`,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  previewCloseBtnText: {
    color: theme.colors.subtext,
    fontSize: 15,
  },
});
