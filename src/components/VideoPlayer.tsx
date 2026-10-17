import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Subtitles, 
  SkipBack, 
  SkipForward,
  Gauge,
  Sliders,
  Sparkles
} from 'lucide-react';
import { VideoProject, DubbingSegment, Speaker } from '../types';
import { ProceduralVideoCanvas } from './ProceduralVideoCanvas';
import { RASAS } from '../data/rasas';

interface VideoPlayerProps {
  project: VideoProject;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  activeSegment: DubbingSegment | null;
  activeSpeaker: Speaker | null;
  subtitlesMode: 'devanagari' | 'iast' | 'dual' | 'off';
  setSubtitlesMode: (mode: 'devanagari' | 'iast' | 'dual' | 'off') => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  audioTrackMode: 'dubbed' | 'original' | 'mixed';
  duckingLevel: number;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onJumpToSegment: (segment: DubbingSegment) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  activeSegment,
  activeSpeaker,
  subtitlesMode,
  setSubtitlesMode,
  playbackSpeed,
  setPlaybackSpeed,
  audioTrackMode,
  duckingLevel,
  onCanvasReady,
  onJumpToSegment,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Time formatting: mm:ss.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Keyboard shortcut listener (Spacebar for play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, setIsPlaying]);

  // Timeline scrubber click / drag
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = fraction * project.duration;
    setCurrentTime(newTime);
  };

  const handlePrevSegment = () => {
    const currentIndex = project.segments.findIndex(s => s.id === activeSegment?.id);
    if (currentIndex > 0) {
      onJumpToSegment(project.segments[currentIndex - 1]);
    } else {
      setCurrentTime(0);
    }
  };

  const handleNextSegment = () => {
    const currentIndex = project.segments.findIndex(s => s.id === activeSegment?.id);
    if (currentIndex >= 0 && currentIndex < project.segments.length - 1) {
      onJumpToSegment(project.segments[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col bg-zinc-900/90 rounded-2xl border border-zinc-800 p-3.5 shadow-xl">
      {/* Video Viewport */}
      <div className="relative w-full rounded-xl overflow-hidden bg-black group">
        {project.isCustomUpload && project.videoUrl ? (
          <video
            ref={videoRef}
            src={project.videoUrl}
            className="w-full aspect-video object-contain"
            muted={audioTrackMode === 'dubbed'}
            playsInline
          />
        ) : (
          <ProceduralVideoCanvas
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            activeSegment={activeSegment}
            activeSpeaker={activeSpeaker}
            subtitlesMode={subtitlesMode}
            isMuted={false}
            onCanvasReady={onCanvasReady}
          />
        )}

        {/* Top Overlay: Title & Active Tone Badge */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-800 shadow">
            <span className="text-white font-semibold text-xs">
              {project.title}
            </span>
            <span className="text-zinc-600 text-xs">•</span>
            <span className="text-zinc-400 text-xs">
              Sanskrit Audio Dub
            </span>
          </div>

          {activeSegment && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md text-xs font-medium border shadow ${
              RASAS[activeSegment.rasa]?.badgeBg || 'bg-zinc-900/80 text-zinc-300 border-zinc-800'
            }`}>
              <Sparkles className="w-3 h-3" />
              <span>Tone: {RASAS[activeSegment.rasa]?.label || 'Neutral'}</span>
            </div>
          )}
        </div>

        {/* Center Play Overlay Button when paused */}
        {!isPlaying && (
          <button
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all z-10"
            title="Play Video"
          >
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </button>
        )}
      </div>

      {/* Synchronized Multi-Track Timeline */}
      <div className="mt-3 px-1">
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative w-full h-8 bg-zinc-950 rounded-lg cursor-pointer border border-zinc-800 overflow-hidden flex items-center group"
          title="Click to seek"
        >
          {/* Segments color bands */}
          {project.segments.map(seg => {
            const leftPct = (seg.startTime / project.duration) * 100;
            const widthPct = ((seg.endTime - seg.startTime) / project.duration) * 100;
            const speaker = project.speakers.find(s => s.id === seg.speakerId);
            const isActive = activeSegment?.id === seg.id;

            return (
              <div
                key={seg.id}
                className={`absolute top-1 bottom-1 rounded transition-all flex items-center px-1.5 overflow-hidden border ${
                  isActive
                    ? 'ring-2 ring-indigo-400 z-10 opacity-100 shadow-md'
                    : 'opacity-75 hover:opacity-100'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: `${speaker?.color || '#6366f1'}33`,
                  borderColor: speaker?.color || '#6366f1',
                }}
              >
                <span className="text-[10px] font-semibold text-zinc-200 truncate select-none">
                  {speaker?.name.split(' ')[0]}
                </span>
              </div>
            );
          })}

          {/* Current playhead line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 z-20 shadow-[0_0_8px_#818cf8] pointer-events-none transition-[left] duration-75"
            style={{
              left: `${(currentTime / project.duration) * 100}%`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 -translate-x-[4px] -translate-y-0.5 shadow" />
          </div>
        </div>
      </div>

      {/* Control Transport Bar */}
      <div className="mt-2.5 flex items-center justify-between text-zinc-300 text-xs px-1">
        {/* Play/Pause & Nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-transform active:scale-95"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={handlePrevSegment}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Previous Segment"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={handleNextSegment}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Next Segment"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setCurrentTime(0);
              setIsPlaying(true);
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Replay from start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Time Display */}
          <div className="ml-2 font-mono text-[11px] text-zinc-400">
            <span className="text-white font-semibold">{formatTime(currentTime)}</span>
            <span className="text-zinc-600"> / </span>
            <span>{formatTime(project.duration)}</span>
          </div>
        </div>

        {/* Right side: Subtitles & Speed */}
        <div className="flex items-center gap-2">
          {/* Subtitles Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSubtitlesMenu(!showSubtitlesMenu)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                subtitlesMode !== 'off'
                  ? 'bg-zinc-800 border-indigo-500/40 text-indigo-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span className="capitalize">{subtitlesMode}</span>
            </button>

            {showSubtitlesMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-44 bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-2xl z-30 flex flex-col gap-0.5">
                {(['dual', 'devanagari', 'iast', 'off'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSubtitlesMode(mode);
                      setShowSubtitlesMenu(false);
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                      subtitlesMode === mode
                        ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {mode === 'dual' ? 'Dual (Sanskrit + Roman)' : mode === 'devanagari' ? 'Sanskrit (Devanagari)' : mode === 'iast' ? 'Roman Phonetic (IAST)' : 'Subtitles Off'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Playback Speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Playback Speed"
            >
              <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              <span>{playbackSpeed}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-24 bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-2xl z-30 flex flex-col gap-0.5">
                {[0.75, 1.0, 1.25, 1.5].map(speed => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`text-center px-2 py-1 rounded text-xs transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
