/**
 * Web Recording Page Template
 * Allows participants to record video clips directly in the browser — no app required.
 * Uses Firebase JS SDK (CDN) to upload directly to Firebase Storage.
 *
 * Language is driven by story.language (from Firestore).
 * To add a new language: add an entry to WEB_TRANSLATIONS below.
 */

const WEB_TRANSLATIONS = {
  he: {
    dir: 'rtl',
    htmlLang: 'he',
    pageTitle: 'צלם שיקוף — {storyName}',
    invitedBy: 'הוזמנת על ידי {creatorName}',
    recordYourReflection: 'צלם את השיקוף שלך',
    music: 'מוזיקה',
    musicWithSong: '🎤 שיר עם מוזיקה',
    noMusic: '🔇 ללא מוזיקה',
    instructionsFromCreator: '📋 הוראות מהיוצר',
    watchVideoFirst: 'צפה בסרטון לפני ההקלטה',
    readInstructionsFirst: 'קרא את ההוראות לפני ההקלטה',
    watchToContinue: '▶ צפה בסרטון כדי להמשיך',
    listenToContinue: '🔊 האזן להוראות כדי להמשיך',
    understood: '✓ הבנתי — המשך להקלטה',
    watchHint: 'הלחצן יופעל אחרי שתצפה בסרטון',
    listenHint: 'הלחצן יופעל אחרי שתאזין להוראות',
    voiceInstructions: 'הוראות קוליות',
    tapToPlay: 'לחץ להשמעה',
    welcome: 'ברוך הבא!',
    namePlaceholder: 'השם שלך',
    continueBtn: 'המשך ▸',
    nameRequired: 'נא להזין שם',
    allowCamera: 'אפשר גישה למצלמה',
    cameraDesc: 'הדפדפן יבקש רשות לגשת למצלמה ולמיקרופון. לחץ "אפשר" כשתתבקש.',
    openCamera: 'פתח מצלמה',
    openingCamera: 'פותח מצלמה...',
    cameraError: 'לא ניתן לגשת למצלמה: {error}',
    clipLabel: 'קליפ {current} מתוך {total}',
    recording: 'מקליט',
    startRecording: '⏺ התחל הקלטה',
    stopRecording: '⏹ סיים הקלטה',
    preview: 'תצוגה מקדימה',
    previewClip: 'תצוגה מקדימה — קליפ {num}',
    saveClip: 'שמור קליפ זה ✓',
    reRecord: 'צלם שוב ↩',
    uploading: 'מעלה...',
    uploadingClip: 'קליפ {current} מתוך {total}',
    uploadError: 'שגיאה בהעלאה',
    uploadErrorDetail: 'שגיאה: {error}',
    retry: 'נסה שוב',
    noMusicFound: 'לא נמצאה מוזיקה לסיפור זה.',
    networkError: 'שגיאת רשת — בדוק חיבור אינטרנט',
    uploadUrlError: 'שגיאה בקבלת כתובת העלאה ({status})',
    saveClipError: 'שגיאה בשמירת הקליפ ({status})',
    uploadErrorStatus: 'שגיאת העלאה {status}',
    watchedContinue: '✓ ראיתי — המשך להקלטה',
    listenedContinue: '✓ שמעתי — המשך להקלטה',
    continueSuffix: '✓ המשך להקלטה',
    thanks: 'תודה!',
    creator: 'היוצר',
    wantToSee: 'רוצה לראות את התוצאה?',
    downloadDesc: 'הורד את Reflectly וצפה בסרטון המוגמר:',
    iphone: '📱 iPhone — App Store',
    android: '🤖 אנדרואיד — Google Play',
    consentTitle: 'הסכמה להשתתפות',
    consentPlatformLabel: 'קראתי ואני מסכים לתנאי השימוש',
    consentProjectLabel: 'אני מסכים/ה להשתתף בסרט זה',
    consentPublicRequired: 'יוצר הסרט מבקש שתסכים לפרסום ברשתות החברתיות',
    consentPublicLabel: 'אני מסכים/ה לפרסום ברשתות החברתיות',
    consentApprove: '✓ אני מסכים/ה — בואו נתחיל!',
    consentDecline: 'לא יכול/ה להשתתף',
    consentDeclinedTitle: 'תודה על הכנות',
    consentDeclinedBody: 'הודענו ליוצר שאינך יכול להשתתף בגלל דרישות הפרסום.',
  },
  en: {
    dir: 'ltr',
    htmlLang: 'en',
    pageTitle: 'Record your reflection — {storyName}',
    invitedBy: 'Invited by {creatorName}',
    recordYourReflection: 'Record your reflection',
    music: 'Music',
    musicWithSong: '🎤 Sing with music',
    noMusic: '🔇 No music',
    instructionsFromCreator: '📋 Instructions from creator',
    watchVideoFirst: 'Watch the video before recording',
    readInstructionsFirst: 'Read the instructions before recording',
    watchToContinue: '▶ Watch the video to continue',
    listenToContinue: '🔊 Listen to continue',
    understood: '✓ Got it — continue to recording',
    watchHint: 'Button activates after you watch the video',
    listenHint: 'Button activates after you listen to the instructions',
    voiceInstructions: 'Voice instructions',
    tapToPlay: 'Tap to play',
    welcome: 'Welcome!',
    namePlaceholder: 'Your name',
    continueBtn: 'Continue ▸',
    nameRequired: 'Please enter your name',
    allowCamera: 'Allow camera access',
    cameraDesc: 'The browser will ask for camera and microphone access. Click "Allow" when prompted.',
    openCamera: 'Open camera',
    openingCamera: 'Opening camera...',
    cameraError: 'Cannot access camera: {error}',
    clipLabel: 'Clip {current} of {total}',
    recording: 'Recording',
    startRecording: '⏺ Start recording',
    stopRecording: '⏹ Stop recording',
    preview: 'Preview',
    previewClip: 'Preview — clip {num}',
    saveClip: 'Save this clip ✓',
    reRecord: 'Record again ↩',
    uploading: 'Uploading...',
    uploadingClip: 'Clip {current} of {total}',
    uploadError: 'Upload error',
    uploadErrorDetail: 'Error: {error}',
    retry: 'Try again',
    noMusicFound: 'No music found for this story.',
    networkError: 'Network error — check your internet connection',
    uploadUrlError: 'Error getting upload URL ({status})',
    saveClipError: 'Error saving clip ({status})',
    uploadErrorStatus: 'Upload error {status}',
    watchedContinue: '✓ Watched — continue to recording',
    listenedContinue: '✓ Listened — continue to recording',
    continueSuffix: '✓ Continue to recording',
    thanks: 'Thank you!',
    creator: 'the creator',
    wantToSee: 'Want to see the result?',
    downloadDesc: 'Download Reflectly and watch the finished video:',
    iphone: '📱 iPhone — App Store',
    android: '🤖 Android — Google Play',
    consentTitle: 'Consent to participate',
    consentPlatformLabel: 'I have read and agree to the terms of use',
    consentProjectLabel: 'I agree to participate in this story',
    consentPublicRequired: 'The creator requests consent for social media sharing',
    consentPublicLabel: 'I agree to public sharing on social media',
    consentApprove: '✓ I agree — Let\'s go!',
    consentDecline: 'Can\'t participate',
    consentDeclinedTitle: 'Thank you for your honesty',
    consentDeclinedBody: 'We notified the creator that you can\'t participate due to publishing requirements.',
  },
  fr: {
    dir: 'ltr',
    htmlLang: 'fr',
    pageTitle: 'Enregistrez votre reflet — {storyName}',
    invitedBy: 'Invité par {creatorName}',
    recordYourReflection: 'Enregistrez votre reflet',
    music: 'Musique',
    musicWithSong: '🎤 Chanter avec musique',
    noMusic: '🔇 Sans musique',
    instructionsFromCreator: '📋 Instructions du créateur',
    watchVideoFirst: 'Regardez la vidéo avant d\'enregistrer',
    readInstructionsFirst: 'Lisez les instructions avant d\'enregistrer',
    watchToContinue: '▶ Regardez la vidéo pour continuer',
    listenToContinue: '🔊 Écoutez pour continuer',
    understood: '✓ Compris — continuer à l\'enregistrement',
    watchHint: 'Le bouton s\'activera après avoir regardé la vidéo',
    listenHint: 'Le bouton s\'activera après avoir écouté les instructions',
    voiceInstructions: 'Instructions vocales',
    tapToPlay: 'Appuyez pour écouter',
    welcome: 'Bienvenue !',
    namePlaceholder: 'Votre nom',
    continueBtn: 'Continuer ▸',
    nameRequired: 'Veuillez entrer votre nom',
    allowCamera: 'Autoriser l\'accès à la caméra',
    cameraDesc: 'Le navigateur demandera l\'accès à votre caméra et microphone. Cliquez sur "Autoriser".',
    openCamera: 'Ouvrir la caméra',
    openingCamera: 'Ouverture de la caméra...',
    cameraError: 'Impossible d\'accéder à la caméra : {error}',
    clipLabel: 'Clip {current} sur {total}',
    recording: 'Enregistrement',
    startRecording: '⏺ Commencer l\'enregistrement',
    stopRecording: '⏹ Arrêter l\'enregistrement',
    preview: 'Aperçu',
    previewClip: 'Aperçu — clip {num}',
    saveClip: 'Enregistrer ce clip ✓',
    reRecord: 'Recommencer ↩',
    uploading: 'Chargement...',
    uploadingClip: 'Clip {current} sur {total}',
    uploadError: 'Erreur de chargement',
    uploadErrorDetail: 'Erreur : {error}',
    retry: 'Réessayer',
    noMusicFound: 'Aucune musique trouvée pour cette histoire.',
    networkError: 'Erreur réseau — vérifiez votre connexion',
    uploadUrlError: 'Erreur d\'obtention de l\'URL ({status})',
    saveClipError: 'Erreur lors de la sauvegarde ({status})',
    uploadErrorStatus: 'Erreur de chargement {status}',
    watchedContinue: '✓ Vu — continuer à l\'enregistrement',
    listenedContinue: '✓ Écouté — continuer à l\'enregistrement',
    continueSuffix: '✓ Continuer à l\'enregistrement',
    thanks: 'Merci !',
    creator: 'le créateur',
    wantToSee: 'Vous voulez voir le résultat ?',
    downloadDesc: 'Téléchargez Reflectly et regardez la vidéo finale :',
    iphone: '📱 iPhone — App Store',
    android: '🤖 Android — Google Play',
    consentTitle: 'Consentement pour participer',
    consentPlatformLabel: 'J\'ai lu et j\'accepte les conditions d\'utilisation',
    consentProjectLabel: 'J\'accepte de participer à cette histoire',
    consentPublicRequired: 'Le créateur demande votre accord pour le partage sur les réseaux sociaux',
    consentPublicLabel: 'J\'accepte le partage public sur les réseaux sociaux',
    consentApprove: '✓ J\'accepte — C\'est parti !',
    consentDecline: 'Je ne peux pas participer',
    consentDeclinedTitle: 'Merci pour votre honnêteté',
    consentDeclinedBody: 'Nous avons informé le créateur que vous ne pouvez pas participer en raison des exigences de publication.',
  },
  es: {
    dir: 'ltr',
    htmlLang: 'es',
    pageTitle: 'Graba tu reflejo — {storyName}',
    invitedBy: 'Invitado por {creatorName}',
    recordYourReflection: 'Graba tu reflejo',
    music: 'Música',
    musicWithSong: '🎤 Cantar con música',
    noMusic: '🔇 Sin música',
    instructionsFromCreator: '📋 Instrucciones del creador',
    watchVideoFirst: 'Ve el video antes de grabar',
    readInstructionsFirst: 'Lee las instrucciones antes de grabar',
    watchToContinue: '▶ Ve el video para continuar',
    listenToContinue: '🔊 Escucha para continuar',
    understood: '✓ Entendido — continuar a grabación',
    watchHint: 'El botón se activará después de ver el video',
    listenHint: 'El botón se activará después de escuchar las instrucciones',
    voiceInstructions: 'Instrucciones de voz',
    tapToPlay: 'Toca para reproducir',
    welcome: '¡Bienvenido!',
    namePlaceholder: 'Tu nombre',
    continueBtn: 'Continuar ▸',
    nameRequired: 'Por favor ingresa tu nombre',
    allowCamera: 'Permitir acceso a la cámara',
    cameraDesc: 'El navegador pedirá permiso para acceder a tu cámara y micrófono. Haz clic en "Permitir".',
    openCamera: 'Abrir cámara',
    openingCamera: 'Abriendo cámara...',
    cameraError: 'No se puede acceder a la cámara: {error}',
    clipLabel: 'Clip {current} de {total}',
    recording: 'Grabando',
    startRecording: '⏺ Iniciar grabación',
    stopRecording: '⏹ Detener grabación',
    preview: 'Vista previa',
    previewClip: 'Vista previa — clip {num}',
    saveClip: 'Guardar este clip ✓',
    reRecord: 'Grabar de nuevo ↩',
    uploading: 'Subiendo...',
    uploadingClip: 'Clip {current} de {total}',
    uploadError: 'Error de subida',
    uploadErrorDetail: 'Error: {error}',
    retry: 'Intentar de nuevo',
    noMusicFound: 'No se encontró música para esta historia.',
    networkError: 'Error de red — verifica tu conexión',
    uploadUrlError: 'Error al obtener URL de subida ({status})',
    saveClipError: 'Error al guardar el clip ({status})',
    uploadErrorStatus: 'Error de subida {status}',
    watchedContinue: '✓ Visto — continuar a grabación',
    listenedContinue: '✓ Escuchado — continuar a grabación',
    continueSuffix: '✓ Continuar a grabación',
    thanks: '¡Gracias!',
    creator: 'el creador',
    wantToSee: '¿Quieres ver el resultado?',
    downloadDesc: 'Descarga Reflectly y mira el video terminado:',
    iphone: '📱 iPhone — App Store',
    android: '🤖 Android — Google Play',
    consentTitle: 'Consentimiento para participar',
    consentPlatformLabel: 'He leído y acepto los términos de uso',
    consentProjectLabel: 'Acepto participar en esta historia',
    consentPublicRequired: 'El creador solicita su consentimiento para compartir en redes sociales',
    consentPublicLabel: 'Acepto el uso público en redes sociales',
    consentApprove: '✓ Acepto — ¡Vamos!',
    consentDecline: 'No puedo participar',
    consentDeclinedTitle: 'Gracias por tu honestidad',
    consentDeclinedBody: 'Notificamos al creador que no puedes participar debido a los requisitos de publicación.',
  },
};

function buildWebRecordHtml(story, firebaseConfig, invitationContext = null) {
  const {
    id: storyId,
    name: storyName,
    creatorName,
    clipCount,
    maxClipDuration,
    instructions,
    videoUri,
    instructionAudioUrl,
    musicUrl,
    musicTrackId,
    hasMusic,
    musicName,
    lockedSet,
    language,
    allowSocialMedia,
  } = story;

  const lang = language || 'en';
  const T = WEB_TRANSLATIONS[lang] || WEB_TRANSLATIONS.en;
  const dir = T.dir;

  // Simple interpolation helper (server-side only)
  const ti = (key, vars = {}) => {
    let s = T[key] || key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };

  // Welcome description (needs plural logic per language)
  const welcomeDesc = lang === 'he'
    ? `תצלם ${clipCount} קליפ${clipCount > 1 ? 'ים קצרים' : ' קצר'} ישירות מהדפדפן — ללא צורך בהתקנת אפליקציה.`
    : lang === 'fr'
      ? `Vous allez enregistrer ${clipCount} clip${clipCount > 1 ? 's' : ''} court${clipCount > 1 ? 's' : ''} directement dans le navigateur — aucune application requise.`
      : lang === 'es'
        ? `Grabarás ${clipCount} clip${clipCount > 1 ? 's' : ''} corto${clipCount > 1 ? 's' : ''} directamente en el navegador — sin necesidad de instalar una aplicación.`
        : `You'll record ${clipCount} short clip${clipCount !== 1 ? 's' : ''} directly in the browser — no app needed.`;

  const thanksDesc = lang === 'he'
    ? `השיקוף שלך הועלה בהצלחה.<br>הוא יופיע בסרטון הסופי של ${escHtml(creatorName || T.creator)}.`
    : lang === 'fr'
      ? `Votre reflet a été chargé avec succès.<br>Il apparaîtra dans la vidéo finale de ${escHtml(creatorName || T.creator)}.`
      : lang === 'es'
        ? `Tu reflejo se subió con éxito.<br>Aparecerá en el video final de ${escHtml(creatorName || T.creator)}.`
        : `Your reflection was uploaded successfully.<br>It will appear in ${escHtml(creatorName || T.creator)}'s final video.`;

  const musicPanelHtml = hasMusic ? `
    <div class="music-panel" id="music-panel">
      <div class="music-panel-header">
        <span>&#127925;</span>
        <span class="music-panel-name">${escHtml(musicName || T.music)}</span>
        <button class="music-preview-btn" id="preview-btn" onclick="toggleMusicPreview()">&#9654;</button>
      </div>
      <div class="music-mode-btns">
        <button class="music-mode-btn" id="btn-performance" onclick="setMusicMode('performance')">${T.musicWithSong}<span class="music-mode-note">(דורש אוזניה בהקלטה)</span></button>
        <button class="music-mode-btn active" id="btn-none" onclick="setMusicMode('none')">${T.noMusic}</button>
      </div>
    </div>` : '';

  const APP_STORE_URL = 'https://apps.apple.com/app/reflectly/id0000000000'; // TODO: update after publish
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reflectly.app';

  // Inject translations into the page for use in inline JS
  const T_JSON = JSON.stringify(T);

  return `<!DOCTYPE html>
<html lang="${T.htmlLang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${ti('pageTitle', { storyName: escHtml(storyName) })}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --accent: #5ab4cc;
      --pink: #5ab4cc;
      --purple: #3d8fa8;
      --bg: #040c18;
      --card: rgba(38, 40, 50, 0.96);
      --text: #fff;
      --sub: rgba(200,155,70,0.75);
      --radius: 16px;
    }
    html, body {
      height: 100%;
      font-family: Arial, sans-serif;
      color: var(--text);
      background: #040c18 url('/assets/Home-%20beckground.jpg.jpg') center/cover no-repeat fixed;
    }
    body { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100%; padding: 0; }

    /* Header */
    .header {
      width: 100%;
      background: rgba(38, 40, 50, 0.97);
      border-bottom: 1px solid rgba(200,155,70,0.15);
      padding: 18px 24px 14px;
      text-align: center;
      display: flex; flex-direction: column; align-items: center;
    }
    .header-logo { height: 40px; opacity: 0.95; margin-bottom: 8px; }
    .header h1 { font-size: 20px; font-weight: 700; color: rgba(228,180,85,0.90); line-height: 1.3; }
    .header p { font-size: 14px; color: rgba(200,155,70,0.60); margin-top: 4px; }

    /* Steps */
    @keyframes stepIn {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .step { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 420px; padding: 24px 20px; }
    .step.active { display: flex; animation: stepIn 0.7s ease forwards; animation-delay: 1s; opacity: 0; }

    .card { background: var(--card); border: 1px solid rgba(200,155,70,0.12); border-radius: var(--radius); padding: 24px; width: 100%; margin-bottom: 16px; }
    .card h2 { font-size: 19px; color: rgba(228,180,85,0.90); margin-bottom: 8px; }
    .card p { font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.6; margin-bottom: 16px; }

    input[type="text"] {
      width: 100%; border: 2px solid rgba(200,155,70,0.25); border-radius: 10px;
      padding: 14px 16px; font-size: 16px; outline: none; background: rgba(255,255,255,0.07); color: #fff;
      transition: border-color 0.2s; margin-bottom: 16px; text-align: ${dir === 'rtl' ? 'right' : 'left'};
    }
    input[type="text"]:focus { border-color: var(--accent); }

    button, a.btn {
      display: block; width: 100%; padding: 15px; border-radius: 12px;
      font-size: 16px; font-weight: bold; border: none; cursor: pointer;
      text-align: center; text-decoration: none; margin-bottom: 10px; transition: opacity 0.2s;
    }
    button:active, a.btn:active { opacity: 0.8; }
    .btn-primary { background: linear-gradient(135deg, #7ecfe0 0%, #5ab4cc 100%); color: #040c18; box-shadow: 0 4px 20px rgba(94,190,218,0.35); }
    .btn-secondary { background: rgba(90,180,204,0.15); color: #7ecfe0; }
    .btn-outline { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.60); border: 1.5px solid rgba(200,155,70,0.20); }
    .btn-ios { background: #000; color: white; }
    .btn-android { background: #3DDC84; color: #000; }
    button:disabled { opacity: 0.4; cursor: default; }

    /* Camera */
    .camera-wrap { position: relative; width: 100%; background: #000; border-radius: var(--radius); overflow: hidden; aspect-ratio: 9/16; margin-bottom: 16px; max-height: 55vh; }
    #preview, #review-video { width: 100%; height: 100%; object-fit: cover; display: block; }
    #preview { transform: scaleX(-1); } /* mirror front camera like selfie */
    .rec-badge { position: absolute; top: 12px; right: 12px; background: #ef4444; color: white; border-radius: 20px; padding: 4px 12px; font-size: 13px; font-weight: bold; display: none; align-items: center; gap: 6px; }
    .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: white; animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    .timer-badge { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: white; border-radius: 20px; padding: 4px 14px; font-size: 14px; font-weight: bold; }
    .countdown-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .countdown-num { color: white; font-size: 80px; font-weight: bold; animation: countpop 0.8s ease; }
    @keyframes countpop { 0%{transform:scale(1.4)} 100%{transform:scale(1)} }

    /* Clip indicator */
    .clip-dots { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
    .clip-dot { width: 10px; height: 10px; border-radius: 50%; background: #e5e7eb; }
    .clip-dot.done { background: var(--pink); }
    .clip-dot.current { background: var(--pink); box-shadow: 0 0 0 3px rgba(255,107,157,0.3); }

    /* Progress */
    .progress-wrap { width: 100%; background: #e5e7eb; border-radius: 99px; height: 8px; overflow: hidden; margin: 12px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--pink), var(--purple)); border-radius: 99px; transition: width 0.3s; width: 0%; }

    /* Spinner */
    .spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: var(--pink); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 24px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .emoji-big { font-size: 64px; text-align: center; margin: 16px 0; }
    .clip-label { font-size: 14px; color: var(--sub); text-align: center; margin-bottom: 8px; }
    .instructions-box { background: #fef9c3; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; font-size: 14px; color: #78350f; line-height: 1.6; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
    .error-msg { color: #ef4444; font-size: 13px; text-align: center; margin: 8px 0; min-height: 20px; }

    /* Music mode panel */
    .music-panel { background: rgba(38,40,50,0.96); border-radius: 14px; border: 1px solid rgba(200,155,70,0.15); margin-bottom: 12px; width: 100%; overflow: hidden; padding: 10px 14px; }
    .music-panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .music-panel-name { flex: 1; font-size: 13px; font-weight: 700; color: rgba(200,155,70,0.85); }
    .music-preview-btn { width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(90,180,204,0.15); color: #7ecfe0; font-size: 14px; cursor: pointer; flex-shrink: 0; }
    .music-preview-btn.playing { background: #5ab4cc; color: #040c18; }
    .music-mode-btns { display: flex; gap: 8px; }
    .music-mode-btn { flex: 1; padding: 9px 6px; border-radius: 10px; border: 1.5px solid rgba(200,155,70,0.20); background: rgba(255,255,255,0.05); font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.70); cursor: pointer; text-align: center; line-height: 1.4; }
    .music-mode-btn.active { background: linear-gradient(135deg,#7ecfe0,#5ab4cc); color: #040c18; border-color: #5ab4cc; }
    .music-mode-note { display: block; font-size: 10px; font-weight: 400; opacity: 0.75; margin-top: 3px; }

    /* Consent step */
    .consent-check { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; cursor: pointer; }
    .consent-check input[type="checkbox"] { width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px; accent-color: var(--purple); }
    .consent-check span { font-size: 14px; color: var(--text); line-height: 1.5; }
    .consent-required-badge { display: inline-block; background: #fff3e0; color: #e65100; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
    .consent-declined-card { text-align: center; padding: 32px 20px; }
    .consent-declined-card .emoji-big { margin-bottom: 12px; }

    /* ── Dark water screens (upload + done) ─────────────────── */
    .dark-step.active {
      position: fixed; inset: 0; z-index: 200;
      overflow-y: auto;
    }
    .dark-bg {
      position: fixed; inset: 0;
      background: url('/assets/Home-%20beckground.jpg.jpg') center/cover no-repeat;
      z-index: 0;
    }
    .dark-bg::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(4,12,24,0.60) 0%, rgba(4,12,24,0.88) 60%, rgba(4,12,24,0.97) 100%);
    }
    .dark-content {
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 100vh;
      padding: 48px 28px 60px; text-align: center; color: #fff;
    }

    /* Ripple animation */
    .ripple-container { position: relative; width: 96px; height: 96px; margin: 0 auto 36px; flex-shrink: 0; }
    .ripple-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 2px solid rgba(126,207,224,0.55);
      animation: ripple-out 2.1s ease-out infinite;
    }
    .ripple-ring:nth-child(2) { animation-delay: 0.70s; }
    .ripple-ring:nth-child(3) { animation-delay: 1.40s; }
    .ripple-core {
      position: absolute; inset: 30%;
      background: rgba(126,207,224,0.85); border-radius: 50%;
    }
    @keyframes ripple-out {
      0%   { transform: scale(0.35); opacity: 0.85; }
      100% { transform: scale(2.60); opacity: 0; }
    }

    /* Upload text */
    .upload-title { font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #fff; }
    .upload-sub   { font-size: 14px; color: rgba(255,255,255,0.55); margin-bottom: 20px; }
    .dark-progress-wrap { width: 240px; background: rgba(255,255,255,0.12); border-radius: 99px; height: 4px; overflow: hidden; margin: 0 auto 8px; }
    .dark-progress-fill { height: 100%; background: linear-gradient(90deg, #7ecfe0, #5ab4cc); border-radius: 99px; transition: width 0.3s; width: 0%; }
    .dark-pct { font-size: 12px; color: rgba(255,255,255,0.35); }

    /* Done screen */
    .done-logo { height: 28px; opacity: 0.70; margin-bottom: 48px; }
    .done-check { font-size: 52px; margin-bottom: 20px; }
    .done-title { font-size: 26px; font-weight: 700; margin-bottom: 10px; color: #fff; }
    .done-desc  { font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.7; margin-bottom: 44px; max-width: 280px; }
    .done-cta-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 14px; }
    .done-btn {
      display: block; width: 100%; max-width: 280px; padding: 14px 20px;
      border-radius: 12px; font-size: 15px; font-weight: 700; text-decoration: none;
      text-align: center; margin: 0 auto 10px;
    }
    .done-btn-ios { background: #fff; color: #000; }
    .done-btn-android { background: #3ddc84; color: #000; }
  </style>
</head>
<body>
  <div class="header">
    <img class="header-logo" src="/assets/rilio-logo-primary.png.png" alt="RILIO">
    <h1>${escHtml(storyName)}</h1>
    ${creatorName ? `<p>הוזמנת על ידי ${escHtml(creatorName)}</p>` : ''}
  </div>

  <!-- Step consent: shown only for invitation-based web access -->
  <div id="step-consent" class="step${invitationContext ? ' active' : ''}">
    <div class="card" id="consent-form-card">
      <h2>${T.consentTitle}</h2>
      ${invitationContext?.requiresPublicConsent ? `<div class="consent-required-badge">${T.consentPublicRequired}</div>` : ''}
      <div style="margin: 16px 0;">
        <label class="consent-check">
          <input type="checkbox" id="check-platform" />
          <span>${T.consentPlatformLabel}</span>
        </label>
        <label class="consent-check">
          <input type="checkbox" id="check-project" />
          <span>${T.consentProjectLabel}</span>
        </label>
        ${invitationContext?.requiresPublicConsent ? `
        <label class="consent-check">
          <input type="checkbox" id="check-public" />
          <span>${T.consentPublicLabel}</span>
        </label>` : ''}
      </div>
      <button class="btn-primary" id="consent-approve-btn" onclick="handleConsentApprove()" disabled>${T.consentApprove}</button>
      <button class="btn-outline" onclick="handleConsentDecline()">${T.consentDecline}</button>
    </div>
    <div class="card consent-declined-card" id="consent-declined-card" style="display:none">
      <div class="emoji-big">🙏</div>
      <h2>${T.consentDeclinedTitle}</h2>
      <p>${T.consentDeclinedBody}</p>
    </div>
  </div>

  <!-- Step 0: Creator Instructions -->
  <div id="step-watch" class="step${!invitationContext && (videoUri || instructionAudioUrl || instructions) ? ' active' : ''}">
    <div style="width:100%; max-width:420px; padding:16px;">
      <div style="background:rgba(38,40,50,0.96); border-radius:14px; padding:14px 16px; margin-bottom:14px; border:1px solid rgba(200,155,70,0.15);">
        <p style="font-size:13px; font-weight:700; color:rgba(200,155,70,0.85); margin:0 0 6px;">${T.instructionsFromCreator}</p>
        <p style="font-size:14px; color:rgba(255,255,255,0.80); line-height:1.6; margin:0;">${escHtml(instructions || (videoUri ? T.watchVideoFirst : T.readInstructionsFirst))}</p>
      </div>
      <div style="background:rgba(38,40,50,0.96); border-radius:16px; border:1px solid rgba(200,155,70,0.12); overflow:hidden; margin-bottom:0; padding:14px; display:flex; flex-direction:column; gap:12px;">
        ${videoUri ? `
        <div style="position:relative; width:100%; background:#000; border-radius:10px; overflow:hidden;">
          <video id="creator-video" src="${escHtml(videoUri)}" playsinline controls preload="metadata" style="width:100%; display:block; max-height:52vh; object-fit:contain;"></video>
        </div>
        ` : ''}
        ${instructionAudioUrl ? `
        <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:14px; border:1px solid rgba(200,155,70,0.12); display:flex; align-items:center; gap:12px;">
          <button id="audio-play-btn" onclick="toggleInstructionAudio()" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7ecfe0,#5ab4cc);color:#040c18;border:none;font-size:22px;cursor:pointer;flex-shrink:0;">▶</button>
          <div style="flex:1;">
            <p style="font-size:13px;font-weight:700;color:rgba(200,155,70,0.85);margin:0 0 2px;">${T.voiceInstructions}</p>
            <p style="font-size:12px;color:rgba(200,155,70,0.50);margin:0;">${T.tapToPlay}</p>
          </div>
        </div>
        ` : ''}
        <button id="watch-continue-btn" class="btn-primary" onclick="watchContinue()" style="margin-bottom:0;"${(videoUri || instructionAudioUrl) ? ' disabled' : ''}>
          ${videoUri ? T.watchToContinue : instructionAudioUrl ? T.listenToContinue : T.understood}
        </button>
        ${(videoUri || instructionAudioUrl) ? `<p id="watch-hint" style="font-size:13px;color:rgba(200,155,70,0.50);text-align:center;margin:0;">${videoUri ? T.watchHint : T.listenHint}</p>` : ''}
      </div>
    </div>
  </div>

  <!-- Step 1: Welcome + Name -->
  <div id="step-welcome" class="step${(!invitationContext && !videoUri && !instructionAudioUrl && !instructions) ? ' active' : ''}">
    <div class="card">
      <h2>${T.welcome}</h2>
      <p>${welcomeDesc}</p>
      ${instructions ? `<div class="instructions-box">📋 ${escHtml(instructions)}</div>` : ''}
      <input type="text" id="name-input" placeholder="${T.namePlaceholder}" maxlength="40" />
      <div class="error-msg" id="name-error"></div>
      <button class="btn-primary" onclick="handleNameContinue()">${T.continueBtn}</button>
    </div>
  </div>

  <!-- Step 2: Camera permission -->
  <div id="step-camera" class="step">
    <div class="card" style="text-align:center">
      <div class="emoji-big">📷</div>
      <h2>${T.allowCamera}</h2>
      <p>${T.cameraDesc}</p>
      <div class="error-msg" id="cam-error"></div>
      <button class="btn-primary" id="cam-btn" onclick="initCamera()">${T.openCamera}</button>
    </div>
  </div>

  <!-- Step 3: Record -->
  <div id="step-record" class="step">
    <div class="clip-dots" id="clip-dots"></div>
    <p class="clip-label" id="clip-label"></p>
    ${musicPanelHtml}
    <div class="camera-wrap">
      <video id="preview" autoplay muted playsinline></video>
      <div class="rec-badge" id="rec-badge"><div class="rec-dot"></div> <span id="rec-label"></span></div>
      <div class="timer-badge" id="timer-badge" style="display:none">00:00</div>
      <div class="countdown-overlay" id="countdown-overlay" style="display:none">
        <div class="countdown-num" id="countdown-num">3</div>
      </div>
    </div>
    <div class="card" style="padding:16px; margin-top:8px;">
      <button class="btn-primary" id="start-btn" onclick="handleStartBtn()"></button>
      <button class="btn-outline" id="stop-btn" style="display:none" onclick="stopRecording()"></button>
      <div class="error-msg" id="rec-error"></div>
    </div>
  </div>

  <!-- Step 4: Review clip -->
  <div id="step-review" class="step">
    <p class="clip-label" id="review-label"></p>
    <div class="camera-wrap">
      <video id="review-video" controls playsinline></video>
    </div>
    <button class="btn-primary" onclick="confirmClip()"></button>
    <button class="btn-outline" onclick="reRecord()"></button>
  </div>

  <!-- Step 5: Uploading (dark water) -->
  <div id="step-upload" class="step dark-step">
    <div class="dark-bg"></div>
    <div class="dark-content">
      <div class="ripple-container">
        <div class="ripple-ring"></div>
        <div class="ripple-ring"></div>
        <div class="ripple-ring"></div>
        <div class="ripple-core"></div>
      </div>
      <h2 class="upload-title" id="upload-title"></h2>
      <p class="upload-sub" id="upload-sub"></p>
      <div class="dark-progress-wrap"><div class="dark-progress-fill" id="upload-progress"></div></div>
      <p class="dark-pct" id="upload-pct">0%</p>
    </div>
  </div>

  <!-- Step 6: Done (dark water emotional) -->
  <div id="step-done" class="step dark-step">
    <div class="dark-bg"></div>
    <div class="dark-content">
      <img class="done-logo" src="/assets/rilio-logo-primary.png.png" alt="RILIO">
      <div class="done-check">✨</div>
      <h2 class="done-title" id="done-title"></h2>
      <p class="done-desc" id="done-desc"></p>
      <p class="done-cta-label" id="done-cta-title"></p>
      <p class="done-desc" id="done-cta-desc" style="margin-bottom:20px;font-size:13px"></p>
      <a class="done-btn done-btn-ios" href="${APP_STORE_URL}" target="_blank">${T.iphone}</a>
      <a class="done-btn done-btn-android" href="${PLAY_STORE_URL}" target="_blank">${T.android}</a>
    </div>
  </div>

  <script type="module">
    // ── Translations (injected server-side) ────────────────────
    const _T = ${T_JSON};

    // Simple interpolation helper
    function t(key, vars) {
      let s = _T[key] || key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
      return s;
    }

    // ── Constants ──────────────────────────────────────────────
    const STORY_ID    = '${escJs(storyId)}';
    const CLIP_COUNT  = ${clipCount};
    const MAX_SEC     = ${maxClipDuration};
    const VIDEO_URI        = ${videoUri ? `'${escJs(videoUri)}'` : 'null'};
    const INSTRUCTION_AUDIO = ${instructionAudioUrl ? `'${escJs(instructionAudioUrl)}'` : 'null'};
    const webUid      = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

    // ── Invitation consent ─────────────────────────────────────
    const INVITATION_ID = ${invitationContext?.invitationId ? `'${escJs(invitationContext.invitationId)}'` : 'null'};
    const REQUIRES_PUBLIC_CONSENT = ${invitationContext?.requiresPublicConsent ? 'true' : 'false'};
    const API_BASE = '${escJs(process.env.EXPO_PUBLIC_API_URL || process.env.SERVER_DOMAIN ? `https://${process.env.SERVER_DOMAIN}` : 'https://reflectlymobilex.onrender.com')}';

    // Enable/disable approve button based on checkboxes
    function updateConsentBtn() {
      const platform = document.getElementById('check-platform')?.checked;
      const project  = document.getElementById('check-project')?.checked;
      const publicCb = document.getElementById('check-public');
      const publicOk = !REQUIRES_PUBLIC_CONSENT || (publicCb && publicCb.checked);
      const btn = document.getElementById('consent-approve-btn');
      if (btn) btn.disabled = !(platform && project && publicOk);
    }
    document.getElementById('check-platform')?.addEventListener('change', updateConsentBtn);
    document.getElementById('check-project')?.addEventListener('change', updateConsentBtn);
    document.getElementById('check-public')?.addEventListener('change', updateConsentBtn);

    window.handleConsentApprove = async function() {
      const publicCb = document.getElementById('check-public');
      const publicConsent = publicCb ? publicCb.checked : false;
      if (INVITATION_ID) {
        try {
          await fetch(API_BASE + '/api/invitations/' + INVITATION_ID + '/consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platformConsent: true,
              projectConsent: true,
              publicPublishingConsent: publicConsent,
              communityConsent: null,
              consentVersion: '1.0',
            }),
          });
        } catch (e) { /* non-fatal — proceed */ }
      }
      // Proceed to next step
      if (VIDEO_URI || INSTRUCTION_AUDIO || ${JSON.stringify(!!(instructions))}) {
        showStep('watch');
      } else {
        showStep('welcome');
      }
    };

    window.handleConsentDecline = async function() {
      try {
        if (INVITATION_ID) {
          await fetch(API_BASE + '/api/invitations/' + INVITATION_ID + '/decline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'publishing_conflict' }),
          });
        } else if (STORY_ID) {
          await fetch(API_BASE + '/api/story/' + STORY_ID + '/consent-decline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) { /* non-fatal */ }
      document.getElementById('consent-form-card').style.display = 'none';
      document.getElementById('consent-declined-card').style.display = 'block';
    };

    // ── Init static text that needs JS ────────────────────────
    document.getElementById('rec-label').textContent     = _T.recording;
    document.getElementById('start-btn').textContent     = _T.startRecording;
    document.getElementById('stop-btn').textContent      = _T.stopRecording;
    document.querySelector('#step-review button.btn-primary').textContent = _T.saveClip;
    document.querySelector('#step-review button.btn-outline').textContent = _T.reRecord;
    document.getElementById('upload-title').textContent  = _T.uploading;
    document.getElementById('done-title').textContent    = _T.thanks;
    document.getElementById('done-desc').innerHTML       = ${JSON.stringify(thanksDesc)};
    document.getElementById('done-cta-title').textContent = _T.wantToSee;
    document.getElementById('done-cta-desc').textContent  = _T.downloadDesc;

    // ── Creator Instructions Watch Step ─────────────────────────
    window.watchContinue = function() { showStep('welcome'); };

    const watchBtn    = document.getElementById('watch-continue-btn');
    const watchHintEl = document.getElementById('watch-hint');
    function unlockWatchBtn(label) {
      if (watchBtn) { watchBtn.disabled = false; watchBtn.textContent = label || _T.continueSuffix; }
      if (watchHintEl) watchHintEl.style.display = 'none';
    }

    if (VIDEO_URI) {
      const creatorVideo = document.getElementById('creator-video');
      if (creatorVideo) {
        creatorVideo.addEventListener('ended', () => unlockWatchBtn(_T.watchedContinue));
        creatorVideo.addEventListener('timeupdate', function() {
          if (creatorVideo.currentTime > 15) unlockWatchBtn(_T.watchedContinue);
        });
        creatorVideo.addEventListener('error', () => unlockWatchBtn(_T.continueSuffix));
      }
    }

    // ── Audio instructions ───────────────────────────────────────
    let instrAudio = null;
    let instrAudioPlayed = false;
    window.toggleInstructionAudio = function() {
      const btn = document.getElementById('audio-play-btn');
      if (!INSTRUCTION_AUDIO) return;
      if (instrAudio && !instrAudio.paused) {
        instrAudio.pause();
        if (btn) btn.textContent = '▶';
        return;
      }
      if (!instrAudio) {
        instrAudio = new Audio(INSTRUCTION_AUDIO);
        instrAudio.addEventListener('ended', () => {
          if (btn) btn.textContent = '↩';
          if (!instrAudioPlayed) {
            instrAudioPlayed = true;
            unlockWatchBtn(_T.listenedContinue);
          }
        });
        instrAudio.addEventListener('timeupdate', function() {
          if (instrAudio.currentTime > 10 && !instrAudioPlayed) {
            instrAudioPlayed = true;
            unlockWatchBtn(_T.listenedContinue);
          }
        });
        instrAudio.addEventListener('error', () => unlockWatchBtn(_T.continueSuffix));
      }
      instrAudio.play().catch(() => unlockWatchBtn(_T.continueSuffix));
      if (btn) btn.textContent = '⏸';
    };

    // ── Music ──────────────────────────────────────────────────
    const MUSIC_URL = ${musicUrl ? `'${escJs(musicUrl)}'` : 'null'};
    let musicMode = 'none';
    let previewAudio = null;

    // ── State ──────────────────────────────────────────────────
    let participantName = '';
    let currentClipIdx  = 0;
    let recordedBlobs   = [];
    let stream          = null;
    let mediaRecorder   = null;
    let chunks          = [];
    let timerInterval   = null;
    let elapsedSec      = 0;
    let ambientAudio    = null;

    // ── Music mode ─────────────────────────────────────────────
    window.setMusicMode = function(mode) {
      musicMode = mode;
      document.getElementById('btn-performance')?.classList.toggle('active', mode === 'performance');
      document.getElementById('btn-none')?.classList.toggle('active', mode === 'none');
      if (mode !== 'performance') stopPreview();
    };

    window.toggleMusicPreview = function() {
      if (!MUSIC_URL) return;
      if (previewAudio) { stopPreview(); return; }
      previewAudio = new Audio(MUSIC_URL);
      previewAudio.volume = 0.4;
      previewAudio.loop = true;
      previewAudio.play().catch(() => {});
      const btn = document.getElementById('preview-btn');
      if (btn) { btn.textContent = '⏹'; btn.classList.add('playing'); }
    };

    function stopPreview() {
      if (previewAudio) { previewAudio.pause(); previewAudio = null; }
      const btn = document.getElementById('preview-btn');
      if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
    }

    window.playMusic = function() {
      if (!MUSIC_URL) { alert(_T.noMusicFound); return; }
      if (ambientAudio) { ambientAudio.pause(); ambientAudio = null; }
      ambientAudio = new Audio(MUSIC_URL);
      ambientAudio.loop = true;
      ambientAudio.volume = 0.15;
      ambientAudio.play().catch(e => alert(t('uploadErrorDetail', { error: e.name + ': ' + e.message })));
    };

    window.stopMusic = function() {
      if (ambientAudio) { ambientAudio.pause(); ambientAudio = null; }
    };

    // ── Step navigation ────────────────────────────────────────
    function showStep(id) {
      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      document.getElementById('step-' + id).classList.add('active');
      // Lock body scroll when dark-water screens are shown (they use position:fixed)
      document.body.style.overflow = (id === 'upload' || id === 'done') ? 'hidden' : '';
      window.scrollTo(0, 0);
    }

    // ── Step 1: Name ───────────────────────────────────────────
    window.handleNameContinue = function() {
      const val = document.getElementById('name-input').value.trim();
      if (!val) {
        document.getElementById('name-error').textContent = _T.nameRequired;
        return;
      }
      participantName = val;
      document.getElementById('name-error').textContent = '';
      buildClipDots();
      showStep('camera');
    };

    // ── Step 2: Camera permission ──────────────────────────────
    window.initCamera = async function() {
      const btn = document.getElementById('cam-btn');
      btn.disabled = true;
      btn.textContent = _T.openingCamera;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        document.getElementById('preview').srcObject = stream;
        showStep('record');
        updateClipUI();
      } catch (e) {
        document.getElementById('cam-error').textContent = t('cameraError', { error: e.message });
        btn.disabled = false;
        btn.textContent = _T.retry;
      }
    };

    // ── Clip dots ──────────────────────────────────────────────
    function buildClipDots() {
      const wrap = document.getElementById('clip-dots');
      wrap.innerHTML = '';
      for (let i = 0; i < CLIP_COUNT; i++) {
        const d = document.createElement('div');
        d.className = 'clip-dot';
        d.id = 'dot-' + i;
        wrap.appendChild(d);
      }
    }

    function updateClipUI() {
      document.getElementById('clip-label').textContent =
        t('clipLabel', { current: currentClipIdx + 1, total: CLIP_COUNT });
      for (let i = 0; i < CLIP_COUNT; i++) {
        const d = document.getElementById('dot-' + i);
        d.className = 'clip-dot' + (i < currentClipIdx ? ' done' : i === currentClipIdx ? ' current' : '');
      }
      stopMusic();
    }

    // ── Step 3: Countdown + Record ─────────────────────────────
    window.handleStartBtn = function() {
      if (MUSIC_URL && musicMode === 'performance') playMusic();
      startCountdown();
    };

    window.startCountdown = async function() {
      document.getElementById('start-btn').style.display = 'none';
      document.getElementById('rec-error').textContent = '';
      const overlay = document.getElementById('countdown-overlay');
      const num     = document.getElementById('countdown-num');
      overlay.style.display = 'flex';
      for (let i = 3; i >= 1; i--) {
        num.textContent = i;
        await sleep(800);
      }
      overlay.style.display = 'none';
      startRecording();
    };

    function startRecording() {
      chunks = [];
      elapsedSec = 0;

      const mimeType = getSupportedMime();
      try {
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      } catch(e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = onRecordingStopped;
      mediaRecorder.start(250);

      document.getElementById('rec-badge').style.display = 'flex';
      document.getElementById('timer-badge').style.display = 'block';
      document.getElementById('stop-btn').style.display = 'block';

      timerInterval = setInterval(() => {
        elapsedSec++;
        document.getElementById('timer-badge').textContent = formatTime(elapsedSec);
        if (elapsedSec >= MAX_SEC) stopRecording();
      }, 1000);
    }

    window.stopRecording = function() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    };

    function onRecordingStopped() {
      clearInterval(timerInterval);
      stopMusic();
      stopPreview();
      document.getElementById('rec-badge').style.display = 'none';
      document.getElementById('timer-badge').style.display = 'none';
      document.getElementById('stop-btn').style.display = 'none';

      const mimeType = mediaRecorder.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: mimeType });
      recordedBlobs[currentClipIdx] = blob;

      const url = URL.createObjectURL(blob);
      const vid  = document.getElementById('review-video');
      vid.src    = url;
      document.getElementById('review-label').textContent =
        t('previewClip', { num: currentClipIdx + 1 });
      showStep('review');
    }

    window.confirmClip = function() {
      currentClipIdx++;
      if (currentClipIdx < CLIP_COUNT) {
        updateClipUI();
        showStep('record');
        document.getElementById('start-btn').style.display = 'block';
      } else {
        uploadAllClips();
      }
    };

    window.reRecord = function() {
      showStep('record');
      document.getElementById('start-btn').style.display = 'block';
    };

    // ── Step 5: Upload ─────────────────────────────────────────
    function showUploadError(msg) {
      document.getElementById('upload-title').textContent = _T.uploadError;
      document.getElementById('upload-sub').textContent = msg;
      document.getElementById('upload-progress').style.width = '0%';
      document.getElementById('upload-pct').textContent = '';
      const spinner = document.querySelector('#step-upload .spinner');
      if (spinner) spinner.style.display = 'none';
      const existing = document.getElementById('retry-upload-btn');
      if (!existing) {
        const btn = document.createElement('button');
        btn.id = 'retry-upload-btn';
        btn.className = 'btn-primary';
        btn.style.marginTop = '16px';
        btn.textContent = _T.retry;
        btn.onclick = () => {
          spinner && (spinner.style.display = '');
          btn.remove();
          uploadAllClips();
        };
        document.querySelector('#step-upload .card').appendChild(btn);
      }
    }

    async function uploadClipViaSignedUrl(blob, clipNumber) {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const contentType = (blob.type && blob.type !== 'video/x-msvideo') ? blob.type
        : (ext === 'mp4' ? 'video/mp4' : 'video/webm');

      const params = new URLSearchParams({ storyId: STORY_ID, clipNumber: String(clipNumber), webUid, contentType });
      const urlRes = await fetch('/api/player-upload-url?' + params);
      if (!urlRes.ok) {
        let errMsg = t('uploadUrlError', { status: urlRes.status });
        try { errMsg = (await urlRes.json()).error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      const { signedUrl, storagePath } = await urlRes.json();

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            document.getElementById('upload-progress').style.width = pct + '%';
            document.getElementById('upload-pct').textContent = pct + '%';
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(t('uploadErrorStatus', { status: xhr.status })));
        };
        xhr.onerror = () => reject(new Error(_T.networkError));
        xhr.send(blob);
      });

      const doneRes = await fetch('/api/player-clip-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: STORY_ID, storagePath, playerName: participantName, clipNumber, webUid }),
      });
      if (!doneRes.ok) {
        let errMsg = t('saveClipError', { status: doneRes.status });
        try { errMsg = (await doneRes.json()).error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      return await doneRes.json();
    }

    async function uploadAllClips() {
      showStep('upload');
      document.getElementById('upload-title').textContent = _T.uploading;
      try {
        for (let i = 0; i < recordedBlobs.length; i++) {
          document.getElementById('upload-sub').textContent =
            t('uploadingClip', { current: i + 1, total: recordedBlobs.length });
          document.getElementById('upload-progress').style.width = '0%';
          document.getElementById('upload-pct').textContent = '0%';
          await uploadClipViaSignedUrl(recordedBlobs[i], i + 1);
        }
        stopStream();
        showStep('done');
      } catch (err) {
        console.error('Upload failed:', err);
        showUploadError(t('uploadErrorDetail', { error: err.message || '?' }));
      }
    }

    // ── Helpers ────────────────────────────────────────────────
    function stopStream() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    }

    function getSupportedMime() {
      const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
      return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    }

    function formatTime(sec) {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return m + ':' + s;
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  </script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJs(str) {
  return String(str || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
}

module.exports = { buildWebRecordHtml, WEB_TRANSLATIONS };
