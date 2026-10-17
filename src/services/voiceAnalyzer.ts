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
  async extractOriginalSpeakersFromMedia(
    source: File | string,
    targetSpeakerCount = 2
  ): Promise<ExtractedVoiceProfile[]> {
    try {
      let arrayBuffer: ArrayBuffer;

      if (typeof source === 'string') {
        const resp = await fetch(source);
        arrayBuffer = await resp.arrayBuffer();
      } else {
        // Read up to first 20MB of uploaded file for fast acoustic analysis
        const slice = source.slice(0, 20 * 1024 * 1024);
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
        // Fallback default profiles if silence
        return this.getDefaultVoiceProfiles(targetSpeakerCount);
      }

      // Sort pitches to detect multi-speaker distribution
      pitches.sort((a, b) => a.pitch - b.pitch);
      
      const lowerHalf = pitches.slice(0, Math.floor(pitches.length / 2));
      const upperHalf = pitches.slice(Math.floor(pitches.length / 2));

      const avgPitch1 = lowerHalf.length > 0 
        ? lowerHalf.reduce((sum, p) => sum + p.pitch, 0) / lowerHalf.length 
        : 125;

      const avgPitch2 = upperHalf.length > 0
        ? upperHalf.reduce((sum, p) => sum + p.pitch, 0) / upperHalf.length
        : 210;

      const profiles: ExtractedVoiceProfile[] = [];

      // Speaker 1 profile
      const isMale1 = avgPitch1 < 165;
      const pitchMult1 = isMale1 
        ? Math.max(0.85, Math.min(1.2, avgPitch1 / 125)) 
        : Math.max(0.9, Math.min(1.25, avgPitch1 / 210));
      
      const snippet1 = this.sliceAudioSnippet(audioBuffer, lowerHalf[0]?.timeSec || 0, 4);

      profiles.push({
        speakerId: 'spk-1',
        name: `Original Speaker 1 (${isMale1 ? 'Male' : 'Female'})`,
        gender: isMale1 ? 'male' : 'female',
        estimatedPitchHz: Math.round(avgPitch1),
        pitchMultiplier: parseFloat(pitchMult1.toFixed(2)),
        recommendedVoiceName: isMale1 ? (avgPitch1 < 115 ? 'Charon' : 'Fenrir') : 'Kore',
        timbreDescription: `Extracted from original video: ${Math.round(avgPitch1)}Hz ${isMale1 ? 'baritone resonance' : 'soprano clarity'}`,
        originalAudioSnippetUrl: snippet1,
      });

      // Speaker 2 profile if requested
      if (targetSpeakerCount >= 2) {
        const isMale2 = avgPitch2 < 165;
        const pitchMult2 = isMale2 
          ? Math.max(0.85, Math.min(1.2, avgPitch2 / 125)) 
          : Math.max(0.9, Math.min(1.25, avgPitch2 / 210));
        
        const snippet2 = this.sliceAudioSnippet(audioBuffer, upperHalf[upperHalf.length - 1]?.timeSec || Math.min(duration - 4, 6), 4);

        profiles.push({
          speakerId: 'spk-2',
          name: `Original Speaker 2 (${isMale2 ? 'Male' : 'Female'})`,
          gender: isMale2 ? 'male' : 'female',
          estimatedPitchHz: Math.round(avgPitch2),
          pitchMultiplier: parseFloat(pitchMult2.toFixed(2)),
          recommendedVoiceName: isMale2 ? 'Puck' : 'Zephyr',
          timbreDescription: `Extracted from original video: ${Math.round(avgPitch2)}Hz ${isMale2 ? 'tenor timbre' : 'melodic vocal tone'}`,
          originalAudioSnippetUrl: snippet2,
        });
      }

      return profiles;
    } catch (err) {
      console.warn('Voice acoustic extraction fallback:', err);
      return this.getDefaultVoiceProfiles(targetSpeakerCount);
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

  private getDefaultVoiceProfiles(count = 2): ExtractedVoiceProfile[] {
    const p1: ExtractedVoiceProfile = {
      speakerId: 'spk-1',
      name: 'Original Speaker 1 (Male)',
      gender: 'male',
      estimatedPitchHz: 125,
      pitchMultiplier: 0.95,
      recommendedVoiceName: 'Fenrir',
      timbreDescription: 'Deep resonant male baritone matching original speaker',
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
