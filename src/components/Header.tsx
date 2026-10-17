import React from 'react';
import { 
  Sparkles, 
  Upload, 
  Download, 
  BookOpen, 
  Mic, 
  Layers, 
  Volume2,
  Video,
  Sliders,
  Play
} from 'lucide-react';
import { VideoProject } from '../types';
import { PRESET_PROJECTS } from '../data/presets';

interface HeaderProps {
  currentProject: VideoProject;
  onSelectPreset: (project: VideoProject) => void;
  onOpenNewProject: () => void;
  onOpenExport: () => void;
  activeTab: 'editor' | 'voice-clone' | 'learner' | 'audio-mix';
  setActiveTab: (tab: 'editor' | 'voice-clone' | 'learner' | 'audio-mix') => void;
  isBatchDubbing: boolean;
  batchProgress: { current: number; total: number };
  onBatchDubAll: () => void;
  duckingLevel: number;
  setDuckingLevel: (level: number) => void;
  audioTrackMode: 'dubbed' | 'original' | 'mixed';
  setAudioTrackMode: (mode: 'dubbed' | 'original' | 'mixed') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  onSelectPreset,
  onOpenNewProject,
  onOpenExport,
  activeTab,
  setActiveTab,
  isBatchDubbing,
  batchProgress,
  onBatchDubAll,
  duckingLevel,
  setDuckingLevel,
  audioTrackMode,
  setAudioTrackMode,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Studio Logo */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">
                  SanskritDub
                </span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  AI Studio
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Professional Multi-Speaker Video Dubbing into Sanskrit
              </p>
            </div>
          </div>

          {/* Sample Video Presets */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {PRESET_PROJECTS.map(preset => (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium ${
                  currentProject.id === preset.id
                    ? 'bg-zinc-800 text-white shadow-sm font-semibold border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title={preset.description}
              >
                {preset.category === 'science' && 'Astrophysics'}
                {preset.category === 'documentary' && 'Wildlife Doc'}
                {preset.category === 'modern-tech' && 'Tech Keynote'}
              </button>
            ))}
            <button
              onClick={onOpenNewProject}
              className="text-xs px-2.5 py-1 rounded-md text-indigo-400 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 flex items-center gap-1 font-medium"
              title="Import custom video or audio file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Video</span>
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs (Normal Video Dubbing UI) */}
        <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
              activeTab === 'editor'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dubbing Timeline</span>
          </button>
          <button
            onClick={() => setActiveTab('voice-clone')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
              activeTab === 'voice-clone'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Cloning</span>
          </button>
          <button
            onClick={() => setActiveTab('learner')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
              activeTab === 'learner'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Language Reference</span>
          </button>
        </div>

        {/* Audio Track Selector & Export Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Audio Track Selector */}
          <div className="hidden sm:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setAudioTrackMode('dubbed')}
              className={`px-2 py-1 rounded transition-colors ${
                audioTrackMode === 'dubbed'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              title="Hear only dubbed Sanskrit speech"
            >
              Dubbed Only
            </button>
            <button
              onClick={() => setAudioTrackMode('mixed')}
              className={`px-2 py-1 rounded transition-colors ${
                audioTrackMode === 'mixed'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              title="Mix with background audio ducking"
            >
              Ducked Mix
            </button>
            <button
              onClick={() => setAudioTrackMode('original')}
              className={`px-2 py-1 rounded transition-colors ${
                audioTrackMode === 'original'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              title="Hear original video track"
            >
              Original
            </button>
          </div>

          {/* Dub All Button */}
          <button
            onClick={onBatchDubAll}
            disabled={isBatchDubbing}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              isBatchDubbing
                ? 'bg-indigo-700/50 text-indigo-200 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isBatchDubbing ? 'animate-spin' : ''}`} />
            {isBatchDubbing ? (
              <span>Dubbing {batchProgress.current}/{batchProgress.total}</span>
            ) : (
              <span>Dub All Lines</span>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
