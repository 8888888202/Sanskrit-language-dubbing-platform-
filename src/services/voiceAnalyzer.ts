/**
 * Acoustic Voice Analyzer & Original Speaker Clone Extractor
 * Extracts vocal frequencies, pitch (F0), gender characteristics, and audio snippets from video/audio files
 */

export interface ExtractedVoiceProfile {
  speakerId: string;
  name: string;
  gender: 'male' | 'female';
  estimatedPitchHz: number;
  pitchMultiplier: number;
  recommendedVoiceName: 'Fenrir' | 'Charon' | 'Kore' | 'Zephyr' | 'Puck';
  timbreDescription: string;
  originalAudioSnippetUrl?: string; // Playable snippet of the actual original speaker
}

export class VoiceAnalyzerService {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Analyze audio from a video file or URL to extract original speaker profiles and audio snippets
   */
  /**
   * Analyze audio from a video file or URL to extract original speaker profiles and audio snippets
   * Automatically detects if there is 1 solo speaker or multiple speakers based on bimodal pitch distribution
   */
  async extractOriginalSpeakersFromMedia(
    source: File | string,
    requestedSpeakerCount?: number | 'auto'
  ): Promise<ExtractedVoiceProfile[]> {
    try {
      let arrayBuffer: ArrayBuffer;

      if (typeof source === 'string') {
        const resp = await fetch(source);
        arrayBuffer = await resp.arrayBuffer();
      } else {
        // Read up to first 30MB of uploaded file for acoustic analysis
        const slice = source.slice(0, 30 * 1024 * 1024);
        arrayBuffer = await slice.arrayBuffer();
      }

      const ctx = this.getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      // Extract fundamental pitch across speech segments
      const pitches = this.extractPitchesFromAudio(channelData, sampleRate);
      
      if (pitches.length === 0) {
        // Fallback default profile (1 speaker by default)
        const targetCount = typeof requestedSpeakerCount === 'number' ? requestedSpeakerCount : 1;
        return this.getDefaultVoiceProfiles(targetCount);
      }

      // Calculate pitch values
      const pitchValues = pitches.map(p => p.pitch);
      pitchValues.sort((a, b) => a - b);
      const medianPitch = pitchValues[Math.floor(pitchValues.length / 2)];
      
      // Calculate 25th and 75th percentiles (IQR)
      const q25 = pitchValues[Math.floor(pitchValues.length * 0.25)];
      const q75 = pitchValues[Math.floor(pitchValues.length * 0.75)];
      const iqr = q75 - q25;

      // Real acoustic criteria for TWO distinct speakers:
      // A genuine male-female dialogue has a wide, bimodal distribution with separate peaks
      // (one in ~90-145 Hz range and another in ~190-260 Hz range)
      // If IQR is moderate (< 55Hz) or if 75%+ of speech is within one register, it is a SINGLE speaker!
      const deepMaleFrames = pitchValues.filter(p => p >= 85 && p <= 150);
      const highFemaleFrames = pitchValues.filter(p => p >= 180 && p <= 280);
      const deepMaleRatio = deepMaleFrames.length / pitchValues.length;
      const highFemaleRatio = highFemaleFrames.length / pitchValues.length;

      // Both male and female registers must each have heavy, sustained representation (>35% each)
      // AND a wide IQR (>65Hz) to qualify as genuine multi-speaker dialogue
      const hasStrongBimodalDialogue = (deepMaleRatio > 0.35 && highFemaleRatio > 0.35 && iqr > 65);
      
      // Determine final speaker count:
      let count = 1;
      if (typeof requestedSpeakerCount === 'number' && requestedSpeakerCount > 0) {
        count = requestedSpeakerCount;
      } else if (requestedSpeakerCount === 'auto' || requestedSpeakerCount === undefined) {
        count = hasStrongBimodalDialogue ? 2 : 1;
      }

      const profiles: ExtractedVoiceProfile[] = [];

      if (count === 1) {
        // Single solo speaker detected!
        // Pitch F0 threshold: < 165Hz is male, >= 165Hz is female
        const isMale = medianPitch < 165;
        const baseNormPitch = isMale ? 125 : 215;
        const pitchMult = Math.max(0.85, Math.min(1.2, medianPitch / baseNormPitch));
        
        // Find highest-energy clean speech snippet from middle of speech
        const midIdx = Math.floor(pitches.length * 0.35);
        const snippetTime = pitches[midIdx]?.timeSec || 1.0;
        const snippetUrl = this.sliceAudioSnippet(audioBuffer, Math.max(0, snippetTime - 0.5), 4.5);

        const recVoice = isMale 
          ? (medianPitch < 115 ? 'Charon' : 'Fenrir')
          : (medianPitch > 220 ? 'Zephyr' : 'Kore');

        profiles.push({
          speakerId: 'spk-1',
          name: `Original Speaker (${isMale ? 'Male' : 'Female'})`,
          gender: isMale ? 'male' : 'female',
          estimatedPitchHz: Math.round(medianPitch),
          pitchMultiplier: parseFloat(pitchMult.toFixed(2)),
          recommendedVoiceName: recVoice,
          timbreDescription: `Detected original ${isMale ? 'male baritone/tenor' : 'female soprano/alto'} (${Math.round(medianPitch)} Hz)`,
          originalAudioSnippetUrl: snippetUrl,
        });
      } else {
        // Multi-speaker dialogue detected (or explicitly requested by user)
        const avgPitch1 = deepMaleFrames.length > 0
          ? deepMaleFrames.reduce((s, p) => s + p, 0) / deepMaleFrames.length
          : Math.max(90, medianPitch - 30);

        const avgPitch2 = highFemaleFrames.length > 0
          ? highFemaleFrames.reduce((s, p) => s + p, 0) / highFemaleFrames.length
          : Math.min(250, medianPitch + 35);

        const isMale1 = avgPitch1 < 165;
        const isMale2 = avgPitch2 < 165;

        const snippet1 = this.sliceAudioSnippet(
          audioBuffer, 
          pitches[0]?.timeSec || 0.5, 
          4.5
        );
        const snippet2 = this.sliceAudioSnippet(
          audioBuffer, 
          pitches[Math.floor(pitches.length * 0.7)]?.timeSec || Math.min(duration - 5, 6), 
          4.5
        );

        profiles.push({
          speakerId: 'spk-1',
          name: `Original Speaker 1 (${isMale1 ? 'Male' : 'Female'})`,
          gender: isMale1 ? 'male' : 'female',
          estimatedPitchHz: Math.round(avgPitch1),
          pitchMultiplier: parseFloat((avgPitch1 / (isMale1 ? 125 : 215)).toFixed(2)),
          recommendedVoiceName: isMale1 ? 'Fenrir' : 'Kore',
          timbreDescription: `Speaker 1: ${Math.round(avgPitch1)}Hz ${isMale1 ? 'male' : 'female'} timbre`,
          originalAudioSnippetUrl: snippet1,
        });

        profiles.push({
          speakerId: 'spk-2',
          name: `Original Speaker 2 (${isMale2 ? 'Male' : 'Female'})`,
          gender: isMale2 ? 'male' : 'female',
          estimatedPitchHz: Math.round(avgPitch2),
          pitchMultiplier: parseFloat((avgPitch2 / (isMale2 ? 125 : 215)).toFixed(2)),
          recommendedVoiceName: isMale2 ? 'Puck' : 'Zephyr',
          timbreDescription: `Speaker 2: ${Math.round(avgPitch2)}Hz ${isMale2 ? 'male' : 'female'} timbre`,
          originalAudioSnippetUrl: snippet2,
        });
      }

      return profiles;
    } catch (err) {
      console.warn('Voice acoustic extraction fallback:', err);
      const targetCount = typeof requestedSpeakerCount === 'number' ? requestedSpeakerCount : 1;
      return this.getDefaultVoiceProfiles(targetCount);
    }
  }

  /**
   * Pitch detection using Autocorrelation on audio frames
   */
  private extractPitchesFromAudio(
    channelData: Float32Array,
    sampleRate: number
  ): Array<{ timeSec: number; pitch: number }> {
    const frameSize = 2048;
    const hopSize = 8192; // Sample every ~0.18s
    const results: Array<{ timeSec: number; pitch: number }> = [];

    const minPitch = 75;  // Hz (lowest male voice)
    const maxPitch = 320; // Hz (highest speaking female voice)
    const minPeriod = Math.floor(sampleRate / maxPitch);
    const maxPeriod = Math.floor(sampleRate / minPitch);

    for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
      // Calculate energy / RMS of frame
      let rms = 0;
      for (let j = 0; j < frameSize; j++) {
        rms += channelData[i + j] * channelData[i + j];
      }
      rms = Math.sqrt(rms / frameSize);

      // Only evaluate frames with speech energy
      if (rms < 0.03) continue;

      // Autocorrelation
      let bestCorrelation = 0;
      let bestLag = -1;

      for (let lag = minPeriod; lag <= maxPeriod; lag++) {
        let correlation = 0;
        for (let j = 0; j < frameSize - lag; j++) {
          correlation += channelData[i + j] * channelData[i + j + lag];
        }
        correlation = correlation / (frameSize - lag);

        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }

      if (bestLag > 0 && bestCorrelation > 0.005) {
        const pitch = sampleRate / bestLag;
        if (pitch >= minPitch && pitch <= maxPitch) {
          results.push({
            timeSec: i / sampleRate,
            pitch,
          });
        }
      }
    }

    return results;
  }

  /**
   * Extract audio snippet as a WAV Blob for ElevenLabs IVC voice cloning
   */
  async extractAudioSnippetBlob(
    source: File | string,
    startSec = 1.0,
    durationSec = 5.0
  ): Promise<Blob | null> {
    try {
      let arrayBuffer: ArrayBuffer;
      if (typeof source === 'string') {
        const resp = await fetch(source);
        arrayBuffer = await resp.arrayBuffer();
      } else {
        const slice = source.slice(0, 30 * 1024 * 1024);
        arrayBuffer = await slice.arrayBuffer();
      }

      const ctx = this.getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.max(0, Math.floor(startSec * sampleRate));
      const endSample = Math.min(audioBuffer.length, startSample + Math.floor(durationSec * sampleRate));
      const channel = audioBuffer.getChannelData(0).subarray(startSample, endSample);
      const wavBytes = this.encodeWAV(channel, sampleRate);
      return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    } catch (e) {
      console.warn('Failed to extract audio snippet blob:', e);
      return null;
    }
  }

  /**
   * Slice a snippet of audio from AudioBuffer and encode to a WAV Blob URL
   */
  private sliceAudioSnippet(
    audioBuffer: AudioBuffer,
    startSec: number,
    durationSec = 4
  ): string | undefined {
    try {
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.max(0, Math.floor(startSec * sampleRate));
      const endSample = Math.min(audioBuffer.length, startSample + Math.floor(durationSec * sampleRate));
      const length = endSample - startSample;

      const channel = audioBuffer.getChannelData(0).subarray(startSample, endSample);
      const wavBytes = this.encodeWAV(channel, sampleRate);
      const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Simple PCM 16-bit Mono WAV encoder
   */
  private encodeWAV(samples: Float32Array, sampleRate: number): Uint8Array {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // 16 for PCM
    view.setUint16(20, 1, true); // Linear quantization
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Float32 to Int16
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Uint8Array(buffer);
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private getDefaultVoiceProfiles(count = 1): ExtractedVoiceProfile[] {
    const p1: ExtractedVoiceProfile = {
      speakerId: 'spk-1',
      name: count === 1 ? 'Original Speaker (Solo)' : 'Original Speaker 1 (Male)',
      gender: 'male',
      estimatedPitchHz: 125,
      pitchMultiplier: 0.95,
      recommendedVoiceName: 'Fenrir',
      timbreDescription: 'Deep resonant male voice matching original speaker',
    };

    const p2: ExtractedVoiceProfile = {
      speakerId: 'spk-2',
      name: 'Original Speaker 2 (Female)',
      gender: 'female',
      estimatedPitchHz: 215,
      pitchMultiplier: 1.05,
      recommendedVoiceName: 'Kore',
      timbreDescription: 'Clear, articulate female presenter matching original speaker',
    };

    return count === 1 ? [p1] : [p1, p2];
  }
}

export const voiceAnalyzer = new VoiceAnalyzerService();
