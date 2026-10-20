export type EmotionType = 
  | 'neutral'
  | 'calm'
  | 'energetic'
  | 'cheerful'
  | 'serious'
  | 'compassionate'
  | 'intense'
  | 'inquisitive';

// Alias for backwards compatibility
export type RasaType = EmotionType;

export interface SanskritWordDetail {
  word: string;
  iast: string;
  meaning: string;
  grammar?: string;
}

export interface DubbingSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerGender?: 'male' | 'female';
  startTime: number; // in seconds
  endTime: number;   // in seconds
  originalText: string;
  sanskritDevanagari: string;
  sanskritIAST: string;
  englishTranslation: string;
  rasa: EmotionType; // emotion/tone
  timingFitNote?: string;
  wordsBreakdown?: SanskritWordDetail[];
  audioBase64?: string;
  audioStatus?: 'idle' | 'synthesizing' | 'ready' | 'error';
  audioBlobUrl?: string;
}

export interface Speaker {
  id: string;
  name: string;
  gender: 'male' | 'female';
  role: string;
  color: string;
  avatar: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  voiceStylePrompt: string;
  pitchMultiplier: number;
  speedMultiplier: number;
  isCloned?: boolean;
  clonedNotes?: string;
  voiceCloneType?: 'auto-extracted' | 'mic-recording' | 'preset' | 'video-original';
  timbreDescription?: string;
  clonedAudioUrl?: string;
  originalAudioSnippetUrl?: string;
  estimatedPitchHz?: number;
  originalAudioBase64?: string;
  elevenLabsVoiceId?: string;
  elevenLabsCloneStatus?: 'created' | 'pending' | 'verified';
}

export interface VideoProject {
  id: string;
  title: string;
  sanskritTitle: string;
  description: string;
  category: 'documentary' | 'science' | 'modern-tech' | 'storytelling';
  duration: number; // in seconds
  videoUrl?: string;
  originalVideoUrl?: string;
  canvasTheme?: 'cosmic' | 'nature' | 'tech';
  segments: DubbingSegment[];
  speakers: Speaker[];
  isCustomUpload?: boolean;
  autoDiarizationDone?: boolean;
  detectedSourceLanguage?: string;
  languageConfidence?: number;
}

export interface EmotionInfo {
  key: EmotionType;
  label: string;
  sanskritEquivalent: string;
  color: string;
  badgeBg: string;
  description: string;
  stylePrompt: string;
}

export type RasaInfo = EmotionInfo;
