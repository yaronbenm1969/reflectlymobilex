const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CHUNK_DURATION: MusicGen is capped at 30s per call
const CHUNK_DURATION = 30;

// analyzeEmotionalTimeline(segments, totalDuration, options)
// options.numClips — if provided, aligns chunks with clip boundaries instead of fixed 30s windows
async function analyzeEmotionalTimeline(transcriptionSegments, totalDuration, options = {}) {
  console.log('🎭 Analyzing emotional timeline...');
  console.log(`Total duration: ${totalDuration}s, Segments: ${transcriptionSegments.length}`);

  const { numClips } = options;

  const MAX_CHUNKS = 10; // Cap: max 10 MusicGen API calls (~5-10 min generation time)

  // If numClips provided and each clip fits in one MusicGen call → one chunk per clip
  // Otherwise fall back to standard 30s chunking
  let numChunks, chunkDuration;
  if (numClips && numClips > 1 && totalDuration / numClips <= CHUNK_DURATION) {
    numChunks = Math.min(numClips, MAX_CHUNKS);
    chunkDuration = Math.max(5, Math.round(totalDuration / numChunks));
    console.log(`🎵 Per-clip chunks: ${numChunks} clips × ${chunkDuration}s each (capped from ${numClips})`);
  } else {
    numChunks = Math.min(Math.max(1, Math.ceil(totalDuration / CHUNK_DURATION)), MAX_CHUNKS);
    chunkDuration = CHUNK_DURATION;
  }
  const segmentsText = transcriptionSegments.map(seg =>
    `[${(seg.start || 0).toFixed(1)}s - ${(seg.end || 0).toFixed(1)}s]: ${seg.text}`
  ).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert music producer. Given video transcription segments, you will:

1. Define a single "Musical DNA" for the entire project — one consistent musical world that all chunks share:
   - musicalKey: e.g. "A minor", "C major"
   - bpm: integer 60–130
   - instruments: e.g. "piano, acoustic guitar, soft strings, gentle percussion"
   - style: e.g. "cinematic ambient", "warm acoustic folk", "introspective piano ballad"
   - basePrompt: a short base description used in every chunk (e.g. "piano, acoustic guitar, A minor, 78 BPM, cinematic ambient")

2. Divide the total duration into ${numChunks} chunk(s) of ${chunkDuration} seconds each.
   For each chunk, write a MusicGen prompt that:
   - STARTS with the exact same basePrompt (same instruments, key, BPM)
   - Has a gentle neutral opening (2–3 seconds soft fade-in, calm)
   - Builds to the emotional peak matching the transcription content for that time window
   - Returns to a gentle neutral close (2–3 seconds soft fade-out, calm)
   - Ends with ", ${chunkDuration} seconds"

   This ensures all chunks can be crossfaded seamlessly.

Return a JSON object with:
{
  "musicalDNA": {
    "musicalKey": string,
    "bpm": number,
    "instruments": string,
    "style": string,
    "basePrompt": string
  },
  "chunkPrompts": [string, ...],  // one per ${chunkDuration}s chunk, length = ${numChunks}
  "timeline": [{ "start": number, "end": number, "emotion": string, "intensity": number }]
}`
        },
        {
          role: 'user',
          content: `Total video duration: ${totalDuration} seconds. Number of ${chunkDuration}s chunks needed: ${numChunks}.

Transcription segments:
${segmentsText}

Create the Musical DNA and ${numChunks} chunk prompt(s) for this content.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('✅ Musical DNA:', JSON.stringify(analysis.musicalDNA || {}).substring(0, 150));
    console.log(`✅ ${(analysis.chunkPrompts || []).length} chunk prompts generated`);

    const dna = analysis.musicalDNA || {};
    const chunkPrompts = analysis.chunkPrompts || [];

    // Fallback: if GPT didn't return enough chunk prompts, pad with base prompt
    while (chunkPrompts.length < numChunks) {
      const base = dna.basePrompt || 'gentle piano and strings, C major, 80 BPM, ambient';
      chunkPrompts.push(`${base}, begins softly, gentle emotional journey, returns to calm, 30 seconds`);
    }

    const timeline = (analysis.timeline || []).map(seg => ({
      start: seg.start || 0,
      end: seg.end || totalDuration,
      emotion: seg.emotion || 'neutral',
      intensity: seg.intensity || 5,
    }));

    if (!timeline.length) {
      timeline.push({ start: 0, end: totalDuration, emotion: 'gentle', intensity: 5 });
    }

    return {
      success: true,
      chunkDuration,
      musicalDNA: {
        musicalKey: dna.musicalKey || 'C major',
        bpm: dna.bpm || 80,
        instruments: dna.instruments || 'piano, strings',
        style: dna.style || 'ambient',
        basePrompt: dna.basePrompt || 'gentle piano and strings, C major, 80 BPM, ambient',
      },
      chunkPrompts,
      timeline,
      // Legacy fields (kept for compatibility)
      musicPrompt: chunkPrompts[0] || '',
      musicalKey: dna.musicalKey || 'C major',
      bpm: dna.bpm || 80,
      instruments: dna.instruments || 'piano, strings',
    };
  } catch (error) {
    console.error('❌ Emotional analysis failed:', error);
    const fallbackPrompt = `gentle piano and strings, C major, 80 BPM, ambient, begins softly, gentle emotional journey, returns to calm, ${chunkDuration} seconds`;
    const fallbackChunks = Array(numChunks).fill(fallbackPrompt);
    return {
      success: false,
      chunkDuration,
      error: error.message,
      musicalDNA: { musicalKey: 'C major', bpm: 80, instruments: 'piano, strings', style: 'ambient', basePrompt: fallbackPrompt },
      chunkPrompts: fallbackChunks,
      timeline: [{ start: 0, end: totalDuration, emotion: 'gentle', intensity: 5 }],
      musicPrompt: fallbackPrompt,
      musicalKey: 'C major',
      bpm: 80,
      instruments: 'piano, strings',
    };
  }
}

async function buildMusicPrompt(emotionData, totalDuration) {
  // Returns the first chunk prompt (legacy single-chunk usage)
  if (emotionData.chunkPrompts && emotionData.chunkPrompts.length > 0) {
    return emotionData.chunkPrompts[0];
  }
  if (emotionData.musicPrompt) {
    let prompt = emotionData.musicPrompt;
    if (!prompt.includes('second') && !prompt.includes('duration')) {
      prompt += `, ${Math.round(totalDuration)} seconds`;
    }
    return prompt;
  }
  const key = emotionData.musicalKey || 'C major';
  const bpm = emotionData.bpm || 90;
  const instruments = emotionData.instruments || 'piano, strings';
  return `${instruments}, ${key}, ${bpm} BPM, gentle ambient, begins softly, returns to calm, ${Math.round(totalDuration)} seconds`;
}

module.exports = {
  analyzeEmotionalTimeline,
  buildMusicPrompt,
  CHUNK_DURATION,
};
