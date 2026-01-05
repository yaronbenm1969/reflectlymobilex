const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function transcribeVideo(videoPath) {
  console.log('🎤 Starting transcription for:', videoPath);
  
  try {
    const audioPath = await extractAudioFromVideo(videoPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'he',
      response_format: 'verbose_json'
    });
    
    fs.unlinkSync(audioPath);
    
    console.log('✅ Transcription completed:', transcription.text?.substring(0, 100));
    
    return {
      success: true,
      text: transcription.text,
      segments: transcription.segments || [],
      language: transcription.language,
      duration: transcription.duration
    };
  } catch (error) {
    console.error('❌ Transcription failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function extractAudioFromVideo(videoPath) {
  const ffmpeg = require('fluent-ffmpeg');
  const audioPath = videoPath.replace(/\.[^.]+$/, '_audio.mp3');
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vn', '-acodec', 'libmp3lame', '-q:a', '4'])
      .output(audioPath)
      .on('end', () => {
        console.log('✅ Audio extracted:', audioPath);
        resolve(audioPath);
      })
      .on('error', (err) => {
        console.error('❌ Audio extraction failed:', err);
        reject(err);
      })
      .run();
  });
}

async function analyzeStoryThemes(transcriptions) {
  console.log('🧠 Analyzing story themes...');
  
  const allText = transcriptions.map(t => t.text).join('\n\n---\n\n');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `אתה מנתח סיפורים ותגובות. נתח את הטקסטים הבאים וזהה:
1. נושאים מרכזיים
2. רגשות עיקריים
3. קשרים בין התגובות השונות
4. הצעות לעריכה יצירתית של הסרטון הסופי

החזר תשובה בעברית בפורמט JSON.`
        },
        {
          role: 'user',
          content: `הנה התמלולים מהסיפור והתגובות:\n\n${allText}`
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('✅ Analysis completed');
    
    return {
      success: true,
      analysis
    };
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateEditingSuggestions(storyTranscript, reflectionTranscripts) {
  console.log('✂️ Generating editing suggestions...');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `אתה עורך וידאו מקצועי. בהתבסס על תמלולי הסיפור והתגובות, הצע:
1. סדר אופטימלי לקליפים
2. נקודות חיתוך מומלצות
3. הצעות למוזיקת רקע מתאימה
4. אפקטים ומעברים מומלצים

החזר תשובה בעברית בפורמט JSON עם המבנה:
{
  "clipOrder": ["clip1", "clip2", ...],
  "cutPoints": [{"time": 0, "reason": "..."}],
  "musicSuggestion": "סגנון מוזיקה",
  "transitions": ["מעבר1", "מעבר2"],
  "overallMood": "מצב רוח כללי"
}`
        },
        {
          role: 'user',
          content: `סיפור מקורי:\n${storyTranscript}\n\nתגובות:\n${reflectionTranscripts.join('\n\n---\n\n')}`
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const suggestions = JSON.parse(response.choices[0].message.content);
    console.log('✅ Editing suggestions generated');
    
    return {
      success: true,
      suggestions
    };
  } catch (error) {
    console.error('❌ Suggestions generation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateVideoTitle(transcriptions) {
  try {
    const allText = transcriptions.slice(0, 3).map(t => t.text).join(' ');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'צור כותרת קצרה ויצירתית (עד 5 מילים) לסרטון בעברית בהתבסס על התוכן.'
        },
        {
          role: 'user',
          content: allText.substring(0, 500)
        }
      ]
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Title generation failed:', error);
    return 'הסיפור שלי';
  }
}

module.exports = {
  transcribeVideo,
  analyzeStoryThemes,
  generateEditingSuggestions,
  generateVideoTitle,
  extractAudioFromVideo
};
