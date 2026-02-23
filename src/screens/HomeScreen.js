import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../ui/AppButton';
import { Card } from '../ui/Card';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const logoImage = require('../../assets/logo.png');

export const HomeScreen = () => {
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const setStoryName = useAppState((state) => state.setStoryName);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);
  const setCurrentInviteCode = useAppState((state) => state.setCurrentInviteCode);
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);
  const user = useAppState((state) => state.user);
  const [localStoryName, setLocalStoryName] = useState(storyName || '');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const navigateToRecord = async () => {
    if (!localStoryName.trim()) {
      return;
    }
    
    if (!user) {
      Alert.alert('התחברות נדרשת', 'כדי ליצור סיפור ולשתף עם חברים, יש להתחבר קודם.');
      go('Auth');
      return;
    }
    
    setIsCreating(true);
    setStoryName(localStoryName.trim());
    
    const result = await storiesService.createStory(user.uid, {
      name: localStoryName.trim(),
    }, {
      displayName: user.displayName || '',
      email: user.email || '',
    });
    
    if (result.success) {
      setCurrentStoryId(result.storyId);
      setCurrentInviteCode(result.inviteCode);
      console.log('🎬 Story created in Firebase:', result.storyId);
      console.log('📎 Invite code:', result.inviteCode);
    } else {
      Alert.alert('שגיאה', 'לא הצלחנו ליצור את הסיפור');
      setIsCreating(false);
      return;
    }
    
    setIsCreating(false);
    go('Record');
  };

  const handleJoinWithCode = async () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('שגיאה', 'הקוד קצר מדי');
      return;
    }
    
    setIsJoining(true);
    
    const result = await storiesService.getStoryByInviteCode(code);
    
    if (result.success) {
      console.log('🎬 Found story:', result.story.name);
      enterPlayerMode(result.story.id, result.story);
    } else {
      Alert.alert('שגיאה', 'קוד לא נמצא. בדוק ונסה שוב.');
    }
    
    setIsJoining(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.safeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => useAppState.getState().setSideMenuOpen(true)}
              accessibilityLabel="Open navigation menu"
            >
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.logoTitleContainer}>
              <Image 
                source={logoImage} 
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Reflectly</Text>
            </View>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => useAppState.getState().navigateTo('Settings')}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>
            שתף את הסיפור שלך, קבל שיקופים מחברים
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.buttonContainer}>
          <Card style={styles.actionCard}>
            <Text style={styles.cardTitle}>מה שם הסיפור שלך?</Text>
            
            <TextInput
              style={styles.storyNameInput}
              placeholder="הכנס שם לסיפור..."
              placeholderTextColor={theme.colors.subtext}
              value={localStoryName}
              onChangeText={setLocalStoryName}
              textAlign="right"
            />
            
            <Text style={styles.cardDescription}>
              הקלט סיפור אישי והזמן חברים לשתף את השיקופים שלהם
            </Text>
            
            <AppButton
              title={isCreating ? "יוצר סיפור..." : "התחל סיפור חדש"}
              onPress={navigateToRecord}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.primaryButton}
              disabled={!localStoryName.trim() || isCreating}
            />
            
            <AppButton
              title="הסיפורים שלי"
              onPress={() => go('MyStories')}
              variant="secondary"
              size="lg"
              fullWidth
              style={styles.secondaryButton}
            />
          </Card>

          <Card style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <Ionicons name="people" size={24} color={theme.colors.accent} />
              <Text style={styles.playerTitle}>קיבלת הזמנה מחבר?</Text>
            </View>
            <Text style={styles.playerDescription}>
              הכנס את הקוד שקיבלת ב-WhatsApp
            </Text>
            <TextInput
              style={styles.inviteCodeInput}
              placeholder="הכנס קוד..."
              placeholderTextColor={theme.colors.subtext}
              value={inviteCodeInput}
              onChangeText={(text) => setInviteCodeInput(text.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
            />
            <AppButton
              title={isJoining ? "מחפש..." : "הצטרף לסיפור"}
              onPress={handleJoinWithCode}
              variant="secondary"
              size="lg"
              fullWidth
              icon="play-circle-outline"
              disabled={inviteCodeInput.length < 4 || isJoining}
            />
          </Card>

          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={theme.colors.secondary} />
              <Text style={styles.infoTitle}>איך זה עובד</Text>
            </View>
            <Text style={styles.infoText}>
              1. הקלט את הסיפור שלך{'\n'}
              2. בחר פורמט הקרנה ומוזיקה{'\n'}
              3. הזמן חברים דרך WhatsApp{'\n'}
              4. הם מקליטים שיקופים{'\n'}
              5. קבל סרטון מעורך עם AI
            </Text>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingBottom: theme.spacing[6],
    paddingTop: 50,
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  logoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.white,
    textAlign: 'center',
    opacity: 0.9,
    marginTop: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing[4],
  },
  buttonContainer: {
    paddingTop: theme.spacing[6],
    gap: theme.spacing[4],
  },
  actionCard: {
    padding: theme.spacing[6],
    alignItems: 'center',
  },
  cardTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  storyNameInput: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: theme.spacing[4],
  },
  cardDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[5],
    lineHeight: 24,
  },
  primaryButton: {
    marginBottom: theme.spacing[3],
  },
  secondaryButton: {
    marginTop: theme.spacing[2],
  },
  playerCard: {
    padding: theme.spacing[5],
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  playerTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginLeft: theme.spacing[2],
  },
  playerDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'right',
    marginBottom: theme.spacing[3],
  },
  inviteCodeInput: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[3],
    fontSize: 20,
    color: theme.colors.text,
    marginBottom: theme.spacing[3],
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '600',
  },
  infoCard: {
    padding: theme.spacing[5],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[3],
  },
  infoTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginLeft: theme.spacing[2],
  },
  infoText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    lineHeight: 24,
    textAlign: 'right',
  },
});
