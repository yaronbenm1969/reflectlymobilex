import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

export const MyStoriesScreen = () => {
  const { back } = useNav();

  const mockStories = [
    { id: '1', title: 'My First Story', date: '2025-01-20', duration: '2:30' },
    { id: '2', title: 'Family Memories', date: '2025-01-19', duration: '3:45' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Stories</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {mockStories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={60} color={theme.colors.subtext} />
            <Text style={styles.emptyTitle}>No stories yet</Text>
            <Text style={styles.emptySubtitle}>
              Start recording your first story to see it here
            </Text>
          </View>
        ) : (
          <View style={styles.storiesGrid}>
            {mockStories.map((story) => (
              <Card key={story.id} style={styles.storyCard}>
                <View style={styles.storyThumbnail}>
                  <Ionicons name="videocam" size={32} color={theme.colors.primary} />
                </View>
                <View style={styles.storyInfo}>
                  <Text style={styles.storyTitle}>{story.title}</Text>
                  <Text style={styles.storyMeta}>
                    {story.date} • {story.duration}
                  </Text>
                </View>
                <TouchableOpacity style={styles.playButton}>
                  <Ionicons name="play" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </Card>
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
    backgroundColor: `${theme.colors.primary}15`,
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
  },
  storyMeta: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});