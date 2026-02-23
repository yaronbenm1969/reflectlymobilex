import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

export const MyStoriesScreen = () => {
  const { back, go } = useNav();
  const user = useAppState((state) => state.user);
  const setStoryName = useAppState((state) => state.setStoryName);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);
  
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, [user]);

  const loadStories = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await storiesService.getUserStories(user.uid);
    
    if (result.success) {
      setStories(result.stories);
    } else {
      console.error('Failed to load stories:', result.error);
    }
    setLoading(false);
  };

  const openStory = (story) => {
    setStoryName(story.name);
    setCurrentStoryId(story.id);
    go('EditRoom');
  };

  const deleteStory = async (storyId) => {
    Alert.alert(
      'מחיקת סיפור',
      'האם אתה בטוח שברצונך למחוק את הסיפור?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            const result = await storiesService.deleteStory(storyId);
            if (result.success) {
              setStories(stories.filter(s => s.id !== storyId));
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL');
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return 'טיוטה';
      case 'shared': return 'נשלח לחברים';
      case 'processing': return 'בעריכה';
      case 'completed': return 'הושלם';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return '#999';
      case 'shared': return '#2196F3';
      case 'processing': return '#FF9800';
      case 'completed': return '#4CAF50';
      default: return '#999';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>הסיפורים שלי</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadStories}>
          <Ionicons name="refresh" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>טוען סיפורים...</Text>
          </View>
        ) : !user ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={60} color={theme.colors.subtext} />
            <Text style={styles.emptyTitle}>התחבר כדי לראות סיפורים</Text>
            <Text style={styles.emptySubtitle}>
              הסיפורים שלך נשמרים בענן כשאתה מחובר
            </Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => go('Auth')}
            >
              <Text style={styles.loginButtonText}>התחבר עכשיו</Text>
            </TouchableOpacity>
          </View>
        ) : stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={60} color={theme.colors.subtext} />
            <Text style={styles.emptyTitle}>אין סיפורים עדיין</Text>
            <Text style={styles.emptySubtitle}>
              התחל להקליט את הסיפור הראשון שלך
            </Text>
          </View>
        ) : (
          <View style={styles.storiesGrid}>
            {stories.map((story) => (
              <TouchableOpacity 
                key={story.id} 
                onPress={() => openStory(story)}
                onLongPress={() => deleteStory(story.id)}
              >
                <Card style={styles.storyCard}>
                  <View style={styles.storyThumbnail}>
                    <Ionicons name="videocam" size={32} color={theme.colors.secondary} />
                  </View>
                  <View style={styles.storyInfo}>
                    <Text style={styles.storyTitle}>{story.name}</Text>
                    <Text style={styles.storyMeta}>
                      {formatDate(story.createdAt)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(story.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(story.status) }]}>
                        {getStatusText(story.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.playButton}>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.accent} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    paddingVertical: theme.spacing[3],
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[8],
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing[3],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[8],
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[3],
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
  loginButton: {
    marginTop: theme.spacing[4],
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.lg,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  storiesGrid: {
    gap: theme.spacing[3],
  },
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[4],
  },
  storyThumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.md,
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[3],
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
  },
  storyMeta: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
    textAlign: 'right',
  },
  statusBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
