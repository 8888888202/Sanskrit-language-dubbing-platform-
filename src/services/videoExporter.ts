/**
 * Video & Audio Export Engine for VakSutra Sanskrit Dubbing Studio
 * Handles in-browser rendering of dubbed video (.webm/.mp4) and master audio (.wav)
 */

import { VideoProject, DubbingSegment } from '../types';

export interface WatermarkOptions {
  enabled: boolean;
  style: 'broadcast' | 'cinematic' | 'minimal' | 'custom';
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  customText?: string;
  opacity?: number;
}

export interface VideoExportOptions {
  resolution: '720p' | '1080p' | '540p';
  subtitlesMode: 'devanagari' | 'iast' | 'dual' | 'off';
  includeVideoVisuals: boolean;
  audioMode: 'dubbed' | 'mixed';
  watermark?: WatermarkOptions;
}

export class VideoExporterService {
  /**
   * Export Master Dubbed Audio as 16-bit 44.1kHz Stereo WAV
   */
  async exportMasterAudioWav(
    project: VideoProject,
    onProgress?: (percent: number, status: string) => void
  ): Promise<Blob> {
    onProgress?.(10, 'Initializing audio mixer...');
    const sampleRate = 44100;
    const duration = Math.max(2, Math.ceil(project.duration));
    const totalFrames = duration * sampleRate;

    // Use OfflineAudioContext to render all segment tracks at their precise timestamps
    const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
      2,
      totalFrames,
      sampleRate
    );

    const segments = project.segments;
    let loadedCount = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      onProgress?.(
        15 + Math.floor((i / segments.length) * 55),
        `Mixing Sanskrit speech segment ${i + 1}/${segments.length}...`
      );

      try {
        let audioBuffer: AudioBuffer | null = null;

        if (seg.audioBlobUrl) {
          const resp = await fetch(seg.audioBlobUrl);
          const ab = await resp.arrayBuffer();
          audioBuffer = await offlineCtx.decodeAudioData(ab);
        }

        if (!audioBuffer) {
          // Generate a synthetic harmonic speech buffer for this segment
          const spk = project.speakers.find(s => s.id === seg.speakerId) || project.speakers[0];
          audioBuffer = this.generateSyntheticSegmentBuffer(
            offlineCtx,
            seg.endTime - seg.startTime,
            spk.gender === 'female'
          );
        }

        if (audioBuffer) {
          const source = offlineCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineCtx.destination);
          source.start(Math.max(0, seg.startTime));
          loadedCount++;
        }
      } catch (err) {
        console.warn('Audio segment mix fallback:', err);
      }
    }

    onProgress?.(75, 'Rendering master audio track...');
    const renderedBuffer = await offlineCtx.startRendering();

    onProgress?.(90, 'Encoding 16-bit PCM WAV...');
    const wavBytes = this.audioBufferToWav(renderedBuffer);
    const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });

    onProgress?.(100, 'Master audio ready!');
    return wavBlob;
  }

  /**
   * Render Dubbed Video with Synchronized Cloned Sanskrit Audio & Burned-in Subtitles & Watermark
   */
  async renderDubbedVideo(
    project: VideoProject,
    sourceVideoElement: HTMLVideoElement | null,
    options: VideoExportOptions,
    onProgress?: (percent: number, status: string) => void
  ): Promise<Blob> {
    onProgress?.(5, 'Preparing render canvas & audio mixer...');

    // Determine dimensions
    const width = options.resolution === '1080p' ? 1920 : options.resolution === '720p' ? 1280 : 960;
    const height = options.resolution === '1080p' ? 1080 : options.resolution === '720p' ? 720 : 540;

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = width;
    renderCanvas.height = height;
    const ctx = renderCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');

    // Setup Web Audio API real-time mixer for MediaRecorder stream
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const audioDest = audioCtx.createMediaStreamDestination();

    // Prepare all segment audio elements / buffers
    const decodedSegments: Array<{
      segment: DubbingSegment;
      buffer: AudioBuffer;
    }> = [];

    onProgress?.(12, 'Decoding Sanskrit cloned voice stems...');
    for (let i = 0; i < project.segments.length; i++) {
      const seg = project.segments[i];
      try {
        let buffer: AudioBuffer | null = null;
        if (seg.audioBlobUrl) {
          const r = await fetch(seg.audioBlobUrl);
          const ab = await r.arrayBuffer();
          buffer = await audioCtx.decodeAudioData(ab);
        }
        if (!buffer) {
          const spk = project.speakers.find(s => s.id === seg.speakerId) || project.speakers[0];
          buffer = this.generateSyntheticSegmentBuffer(
            audioCtx,
            seg.endTime - seg.startTime,
            spk.gender === 'female'
          );
        }
        decodedSegments.push({ segment: seg, buffer });
      } catch (e) {
        console.warn('Segment decode skipped for export:', e);
      }
    }

    // Set up dedicated render video element for source video if available
    let activeVideoElement: HTMLVideoElement | null = null;
    const hasSourceVideo = Boolean(project.videoUrl || (sourceVideoElement && sourceVideoElement.src));

    if (hasSourceVideo) {
      onProgress?.(20, 'Loading and preparing source video tracks...');
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      vid.src = project.videoUrl || sourceVideoElement?.src || '';

      // Wait for video to load metadata and initial frame
      await new Promise<void>((resolve) => {
        if (vid.readyState >= 2) return resolve();
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);

        const onReady = () => {
          clearTimeout(timeout);
          vid.removeEventListener('loadeddata', onReady);
          vid.removeEventListener('canplay', onReady);
          resolve();
        };

        vid.addEventListener('loadeddata', onReady);
        vid.addEventListener('canplay', onReady);
      });

      vid.currentTime = 0;
      activeVideoElement = vid;
    }

    // Capture canvas stream at 30fps
    const canvasStream = renderCanvas.captureStream(30);

    // Merge canvas video track and audio destination track
    const combinedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
    audioDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

    // Determine supported mime type
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
      mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      mimeType = 'video/webm;codecs=vp8,opus';
    } else {
      mimeType = 'video/webm';
    }

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 4_500_000,
    });

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise((resolve, reject) => {
      let isCleanedUp = false;
      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        if (activeVideoElement) {
          activeVideoElement.pause();
          activeVideoElement.src = '';
          activeVideoElement = null;
        }
        audioCtx.close().catch(() => {});
      };

      mediaRecorder.onstop = () => {
        cleanup();
        const finalBlob = new Blob(recordedChunks, { type: mimeType });
        onProgress?.(100, 'Video export complete!');
        resolve(finalBlob);
      };

      mediaRecorder.onerror = err => {
        cleanup();
        reject(err);
      };

      // Start recording
      mediaRecorder.start(100);

      // Start video playback in sync with audio
      if (activeVideoElement) {
        activeVideoElement.currentTime = 0;
        activeVideoElement.play().catch(e => console.warn('Export video play warning:', e));
        
        // Loop video if dubbing duration is longer than the source video
        activeVideoElement.addEventListener('ended', () => {
          if (activeVideoElement && !isCleanedUp) {
            activeVideoElement.currentTime = 0;
            activeVideoElement.play().catch(() => {});
          }
        });
      }

      // Play audio stems at their designated timestamps
      const startTimeAudio = audioCtx.currentTime;
      decodedSegments.forEach(({ segment, buffer }) => {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioDest);
        source.start(startTimeAudio + Math.max(0, segment.startTime));
      });

      // Frame rendering loop (runs through project.duration in real time)
      const durationSec = Math.max(3, project.duration);
      const fps = 30;
      const totalFrames = Math.ceil(durationSec * fps);
      let currentFrame = 0;

      const frameInterval = 1000 / fps;

      const renderIntervalId = window.setInterval(() => {
        currentFrame++;
        const currentSec = (currentFrame / totalFrames) * durationSec;
        const pct = Math.min(98, Math.floor((currentFrame / totalFrames) * 80) + 18);
        onProgress?.(pct, `Rendering video frame ${currentFrame}/${totalFrames} (${currentSec.toFixed(1)}s)...`);

        // Find active segment for subtitles
        const activeSegment = project.segments.find(
          s => currentSec >= s.startTime && currentSec <= s.endTime
        ) || null;

        const activeSpeaker = activeSegment
          ? project.speakers.find(s => s.id === activeSegment.speakerId) || null
          : null;

        // Render frame visuals
        this.drawVideoFrame(
          ctx,
          width,
          height,
          currentSec,
          project,
          activeSegment,
          activeSpeaker,
          activeVideoElement || sourceVideoElement,
          options.subtitlesMode,
          options.watermark
        );

        if (currentFrame >= totalFrames) {
          clearInterval(renderIntervalId);
          setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 350);
        }
      }, frameInterval);
    });
  }

  /**
   * Draw visual video frame (real video element or clean procedural studio visual) with subtitles overlay and watermark
   */
  private drawVideoFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentSec: number,
    project: VideoProject,
    activeSegment: DubbingSegment | null,
    activeSpeaker: any | null,
    sourceVideoElement: HTMLVideoElement | null,
    subtitlesMode: 'devanagari' | 'iast' | 'dual' | 'off',
    watermark?: WatermarkOptions
  ) {
    ctx.clearRect(0, 0, width, height);

    const hasVideo = Boolean(
      sourceVideoElement && 
      (sourceVideoElement.readyState >= 2 || (sourceVideoElement.videoWidth > 0 && sourceVideoElement.videoHeight > 0))
    );

    if (hasVideo && sourceVideoElement) {
      try {
        // Draw real moving video frame
        ctx.drawImage(sourceVideoElement, 0, 0, width, height);
      } catch (e) {
        // If drawing fails momentarily, draw clean studio backdrop
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);
      }
    } else if (project.isCustomUpload) {
      // For custom uploads if video frame not ready yet, keep dark frame, NEVER inject random cosmic frames!
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Only for non-upload procedural demo projects
      this.drawProceduralBackground(ctx, width, height, currentSec, project);
    }

    // Burned-in Screen Watermark
    this.drawWatermark(ctx, width, height, watermark);

    // Broadcast-Style Subtitle Overlay
    if (activeSegment && subtitlesMode !== 'off') {
      const boxWidth = width * 0.88;
      const boxHeight = 110;
      const boxX = (width - boxWidth) / 2;
      const boxY = height - boxHeight - 32;

      // Card backdrop
      ctx.fillStyle = 'rgba(9, 9, 11, 0.90)';
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 14);
      ctx.fill();
      ctx.stroke();

      // Speaker Tag
      if (activeSpeaker) {
        ctx.fillStyle = activeSpeaker.color || '#38bdf8';
        ctx.beginPath();
        ctx.arc(boxX + 28, boxY + 26, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#f4f4f5';
        ctx.textAlign = 'left';
        ctx.fillText(activeSpeaker.name, boxX + 42, boxY + 31);

        ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#94a3b8';
        const spkWidth = ctx.measureText(activeSpeaker.name).width;
        ctx.fillText(`• ${activeSpeaker.gender === 'female' ? 'Female' : 'Male'} Cloned Voice (${activeSegment.rasa})`, boxX + 42 + spkWidth + 8, boxY + 31);
      }

      // Sanskrit Subtitle Lines
      ctx.textAlign = 'center';
      const centerX = width / 2;

      if (subtitlesMode === 'devanagari' || subtitlesMode === 'dual') {
        ctx.font = '700 24px "Noto Sans Devanagari", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(activeSegment.sanskritDevanagari, centerX, boxY + 68);
      }

      if (subtitlesMode === 'iast' || subtitlesMode === 'dual') {
        ctx.font = 'italic 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#cbd5e1';
        const yPos = subtitlesMode === 'dual' ? boxY + 95 : boxY + 70;
        ctx.fillText(activeSegment.sanskritIAST, centerX, yPos);
      }
    }
  }

  /**
   * Draw burned-in screen watermark in specified position and style
   */
  private drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    watermark?: WatermarkOptions
  ) {
    if (watermark && watermark.enabled === false) return;

    const style = watermark?.style || 'broadcast';
    const position = watermark?.position || 'top-right';
    const opacity = watermark?.opacity ?? 0.88;
    const customText = watermark?.customText || 'VakSutra Sanskrit AI Dub';

    ctx.save();
    ctx.globalAlpha = Math.max(0.2, Math.min(1.0, opacity));

    if (style === 'broadcast') {
      // Modern Broadcast Glass Badge with glowing Sanskrit logo & Voice Clone label
      const boxW = 270;
      const boxH = 46;
      let boxX = width - boxW - 24;
      let boxY = 24;

      if (position === 'top-left') {
        boxX = 24;
        boxY = 24;
      } else if (position === 'bottom-left') {
        boxX = 24;
        boxY = height - boxH - 24;
      } else if (position === 'bottom-right') {
        boxX = width - boxW - 24;
        boxY = height - boxH - 24;
      }

      // Glass Card
      ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();

      // Brand Dot / Icon
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(boxX + 18, boxY + 23, 6, 0, Math.PI * 2);
      ctx.fill();

      // Main Watermark Text
      ctx.font = '700 12.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText('VakSutra • Dubbed in Sanskrit', boxX + 32, boxY + 20);

      // Subtitle Tag
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('⚡ ElevenLabs IVC Voice Clone', boxX + 32, boxY + 35);

    } else if (style === 'cinematic') {
      // Ornate Sanskrit Calligraphic Watermark
      const boxW = 310;
      const boxH = 42;
      let boxX = width - boxW - 28;
      let boxY = 24;

      if (position === 'top-left') boxX = 28;
      else if (position === 'bottom-left') { boxX = 28; boxY = height - boxH - 24; }
      else if (position === 'bottom-right') { boxX = width - boxW - 28; boxY = height - boxH - 24; }

      ctx.fillStyle = 'rgba(15, 12, 5, 0.82)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 14px "Noto Sans Devanagari", sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('॥ वाक्सूत्रम् • संस्कृत-ध्वन्यङ्कनम् ॥', boxX + boxW / 2, boxY + 27);

    } else if (style === 'minimal') {
      // Clean, low-key typography
      let textX = width - 24;
      let textY = 32;
      ctx.textAlign = 'right';

      if (position === 'top-left') { textX = 24; ctx.textAlign = 'left'; }
      else if (position === 'bottom-left') { textX = 24; textY = height - 24; ctx.textAlign = 'left'; }
      else if (position === 'bottom-right') { textX = width - 24; textY = height - 24; ctx.textAlign = 'right'; }

      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText('VAKSUTRA • SANSKRIT DUB', textX, textY);

    } else {
      // Custom Creator Handle / Branding
      const text = customText || 'Dubbed in Sanskrit with VakSutra';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      const textWidth = ctx.measureText(text).width;
      const boxW = Math.max(160, textWidth + 32);
      const boxH = 36;
      let boxX = width - boxW - 24;
      let boxY = 24;

      if (position === 'top-left') boxX = 24;
      else if (position === 'bottom-left') { boxX = 24; boxY = height - boxH - 24; }
      else if (position === 'bottom-right') { boxX = width - boxW - 24; boxY = height - boxH - 24; }

      ctx.fillStyle = 'rgba(9, 9, 11, 0.80)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.textAlign = 'center';
      ctx.fillText(text, boxX + boxW / 2, boxY + 22);
    }

    ctx.restore();
  }

  /**
   * Procedural background visual generator for astrophysics, nature, and tech keynote
   */
  private drawProceduralBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentSec: number,
    project: VideoProject
  ) {
    const theme = project.canvasTheme || 'cosmic';

    if (theme === 'cosmic') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0a0d1a');
      grad.addColorStop(0.5, '#03050c');
      grad.addColorStop(1, '#010206');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Starfield
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 90; i++) {
        const sx = (i * 137.5) % width;
        const sy = (i * 269.3 + currentSec * 10) % height;
        ctx.beginPath();
        ctx.arc(sx, sy, (i % 3) * 0.7 + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planet and orbits
      const cx = width / 2;
      const cy = height / 2 - 20;

      // Glow
      const glow = ctx.createRadialGradient(cx, cy, 50, cx, cy, 300);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
      glow.addColorStop(0.5, 'rgba(99, 102, 241, 0.12)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 300, 0, Math.PI * 2);
      ctx.fill();

      // Planet
      const pGrad = ctx.createRadialGradient(cx - 30, cy - 30, 20, cx, cy, 100);
      pGrad.addColorStop(0, '#38bdf8');
      pGrad.addColorStop(0.6, '#1e3a8a');
      pGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 90, 0, Math.PI * 2);
      ctx.fill();

      // Orbits
      [180, 270, 360].forEach((rx, idx) => {
        const ry = rx * 0.36;
        ctx.strokeStyle = idx === 1 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, -0.08, 0, Math.PI * 2);
        ctx.stroke();

        const angle = currentSec * (0.8 / (idx + 1)) + idx * 1.5;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;

        ctx.fillStyle = idx === 0 ? '#38bdf8' : idx === 1 ? '#818cf8' : '#34d399';
        ctx.beginPath();
        ctx.arc(px, py, 6 + idx, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      // Tech documentary
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }

  /**
   * Generates a synthetic harmonic speech buffer for segments that don't have an online synthesized audio URL
   */
  private generateSyntheticSegmentBuffer(
    ctx: BaseAudioContext,
    durationSec: number,
    isFemale: boolean
  ): AudioBuffer {
    const dur = Math.max(1.5, Math.min(8, durationSec));
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(dur * sampleRate);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const f0 = isFemale ? 220 : 125;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Syllable pulse envelope
      const syllable = Math.sin(t * 7) * 0.5 + 0.5;
      const decay = Math.exp(-t / (dur * 0.8));
      const amp = syllable * decay * 0.2;

      // Harmonic synthesis (F0 + Formant 1 + Formant 2)
      const val = (
        Math.sin(2 * Math.PI * f0 * t) * 0.6 +
        Math.sin(2 * Math.PI * f0 * 2 * t) * 0.3 +
        Math.sin(2 * Math.PI * f0 * 4 * t) * 0.15
      ) * amp;

      left[i] = val;
      right[i] = val;
    }

    return buffer;
  }

  /**
   * Convert AudioBuffer to 16-bit PCM WAV byte array
   */
  private audioBufferToWav(buffer: AudioBuffer): Uint8Array {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2;
    const outBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(outBuffer);

    // RIFF chunk
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true); // 16-bit

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Interleave channels
    let offset = 44;
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Uint8Array(outBuffer);
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

export const videoExporter = new VideoExporterService();
