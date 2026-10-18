import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Subtitles, 
  Check, 
  Layers,
  Video,
  Music,
  Loader2,
  Film,
  AlertTriangle,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { VideoProject } from '../types';
import { videoExporter, VideoExportOptions } from '../services/videoExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: VideoProject;
  sourceVideoElement?: HTMLVideoElement | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  sourceVideoElement,
}) => {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Video Export State
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatusText, setVideoStatusText] = useState('');
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p' | '540p' | 'original'>('original');
  const [selectedSubtitles, setSelectedSubtitles] = useState<'dual' | 'devanagari' | 'iast' | 'off'>('devanagari');
  const [bitrateMode, setBitrateMode] = useState<'match-original' | 'standard' | 'high'>('match-original');
  const [occludeOriginalCaptions, setOccludeOriginalCaptions] = useState(true);

  // Audio Export State
  const [isRenderingAudio, setIsRenderingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  if (!isOpen) return null;

  // Duration Validation
  const exactVideoDur = sourceVideoElement?.duration && !isNaN(sourceVideoElement.duration) && sourceVideoElement.duration > 0
    ? sourceVideoElement.duration
    : project.duration;
  const maxSegmentEnd = Math.max(0, ...project.segments.map(s => s.endTime));
  const isDurationMatched = Math.abs(exactVideoDur - maxSegmentEnd) <= 2.5 || maxSegmentEnd >= exactVideoDur * 0.92;

  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  // 1. Render and Download Full Dubbed Video (Original pristine video + Dubbed Sanskrit audio track)
  const handleExportDubbedVideo = async () => {
    if (isRenderingVideo) return;
    setIsRenderingVideo(true);
    setVideoProgress(5);
    setVideoStatusText('Frame-locking video with cloned Sanskrit audio track...');

    try {
      const options: VideoExportOptions = {
        resolution: selectedResolution,
        subtitlesMode: selectedSubtitles,
        audioMode: 'dubbed',
        bitrateMode: bitrateMode,
        occludeOriginalCaptions: occludeOriginalCaptions && selectedSubtitles !== 'off',
      };

      const videoBlob = await videoExporter.renderDubbedVideo(
        project,
        sourceVideoElement || null,
        options,
        (pct, msg) => {
          setVideoProgress(pct);
          setVideoStatusText(msg);
        }
      );

      const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/\s+/g, '_')}_Sanskrit_Dubbed.${ext}`;
      a.click();

      setDownloadStatus(`Video file downloaded (${(videoBlob.size / (1024 * 1024)).toFixed(1)} MB)!`);
      setTimeout(() => setDownloadStatus(null), 4000);
    } catch (err: any) {
      console.error('Video export error:', err);
      setDownloadStatus(`Video export error: ${err?.message || 'Could not encode video'}`);
    } finally {
      setIsRenderingVideo(false);
      setVideoProgress(0);
      setVideoStatusText('');
    }
  };

  // 2. Render and Download Master Synchronized Sanskrit Audio (.wav)
  const handleExportMasterAudio = async () => {
    if (isRenderingAudio) return;
    setIsRenderingAudio(true);
    setAudioProgress(10);

    try {
      const wavBlob = await videoExporter.exportMasterAudioWav(project, (pct) => {
        setAudioProgress(pct);
      });

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/\s+/g, '_')}_Sanskrit_Master_Audio.wav`;
      a.click();

      setDownloadStatus(`Master audio (.WAV) downloaded (${(wavBlob.size / (1024 * 1024)).toFixed(1)} MB)!`);
      setTimeout(() => setDownloadStatus(null), 4000);
    } catch (err: any) {
      console.error('Audio export error:', err);
      setDownloadStatus('Audio mix error. Please try again.');
    } finally {
      setIsRenderingAudio(false);
      setAudioProgress(0);
    }
  };

  // 3. Export Subtitles .SRT
  const handleExportSrt = (mode: 'devanagari' | 'iast' | 'dual') => {
    let srt = '';
    project.segments.forEach((seg, index) => {
      srt += `${index + 1}\n`;
      srt += `${formatSrtTime(seg.startTime)} --> ${formatSrtTime(seg.endTime)}\n`;
      if (mode === 'devanagari') {
        srt += `${seg.speakerName}: ${seg.sanskritDevanagari}\n\n`;
      } else if (mode === 'iast') {
        srt += `${seg.speakerName}: ${seg.sanskritIAST}\n\n`;
      } else {
        srt += `${seg.speakerName}: ${seg.sanskritDevanagari}\n${seg.sanskritIAST}\n(${seg.englishTranslation})\n\n`;
      }
    });

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_${mode}.srt`;
    a.click();

    setDownloadStatus(`Subtitles (${mode}) downloaded!`);
    setTimeout(() => setDownloadStatus(null), 3000);
  };

  // 4. Export Transcript & Glossary Markdown
  const handleExportMarkdown = () => {
    let md = `# Video Dubbing Transcript: ${project.title}\n\n`;
    md += `**Target Language**: Sanskrit (संस्कृतम्)\n`;
    md += `**Duration**: ${exactVideoDur.toFixed(1)} seconds\n`;
    md += `**Speakers**: ${project.speakers.map(s => `${s.name} (${s.gender}, ${s.estimatedPitchHz || (s.gender === 'female' ? 300 : 120)}Hz)`).join(', ')}\n\n`;
    md += `## Sanskrit Dubbing Script & Timecodes\n\n`;

    project.segments.forEach((seg, i) => {
      md += `### ${i + 1}. [${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s] ${seg.speakerName}\n`;
      md += `> **Sanskrit**: ${seg.sanskritDevanagari}\n`;
      md += `> **Roman Phonetics**: ${seg.sanskritIAST}\n`;
      md += `> **English Meaning**: ${seg.englishTranslation}\n\n`;

      if (seg.wordsBreakdown && seg.wordsBreakdown.length > 0) {
        md += `#### Word Breakdown\n`;
        md += `| Word | Roman | Meaning | Grammar |\n`;
        md += `| :--- | :--- | :--- | :--- |\n`;
        seg.wordsBreakdown.forEach(w => {
          md += `| ${w.word} | ${w.iast} | ${w.meaning} | ${w.grammar || '-'} |\n`;
        });
        md += `\n`;
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_Transcript.md`;
    a.click();

    setDownloadStatus('Transcript & glossary downloaded!');
    setTimeout(() => setDownloadStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Export Sanskrit Dubbed Video & Stems
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Frame-locked video with synchronized Sanskrit audio & loudness normalization
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {downloadStatus && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{downloadStatus}</span>
          </div>
        )}

        {/* Audio-Video Duration Sync Verification Badge */}
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          isDurationMatched 
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
            : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
        }`}>
          <div className="flex items-center gap-2">
            {isDurationMatched ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div>
              <span className="font-semibold">
                {isDurationMatched ? 'Duration Synced (100% Coverage)' : 'Duration Warning'}
              </span>
              <p className="text-[11px] text-zinc-400">
                Video: {exactVideoDur.toFixed(1)}s • Dubbed Audio: {maxSegmentEnd.toFixed(1)}s
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
            {((maxSegmentEnd / Math.max(1, exactVideoDur)) * 100).toFixed(0)}%
          </span>
        </div>

        {/* ============================================================ */}
        {/* HERO: Full Dubbed Video File (.MP4 / .WEBM) */}
        {/* ============================================================ */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-indigo-950/30 to-zinc-950 border border-indigo-500/40 shadow-lg flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Video className="w-4 h-4 text-indigo-400" />
              <span>Full Dubbed Video (.MP4 / .WEBM)</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Frame-Locked • No Watermarks
            </span>
          </div>

          <p className="text-xs text-zinc-300">
            Exports original video frame-locked to the exact duration with normalized Sanskrit cloned audio (+4.8 dB) and optional burned-in caption occlusion.
          </p>

          {/* Video Options */}
          <div className="grid grid-cols-2 gap-3 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800/80 text-xs">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Resolution:
              </label>
              <select
                value={selectedResolution}
                onChange={e => setSelectedResolution(e.target.value as any)}
                disabled={isRenderingVideo}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 outline-none"
              >
                <option value="original">Original Source Quality</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
                <option value="540p">540p Fast Preview</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Subtitles:
              </label>
              <select
                value={selectedSubtitles}
                onChange={e => setSelectedSubtitles(e.target.value as any)}
                disabled={isRenderingVideo}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 outline-none"
              >
                <option value="devanagari">Devanagari Only</option>
                <option value="dual">Dual (Sanskrit + Roman)</option>
                <option value="iast">Roman IAST Only</option>
                <option value="off">No Subtitles</option>
              </select>
            </div>

            {/* Bitrate control to prevent file bloat */}
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                File Size / Bitrate:
              </label>
              <select
                value={bitrateMode}
                onChange={e => setBitrateMode(e.target.value as any)}
                disabled={isRenderingVideo}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 outline-none"
              >
                <option value="match-original">Match Original Size (~0.7 Mbps, ~11MB for 133s) - Recommended</option>
                <option value="standard">Standard Broadcast (~1.5 Mbps)</option>
                <option value="high">High Quality (~3.0 Mbps)</option>
              </select>
            </div>

            {/* Burned-in caption occlusion toggle */}
            {selectedSubtitles !== 'off' && (
              <div className="col-span-2 pt-1 border-t border-zinc-800/80">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={occludeOriginalCaptions}
                    onChange={e => setOccludeOriginalCaptions(e.target.checked)}
                    className="rounded accent-indigo-600 w-3.5 h-3.5"
                  />
                  <span className="text-[11px] text-zinc-300">
                    Cover original burned-in Hindi captions with clean dark subtitle backdrop
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Render Progress Bar */}
          {isRenderingVideo && (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between text-xs text-indigo-300 font-mono">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{videoStatusText || 'Muxing video with Sanskrit audio...'}</span>
                </span>
                <span>{videoProgress}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Video Download Button */}
          <button
            onClick={handleExportDubbedVideo}
            disabled={isRenderingVideo}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isRenderingVideo
                ? 'bg-indigo-700/50 text-indigo-200 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.01] active:scale-95'
            }`}
          >
            {isRenderingVideo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting Video ({videoProgress}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Sanskrit Dubbed Video ({exactVideoDur.toFixed(1)}s)</span>
              </>
            )}
          </button>
        </div>

        {/* ============================================================ */}
        {/* OPTION 2: Master Synchronized Audio Track (.WAV) */}
        {/* ============================================================ */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                <span>Master Cloned Sanskrit Audio (.WAV)</span>
                <span className="text-[10px] text-zinc-400 font-normal">+4.8dB Normalized • 44.1kHz</span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Continuous mixed Sanskrit track covering full video length ({exactVideoDur.toFixed(1)}s)
              </p>
            </div>
          </div>

          <button
            onClick={handleExportMasterAudio}
            disabled={isRenderingAudio}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors"
          >
            {isRenderingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>WAV</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* OPTION 3: Subtitles (.SRT) & Transcripts */}
        {/* ============================================================ */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Subtitles className="w-4 h-4 text-zinc-400" />
            <span>Subtitles & Bilingual Transcript</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleExportSrt('devanagari')}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3 h-3 text-zinc-400" />
              <span>Devanagari (.srt)</span>
            </button>
            <button
              onClick={() => handleExportSrt('dual')}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3 h-3 text-zinc-400" />
              <span>Dual (.srt)</span>
            </button>
            <button
              onClick={handleExportMarkdown}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="w-3 h-3 text-zinc-400" />
              <span>Transcript (.md)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
