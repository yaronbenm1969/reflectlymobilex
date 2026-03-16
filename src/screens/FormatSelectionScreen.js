import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, InteractionManager, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import { SimpleFormatPreview } from '../components/SimpleFormatPreview';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const ANIMATION_TYPES = {
  'cube-3d': { name: 'קוביה תלת מימד', description: 'סיבוב דינמי על קוביה' },
  'carousel-3d': { name: 'קרוסלה תלת מימד', description: 'מעבר חלק בין קטעים' },
  'flip-pages': { name: 'דפים מתהפכים', description: 'כמו אלבום תמונות' },
  'standard': { name: 'רגיל', description: 'וידאו ליניארי קלאסי' },
  'stack-cards': { name: 'כרטיסים נערמים', description: 'ערימת כרטיסים' },
  'tinder': { name: 'החלקת טינדר', description: 'החלק ימינה או שמאלה' },
  'fold': { name: 'קיפול נייר', description: 'קיפול כמו נייר' },
  'circular': { name: 'מעגלי', description: 'סיבוב במעגל' },
  'flow': { name: 'זרימה', description: 'זרימה חלקה' },
  'parallax': { name: 'עומק פרלקס', description: 'אפקט עומק תלת מימדי' },
  'blur-rotate': { name: 'טשטוש וסיבוב', description: 'סיבוב עם טשטוש' },
  'scale-fade': { name: 'הגדלה ועמעום', description: 'הגדלה והעלמות חלקה' },
};

export const FormatSelectionScreen = ({ route }) => {
  const { go, back } = useNav();
  const setVideoFormat = useAppState((state) => state.setVideoFormat);
  const setBackgroundStyle = useAppState((state) => state.setBackgroundStyle);
  const videoFormat = useAppState((state) => state.videoFormat);
  const backgroundStyle = useAppState((state) => state.backgroundStyle);
  const currentStoryId = useAppState((state) => state.currentStoryId);
  
  const [selectedFormat, setSelectedFormat] = useState(videoFormat || null);
  const [selectedBackground, setSelectedBackground] = useState(backgroundStyle || null);
  const [isReady, setIsReady] = useState(false);
  const [previewFormat, setPreviewFormat] = useState(null);

  console.log('🎬 FormatSelectionScreen rendered');

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        setIsReady(true);
        console.log('✅ FormatSelectionScreen ready for interactions');
      }, 300);
    });

    return () => task.cancel();
  }, []);

  const formatOptions = [
    { id: 'cube-3d', name: 'קוביה תלת מימד', description: 'סיבוב דינמי על קוביה', icon: 'cube' },
    { id: 'carousel-3d', name: 'קרוסלה תלת מימד', description: 'מעבר חלק בין קטעים', icon: 'albums' },
    { id: 'film-strip', name: 'סרט קולנוע', description: 'גלילת פריימים כמו סרט פילם', icon: 'film-outline' },
    { id: 'flip-pages', name: 'דפים מתהפכים', description: 'כמו אלבום תמונות', icon: 'book' },
    { id: 'standard', name: 'רגיל', description: 'וידאו ליניארי קלאסי', icon: 'film' },
    { id: 'stack-cards', name: 'כרטיסים נערמים', description: 'ערימת כרטיסים', icon: 'layers' },
    { id: 'tinder', name: 'החלקת טינדר', description: 'החלק ימינה או שמאלה', icon: 'heart' },
    { id: 'fold', name: 'קיפול נייר', description: 'קיפול כמו נייר', icon: 'document' },
    { id: 'circular', name: 'מעגלי', description: 'סיבוב במעגל', icon: 'sync' },
    { id: 'flow', name: 'זרימה', description: 'זרימה חלקה', icon: 'water' },
    { id: 'parallax', name: 'עומק פרלקס', description: 'אפקט עומק תלת מימדי', icon: 'git-branch' },
    { id: 'blur-rotate', name: 'טשטוש וסיבוב', description: 'סיבוב עם טשטוש', icon: 'aperture' },
    { id: 'scale-fade', name: 'הגדלה ועמעום', description: 'הגדלה והעלמות חלקה', icon: 'expand' },
  ];

  const backgroundOptions = [
    { id: 'original', name: 'רקע מקורי', description: 'השאר את הרקע כמו שהוא', icon: 'image' },
    { id: 'ai-wallpaper', name: 'AI טפט', description: 'רקע מעוצב בבינה מלאכותית', icon: 'color-palette' },
    { id: 'video-background', name: 'סרטון רקע', description: 'החלף רקע בוידאו דינמי', icon: 'videocam' },
    { id: 'split-screen', name: 'שילוב דמויות', description: 'מסך מפוצל עם כולם ביחד', icon: 'grid' },
  ];

  const handleSave = async () => {
    if (!isReady) {
      console.log('⏸️ Save ignored - screen not ready');
      return;
    }
    
    console.log('💾 Saving format & style:', { selectedFormat, selectedBackground, storyId: currentStoryId });
    
    if (selectedFormat) {
      setVideoFormat(selectedFormat);
    }
    if (selectedBackground) {
      setBackgroundStyle(selectedBackground);
    }
    
    if (currentStoryId) {
      const result = await storiesService.updateStory(currentStoryId, {
        format: selectedFormat || 'standard',
        backgroundStyle: selectedBackground || 'original',
      });
      console.log('💾 Firebase update result:', result);
    }
    
    go('MusicSelection');
  };

  const renderFormatOption = (option, isSelected, onPress) => (
    <TouchableOpacity
      key={option.id}
      style={[styles.formatOption, isSelected && styles.optionSelected]}
      onPress={() => isReady && onPress(option.id)}
    >
      <View style={styles.formatContent}>
        <View style={styles.formatLeft}>
          <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
            <Ionicons 
              name={option.icon} 
              size={24} 
              color={isSelected ? 'white' : theme.colors.secondary} 
            />
          </View>
          <View style={styles.formatInfo}>
            <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
              {option.name}
            </Text>
            <Text style={styles.optionDescription}>{option.description}</Text>
          </View>
        </View>
        
        <View style={styles.formatRight}>
          <View style={styles.demoWrapper}>
            <SimpleFormatPreview type={option.id} size={50} />
          </View>
          <TouchableOpacity 
            style={styles.previewButton}
            onPress={() => setPreviewFormat(option.id)}
          >
            <Ionicons name="eye" size={16} color={theme.colors.secondary} />
            <Text style={styles.previewText}>דגימה</Text>
          </TouchableOpacity>
        </View>
        
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} style={styles.checkIcon} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderBackgroundOption = (option, isSelected, onPress) => (
    <TouchableOpacity
      key={option.id}
      style={[styles.option, isSelected && styles.optionSelected]}
      onPress={() => isReady && onPress(option.id)}
    >
      <View style={styles.optionContent}>
        <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
          <Ionicons 
            name={option.icon} 
            size={28} 
            color={isSelected ? 'white' : theme.colors.secondary} 
          />
        </View>
        <View style={styles.optionInfo}>
          <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
            {option.name}
          </Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>סגנון וידאו</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎬 פורמט הקרנה</Text>
          <Text style={styles.sectionDescription}>
            בחר איך הסיפור שלך יוצג (לחץ על "דגימה" לצפייה מורחבת)
          </Text>
          
          <Card style={styles.optionsContainer}>
            {formatOptions.map((option) => 
              renderFormatOption(
                option, 
                selectedFormat === option.id,
                setSelectedFormat
              )
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 עיצוב רקע ושילוב AI</Text>
          <Text style={styles.sectionDescription}>
            הוסף אפקטים מיוחדים לוידאו
          </Text>
          
          <Card style={styles.optionsContainer}>
            {backgroundOptions.map((option) => 
              renderBackgroundOption(
                option, 
                selectedBackground === option.id,
                setSelectedBackground
              )
            )}
          </Card>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="סיים והמשך"
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!selectedFormat || !selectedBackground}
          />
          
          <Text style={styles.helpText}>
            הבחירות שלך יעובדו ב-AI לוידאו הסופי
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={previewFormat !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewFormat(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {previewFormat && ANIMATION_TYPES[previewFormat]?.name}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setPreviewFormat(null)}
              >
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.previewContainer}>
              {previewFormat && (
                <SimpleFormatPreview 
                  type={previewFormat} 
                  size={200} 
                />
              )}
            </View>
            
            <Text style={styles.modalDescription}>
              {previewFormat && ANIMATION_TYPES[previewFormat]?.description}
            </Text>
            
            <AppButton
              title="בחר פורמט זה"
              onPress={() => {
                setSelectedFormat(previewFormat);
                setPreviewFormat(null);
              }}
              variant="primary"
              size="lg"
              fullWidth
            />
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
    backgroundColor: 'white',
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
  },
  section: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[5],
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[2],
  },
  sectionDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginBottom: theme.spacing[4],
  },
  optionsContainer: {
    padding: 0,
    overflow: 'hidden',
  },
  formatOption: {
    padding: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  optionSelected: {
    backgroundColor: `${theme.colors.primary}08`,
  },
  formatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  formatInfo: {
    flex: 1,
  },
  formatRight: {
    alignItems: 'center',
    marginLeft: theme.spacing[2],
  },
  demoWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: `${theme.colors.secondary}10`,
  },
  previewText: {
    fontSize: 11,
    color: theme.colors.secondary,
    marginLeft: 4,
  },
  checkIcon: {
    marginLeft: theme.spacing[2],
  },
  option: {
    padding: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[3],
  },
  iconContainerSelected: {
    backgroundColor: theme.colors.primary,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginBottom: 4,
  },
  optionNameSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  optionDescription: {
    ...theme.typography.small,
    color: theme.colors.subtext,
  },
  actions: {
    padding: theme.spacing[4],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.spacing[8],
  },
  helpText: {
    ...theme.typography.small,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[3],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[4],
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: theme.spacing[5],
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: theme.spacing[4],
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    marginBottom: theme.spacing[4],
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
});
