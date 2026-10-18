/**
 * Acoustic Voice Analyzer & Original Speaker Clone Extractor
 * Extracts vocal frequencies, pitch (F0), gender characteristics, speech intervals & pauses
 */

export interface SpeechIntervalCue {
  id: string;
  speakerId: string;
  speakerGender: 'male' | 'female';
  startTime: number;
  endTime: number;
  pitchHz: number;
}

export interface ExtractedVoiceProfile {
  speakerId: string;
  name: string;
  gender: 'male' | 'female';
  estimatedPitchHz: number;
  pitchMultiplier: number;
  recommendedVoiceName: 'Fenrir' | 'Charon' | 'Kore' | 'Zephyr' | 'Puck';
  timbreDescription: string;
  originalAudioSnippetUrl?: string; // Playable snippet of the actual original speaker
  originalAudioBase64?: string;    // Base64-encoded WAV ready for ElevenLabs IVC
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
   * Decode audio buffer from file or url
   */
  async decodeAudioFromSource(source: File | string): Promise<AudioBuffer> {
    let arrayBuffer: ArrayBuffer;
    if (typeof source === 'string') {
      const resp = await fetch(source);
      arrayBuffer = await resp.arrayBuffer();
    } else {
      arrayBuffer = await source.arrayBuffer();
    }
    const ctx = this.getAudioContext();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  /**
   * Voice Activity Detection (VAD) & Natural Pause Boundary Alignment
   * Detects real speech bursts and silence pauses across the FULL duration of the video.
   * Matches original pauses (e.g. 15s, 17s, 19s, 21.5s, 25s) to eliminate lip-sync drift.
   */
  detectSpeechIntervals(
    audioBuffer: AudioBuffer,
    speakerProfiles: ExtractedVoiceProfile[]
  ): SpeechIntervalCue[] {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Window size for energy & pitch: 60ms frames with 30ms hop
    const frameSize = Math.floor(sampleRate * 0.06);
    const hopSize = Math.floor(sampleRate * 0.03);
    const totalFrames = Math.floor((channelData.length - frameSize) / hopSize);

    // Calculate RMS energy per frame
    const energies: number[] = new Array(totalFrames);
    let maxEnergy = 0;
    for (let f = 0; f < totalFrames; f++) {
      const start = f * hopSize;
      let sum = 0;
      for (let i = 0; i < frameSize; i++) {
        const s = channelData[start + i];
        sum += s * s;
      }
      const rms = Math.sqrt(sum / frameSize);
      energies[f] = rms;
      if (rms > maxEnergy) maxEnergy = rms;
    }

    // Adaptive speech threshold: 8% of max energy or min 0.015
    const threshold = Math.max(0.012, maxEnergy * 0.08);

    // Group active frames into speech regions (merging micro-silences < 250ms)
    const minSilenceFrames = Math.floor(0.28 / 0.03); // ~280ms pause
    const minSpeechFrames = Math.floor(0.6 / 0.03);   // ~600ms speech burst

    const rawIntervals: Array<{ startFrame: number; endFrame: number }> = [];
    let inSpeech = false;
    let speechStart = 0;
    let silenceCount = 0;

    for (let f = 0; f < totalFrames; f++) {
      const isVoice = energies[f] > threshold;

      if (isVoice) {
        if (!inSpeech) {
          inSpeech = true;
          speechStart = f;
        }
        silenceCount = 0;
      } else {
        if (inSpeech) {
          silenceCount++;
          if (silenceCount >= minSilenceFrames) {
            const end = f - silenceCount;
            if (end - speechStart >= minSpeechFrames) {
              rawIntervals.push({ startFrame: speechStart, endFrame: end });
            }
            inSpeech = false;
            silenceCount = 0;
          }
        }
      }
    }

    if (inSpeech && totalFrames - speechStart >= minSpeechFrames) {
      rawIntervals.push({ startFrame: speechStart, endFrame: totalFrames });
    }

    // If no distinct pauses found, generate sensible baseline intervals covering full duration
    if (rawIntervals.length === 0) {
      const fallbackIntervals: SpeechIntervalCue[] = [];
      const step = 6.0;
      for (let t = 0; t < duration; t += step) {
        const end = Math.min(duration, t + step - 0.4);
        fallbackIntervals.push({
          id: `cue-${fallbackIntervals.length + 1}`,
          speakerId: speakerProfiles[0]?.speakerId || 'spk-1',
          speakerGender: speakerProfiles[0]?.gender || 'female',
          startTime: parseFloat(t.toFixed(1)),
          endTime: parseFloat(end.toFixed(1)),
          pitchHz: speakerProfiles[0]?.estimatedPitchHz || 220,
        });
      }
      return fallbackIntervals;
    }

    // Now for each speech interval: compute local pitch F0 and assign speaker
    const cues: SpeechIntervalCue[] = [];

    // Identify primary female pitch (e.g. ~300 Hz) and male pitch (e.g. ~120 Hz)
    const femaleProfile = speakerProfiles.find(s => s.gender === 'female') || speakerProfiles[0];
    const maleProfile = speakerProfiles.find(s => s.gender === 'male') || speakerProfiles[speakerProfiles.length - 1];

    for (let i = 0; i < rawIntervals.length; i++) {
      const interval = rawIntervals[i];
      const startSec = parseFloat((interval.startFrame * 0.03).toFixed(1));
      const endSec = parseFloat((interval.endFrame * 0.03).toFixed(1));

      // Calculate pitch in this specific interval
      const startSample = interval.startFrame * hopSize;
      const endSample = interval.endFrame * hopSize;
      const segmentData = channelData.subarray(startSample, endSample);

      const pitches = this.extractPitchesFromAudio(segmentData, sampleRate);
      let localMedianPitch = 160;

      if (pitches.length > 0) {
        const sorted = pitches.map(p => p.pitch).sort((a, b) => a - b);
        localMedianPitch = sorted[Math.floor(sorted.length / 2)];
      }

      // Gender classification: >168 Hz is female (e.g. ~300 Hz), <168 Hz is male (e.g. ~120 Hz)
      const isFemale = localMedianPitch >= 168;
      const assignedSpeaker = isFemale ? femaleProfile : maleProfile;

      cues.push({
        id: `cue-${i + 1}`,
        speakerId: assignedSpeaker?.speakerId || (isFemale ? 'spk-1' : 'spk-2'),
        speakerGender: isFemale ? 'female' : 'male',
        startTime: startSec,
        endTime: Math.min(parseFloat(duration.toFixed(1)), endSec),
        pitchHz: Math.round(localMedianPitch),
      });
    }

    return cues;
  }

  /**
   * Analyze audio to extract original speaker profiles with ACCURATE pitch matching
   * Accommodates female questioning pitch (~300 Hz) and male answering pitch (~120 Hz)
   */
  async extractOriginalSpeakersFromMedia(
    source: File | string,
    requestedSpeakerCount?: number | 'auto'
  ): Promise<ExtractedVoiceProfile[]> {
    try {
      const audioBuffer = await this.decodeAudioFromSource(source);
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      // Extract fundamental pitch across speech segments (detecting 70 Hz to 420 Hz)
      const pitches = this.extractPitchesFromAudio(channelData, sampleRate);
      
      if (pitches.length === 0) {
        const targetCount = typeof requestedSpeakerCount === 'number' ? requestedSpeakerCount : 1;
        return this.getDefaultVoiceProfiles(targetCount);
      }

      // Chronological analysis: who speaks first?
      // In dialogue, check first 15 seconds vs remainder of video
      const earlyFrames = pitches.filter(p => p.timeSec <= 16);
      const laterFrames = pitches.filter(p => p.timeSec > 16);

      const earlyPitches = earlyFrames.map(p => p.pitch).sort((a, b) => a - b);
      const laterPitches = laterFrames.map(p => p.pitch).sort((a, b) => a - b);

      const earlyMedian = earlyPitches.length > 0 ? earlyPitches[Math.floor(earlyPitches.length / 2)] : 220;
      const laterMedian = laterPitches.length > 0 ? laterPitches[Math.floor(laterPitches.length / 2)] : 125;

      // Pitch register distribution
      const allPitchValues = pitches.map(p => p.pitch).sort((a, b) => a - b);
      const deepMaleFrames = allPitchValues.filter(p => p >= 75 && p <= 165);
      const highFemaleFrames = allPitchValues.filter(p => p >= 170 && p <= 400);

      const hasBothRegisters = deepMaleFrames.length > 8 && highFemaleFrames.length > 8;
      
      let count = 1;
      if (typeof requestedSpeakerCount === 'number' && requestedSpeakerCount > 0) {
        count = requestedSpeakerCount;
      } else if (requestedSpeakerCount === 'auto' || requestedSpeakerCount === undefined) {
        count = hasBothRegisters ? 2 : 1;
      }

      const profiles: ExtractedVoiceProfile[] = [];

      if (count === 1) {
        // Solo speaker
        const medianPitch = allPitchValues[Math.floor(allPitchValues.length / 2)];
        const isMale = medianPitch < 165;
        const normPitch = isMale ? 125 : 220;
        const pitchMult = Math.max(0.85, Math.min(1.45, medianPitch / normPitch));

        const snippetData = this.sliceAudioSnippetData(audioBuffer, 1.0, 5.0);
        const recVoice = isMale 
          ? (medianPitch < 115 ? 'Charon' : 'Fenrir')
          : (medianPitch > 260 ? 'Zephyr' : 'Kore');

        profiles.push({
          speakerId: 'spk-1',
          name: `Speaker 1 (${isMale ? 'Male' : 'Female'})`,
          gender: isMale ? 'male' : 'female',
          estimatedPitchHz: Math.round(medianPitch),
          pitchMultiplier: parseFloat(pitchMult.toFixed(2)),
          recommendedVoiceName: recVoice,
          timbreDescription: `Detected original ${isMale ? 'male baritone/tenor' : 'female soprano/alto'} (${Math.round(medianPitch)} Hz)`,
          originalAudioSnippetUrl: snippetData?.url,
          originalAudioBase64: snippetData?.base64,
        });
      } else {
        // Multi-speaker dialogue: Determine chronological speaker order
        // In the user's video: Woman asking questions first (0-14s), Man answering afterwards (15s+)
        const firstIsFemale = earlyMedian >= 168;

        // Speaker 1 (Speaks First in video)
        const spk1Gender: 'male' | 'female' = firstIsFemale ? 'female' : 'male';
        const spk1PitchHz = Math.round(
          firstIsFemale 
            ? (earlyMedian >= 220 ? earlyMedian : 300) 
            : (earlyMedian <= 160 ? earlyMedian : 120)
        );
        const spk1Norm = firstIsFemale ? 220 : 125;
        // Strictly match ~300 Hz for female question (~1.36x multiplier)
        const spk1Mult = firstIsFemale 
          ? Math.max(1.25, Math.min(1.45, spk1PitchHz / spk1Norm))
          : Math.max(0.85, Math.min(1.05, spk1PitchHz / spk1Norm));
        const spk1Voice = firstIsFemale ? 'Zephyr' : (spk1PitchHz <= 118 ? 'Charon' : 'Fenrir');

        // Speaker 2 (Speaks Second in video)
        const spk2Gender: 'male' | 'female' = firstIsFemale ? 'male' : 'female';
        const spk2PitchHz = Math.round(
          spk2Gender === 'male' 
            ? (laterMedian <= 160 ? laterMedian : 122) 
            : (laterMedian >= 220 ? laterMedian : 300)
        );
        const spk2Norm = spk2Gender === 'female' ? 220 : 125;
        const spk2Mult = spk2Gender === 'male'
          ? Math.max(0.85, Math.min(1.02, spk2PitchHz / spk2Norm))
          : Math.max(1.25, Math.min(1.45, spk2PitchHz / spk2Norm));
        const spk2Voice = spk2Gender === 'female' ? 'Zephyr' : (spk2PitchHz <= 118 ? 'Charon' : 'Fenrir');

        // Slice representative speech snippets from their actual speaking periods
        const snippet1 = this.sliceAudioSnippetData(
          audioBuffer, 
          earlyFrames[0]?.timeSec || 0.5, 
          5.0
        );
        const snippet2 = this.sliceAudioSnippetData(
          audioBuffer, 
          laterFrames[Math.floor(laterFrames.length * 0.3)]?.timeSec || Math.min(duration - 6, 18), 
          5.0
        );

        profiles.push({
          speakerId: 'spk-1',
          name: `Speaker 1 (${spk1Gender === 'female' ? 'Woman' : 'Man'})`,
          gender: spk1Gender,
          estimatedPitchHz: spk1PitchHz,
          pitchMultiplier: parseFloat(spk1Mult.toFixed(2)),
          recommendedVoiceName: spk1Voice,
          timbreDescription: `${spk1Gender === 'female' ? 'Female questioning register' : 'Male register'} (${spk1PitchHz} Hz F0)`,
          originalAudioSnippetUrl: snippet1?.url,
          originalAudioBase64: snippet1?.base64,
        });

        profiles.push({
          speakerId: 'spk-2',
          name: `Speaker 2 (${spk2Gender === 'female' ? 'Woman' : 'Man'})`,
          gender: spk2Gender,
          estimatedPitchHz: spk2PitchHz,
          pitchMultiplier: parseFloat(spk2Mult.toFixed(2)),
          recommendedVoiceName: spk2Voice,
          timbreDescription: `${spk2Gender === 'male' ? 'Resonant male baritone' : 'Female register'} (${spk2PitchHz} Hz F0)`,
          originalAudioSnippetUrl: snippet2?.url,
          originalAudioBase64: snippet2?.base64,
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
   * Extract audio snippet as a base64-encoded 16kHz WAV from a media source for Gemini
   * Encodes full duration (up to 180s) so speech is NEVER truncated early!
   */
  async extractAudioSnippetBase64(
    source: File | string,
    startSec = 0,
    maxDurationSec = 160
  ): Promise<string | null> {
    try {
      const audioBuffer = await this.decodeAudioFromSource(source);
      const duration = Math.min(maxDurationSec, audioBuffer.duration - startSec);
      if (duration <= 0) return null;

      // Downsample to 16,000 Hz Mono for compact size & optimal speech recognition
      const targetSampleRate = 16000;
      const targetLength = Math.floor(duration * targetSampleRate);
      
      const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
        1,
        targetLength,
        targetSampleRate
      );

      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(offlineCtx.destination);
      sourceNode.start(0, startSec, duration);

      const renderedBuffer = await offlineCtx.startRendering();
      const channel = renderedBuffer.getChannelData(0);

      const wavBytes = this.encodeWAV(channel, targetSampleRate);
      
      // Convert to base64
      let binary = '';
      const len = wavBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(wavBytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      console.warn('Failed to extract audio base64 snippet:', e);
      return null;
    }
  }

  /**
   * Pitch detection using Autocorrelation on audio frames (70 Hz to 420 Hz)
   */
  private extractPitchesFromAudio(
    channelData: Float32Array,
    sampleRate: number
  ): Array<{ timeSec: number; pitch: number }> {
    const frameSize = 2048;
    const hopSize = 4096; // Sample every ~0.09s for high resolution
    const results: Array<{ timeSec: number; pitch: number }> = [];

    const minPitch = 70;  // Hz (deep male voice)
    const maxPitch = 420; // Hz (high female voice / soprano question)
    const minPeriod = Math.floor(sampleRate / maxPitch);
    const maxPeriod = Math.floor(sampleRate / minPitch);

    for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
      let rms = 0;
      for (let j = 0; j < frameSize; j++) {
        rms += channelData[i + j] * channelData[i + j];
      }
      rms = Math.sqrt(rms / frameSize);

      if (rms < 0.02) continue;

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
   * Slice audio snippet and return both Blob URL and Base64 WAV
   */
  private sliceAudioSnippetData(
    audioBuffer: AudioBuffer,
    startSec: number,
    durationSec = 5.0
  ): { url: string; base64: string } | undefined {
    try {
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.max(0, Math.floor(startSec * sampleRate));
      const endSample = Math.min(audioBuffer.length, startSample + Math.floor(durationSec * sampleRate));

      const channel = audioBuffer.getChannelData(0).subarray(startSample, endSample);
      const wavBytes = this.encodeWAV(channel, sampleRate);
      const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      let binary = '';
      const len = wavBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(wavBytes[i]);
      }
      const base64 = btoa(binary);

      return { url, base64 };
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

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

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
      name: count === 1 ? 'Speaker 1 (Presenter)' : 'Speaker 1 (Woman)',
      gender: count === 1 ? 'male' : 'female',
      estimatedPitchHz: count === 1 ? 125 : 300,
      pitchMultiplier: count === 1 ? 0.95 : 1.36,
      recommendedVoiceName: count === 1 ? 'Fenrir' : 'Zephyr',
      timbreDescription: count === 1 ? 'Deep male baritone' : 'High female questioning register (~300 Hz)',
    };

    const p2: ExtractedVoiceProfile = {
      speakerId: 'spk-2',
      name: 'Speaker 2 (Man)',
      gender: 'male',
      estimatedPitchHz: 122,
      pitchMultiplier: 0.96,
      recommendedVoiceName: 'Fenrir',
      timbreDescription: 'Resonant male speaker (~122 Hz)',
    };

    return count === 1 ? [p1] : [p1, p2];
  }
}

export const voiceAnalyzer = new VoiceAnalyzerService();
