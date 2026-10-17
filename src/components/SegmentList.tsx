import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Volume2, 
  Clock, 
  Edit3, 
  Check, 
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { DubbingSegment, Speaker, EmotionType, VideoProject } from '../types';
import { RASAS } from '../data/rasas';

interface SegmentListProps {
  project: VideoProject;
  activeSegmentId: string | null;
  onSelectSegment: (segment: DubbingSegment) => void;
  onUpdateSegment: (segmentId: string, updates: Partial<DubbingSegment>) => void;
  onSynthesizeLine: (segment: DubbingSegment) => Promise<void>;
  onPlayLine: (segment: DubbingSegment) => void;
  playingSegmentId: string | null;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  project,
  activeSegmentId,
  onSelectSegment,
  onUpdateSegment,
  onSynthesizeLine,
  onPlayLine,
  playingSegmentId,
}) => {
  const [expandedLearnerId, setExpandedLearnerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editIast, setEditIast] = useState('');

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const handleStartEdit = (seg: DubbingSegment) => {
    setEditingId(seg.id);
    setEditText(seg.sanskritDevanagari);
    setEditIast(seg.sanskritIAST);
  };

  const handleSaveEdit = (segId: string) => {
    onUpdateSegment(segId, {
      sanskritDevanagari: editText,
      sanskritIAST: editIast,
      audioBlobUrl: undefined,
      audioStatus: 'idle',
    });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* List Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Dialogue Tracks & Subtitles
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
            {project.segments.length} Lines
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 hidden sm:block">
          Select line to jump video • Edit Sanskrit text directly
        </p>
      </div>

      {/* Segment Cards List */}
      <div className="flex flex-col gap-2.5 max-h-[640px] overflow-y-auto pr-1">
        {project.segments.map((seg, idx) => {
          const speaker = project.speakers.find(s => s.id === seg.speakerId);
          const emotion = RASAS[seg.rasa] || RASAS.neutral;
          const isActive = activeSegmentId === seg.id;
          const isPlayingThis = playingSegmentId === seg.id;
          const isLearnerExpanded = expandedLearnerId === seg.id;
          const isEditing = editingId === seg.id;

          return (
            <div
              key={seg.id}
              className={`rounded-xl border transition-all p-3.5 ${
                isActive
                  ? 'bg-zinc-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90'
              }`}
            >
              {/* Header: Speaker, Tone Selector, Timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  {/* Speaker Selector */}
                  <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: speaker?.color || '#6366f1' }} />
                    <select
                      value={seg.speakerId}
                      onChange={e => onUpdateSegment(seg.id, { speakerId: e.target.value })}
                      className="bg-transparent text-xs font-semibold text-zinc-200 outline-none cursor-pointer"
                    >
                      {project.speakers.map(s => (
                        <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                          {s.name} ({s.voiceName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Emotion / Tone Selector */}
                  <div className="flex items-center gap-1">
                    <select
                      value={seg.rasa}
                      onChange={e => onUpdateSegment(seg.id, { rasa: e.target.value as EmotionType })}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium outline-none cursor-pointer transition-colors ${emotion.badgeBg}`}
                      title={emotion.description}
                    >
                      {Object.values(RASAS).map(r => (
                        <option key={r.key} value={r.key} className="bg-zinc-900 text-white">
                          Tone: {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Timestamp Jump Button */}
                <button
                  onClick={() => onSelectSegment(seg)}
                  className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                  title="Jump video to this line"
                >
                  <Clock className="w-3 h-3 text-indigo-400" />
                  <span>{formatSec(seg.startTime)} - {formatSec(seg.endTime)}</span>
                </button>
              </div>

              {/* Main Dialogue Content */}
              <div className="flex flex-col gap-1.5 my-2">
                {/* Source Original Text */}
                <div className="text-xs text-zinc-400">
                  <span className="text-zinc-500 font-medium">Source: </span>
                  <span>"{seg.originalText}"</span>
                </div>

                {/* Sanskrit Translation */}
                {isEditing ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <input
                      type="text"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full bg-zinc-950 border border-indigo-500/60 rounded-lg p-2 text-base font-semibold text-white outline-none"
                      placeholder="Sanskrit (Devanagari)"
                    />
                    <input
                      type="text"
                      value={editIast}
                      onChange={e => setEditIast(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-1.5 text-xs text-zinc-300 outline-none"
                      placeholder="Romanized Phonetics (IAST)"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(seg.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white font-semibold rounded-md text-xs hover:bg-indigo-500"
                      >
                        <Check className="w-3.5 h-3.5" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-base font-semibold text-white tracking-wide leading-relaxed font-sanskrit">
                        {seg.sanskritDevanagari}
                      </div>
                      <button
                        onClick={() => handleStartEdit(seg)}
                        className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
                        title="Edit translation"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Romanized Phonetics (IAST) */}
                    <div className="text-xs text-zinc-300/90 font-mono mt-0.5">
                      {seg.sanskritIAST}
                    </div>
                    {/* English Meaning */}
                    <div className="text-[11px] text-zinc-400 mt-1">
                      → {seg.englishTranslation}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-zinc-800/80">
                {/* Audio Listen & Synthesize */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPlayLine(seg)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isPlayingThis
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    {isPlayingThis ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>Playing</span>
                        <div className="flex items-center gap-0.5 ml-1">
                          <span className="w-1 h-3 bg-white rounded-full animate-wave-1" />
                          <span className="w-1 h-4 bg-white rounded-full animate-wave-2" />
                          <span className="w-1 h-2 bg-white rounded-full animate-wave-3" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Play Dub</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onSynthesizeLine(seg)}
                    disabled={seg.audioStatus === 'synthesizing'}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    title="Generate voice line with Gemini TTS"
                  >
                    <RefreshCw className={`w-3 h-3 text-indigo-400 ${seg.audioStatus === 'synthesizing' ? 'animate-spin' : ''}`} />
                    <span>{seg.audioStatus === 'synthesizing' ? 'Generating...' : 'Regen Audio'}</span>
                  </button>

                  {seg.audioBlobUrl && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                      ✓ HD Dubbed
                    </span>
                  )}
                </div>

                {/* Translation & Grammar Breakdown Toggle */}
                {seg.wordsBreakdown && seg.wordsBreakdown.length > 0 && (
                  <button
                    onClick={() => setExpandedLearnerId(isLearnerExpanded ? null : seg.id)}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-lg hover:bg-indigo-950/30 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Word Breakdown ({seg.wordsBreakdown.length})</span>
                    {isLearnerExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Word-by-Word Accordion for Learners */}
              {isLearnerExpanded && seg.wordsBreakdown && (
                <div className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                      Word-by-Word Translation & Grammatical Function
                    </span>
                    <span className="text-[10px] text-zinc-500">Language Analysis</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {seg.wordsBreakdown.map((wb, widx) => (
                      <div
                        key={widx}
                        className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col gap-0.5 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-sanskrit text-sm font-bold text-white">
                            {wb.word}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {wb.iast}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-200 font-medium">
                          {wb.meaning}
                        </div>
                        {wb.grammar && (
                          <div className="text-[10px] text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded w-fit mt-0.5">
                            {wb.grammar}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
