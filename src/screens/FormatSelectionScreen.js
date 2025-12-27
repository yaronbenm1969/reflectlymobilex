import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const FormatSelectionScreen = ({ route }) => {
  const { go, back } = useNav();
  const setVideoFormat = useAppState((state) => state.setVideoFormat);
  const setBackgroundStyle = useAppState((state) => state.setBackgroundStyle);
  const videoFormat = useAppState((state) => state.videoFormat);
  const backgroundStyle = useAppState((state) => state.backgroundStyle);
  
  const [selectedFormat, setSelectedFormat] = useState(videoFormat || null);
  const [selectedBackground, setSelectedBackground] = useState(backgroundStyle || null);
  const [isReady, setIsReady] = useState(false);

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
    { 
      id: '3d-cube', 
      name: 'קוביה תלת מימד', 
      description: 'סיבוב דינמי על קוביה',
      icon: 'cube'
    },
    { 
      id: '3d-carousel', 
      name: 'קרוסלה תלת מימד', 
      description: 'מעבר חלק בין קטעים',
      icon: 'albums'
    },
    { 
      id: 'flip-pages', 
      name: 'דפים מתהפכים', 
      description: 'כמו אלבום תמונות',
      icon: 'book'
    },
    { 
      id: 'standard', 
      name: 'רגיל', 
      description: 'וידאו ליניארי קלאסי',
      icon: 'film'
    },
  ];

  const backgroundOptions = [
    { 
      id: 'original', 
      name: 'רקע מקורי', 
      description: 'השאר את הרקע כמו שהוא',
      icon: 'image'
    },
    { 
      id: 'ai-wallpaper', 
      name: 'AI טפט', 
      description: 'רקע מעוצב בבינה מלאכותית',
      icon: 'color-palette'
    },
    { 
      id: 'video-background', 
      name: 'סרטון רקע', 
      description: 'החלף רקע בוידאו דינמי',
      icon: 'videocam'
    },
    { 
      id: 'split-screen', 
      name: 'שילוב דמויות', 
      description: 'מסך מפוצל עם כולם ביחד',
      icon: 'grid'
    },
  ];

  const handleSave = () => {
    if (!isReady) {
      console.log('⏸️ Save ignored - screen not ready');
      return;
    }
    
    console.log('💾 Saving format & style:', { selectedFormat, selectedBackground });
    
    if (selectedFormat) {
      setVideoFormat(selectedFormat);
    }
    if (selectedBackground) {
      setBackgroundStyle(selectedBackground);
    }
    
    go('MusicSelection');
  };

  const renderOption = (option, isSelected, onPress) => (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.option,
        isSelected && styles.optionSelected
      ]}
      onPress={() => isReady && onPress(option.id)}
    >
      <View style={styles.optionContent}>
        <View style={[
          styles.iconContainer,
          isSelected && styles.iconContainerSelected
        ]}>
          <Ionicons 
            name={option.icon} 
            size={28} 
            color={isSelected ? 'white' : theme.colors.primary} 
          />
        </View>
        <View style={styles.optionInfo}>
          <Text style={[
            styles.optionName,
            isSelected && styles.optionNameSelected
          ]}>
            {option.name}
          </Text>
          <Text style={styles.optionDescription}>
            {option.description}
          </Text>
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
            בחר איך הסיפור שלך יוצג
          </Text>
          
          <Card style={styles.optionsContainer}>
            {formatOptions.map((option) => 
              renderOption(
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
              renderOption(
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
  option: {
    padding: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  optionSelected: {
    backgroundColor: '#FFF5F9',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF0F6',
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
});
