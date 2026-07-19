import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../state/appState';
import { useNav } from '../hooks/useNav';
import { invitationsService } from '../services/invitationsService';
import theme from '../theme/theme';

export const InvitationLandingScreen = () => {
  const { t } = useTranslation();
  const { go, back } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  const setInvitation = useAppState((state) => state.setInvitation);
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);

  const token = navigationParams?.inviteToken;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invData, setInvData] = useState(null); // { invitationId, participantName, storyData }

  useEffect(() => {
    if (!token) {
      setError('invalid_link');
      setLoading(false);
      return;
    }
    invitationsService.resolveToken(token).then((res) => {
      if (!res.success) {
        setError(res.error === 'invitation_not_found' ? 'not_found'
          : res.error === 'invitation_expired' ? 'expired'
          : 'error');
      } else {
        setInvData(res);
      }
      setLoading(false);
    });
  }, [token]);

  const handleConfirm = () => {
    if (!invData) return;
    setInvitation(invData.invitationId, invData.participantName);
    enterPlayerMode(invData.storyId, invData.storyData);
    // PlayerViewScreen → PlayerRecordScreen will pick up invitationId from state
  };

  const handleDecline = () => {
    back();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    const messages = {
      not_found: { icon: 'link-outline', title: 'הזמנה לא נמצאה', body: 'ייתכן שהקישור שגוי או שפג תוקפו.' },
      expired: { icon: 'time-outline', title: 'הזמנה פגה תוקף', body: 'צור קשר עם היוצר לקבלת קישור חדש.' },
      invalid_link: { icon: 'alert-circle-outline', title: 'קישור לא תקין', body: 'נסה שנית או צור קשר עם מי ששלח לך.' },
      error: { icon: 'alert-circle-outline', title: 'שגיאה', body: 'לא הצלחנו לטעון את ההזמנה. נסה שנית.' },
    };
    const msg = messages[error] || messages.error;
    return (
      <View style={styles.center}>
        <Ionicons name={msg.icon} size={56} color="rgba(255,255,255,0.4)" />
        <Text style={styles.errorTitle}>{msg.title}</Text>
        <Text style={styles.errorBody}>{msg.body}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Text style={styles.backBtnText}>חזור</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const storyName = invData?.storyData?.name || '';
  const creatorName = invData?.storyData?.creatorName || '';
  const participantName = invData?.participantName || '';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="film-outline" size={64} color="rgba(255,255,255,0.9)" />
        </View>

        <Text style={styles.greeting}>שלום,</Text>
        <Text style={styles.name}>{participantName}</Text>

        <Text style={styles.body}>
          {creatorName
            ? `${creatorName} הזמין אותך להשתתף בסרט`
            : 'הוזמנת להשתתף בסרט'}
        </Text>

        {!!storyName && (
          <View style={styles.storyBadge}>
            <Text style={styles.storyBadgeText}>"{storyName}"</Text>
          </View>
        )}

        <Text style={styles.notice}>
          הזמנה זו אישית. אם אינך {participantName}, אנא אל תמשיך.
        </Text>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
          <Text style={styles.confirmBtnText}>זה אני, ממשיך</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.7}>
          <Text style={styles.declineBtnText}>זה לא אני</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a1a',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  iconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  greeting: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  name: {
    fontSize: 36,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 20,
    textAlign: 'center',
  },
  body: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  storyBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 28,
  },
  storyBadgeText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  notice: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 28,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  declineBtn: {
    paddingVertical: 12,
  },
  declineBtnText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
  },
});
