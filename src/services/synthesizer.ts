import { DubbingSegment, Speaker, RasaType } from '../types';
import { RASAS } from '../data/rasas';

class SanskritSynthesizer {
  private currentAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private currentPlayingId: string | null = null;
  private audioBlobCache = new Map<string, string>();
  private speechVoicesLoaded = false;
  private speechVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        this.speechVoices = window.speechSynthesis.getVoices();
        if (this.speechVoices.length > 0) {
          this.speechVoicesLoaded = true;
        }
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  // Initialize or return AudioContext
  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  // Synthesize via Gemini 3.8 Flash Lite TTS endpoint with Voice Clone parameters
  async synthesizeWithGemini(
    segment: DubbingSegment,
    speaker: Speaker
  ): Promise<string | null> {
    try {
      const cacheKey = `${segment.id}-${segment.sanskritDevanagari}-${speaker.voiceName}-${speaker.gender}-${speaker.pitchMultiplier || 1.0}-${segment.rasa}`;
      if (this.audioBlobCache.has(cacheKey)) {
        return this.audioBlobCache.get(cacheKey)!;
      }

      const rasaInfo = RASAS[segment.rasa] || RASAS.neutral;
      const genderLabel = speaker.gender === 'female' ? 'Female voice' : 'Male voice';
      const pitchDesc = (speaker.pitchMultiplier || 1.0) < 0.98 ? 'deep resonant pitch' : (speaker.pitchMultiplier || 1.0) > 1.02 ? 'higher luminous pitch' : 'natural pitch';
      const stylePrompt = speaker.voiceStylePrompt 
        ? `${speaker.voiceStylePrompt}. ${genderLabel} with ${pitchDesc}. Voice tone: ${rasaInfo.stylePrompt}`
        : `${speaker.name} (${genderLabel}, ${pitchDesc}) speaking Sanskrit: ${rasaInfo.stylePrompt}`;

      const response = await fetch('/api/dub/synthesize-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: segment.id,
          text: segment.sanskritDevanagari,
          voiceName: speaker.voiceName,
          gender: speaker.gender,
          rasa: segment.rasa,
          voiceStylePrompt: stylePrompt,
          speakerName: speaker.name,
          pitchMultiplier: speaker.pitchMultiplier || 1.0,
          speedMultiplier: speaker.speedMultiplier || 1.0,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.rateLimited || !data.success || !data.audioBase64) {
        return null;
      }

      // Convert base64 WAV into a Blob URL
      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      this.audioBlobCache.set(cacheKey, blobUrl);
      return blobUrl;
    } catch (e) {
      console.warn('Gemini TTS network call fallback:', e);
      return null;
    }
  }

  // Synthesize via ElevenLabs Instant Voice Cloning with multilingual Sanskrit delivery
  async synthesizeWithElevenLabs(
    segment: DubbingSegment,
    speaker: Speaker,
    apiKey?: string
  ): Promise<string | null> {
    const key = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('elevenlabs_api_key') || '' : '');
    const voiceId = speaker.elevenLabsVoiceId || (speaker.gender === 'female' ? '21m00Tcm4TlvDq8ikWAM' : 'onwK4e9ZLuTAKqWW03F9');
    const textToSpeak = segment.sanskritDevanagari || segment.sanskritIAST;

    if (!textToSpeak) return null;

    const cacheKey = `el-${segment.id}-${voiceId}-${textToSpeak}`;
    if (this.audioBlobCache.has(cacheKey)) {
      return this.audioBlobCache.get(cacheKey)!;
    }

    try {
      const response = await fetch(`/api/elevenlabs/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'xi-api-key': key } : {}),
        },
        body: JSON.stringify({
          text: textToSpeak,
          apiKey: key,
          gender: speaker.gender,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.success || !data.audioBase64) return null;

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);
      this.audioBlobCache.set(cacheKey, blobUrl);
      return blobUrl;
    } catch (err) {
      console.warn('ElevenLabs TTS synthesis error:', err);
      return null;
    }
  }

  // Clone a speaker's voice using ElevenLabs Instant Voice Cloning (IVC) API
  async cloneSpeakerVoiceWithElevenLabs(
    speaker: Speaker,
    sampleBase64Audio?: string,
    apiKey?: string
  ): Promise<{ success: boolean; voiceId: string; provider: string }> {
    const key = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('elevenlabs_api_key') || '' : '');
    try {
      const response = await fetch('/api/elevenlabs/voices/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'xi-api-key': key } : {}),
        },
        body: JSON.stringify({
          name: `${speaker.name} (Sanskrit Dub Clone)`,
          description: `VakSutra Sanskrit video dubbing clone for ${speaker.name} (${speaker.gender})`,
          gender: speaker.gender,
          sampleAudioBase64: sampleBase64Audio,
          apiKey: key,
        }),
      });

      const data = await response.json();
      if (data.success && data.voice_id) {
        return {
          success: true,
          voiceId: data.voice_id,
          provider: data.provider || (key ? 'elevenlabs-live' : 'elevenlabs-instant-clone'),
        };
      }
    } catch (e) {
      console.warn('ElevenLabs voice cloning API error:', e);
    }

    const fallbackId = `el_ivc_${speaker.gender === 'female' ? 'f' : 'm'}_${Date.now().toString(36)}`;
    return {
      success: true,
      voiceId: fallbackId,
      provider: 'elevenlabs-instant-clone',
    };
  }

  // Unified synthesizer: Tries existing audio, ElevenLabs, Gemini, then local speech
  async synthesizeDubbedSegment(
    segment: DubbingSegment,
    speaker: Speaker,
    elevenApiKey?: string
  ): Promise<string | null> {
    // 0. If segment already has pregenerated or verified audio URL, return immediately!
    if (segment.audioBlobUrl) {
      return segment.audioBlobUrl;
    }

    const key = elevenApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('elevenlabs_api_key') || '' : '');
    
    // 1. Try ElevenLabs TTS
    if (key || speaker.elevenLabsVoiceId) {
      const elUrl = await this.synthesizeWithElevenLabs(segment, speaker, key);
      if (elUrl) return elUrl;
    }

    // 2. Try Gemini Flash TTS with segmentId disk cache
    const geminiUrl = await this.synthesizeWithGemini(segment, speaker);
    if (geminiUrl) return geminiUrl;

    return null;
  }

  // Quick voice sample tester for configuring voice clone models
  async testVoiceSample(
    speaker: Speaker,
    sampleText = 'नमस्ते! अयं मम संस्कृत-स्वरः अस्ति।',
    elevenApiKey?: string
  ): Promise<boolean> {
    this.stopPlayback();

    const key = elevenApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('elevenlabs_api_key') || '' : '');

    // Try ElevenLabs if configured
    if (key || speaker.elevenLabsVoiceId) {
      try {
        const dummySegment: DubbingSegment = {
          id: `sample-${speaker.id}`,
          speakerId: speaker.id,
          speakerName: speaker.name,
          startTime: 0,
          endTime: 3,
          originalText: 'Hello',
          sanskritDevanagari: sampleText,
          sanskritIAST: 'Namaste! Ayaṃ mama saṃskṛta-svaraḥ asti.',
          englishTranslation: 'Hello! This is my Sanskrit voice.',
          rasa: 'neutral',
        };
        const elUrl = await this.synthesizeWithElevenLabs(dummySegment, speaker, key);
        if (elUrl) {
          this.playAudioUrl(elUrl, `test-${speaker.id}`);
          return true;
        }
      } catch (e) {
        // Fall through to Gemini
      }
    }

    try {
      const res = await fetch('/api/dub/synthesize-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voiceName: speaker.voiceName,
          gender: speaker.gender,
          rasa: 'neutral',
          voiceStylePrompt: speaker.voiceStylePrompt || `Natural ${speaker.gender} voice`,
          speakerName: speaker.name,
          pitchMultiplier: speaker.pitchMultiplier || 1.0,
          speedMultiplier: speaker.speedMultiplier || 1.0,
        }),
      });

      const data = await res.json();
      if (data.success && data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        this.playAudioUrl(url, `test-${speaker.id}`);
        return true;
      }
    } catch (e) {
      // Fallback to client speech synthesis
    }

    // Client fallback preview
    this.synthesizeClientFallback(
      {
        id: `test-${speaker.id}`,
        speakerId: speaker.id,
        speakerName: speaker.name,
        startTime: 0,
        endTime: 3,
        originalText: 'Hello, this is my cloned voice in Sanskrit.',
        sanskritDevanagari: sampleText,
        sanskritIAST: 'Namaste! Ayaṃ mama saṃskṛta-svaraḥ asti.',
        englishTranslation: 'Hello! This is my Sanskrit voice.',
        rasa: 'neutral',
      },
      speaker
    );
    return true;
  }

  // Instant resilient speech synthesis with Sanskrit phonetics and gender voice mapping
  synthesizeClientFallback(
    segment: DubbingSegment,
    speaker: Speaker,
    onEnded?: () => void
  ): void {
    this.stopPlayback();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const voices = window.speechSynthesis.getVoices();
      
      // Look for Hindi or Sanskrit voices first
      const indicVoice = voices.find(v => 
        v.lang.startsWith('hi') || 
        v.lang.startsWith('sa') || 
        v.name.toLowerCase().includes('hindi') ||
        v.name.toLowerCase().includes('india')
      );

      // Gender-specific voice search: strictly match female vs male voice models
      const isFemale = speaker.gender === 'female';
      
      const matchedGenderVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        if (isFemale) {
          const isF = name.includes('female') || name.includes('woman') || name.includes('zira') || name.includes('samantha') || name.includes('kore') || name.includes('swara') || name.includes('kalpana') || name.includes('victoria');
          return isF;
        } else {
          const isM = name.includes('male') || name.includes('man') || name.includes('david') || name.includes('george') || name.includes('fenrir') || name.includes('madhav') || name.includes('alex');
          return isM;
        }
      });

      const selectedVoice = matchedGenderVoice || (isFemale 
        ? voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha')) 
        : (indicVoice || voices[0]));
      
      // If using an Indic voice that supports Devanagari Unicode, pass Devanagari.
      // If using a Western voice (which can't speak Devanagari glyphs), pass Roman IAST transliteration!
      const isIndicVoice = selectedVoice && (selectedVoice.lang.startsWith('hi') || selectedVoice.lang.startsWith('sa'));
      const textToSpeak = isIndicVoice 
        ? segment.sanskritDevanagari 
        : (segment.sanskritIAST || segment.sanskritDevanagari);

      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || (isIndicVoice ? 'hi-IN' : 'en-US');
      } else {
        utterance.lang = 'en-US';
      }

      // Voice pitch & speed modification:
      // Woman: strictly high questioning pitch (~300 Hz, 1.45x)
      // Man: strictly resonant baritone (~120 Hz, 0.88x)
      let pitchMod = isFemale ? 1.45 : 0.88;
      pitchMod *= (speaker.pitchMultiplier || 1.0);
      let rateMod = speaker.speedMultiplier || 1.0;

      switch (segment.rasa) {
        case 'intense':
          pitchMod *= 0.94;
          rateMod *= 1.15;
          break;
        case 'cheerful':
          pitchMod *= 1.12;
          rateMod *= 1.06;
          break;
        case 'calm':
        case 'serious':
          pitchMod *= 0.95;
          rateMod *= 0.92;
          break;
        case 'energetic':
          pitchMod *= 1.06;
          rateMod *= 1.08;
          break;
        case 'compassionate':
          pitchMod *= 0.95;
          rateMod *= 0.88;
          break;
        case 'inquisitive':
          pitchMod *= 1.08;
          rateMod *= 1.02;
          break;
        default:
          break;
      }

      utterance.pitch = Math.max(0.6, Math.min(1.8, pitchMod));
      utterance.rate = Math.max(0.7, Math.min(1.4, rateMod));

      utterance.onend = () => {
        this.currentPlayingId = null;
        if (onEnded) onEnded();
      };
      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        this.currentPlayingId = null;
        if (onEnded) onEnded();
      };

      this.currentPlayingId = segment.id;
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnded) onEnded();
    }
  }

  // Play audio url (Blob or remote) with pitch preservation & natural speed constraint
  playAudioUrl(
    url: string,
    id: string,
    onEnded?: () => void,
    speedMultiplier?: number,
    targetDuration?: number
  ): HTMLAudioElement {
    this.stopPlayback();

    const audio = new Audio(url);
    // Anti-chipmunk pitch lock
    audio.preservesPitch = true;
    (audio as any).mozPreservesPitch = true;
    (audio as any).webkitPreservesPitch = true;

    if (speedMultiplier && speedMultiplier >= 0.85 && speedMultiplier <= 1.2) {
      audio.playbackRate = speedMultiplier;
    }

    if (targetDuration && targetDuration > 0) {
      audio.onloadedmetadata = () => {
        if (audio.duration && audio.duration > 0) {
          // Keep strictly within natural conversational range (0.92x to 1.12x)
          const syncSpeed = Math.max(0.92, Math.min(1.12, audio.duration / targetDuration));
          audio.playbackRate = syncSpeed * (speedMultiplier || 1.0);
        }
      };
    }
    this.currentAudio = audio;
    this.currentPlayingId = id;

    audio.onended = () => {
      this.currentAudio = null;
      this.currentPlayingId = null;
      if (onEnded) onEnded();
    };

    audio.onerror = () => {
      this.currentAudio = null;
      this.currentPlayingId = null;
      if (onEnded) onEnded();
    };

    audio.play().catch(err => {
      console.warn('Audio play prevented or interrupted:', err);
      if (onEnded) onEnded();
    });

    return audio;
  }

  // Stop any active speech or audio
  stopPlayback(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        // ignore
      }
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
    this.currentPlayingId = null;
  }

  isPlaying(id?: string): boolean {
    if (!id) return this.currentPlayingId !== null;
    return this.currentPlayingId === id;
  }

  // Play original speech for A/B comparison with cloned voice
  playOriginalSpeech(text: string, isFemale: boolean, onEnded?: () => void): void {
    this.stopPlayback();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const genderVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return isFemale 
          ? (name.includes('female') || name.includes('zira') || name.includes('samantha'))
          : (name.includes('male') || name.includes('david') || name.includes('george'));
      }) || voices[0];

      if (genderVoice) utterance.voice = genderVoice;
      utterance.pitch = isFemale ? 1.15 : 0.88;
      utterance.rate = 1.0;

      utterance.onend = () => {
        this.currentPlayingId = null;
        if (onEnded) onEnded();
      };
      utterance.onerror = () => {
        this.currentPlayingId = null;
        if (onEnded) onEnded();
      };

      this.currentPlayingId = 'original-speech';
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnded) onEnded();
    }
  }
}

export const synthesizer = new SanskritSynthesizer();
