import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Subtitles, 
  Check, 
  Layers
} from 'lucide-react';
import { VideoProject } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: VideoProject;
  canvasRef?: HTMLCanvasElement | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  // 1. Export Subtitles .SRT
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

  // 2. Export Transcript & Glossary Markdown
  const handleExportMarkdown = () => {
    let md = `# Video Dubbing Transcript: ${project.title}\n\n`;
    md += `**Description**: ${project.description}\n`;
    md += `**Duration**: ${project.duration} seconds\n\n`;
    md += `## Sanskrit Dubbing Script\n\n`;

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

    setDownloadStatus('Transcript downloaded!');
    setTimeout(() => setDownloadStatus(null), 3000);
  };

  // 3. Export JSON Project
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Export Subtitles & Audio Stems
            </h2>
            <p className="text-xs text-zinc-400">
              Download standard subtitle files, dialogue transcripts, and project data
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {downloadStatus && (
          <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{downloadStatus}</span>
          </div>
        )}

        {/* Export Options */}
        <div className="flex flex-col gap-3">
          {/* Subtitles */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Subtitles className="w-4 h-4 text-indigo-400" />
              <span>Standard Subtitles (.SRT format)</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Compatible with YouTube, Premiere Pro, DaVinci Resolve, Final Cut Pro, and VLC.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <button
                onClick={() => handleExportSrt('devanagari')}
                className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white font-medium font-sanskrit"
              >
                Sanskrit Script
              </button>
              <button
                onClick={() => handleExportSrt('iast')}
                className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 font-medium font-mono"
              >
                Roman (IAST)
              </button>
              <button
                onClick={() => handleExportSrt('dual')}
                className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 font-medium"
              >
                Dual Bilingual
              </button>
            </div>
          </div>

          {/* Transcript Markdown */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-900 text-indigo-400 border border-zinc-800">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">
                  Full Transcript & Vocabulary (.MD)
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Timecodes, translations, and morphological table
                </p>
              </div>
            </div>
            <button
              onClick={handleExportMarkdown}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors border border-zinc-700"
            >
              Download
            </button>
          </div>

          {/* JSON Project Backup */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-900 text-indigo-400 border border-zinc-800">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">
                  Project Data Package (.JSON)
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Includes timing timestamps, speaker diarization, and voice settings
                </p>
              </div>
            </div>
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors border border-zinc-700"
            >
              Download
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
