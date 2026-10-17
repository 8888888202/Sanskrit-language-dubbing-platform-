import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON requests up to 50MB for video/audio frames
app.use(express.json({ limit: '50mb' }));

// Server-side Google GenAI initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper: Ensure we have an active Gemini client
function getGenAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return ai;
}

// -------------------------------------------------------------
// Endpoint 1: Auto-Transcribe & Translate to Sanskrit
// -------------------------------------------------------------
app.post('/api/dub/transcribe-and-translate', async (req, res) => {
  try {
    const { videoTitle, description, originalLanguage, sourceText, speakersCount = 2 } = req.body;
    const client = getGenAI();

    const prompt = `
You are an expert AI audio engineer, phonetician, and video dubbing director specializing in Sanskrit translation.
Analyze the following video content context, automatically perform multi-speaker detection (diarization), determine the gender (male/female) of each speaker, extract voice clone acoustics, and generate timed dialogue segments dubbed into authentic, metric-fitting Sanskrit.

Video Context:
- Title: "${videoTitle || 'Untitled Video'}"
- Description: "${description || ''}"
- Source Language: "${originalLanguage || 'English'}"
- Requested Number of Speakers: ${speakersCount}
${sourceText ? `- Source Transcript / Script Provided:\n"""${sourceText}"""` : '- (Please generate a vivid, high-quality dialogue script matching the video topic)'}

CRITICAL DUBBING & AUTO-DETECTION REQUIREMENTS:
1. Auto Multi-Speaker & Gender Check:
   - Identify ${speakersCount} distinct speakers.
   - Assign exact gender ("male" or "female") for each speaker based on dialogue context, role, and pitch characteristics.
   - Assign optimal neural voice: 'Fenrir' (deep male baritone), 'Charon' (mature resonant male), 'Kore' (luminous clear female), 'Zephyr' (warm youthful female), or 'Puck' (dynamic expressive male).
   - Provide voice cloning acoustic parameters (pitchMultiplier: 0.85 to 1.15, speedMultiplier: 0.90 to 1.10, timbreDescription, stylePrompt).
2. Segment-by-segment Translation:
   - Divide into 4 to 8 timed segments with sequential timestamps (seconds).
   - Accurately assign speakerId ("spk-1", "spk-2", etc.) and speakerGender ("male" or "female").
   - Sanskrit translation must be natural spoken Sanskrit (सरल संस्कृतम्) matching natural speech tempo.
   - Provide Devanagari script AND exact IAST Roman transliteration.
   - Provide English translation for international creators.
   - Assign line-level emotion tone: "neutral", "calm", "energetic", "serious", "cheerful", "compassionate", "intense", or "inquisitive".
   - Provide word-by-word vocabulary and grammar breakdown.
`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            detectedSpeakers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speakerId: { type: Type.STRING },
                  name: { type: Type.STRING },
                  gender: { type: Type.STRING, description: "male or female" },
                  role: { type: Type.STRING },
                  voiceName: { type: Type.STRING, description: "Fenrir, Charon, Kore, Zephyr, or Puck" },
                  pitchMultiplier: { type: Type.NUMBER },
                  speedMultiplier: { type: Type.NUMBER },
                  timbreDescription: { type: Type.STRING },
                  stylePrompt: { type: Type.STRING },
                },
                required: ['speakerId', 'name', 'gender', 'voiceName', 'pitchMultiplier', 'speedMultiplier', 'timbreDescription', 'stylePrompt'],
              },
            },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  speakerId: { type: Type.STRING },
                  speakerName: { type: Type.STRING },
                  speakerGender: { type: Type.STRING, description: "male or female" },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  originalText: { type: Type.STRING },
                  sanskritDevanagari: { type: Type.STRING },
                  sanskritIAST: { type: Type.STRING },
                  englishTranslation: { type: Type.STRING },
                  rasa: {
                    type: Type.STRING,
                    description: "Emotional tone: neutral, calm, energetic, serious, cheerful, compassionate, intense, or inquisitive",
                  },
                  timingFitNote: { type: Type.STRING },
                  wordsBreakdown: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        iast: { type: Type.STRING },
                        meaning: { type: Type.STRING },
                        grammar: { type: Type.STRING },
                      },
                      required: ['word', 'iast', 'meaning'],
                    },
                  },
                },
                required: [
                  'id',
                  'speakerId',
                  'speakerName',
                  'startTime',
                  'endTime',
                  'originalText',
                  'sanskritDevanagari',
                  'sanskritIAST',
                  'englishTranslation',
                  'rasa',
                ],
              },
            },
          },
          required: ['title', 'detectedSpeakers', 'segments'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in transcribe-and-translate:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe and translate',
    });
  }
});

// -------------------------------------------------------------
// Endpoint 2: Sanskrit Speech Synthesis with Voice Clone & Rasa
// -------------------------------------------------------------
app.post('/api/dub/synthesize-line', async (req, res) => {
  try {
    const {
      text, // Sanskrit text (Devanagari or IAST)
      voiceName = 'Kore', // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
      rasa = 'shanta',
      voiceStylePrompt = '',
      speakerName = 'Speaker',
    } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const client = getGenAI();

    // Map Emotion / Tone to acoustic styling instructions
    const toneStyleDescriptions: Record<string, string> = {
      neutral: 'Clear, balanced, neutral, professional studio announcer delivery with articulate Sanskrit cadence',
      calm: 'Calm, steady, serene, reflective documentary tone with clean articulate Sanskrit pronunciation',
      energetic: 'Energetic, confident, vibrant and articulate voice with modern cadence and clear diction',
      cheerful: 'Friendly, cheerful, positive, upbeat and warm delivery with conversational inflection',
      serious: 'Authoritative, serious, deep and grounded documentary narrator voice',
      compassionate: 'Gentle, warm, empathetic, soft and considerate vocal delivery with natural pacing',
      intense: 'Dramatic, intense, commanding and powerful cinematic projection',
      inquisitive: 'Inquisitive, curious, bright and engaged tone exploring scientific ideas',
      // Backwards compatibility mappings
      shanta: 'Calm, steady, serene and balanced documentary tone with articulate Sanskrit cadence',
      veera: 'Energetic, confident, vibrant, resonant and articulate delivery',
      bhakti: 'Deep, warm, sincere and resonant delivery with natural cadence',
      hasya: 'Joyful, playful, lighthearted and witty delivery',
      karuna: 'Compassionate, gentle, soft and empathetic vocal tone',
      raudra: 'Commanding, intense, firm, powerful and majestic delivery',
      adbhuta: 'Wonder-filled, inquisitive, awe-struck, expressive intonation',
      shringara: 'Warm, elegant, melodious and aesthetic vocal cadence',
    };

// In-memory cache for synthesized audio to prevent 429 rate-limiting on repeat lines
const audioCache = new Map<string, string>();

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const resolvedVoice = validVoices.includes(voiceName) 
      ? voiceName 
      : (req.body.gender === 'female' ? 'Kore' : 'Fenrir');

    const emotionalStyle = toneStyleDescriptions[rasa.toLowerCase()] || 'Clear, natural, articulate studio Sanskrit delivery';
    const pitchFactor = req.body.pitchMultiplier || 1.0;
    const pitchNote = pitchFactor < 0.98 ? 'deep pitch' : pitchFactor > 1.02 ? 'high register pitch' : 'natural pitch';

    const combinedStyle = voiceStylePrompt 
      ? `${voiceStylePrompt}. Tone: ${emotionalStyle}`
      : `${speakerName} (${pitchNote}) speaking in Sanskrit: ${emotionalStyle}`;

    // Cache key based on text, voice, gender, pitch, and rasa
    const cacheKey = `${text.trim()}::${resolvedVoice}::${pitchFactor.toFixed(2)}::${rasa}::${req.body.gender || ''}`;
    if (audioCache.has(cacheKey)) {
      return res.json({
        success: true,
        audioBase64: audioCache.get(cacheKey),
        mimeType: 'audio/wav',
        cached: true,
      });
    }

    // Call gemini-3.8-flash-lite-tts for fast and reliable speech synthesis
    const ttsResponse = await client.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: combinedStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: resolvedVoice },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(200).json({
        success: false,
        rateLimited: false,
        error: 'No audio data received from Gemini TTS',
      });
    }

    // Cache synthesized result
    audioCache.set(cacheKey, base64Audio);

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      cached: false,
    });
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || 
                        error?.message?.includes('429') || 
                        error?.message?.includes('quota') || 
                        error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit) {
      console.warn('Gemini 3.8 Flash Lite TTS free tier quota reached (3 RPM). Returning rate-limit response for client fallback.');
      return res.status(200).json({
        success: false,
        rateLimited: true,
        retryAfter: 8,
        message: 'Cloud TTS quota reached (3 requests/min on free tier). Seamlessly using instant local speech engine.',
      });
    }

    console.error('Error in synthesize-line:', error?.message || error);
    return res.status(200).json({
      success: false,
      rateLimited: false,
      error: error?.message || 'TTS synthesis failed',
    });
  }
});

// -------------------------------------------------------------
// Endpoint 3: Voice Clone Profile Extractor
// -------------------------------------------------------------
app.post('/api/dub/analyze-voice', async (req, res) => {
  try {
    const { speakerDescription, sampleAudioBase64, sampleText } = req.body;
    const client = getGenAI();

    const prompt = `
You are an expert audio engineer and vocal acoustic analyst specializing in vocal cloning and Indian phonetics.
Analyze this speaker profile to create a voice clone specification for Sanskrit dubbing:
Speaker notes: "${speakerDescription || 'Natural male/female speaker'}"
Sample text spoken: "${sampleText || 'Namaste, welcoming everyone to this presentation'}"

Recommend:
1. Best matching Gemini prebuilt voice: 'Puck' (expressive male), 'Charon' (deep baritone male), 'Kore' (clear gentle female), 'Fenrir' (commanding mature male), or 'Zephyr' (warm youthful female).
2. Acoustic parameters (pitch shift factor between 0.8 and 1.3, speed rate 0.8 to 1.3, formant resonance factor, warmth, breathiness).
3. A tailored "speechMetadata.style" prompt string that captures their timbre, cadence, and persona for high-fidelity voice preservation during Sanskrit dubbing.
4. Voice clone avatar color and title.
`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedVoice: { type: Type.STRING },
            personaTitle: { type: Type.STRING },
            timbreDescription: { type: Type.STRING },
            stylePrompt: { type: Type.STRING },
            pitchMultiplier: { type: Type.NUMBER },
            speedMultiplier: { type: Type.NUMBER },
            accentColor: { type: Type.STRING },
            sanskritSpecialty: { type: Type.STRING },
          },
          required: ['recommendedVoice', 'personaTitle', 'stylePrompt', 'pitchMultiplier', 'speedMultiplier'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in analyze-voice:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze voice',
    });
  }
});

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// Vite middleware in dev, static files in production
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`VakSutra Server running on http://localhost:${port}`);
  });
}

startServer();
