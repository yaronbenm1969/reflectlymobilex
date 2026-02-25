const STORAGE_BUCKET = 'reflectly-playback.firebasestorage.app';
const BASE_URL = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library`;

const AMBIENT_PRESETS = [
  {
    id: 'reflective-space',
    name: 'Reflective Space',
    nameHe: 'מרחב פנימי',
    key: 'D',
    bpm: 60,
    phases: {
      phase1: `${BASE_URL}/reflective-space/phase1.mp3`,
      phase2: `${BASE_URL}/reflective-space/phase2.mp3`,
      phase3: `${BASE_URL}/reflective-space/phase3.mp3`,
    }
  },
  {
    id: 'gentle-warmth',
    name: 'Gentle Warmth',
    nameHe: 'חום עדין',
    key: 'G',
    bpm: 65,
    phases: {
      phase1: `${BASE_URL}/gentle-warmth/phase1.mp3`,
      phase2: `${BASE_URL}/gentle-warmth/phase2.mp3`,
      phase3: `${BASE_URL}/gentle-warmth/phase3.mp3`,
    }
  },
  {
    id: 'soft-hope',
    name: 'Soft Hope',
    nameHe: 'תקווה שקטה',
    key: 'C',
    bpm: 70,
    phases: {
      phase1: `${BASE_URL}/soft-hope/phase1.mp3`,
      phase2: `${BASE_URL}/soft-hope/phase2.mp3`,
      phase3: `${BASE_URL}/soft-hope/phase3.mp3`,
    }
  },
  {
    id: 'tender-vulnerability',
    name: 'Tender Vulnerability',
    nameHe: 'עדינות רגשית',
    key: 'Am',
    bpm: 58,
    phases: {
      phase1: `${BASE_URL}/tender-vulnerability/phase1.mp3`,
      phase2: `${BASE_URL}/tender-vulnerability/phase2.mp3`,
      phase3: `${BASE_URL}/tender-vulnerability/phase3.mp3`,
    }
  },
  {
    id: 'quiet-strength',
    name: 'Quiet Strength',
    nameHe: 'כוח שקט',
    key: 'E',
    bpm: 62,
    phases: {
      phase1: `${BASE_URL}/quiet-strength/phase1.mp3`,
      phase2: `${BASE_URL}/quiet-strength/phase2.mp3`,
      phase3: `${BASE_URL}/quiet-strength/phase3.mp3`,
    }
  },
  {
    id: 'light-movement',
    name: 'Light Movement',
    nameHe: 'תנועה עדינה',
    key: 'A',
    bpm: 80,
    phases: {
      phase1: `${BASE_URL}/light-movement/phase1.mp3`,
      phase2: `${BASE_URL}/light-movement/phase2.mp3`,
      phase3: `${BASE_URL}/light-movement/phase3.mp3`,
    }
  },
  {
    id: 'floating-memory',
    name: 'Floating Memory',
    nameHe: 'זיכרון מרחף',
    key: 'Dm',
    bpm: 55,
    phases: {
      phase1: `${BASE_URL}/floating-memory/phase1.mp3`,
      phase2: `${BASE_URL}/floating-memory/phase2.mp3`,
      phase3: `${BASE_URL}/floating-memory/phase3.mp3`,
    }
  },
  {
    id: 'subtle-uplift',
    name: 'Subtle Uplift',
    nameHe: 'התעלות עדינה',
    key: 'Bb',
    bpm: 72,
    phases: {
      phase1: `${BASE_URL}/subtle-uplift/phase1.mp3`,
      phase2: `${BASE_URL}/subtle-uplift/phase2.mp3`,
      phase3: `${BASE_URL}/subtle-uplift/phase3.mp3`,
    }
  },
  {
    id: 'open-horizon',
    name: 'Open Horizon',
    nameHe: 'אופק פתוח',
    key: 'D',
    bpm: 75,
    phases: {
      phase1: `${BASE_URL}/open-horizon/phase1.mp3`,
      phase2: `${BASE_URL}/open-horizon/phase2.mp3`,
      phase3: `${BASE_URL}/open-horizon/phase3.mp3`,
    }
  },
  {
    id: 'electric-pulse',
    name: 'Electric Pulse',
    nameHe: 'פעימה חשמלית',
    key: 'Fm',
    bpm: 122,
    phases: {
      phase1: `${BASE_URL}/electric-pulse/phase1.mp3`,
      phase2: `${BASE_URL}/electric-pulse/phase2.mp3`,
      phase3: `${BASE_URL}/electric-pulse/phase3.mp3`,
    }
  },
  {
    id: 'world-celebration',
    name: 'World Celebration',
    nameHe: 'חגיגה עולמית',
    key: 'G',
    bpm: 110,
    phases: {
      phase1: `${BASE_URL}/world-celebration/phase1.mp3`,
      phase2: `${BASE_URL}/world-celebration/phase2.mp3`,
      phase3: `${BASE_URL}/world-celebration/phase3.mp3`,
    }
  }
];

function getPresetById(id) {
  return AMBIENT_PRESETS.find(p => p.id === id);
}

function getAllPresets() {
  return AMBIENT_PRESETS;
}

function getPhaseUrl(presetId, phaseNumber) {
  const preset = getPresetById(presetId);
  if (!preset) return null;
  const phaseKey = `phase${phaseNumber}`;
  return preset.phases[phaseKey] || null;
}

module.exports = {
  AMBIENT_PRESETS,
  getPresetById,
  getAllPresets,
  getPhaseUrl
};
