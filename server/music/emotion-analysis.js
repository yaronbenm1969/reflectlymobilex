const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function analyzeEmotionalTimeline(transcriptionSegments, totalDuration) {
  console.log('🎭 Analyzing emotional timeline...');
  console.log(`Total duration: ${totalDuration}s, Segments: ${transcriptionSegments.length}`);

  const segmentsText = transcriptionSegments.map(seg => 
    `[${seg.start?.toFixed(1) || 0}s - ${seg.end?.toFixed(1) || 0}s]: ${seg.text}`
  ).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert music producer and emotional analyst. Given video transcription segments with timestamps, create a detailed emotional timeline for background music composition.

For each emotional segment, specify:
- Time range (start/end in seconds)
- Primary emotion (e.g., gentle, dramatic, nostalgic, joyful, melancholic, energetic, peaceful, tense)
- Intensity level (1-10, where 1 is very subtle and 10 is overwhelming)
- Suggested instruments emphasis: drums (0-100), bass (0-100), melody (0-100)
- EQ preset: "warm" (boost low-mids), "bright" (boost highs), "deep" (boost lows), "neutral"
- Reverb level: "dry" (0.1), "medium" (0.4), "spacious" (0.7), "cathedral" (0.9)
- Stereo width: "narrow" (0.3), "normal" (0.6), "wide" (0.9)

Also provide:
- Overall musical key suggestion (e.g., "C major", "A minor")
- BPM suggestion (60-140)
- Primary instrument palette (e.g., "piano, strings, soft drums")
- A single continuous MusicGen prompt that describes the full emotional journey as one piece (critical for musical coherence)

The MusicGen prompt must describe the ENTIRE piece as one flowing composition, mentioning how it evolves over time. Do NOT split into separate prompts.

Return JSON format.`
        },
        {
          role: 'user',
          content: `Total video duration: ${totalDuration} seconds.

Transcription segments:
${segmentsText}

Create the emotional timeline and MusicGen prompt for this content.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('✅ Emotional timeline created:', JSON.stringify(analysis).substring(0, 200));

    const result = {
      success: true,
      timeline: analysis.timeline || analysis.segments || analysis.emotionalSegments || [],
      musicPrompt: analysis.musicPrompt || analysis.musicGenPrompt || analysis.prompt || '',
      musicalKey: analysis.musicalKey || analysis.key || 'C major',
      bpm: analysis.bpm || analysis.tempo || 90,
      instruments: analysis.instruments || analysis.instrumentPalette || 'piano, strings, soft percussion',
      raw: analysis
    };

    if (!result.timeline.length) {
      result.timeline = [{
        start: 0,
        end: totalDuration,
        emotion: 'gentle',
        intensity: 5,
        drums: 30,
        bass: 40,
        melody: 80,
        eq: 'warm',
        reverb: 'medium',
        stereoWidth: 'normal'
      }];
    }

    result.timeline = result.timeline.map(seg => ({
      start: seg.start || seg.startTime || 0,
      end: seg.end || seg.endTime || totalDuration,
      emotion: seg.emotion || seg.mood || 'neutral',
      intensity: seg.intensity || 5,
      drums: seg.drums ?? seg.drumsLevel ?? 50,
      bass: seg.bass ?? seg.bassLevel ?? 50,
      melody: seg.melody ?? seg.melodyLevel ?? 70,
      eq: seg.eq || seg.eqPreset || 'neutral',
      reverb: seg.reverb || seg.reverbLevel || 'medium',
      stereoWidth: seg.stereoWidth || seg.width || 'normal'
    }));

    return result;
  } catch (error) {
    console.error('❌ Emotional analysis failed:', error);
    return {
      success: false,
      error: error.message,
      timeline: [{
        start: 0,
        end: totalDuration,
        emotion: 'gentle',
        intensity: 5,
        drums: 30,
        bass: 40,
        melody: 80,
        eq: 'warm',
        reverb: 'medium',
        stereoWidth: 'normal'
      }],
      musicPrompt: `gentle ambient piano and strings, peaceful and warm, ${Math.round(totalDuration)} seconds`,
      musicalKey: 'C major',
      bpm: 80,
      instruments: 'piano, strings'
    };
  }
}

async function buildMusicPrompt(emotionData, totalDuration) {
  if (emotionData.musicPrompt) {
    let prompt = emotionData.musicPrompt;
    if (!prompt.includes('second') && !prompt.includes('duration')) {
      prompt += `, ${Math.round(totalDuration)} seconds`;
    }
    return prompt;
  }

  const timeline = emotionData.timeline || [];
  const key = emotionData.musicalKey || 'C major';
  const bpm = emotionData.bpm || 90;
  const instruments = emotionData.instruments || 'piano, strings';

  let description = `${instruments}, ${key}, ${bpm} BPM, `;
  
  if (timeline.length === 1) {
    description += `${timeline[0].emotion} mood throughout, ${Math.round(totalDuration)} seconds`;
  } else {
    const phases = timeline.map(seg => {
      const duration = Math.round(seg.end - seg.start);
      return `${seg.emotion} (${duration}s)`;
    });
    description += `emotional journey: ${phases.join(' then ')}, smooth transitions between sections, ${Math.round(totalDuration)} seconds`;
  }

  return description;
}

module.exports = {
  analyzeEmotionalTimeline,
  buildMusicPrompt
};
