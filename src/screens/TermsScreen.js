import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useTranslation } from 'react-i18next';

const ACCENT = '#8446b0';

export const TermsScreen = () => {
  const { back } = useNav();
  const { i18n } = useTranslation();
  const isHe = i18n.language === 'he';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>{isHe ? 'תנאים ופרטיות' : 'Terms & Privacy'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>

        <Section title={isHe ? '1. השירות' : '1. The Service'}>
          <Body isHe={isHe}>
            {isHe
              ? 'RILIO היא אפליקציה לשיתוף סיפורים בווידיאו. יוצרים מצלמים סיפור אישי, מזמינים משתתפים להוסיף קליפים, ומקבלים סרטון גמר ערוך בינה מלאכותית.'
              : 'RILIO is a video storytelling app. Creators record a personal story, invite participants to add clips, and receive an AI-edited final video.'}
          </Body>
          <Body isHe={isHe}>
            {isHe
              ? 'השימוש באפליקציה מהווה הסכמה לתנאים אלה ולמדיניות הפרטיות.'
              : 'Using the app constitutes acceptance of these terms and the Privacy Policy.'}
          </Body>
        </Section>

        <Section title={isHe ? '2. תוכן המשתמש' : '2. User Content'}>
          <Body isHe={isHe}>
            {isHe
              ? 'אתה שומר על זכויות היוצרים בתכנים שאתה מצלם. בהעלאת תוכן לאפליקציה אתה מעניק ל-RILIO רישיון מוגבל לעבד, לאחסן ולהציג את התוכן לצורך מתן השירות בלבד.'
              : 'You retain ownership of content you create. By uploading content you grant RILIO a limited license to process, store, and display it solely to provide the service.'}
          </Body>
          <Body isHe={isHe}>
            {isHe
              ? 'אינך רשאי להעלות תוכן שמפר זכויות יוצרים של אחרים, תוכן פוגעני, אלים, או תוכן המערב קטינים ללא הסכמת הורה.'
              : 'You may not upload content that infringes third-party copyright, is offensive or violent, or involves minors without parental consent.'}
          </Body>
        </Section>

        <Section title={isHe ? '3. אחריות על גיבוי תכנים' : '3. Content & Storage Responsibility'}>
          <Highlight>
            <Body isHe={isHe} bold>
              {isHe
                ? 'RILIO אינה אחראית לאובדן, פגיעה, או מחיקה של סרטונים ותכנים. היוצרים אחראים לבדם לשמור עותקי גיבוי של כל תוכן שברצונם לשמר.'
                : 'RILIO is not liable for loss, corruption, or deletion of videos or content. Creators are solely responsible for maintaining backup copies of any content they wish to preserve.'}
            </Body>
          </Highlight>
          <Body isHe={isHe}>
            {isHe
              ? 'אובדן תוכן עלול להיגרם מסיבות שאינן בשליטתנו, כולל: תקלות טכניות, מחיקת חשבון, שינויי מדיניות של ספקי אחסון צד-שלישי (Firebase / Google Cloud Storage), או אירועי כוח עליון. RILIO אינה מתחייבת לאחסון קבוע של תכנים.'
              : 'Content loss may result from causes beyond our control, including: technical failures, account deletion, policy changes by third-party storage providers (Firebase / Google Cloud Storage), or force-majeure events. RILIO does not guarantee permanent cloud storage.'}
          </Body>
        </Section>

        <Section title={isHe ? '4. פרטיות' : '4. Privacy'}>
          <Body isHe={isHe}>
            {isHe
              ? 'אנו אוספים את המידע המינימלי הנדרש למתן השירות: פרטי חשבון, סרטונים שהועלו, ואירועי שימוש אנונימיים.'
              : 'We collect the minimum data required to provide the service: account details, uploaded videos, and anonymous usage events.'}
          </Body>
          <Body isHe={isHe}>
            {isHe
              ? 'איננו מוכרים את המידע שלך לצדדים שלישיים. לפרטים המלאים ראה מדיניות הפרטיות שלנו:'
              : 'We do not sell your data to third parties. For full details see our Privacy Policy:'}
          </Body>
          <TouchableOpacity onPress={() => Linking.openURL('https://rilio.io/privacy')} style={styles.link}>
            <Text style={styles.linkText}>rilio.io/privacy</Text>
            <Ionicons name="open-outline" size={14} color={ACCENT} />
          </TouchableOpacity>
        </Section>

        <Section title={isHe ? '5. הגבלת אחריות' : '5. Limitation of Liability'}>
          <Body isHe={isHe}>
            {isHe
              ? 'RILIO מסופקת "כמות שהיא" (AS IS). בשום מקרה לא תישא RILIO באחריות לנזקים עקיפים, מקריים, או תוצאתיים הנובעים משימוש או אי-יכולת שימוש בשירות.'
              : 'RILIO is provided "as is". In no event shall RILIO be liable for indirect, incidental, or consequential damages arising from use or inability to use the service.'}
          </Body>
        </Section>

        <Section title={isHe ? '6. גיל מינימום' : '6. Minimum Age'}>
          <Body isHe={isHe}>
            {isHe
              ? 'השירות מיועד למשתמשים בני 13 ומעלה. משתמשים מתחת לגיל 18 זקוקים להסכמת הורה.'
              : 'The service is intended for users aged 13 and above. Users under 18 require parental consent.'}
          </Body>
        </Section>

        <Section title={isHe ? '7. יצירת קשר' : '7. Contact'}>
          <Body isHe={isHe}>
            {isHe ? 'לשאלות ופניות:' : 'For questions and requests:'}
          </Body>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:privacy@rilio.io')} style={styles.link}>
            <Ionicons name="mail-outline" size={14} color={ACCENT} />
            <Text style={styles.linkText}>privacy@rilio.io</Text>
          </TouchableOpacity>
        </Section>

        <Text style={styles.lastUpdated}>
          {isHe ? 'עודכן לאחרונה: יולי 2026 · RILIO v1.0' : 'Last updated: July 2026 · RILIO v1.0'}
        </Text>
      </ScrollView>
    </View>
  );
};

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Body = ({ children, isHe, bold }) => (
  <Text style={[styles.body, bold && { fontWeight: '600', color: '#1a1a2e' }]}
    textAlign={isHe ? 'right' : 'left'}>
    {children}
  </Text>
);

const Highlight = ({ children }) => (
  <View style={styles.highlight}>{children}</View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 54,
    backgroundColor: ACCENT,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: 'white' },
  placeholder: { width: 40 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  section: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 8,
  },
  highlight: {
    backgroundColor: '#fff8f0',
    borderLeftWidth: 3,
    borderLeftColor: '#c0622a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  linkText: {
    fontSize: 14,
    color: ACCENT,
    textDecorationLine: 'underline',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
