const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const AMBIENT_PRESETS = [
  {
    id: 'reflective-space',
    name: 'Reflective Space',
    key: 'D',
    bpm: 60,
    prompt: 'Gentle ambient piano in D major, 60 BPM, soft warm pad textures underneath, minimal harmonic movement, spacious and meditative, no percussion, no drums, organic acoustic feel, breathing space between notes, delicate reverb, three phases: opening spacious stillness with sustained pads, middle section adds gentle piano arpeggios with subtle string texture, ending resolves warmly with open chords and light melodic lift, continuous flow, non-intrusive background music'
  },
  {
    id: 'gentle-warmth',
    name: 'Gentle Warmth',
    key: 'G',
    bpm: 65,
    prompt: 'Warm intimate strings in G major, 65 BPM, soft cello and viola duet, open harmonic voicings, human and tender, no percussion, acoustic chamber feel, close and personal, three phases: opening with single sustained cello note growing into gentle melody, middle adds viola counterpoint with warm vibrato, ending lifts gently with full string harmony resolving to open fifth, continuous and flowing, comforting background music'
  },
  {
    id: 'soft-hope',
    name: 'Soft Hope',
    key: 'C',
    bpm: 70,
    prompt: 'Hopeful acoustic guitar and piano in C major, 70 BPM, bright modal quality, lydian touches, no heavy climax, gentle and optimistic, no drums, light fingerpicking guitar with soft piano chords, three phases: opening with simple piano chords in open voicing, middle introduces gentle guitar melody with ascending motion, ending adds warmth with both instruments in bright resolution, subtle and uplifting, non-manipulative background music'
  },
  {
    id: 'tender-vulnerability',
    name: 'Tender Vulnerability',
    key: 'Am',
    bpm: 58,
    prompt: 'Extremely delicate ambient texture in A minor, 58 BPM, almost transparent, thin piano notes with long decay, barely audible string harmonics, whisper-quiet, ethereal and fragile, no percussion, three phases: opening with single repeated piano note and distant pad, middle adds faint high string harmonics like glass, ending softens even further with gentle resolution, minimalist and intimate, nearly silent background music'
  },
  {
    id: 'quiet-strength',
    name: 'Quiet Strength',
    key: 'E',
    bpm: 62,
    prompt: 'Grounded ambient music in E major, 62 BPM, low anchor drone note, slow movement above it, stable and confident but quiet, cello or bass note sustained underneath, gentle piano movement on top, no drums, three phases: opening establishes low E drone with warmth, middle adds slow melodic motion in upper register, ending maintains stability with subtle harmonic enrichment, steady and reassuring background music'
  },
  {
    id: 'light-movement',
    name: 'Light Movement',
    key: 'A',
    bpm: 80,
    prompt: 'Gentle rhythmic ambient in A major, 80 BPM, soft pulse without drums, plucked strings or marimba creating light movement, organic and dance-like but subtle, no heavy percussion, three phases: opening with soft rhythmic pulse on plucked instrument, middle adds gentle melodic line dancing over the pulse, ending lifts energy slightly with warm harmonic movement, encouraging gentle body movement, light and playful background music'
  },
  {
    id: 'floating-memory',
    name: 'Floating Memory',
    key: 'Dm',
    bpm: 55,
    prompt: 'Dreamy floating ambient in D minor, 55 BPM, deep reverb, suspended harmonies, nostalgic and hazy, piano notes dissolving into space, no percussion, time feels suspended, three phases: opening with reverb-heavy sustained piano chords floating, middle adds distant melody like a half-remembered song, ending dissolves into warm ambient wash with gentle resolution, dreamlike and nostalgic background music'
  },
  {
    id: 'grounded-calm',
    name: 'Grounded Calm',
    key: 'F',
    bpm: 56,
    prompt: 'Deep grounded ambient in F major, 56 BPM, very low register emphasis, minimal movement, stable and earthy, sustained bass tones with gentle warmth above, no percussion, three phases: opening with deep sustained F note creating foundation, middle adds very slow harmonic movement in low register, ending maintains groundedness with subtle warmth, absolutely minimal and stable, calming meditation background music'
  },
  {
    id: 'subtle-uplift',
    name: 'Subtle Uplift',
    key: 'Bb',
    bpm: 72,
    prompt: 'Gradually building ambient in Bb major, 72 BPM, very slow emotional crescendo over full duration, starts nearly silent and builds to gentle warmth, strings and piano, no drums, three phases: opening barely audible with distant pad texture, middle slowly introduces piano melody with growing confidence, ending reaches warm fullness without dramatic climax just gentle arrival, patient and gradual emotional lift, inspiring background music'
  },
  {
    id: 'open-horizon',
    name: 'Open Horizon',
    key: 'D',
    bpm: 75,
    prompt: 'Open expansive ambient in D major, 75 BPM, wide stereo field, bright open chords, feeling of spaciousness and possibility, acoustic guitar and strings, no drums, three phases: opening with wide open D chord ringing out into space, middle adds gentle ascending melody suggesting new beginnings, ending resolves with optimistic warmth and sense of completion, bright and airy, hopeful background music for new possibilities'
  }
];

const MUSIC_DIR = path.join(process.cwd(), 'temp', 'music', 'library');

function ensureDir() {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
  }
}

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      reject(err);
    });
  });
}

async function generateSingleAmbientTrack(preset, durationSeconds = 30) {
  console.log(`🎵 Generating ambient track: ${preset.name} (${preset.key}, ${preset.bpm} BPM)...`);

  try {
    const output = await replicate.run(
      'facebook/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedbb',
      {
        input: {
          prompt: preset.prompt,
          duration: Math.min(durationSeconds, 30),
          model_version: 'stereo-large',
          output_format: 'wav',
          normalization_strategy: 'peak'
        }
      }
    );

    const musicUrl = typeof output === 'string' ? output : (output?.output || output?.url || output);
    
    if (typeof musicUrl !== 'string' || !musicUrl.startsWith('http')) {
      console.error(`❌ Unexpected output for ${preset.name}:`, typeof output);
      return { success: false, error: 'Unexpected MusicGen output' };
    }

    ensureDir();
    const localPath = path.join(MUSIC_DIR, `${preset.id}.wav`);
    await downloadFile(musicUrl, localPath);

    console.log(`✅ Generated: ${preset.name} → ${localPath}`);
    return { success: true, path: localPath, url: musicUrl, preset };

  } catch (error) {
    console.error(`❌ Failed to generate ${preset.name}:`, error.message);
    return { success: false, error: error.message, preset };
  }
}

async function generateFullLibrary(uploadToFirebaseFn) {
  console.log('🎼 Starting ambient library generation (10 tracks)...');
  console.log(`Estimated cost: ~$0.30-0.50 total`);
  
  const results = [];
  
  for (const preset of AMBIENT_PRESETS) {
    const result = await generateSingleAmbientTrack(preset);
    results.push(result);
    
    if (result.success && uploadToFirebaseFn) {
      try {
        const storagePath = `music/library/${preset.id}.wav`;
        const firebaseUrl = await uploadToFirebaseFn(result.path, storagePath);
        result.firebaseUrl = firebaseUrl;
        console.log(`☁️ Uploaded to Firebase: ${preset.id}`);
      } catch (err) {
        console.error(`☁️ Upload failed for ${preset.id}:`, err.message);
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\n🎼 Library generation complete: ${succeeded} succeeded, ${failed} failed`);
  
  return results;
}

function getPresetById(id) {
  return AMBIENT_PRESETS.find(p => p.id === id);
}

function getAllPresets() {
  return AMBIENT_PRESETS;
}

module.exports = {
  AMBIENT_PRESETS,
  generateSingleAmbientTrack,
  generateFullLibrary,
  getPresetById,
  getAllPresets
};
