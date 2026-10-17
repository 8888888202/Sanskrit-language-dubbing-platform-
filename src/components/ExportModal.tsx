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
  Sparkles,
  Loader2,
  Film,
  BadgeAlert,
  Sliders,
  Type
} from 'lucide-react';
import { VideoProject } from '../types';
import { videoExporter, VideoExportOptions, WatermarkOptions } from '../services/videoExporter';

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
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p' | '540p'>('720p');
  const [selectedSubtitles, setSelectedSubtitles] = useState<'dual' | 'devanagari' | 'iast' | 'off'>('dual');

  // Watermark State
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkStyle, setWatermarkStyle] = useState<'broadcast' | 'cinematic' | 'minimal' | 'custom'>('broadcast');
  const [watermarkPosition, setWatermarkPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [watermarkCustomText, setWatermarkCustomText] = useState('VakSutra • Sanskrit AI Dub');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.85);

  // Audio Export State
  const [isRenderingAudio, setIsRenderingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  if (!isOpen) return null;

  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  // 1. Render and Download Full Dubbed Video with Watermark
  const handleExportDubbedVideo = async () => {
    if (isRenderingVideo) return;
    setIsRenderingVideo(true);
    setVideoProgress(5);
    setVideoStatusText('Initializing video pipeline & watermark overlay...');

    try {
      const options: VideoExportOptions = {
        resolution: selectedResolution,
        subtitlesMode: selectedSubtitles,
        includeVideoVisuals: true,
        audioMode: 'dubbed',
        watermark: {
          enabled: watermarkEnabled,
          style: watermarkStyle,
          position: watermarkPosition,
          customText: watermarkCustomText,
          opacity: watermarkOpacity,
        },
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

      // Trigger browser download
      const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/\s+/g, '_')}_Sanskrit_Dubbed.${ext}`;
      a.click();

      setDownloadStatus(`Video file downloaded (${(videoBlob.size / (1024 * 1024)).toFixed(1)} MB) with burned-in watermark!`);
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
    md += `**Description**: ${project.description}\n`;
    md += `**Target Language**: Sanskrit (संस्कृतम्)\n`;
    md += `**Duration**: ${project.duration} seconds\n`;
    md += `**Speakers**: ${project.speakers.map(s => `${s.name} (${s.gender}, ${s.voiceName})`).join(', ')}\n\n`;
    md += `## Sanskrit Dubbing Script & Timecodes\n\n`;

    project.segments.forEach((seg, i) => {
      md += `### ${i + 1}. [${seg.startTime}s - ${seg.endTime}s] ${seg.speakerName} (Tone: ${seg.rasa})\n`;
      md += `> **Sanskrit**: ${seg.sanskritDevanagari}\n`;
      md += `> **Roman Phonetics**: ${seg.sanskritIAST}\n`;
      md += `> **English Translation**: ${seg.englishTranslation}\n\n`;

      if (seg.wordsBreakdown && seg.wordsBreakdown.length > 0) {
        md += `#### Word Breakdown & Morphology\n`;
        md += `| Word | Roman | Meaning | Part of Speech |\n`;
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

  // 5. Export JSON Project
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_Project.json`;
    a.click();

    setDownloadStatus('Project JSON downloaded!');
    setTimeout(() => setDownloadStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl flex flex-col gap-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Export Dubbed Video & Stems
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Download your video with synchronized Sanskrit cloned audio, custom screen watermark, and subtitles
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

        {/* ============================================================ */}
        {/* HERO OPTION 1: Full Dubbed Video File (.MP4 / .WEBM) */}
        {/* ============================================================ */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-indigo-950/40 to-zinc-950 border border-indigo-500/40 shadow-lg flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Video className="w-4 h-4 text-indigo-400" />
              <span>Full Dubbed Video (.MP4 / .WEBM)</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              Ready to Download
            </span>
          </div>

          <p className="text-xs text-zinc-300">
            Render video with original speakers' vocal timbre cloned into Sanskrit, plus customizable burned-in broadcast subtitles and screen watermark.
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
                <option value="720p">720p HD (Recommended)</option>
                <option value="1080p">1080p Full HD</option>
                <option value="540p">540p Fast Preview</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Burned-in Subtitles:
              </label>
              <select
                value={selectedSubtitles}
                onChange={e => setSelectedSubtitles(e.target.value as any)}
                disabled={isRenderingVideo}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 outline-none"
              >
                <option value="dual">Dual (Sanskrit + Roman)</option>
                <option value="devanagari">Devanagari Only</option>
                <option value="iast">Roman IAST Only</option>
                <option value="off">No Subtitles (Clean Video)</option>
              </select>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SCREEN WATERMARK CUSTOMIZER */}
          {/* ============================================================ */}
          <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={e => setWatermarkEnabled(e.target.checked)}
                  disabled={isRenderingVideo}
                  className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BadgeAlert className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Burn Screen Watermark into Video</span>
                </span>
              </label>

              {watermarkEnabled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                  Active on Export
                </span>
              )}
            </div>

            {watermarkEnabled && (
              <div className="flex flex-col gap-2.5 pt-1 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Watermark Style:</label>
                    <select
                      value={watermarkStyle}
                      onChange={e => setWatermarkStyle(e.target.value as any)}
                      disabled={isRenderingVideo}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-200 text-xs outline-none"
                    >
                      <option value="broadcast">📺 Modern Broadcast Badge</option>
                      <option value="cinematic">✨ Classical Vedic Sanskrit Stamp</option>
                      <option value="minimal">🔲 Minimal Corner Stamp</option>
                      <option value="custom">✍️ Custom Channel / Creator Name</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Position on Screen:</label>
                    <select
                      value={watermarkPosition}
                      onChange={e => setWatermarkPosition(e.target.value as any)}
                      disabled={isRenderingVideo}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-200 text-xs outline-none"
                    >
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </select>
                  </div>
                </div>

                {watermarkStyle === 'custom' && (
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Custom Watermark Text:</label>
                    <input
                      type="text"
                      value={watermarkCustomText}
                      onChange={e => setWatermarkCustomText(e.target.value)}
                      placeholder="@YourChannel • Sanskrit Dub"
                      disabled={isRenderingVideo}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Watermark Live Visual Preview */}
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono">Watermark Preview:</span>
                  <div className="flex items-center gap-1.5">
                    {watermarkStyle === 'broadcast' && (
                      <div className="px-2.5 py-1 rounded-md bg-zinc-900 border border-indigo-500/50 text-[10px] font-bold text-white flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>VakSutra • Dubbed in Sanskrit</span>
                        <span className="text-[8px] text-sky-400 font-mono ml-1">⚡ ElevenLabs IVC</span>
                      </div>
                    )}
                    {watermarkStyle === 'cinematic' && (
                      <div className="px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-600/60 font-sanskrit text-[11px] font-bold text-amber-300 shadow-sm">
                        ॥ वाक्सूत्रम् • संस्कृत-ध्वन्यङ्कनम् ॥
                      </div>
                    )}
                    {watermarkStyle === 'minimal' && (
                      <div className="font-mono text-[9px] font-semibold text-zinc-300 tracking-wider">
                        VAKSUTRA • SANSKRIT DUB
                      </div>
                    )}
                    {watermarkStyle === 'custom' && (
                      <div className="px-2.5 py-1 rounded-full bg-purple-950/40 border border-purple-600/50 text-[10px] font-semibold text-white shadow-sm">
                        {watermarkCustomText || 'Custom Watermark'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Render Progress Bar */}
          {isRenderingVideo && (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between text-xs text-indigo-300 font-mono">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{videoStatusText || 'Rendering video frames...'}</span>
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
                <span>Rendering Video ({videoProgress}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Render & Download Dubbed Video</span>
              </>
            )}
          </button>
        </div>

        {/* ============================================================ */}
        {/* OPTION 2: Master Synchronized Audio Track (.WAV) */}
        {/* ============================================================ */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                <span>Master Cloned Sanskrit Audio Track (.WAV)</span>
                <span className="text-[10px] text-zinc-400 font-normal">44.1kHz • 16-bit</span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Continuous mixed audio track of full video duration, ready for Premiere / DaVinci Resolve
              </p>
            </div>
          </div>

          <button
            onClick={handleExportMasterAudio}
            disabled={isRenderingAudio}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors border border-zinc-700 flex items-center gap-1.5 shrink-0"
          >
            {isRenderingAudio ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Mixing...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Audio</span>
              </>
            )}
          </button>
        </div>

        {/* ============================================================ */}
        {/* OPTION 3: Subtitles (.SRT) */}
        {/* ============================================================ */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Subtitles className="w-4 h-4 text-indigo-400" />
            <span>Standard Subtitles (.SRT format)</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Compatible with YouTube Studio, Premiere Pro, Final Cut Pro, and VLC player.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <button
              onClick={() => handleExportSrt('devanagari')}
              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white font-medium font-sanskrit transition-colors"
            >
              Sanskrit Script
            </button>
            <button
              onClick={() => handleExportSrt('iast')}
              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 font-medium font-mono transition-colors"
            >
              Roman (IAST)
            </button>
            <button
              onClick={() => handleExportSrt('dual')}
              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 font-medium transition-colors"
            >
              Dual Bilingual
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* OPTION 4: Transcript & Project Data */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 gap-3">
          {/* Transcript Markdown */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transcript (.MD)</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Grammar & vocabulary breakdown
              </p>
            </div>
            <button
              onClick={handleExportMarkdown}
              className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              Download MD
            </button>
          </div>

          {/* JSON Project Backup */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Project File (.JSON)</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Timestamps & voice clone data
              </p>
            </div>
            <button
              onClick={handleExportJson}
              className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              Download JSON
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
