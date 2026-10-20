import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Subtitles, 
  SkipBack, 
  SkipForward,
  Gauge,
  Volume2,
  VolumeX
} from 'lucide-react';
import { VideoProject, DubbingSegment, Speaker } from '../types';

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
  onJumpToSegment: (segment: DubbingSegment) => void;
  sourceVideoRef?: React.RefObject<HTMLVideoElement | null>;
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
  onJumpToSegment,
  sourceVideoRef: externalVideoRef,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef || localVideoRef;
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

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

  // Synchronize native video element play/pause state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isPlaying) {
      vid.play().catch(err => {
        // Autoplay policy or interrupted
        console.warn('Video play interrupted:', err);
      });
    } else {
      vid.pause();
    }
  }, [isPlaying, videoRef]);

  // Synchronize native video current time when scrubber moves
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (Math.abs(vid.currentTime - currentTime) > 0.3) {
      vid.currentTime = currentTime;
    }
  }, [currentTime, videoRef]);

  // Synchronize playback speed
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = playbackSpeed;
  }, [playbackSpeed, videoRef]);

  // Update currentTime as video plays
  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !isPlaying) return;
    setCurrentTime(vid.currentTime);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  // Timeline scrubber click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = fraction * Math.max(1, project.duration);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handlePrevSegment = () => {
    const currentIndex = project.segments.findIndex(s => s.id === activeSegment?.id);
    if (currentIndex > 0) {
      onJumpToSegment(project.segments[currentIndex - 1]);
    } else {
      setCurrentTime(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  };

  const handleNextSegment = () => {
    const currentIndex = project.segments.findIndex(s => s.id === activeSegment?.id);
    if (currentIndex >= 0 && currentIndex < project.segments.length - 1) {
      onJumpToSegment(project.segments[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col bg-zinc-900 rounded-2xl border border-zinc-800 p-3.5 shadow-2xl">
      {/* Video Viewport - Pristine 1:1, NO Watermarks, NO artificial borders */}
      <div className="relative w-full rounded-xl overflow-hidden bg-black flex items-center justify-center group aspect-video">
        {project.videoUrl ? (
          <video
            ref={videoRef as any}
            src={project.videoUrl}
            className="w-full h-full object-contain"
            muted={audioTrackMode === 'dubbed'}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onClick={() => setIsPlaying(!isPlaying)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
            <p className="text-xs">No video loaded</p>
          </div>
        )}

        {/* Clean Standard Bottom Subtitles Overlay: Completely blocks out original burned-in Hindi captions */}
        {subtitlesMode !== 'off' && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-zinc-950/98 to-zinc-950/80 px-4 py-3 flex flex-col items-center justify-center text-center select-none z-20 min-h-[64px] border-t border-white/10 pointer-events-none transition-all">
            {activeSegment ? (
              <div className="max-w-[94%]">
                {subtitlesMode === 'dual' && (
                  <>
                    <p className="text-white font-bold text-sm sm:text-base font-sanskrit tracking-wide drop-shadow">
                      {activeSegment.sanskritDevanagari}
                    </p>
                    <p className="text-zinc-300 text-[11px] sm:text-xs italic font-sans mt-0.5 drop-shadow">
                      {activeSegment.sanskritIAST}
                    </p>
                  </>
                )}
                {subtitlesMode === 'devanagari' && (
                  <p className="text-white font-bold text-base sm:text-lg font-sanskrit tracking-wide drop-shadow">
                    {activeSegment.sanskritDevanagari}
                  </p>
                )}
                {subtitlesMode === 'iast' && (
                  <p className="text-zinc-100 font-medium text-xs sm:text-sm italic font-sans drop-shadow">
                    {activeSegment.sanskritIAST}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-medium tracking-wide">
                संस्कृत-ध्वन्यङ्कनम् (Sanskrit Dubbing Active)
              </p>
            )}
          </div>
        )}

        {/* Center Play Button Overlay when paused */}
        {!isPlaying && (
          <button
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all z-20"
            title="Play Video"
          >
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </button>
        )}
      </div>

      {/* Multi-Track Audio Timeline Bar */}
      <div className="mt-3 px-1">
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative w-full h-9 bg-zinc-950 rounded-lg cursor-pointer border border-zinc-800 overflow-hidden flex items-center group shadow-inner"
          title="Click to seek"
        >
          {/* Segments color bands */}
          {project.segments.map(seg => {
            const duration = Math.max(1, project.duration);
            const leftPct = (seg.startTime / duration) * 100;
            const widthPct = ((seg.endTime - seg.startTime) / duration) * 100;
            const speaker = project.speakers.find(s => s.id === seg.speakerId) || project.speakers[0];
            const isActive = activeSegment?.id === seg.id;

            return (
              <div
                key={seg.id}
                className={`absolute top-1 bottom-1 rounded transition-all flex items-center px-1.5 overflow-hidden border ${
                  isActive
                    ? 'ring-2 ring-indigo-400 z-10 opacity-100 shadow-md'
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: `${speaker?.color || '#6366f1'}35`,
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
              left: `${(currentTime / Math.max(1, project.duration)) * 100}%`,
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
              if (videoRef.current) videoRef.current.currentTime = 0;
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
              <span className="capitalize">{subtitlesMode === 'off' ? 'Subtitles Off' : subtitlesMode}</span>
            </button>

            {showSubtitlesMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-2xl z-30 flex flex-col gap-0.5">
                {(['off', 'dual', 'devanagari', 'iast'] as const).map(mode => (
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
                    {mode === 'off' ? 'Subtitles Off (Clean Video)' : mode === 'dual' ? 'Dual (Sanskrit + Roman)' : mode === 'devanagari' ? 'Sanskrit (Devanagari)' : 'Roman Phonetic (IAST)'}
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
