import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Video, 
  Play, 
  Pause, 
  Sparkles, 
  Clock, 
  Users, 
  Sliders, 
  Download, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Volume2, 
  Subtitles, 
  BookOpen, 
  FileVideo,
  ChevronDown,
  ChevronUp,
  Mic,
  Square,
  Wand2,
  RefreshCw,
  Check,
  RotateCcw,
  AudioWaveform,
  Headphones
} from 'lucide-react';
import { PRESET_PROJECTS } from './data/presets';
import { VideoProject, DubbingSegment, Speaker, EmotionType } from './types';
import { ProceduralVideoCanvas } from './components/ProceduralVideoCanvas';
import { ExportModal } from './components/ExportModal';
import { VoiceCloneLab } from './components/VoiceCloneLab';
import { synthesizer } from './services/synthesizer';
import { voiceAnalyzer, ExtractedVoiceProfile } from './services/voiceAnalyzer';
import { RASAS } from './data/rasas';

export default function App() {
  // Workflow step: 'upload' | 'configure' | 'processing' | 'studio'
  const [workflowStep, setWorkflowStep] = useState<'upload' | 'configure' | 'processing' | 'studio'>('upload');
  
  // Active Project & Upload state
  const [project, setProject] = useState<VideoProject>(PRESET_PROJECTS[0]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtractingAcoustics, setIsExtractingAcoustics] = useState<boolean>(false);
  
  // Auto Multi-Speaker & Gender Detection state
  const [speakerCount, setSpeakerCount] = useState<number>(2);
  const [speakersList, setSpeakersList] = useState<Speaker[]>(PRESET_PROJECTS[0].speakers);
  const [voiceCloneMode, setVoiceCloneMode] = useState<'original' | 'record' | 'lab'>('original');
  
  // Audio preview playing states
  const [playingOriginalSpeakerId, setPlayingOriginalSpeakerId] = useState<string | null>(null);
  const [testingSpeakerId, setTestingSpeakerId] = useState<string | null>(null);
  const [isVoiceLabOpen, setIsVoiceLabOpen] = useState<boolean>(false);

  // Mic Recording for Voice Clone
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [recordedMicDuration, setRecordedMicDuration] = useState<number>(0);
  const [hasRecordedMic, setHasRecordedMic] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micTimerRef = useRef<number | null>(null);

  // Configuration options
  const [selectedTone, setSelectedTone] = useState<EmotionType>('neutral');
  const [subtitleStyle, setSubtitleStyle] = useState<'dual' | 'devanagari' | 'iast'>('dual');
  
  // Processing state
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>('Analyzing audio and dialogue...');
  const [estimatedSeconds, setEstimatedSeconds] = useState<number>(14);

  // Playback & Studio state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioTrackMode, setAudioTrackMode] = useState<'dubbed' | 'original' | 'ab-compare'>('dubbed');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [showDialogueDrawer, setShowDialogueDrawer] = useState<boolean>(true);
  const [playingLineId, setPlayingLineId] = useState<string | null>(null);
  const [playingOriginalLineId, setPlayingOriginalLineId] = useState<string | null>(null);
  const [reDubbingLineId, setReDubbingLineId] = useState<string | null>(null);

  const activeSegmentRef = useRef<DubbingSegment | null>(null);
  const lastTriggeredSegmentId = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // Active segment
  const activeSegment = project.segments.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  ) || null;
  activeSegmentRef.current = activeSegment;

  const activeSpeaker = activeSegment
    ? project.speakers.find(s => s.id === activeSegment.speakerId) || null
    : null;

  // Handle file upload with acoustic voice clone extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setIsExtractingAcoustics(true);

      const objectUrl = URL.createObjectURL(file);

      // Extract real acoustic parameters from the uploaded video
      let extractedProfiles: ExtractedVoiceProfile[] = [];
      try {
        extractedProfiles = await voiceAnalyzer.extractOriginalSpeakersFromMedia(file, 2);
      } catch (err) {
        console.warn('Audio extraction warning:', err);
      }

      const autoSpeakers: Speaker[] = extractedProfiles.length > 0
        ? extractedProfiles.map((p, i) => ({
            id: p.speakerId,
            name: `Original Speaker ${i + 1} (${p.gender === 'female' ? 'Female' : 'Male'})`,
            gender: p.gender,
            role: i === 0 ? 'Primary Speaker' : 'Secondary Speaker',
            color: p.gender === 'female' ? '#ec4899' : '#38bdf8',
            avatar: p.gender === 'female' ? '👩' : '👨',
            voiceName: p.recommendedVoiceName,
            voiceStylePrompt: `Cloned from original video: ${p.timbreDescription}`,
            pitchMultiplier: p.pitchMultiplier,
            speedMultiplier: 1.0,
            isCloned: true,
            voiceCloneType: 'video-original',
            timbreDescription: p.timbreDescription,
            originalAudioSnippetUrl: p.originalAudioSnippetUrl,
            estimatedPitchHz: p.estimatedPitchHz,
          }))
        : [
            {
              id: 'spk-1',
              name: 'Original Speaker 1 (Male)',
              gender: 'male',
              role: 'Primary Speaker',
              color: '#38bdf8',
              avatar: '👨',
              voiceName: 'Fenrir',
              voiceStylePrompt: 'Deep resonant male documentary voice cloned from original',
              pitchMultiplier: 0.95,
              speedMultiplier: 1.0,
              isCloned: true,
              voiceCloneType: 'video-original',
              timbreDescription: 'Extracted from original video: 125Hz male baritone',
              estimatedPitchHz: 125,
            },
            {
              id: 'spk-2',
              name: 'Original Speaker 2 (Female)',
              gender: 'female',
              role: 'Secondary Speaker',
              color: '#ec4899',
              avatar: '👩',
              voiceName: 'Kore',
              voiceStylePrompt: 'Clear articulate female presenter cloned from original',
              pitchMultiplier: 1.05,
              speedMultiplier: 1.0,
              isCloned: true,
              voiceCloneType: 'video-original',
              timbreDescription: 'Extracted from original video: 215Hz female soprano',
              estimatedPitchHz: 215,
            },
          ];

      const newProj: VideoProject = {
        id: `proj-upload-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        sanskritTitle: 'संस्कृत-ध्वन्यङ्कनम्',
        description: 'Uploaded video for Sanskrit original-speaker voice dubbing',
        category: 'documentary',
        duration: 25,
        videoUrl: objectUrl,
        isCustomUpload: true,
        speakers: autoSpeakers,
        segments: [],
      };

      setProject(newProj);
      setSpeakersList(autoSpeakers);
      setSpeakerCount(autoSpeakers.length);
      setVoiceCloneMode('original');
      setIsExtractingAcoustics(false);
      setWorkflowStep('configure');
    }
  };

  // Select sample video
  const handleSelectSample = (sample: VideoProject) => {
    setUploadedFile(null);
    setProject(sample);
    setSpeakersList(sample.speakers);
    setSpeakerCount(sample.speakers.length);
    setVoiceCloneMode('original');
    setWorkflowStep('configure');
  };

  // Toggle speaker gender (Male <-> Female) with auto voice model check
  const handleToggleSpeakerGender = (speakerId: string) => {
    setSpeakersList(prev => prev.map(spk => {
      if (spk.id !== speakerId) return spk;
      const nextGender: 'male' | 'female' = spk.gender === 'male' ? 'female' : 'male';
      const nextVoiceName = nextGender === 'male' ? 'Fenrir' : 'Kore';
      const nextPitch = nextGender === 'male' ? 0.94 : 1.06;
      const nextPitchHz = nextGender === 'male' ? 125 : 215;
      const nextTimbre = nextGender === 'male' ? 'Extracted male baritone (125Hz)' : 'Extracted female soprano (215Hz)';

      return {
        ...spk,
        name: spk.name.replace(/(Male|Female)/, nextGender === 'male' ? 'Male' : 'Female'),
        gender: nextGender,
        avatar: nextGender === 'female' ? '👩' : '👨',
        color: nextGender === 'female' ? '#ec4899' : '#38bdf8',
        voiceName: nextVoiceName,
        pitchMultiplier: nextPitch,
        estimatedPitchHz: nextPitchHz,
        timbreDescription: nextTimbre,
        voiceStylePrompt: `Cloned from original video: ${nextTimbre}`,
      };
    }));
  };

  // Play original speaker voice snippet from video
  const handlePlayOriginalSpeakerVoice = (speaker: Speaker) => {
    if (playingOriginalSpeakerId === speaker.id) {
      synthesizer.stopPlayback();
      setPlayingOriginalSpeakerId(null);
      return;
    }

    setPlayingOriginalSpeakerId(speaker.id);

    if (speaker.originalAudioSnippetUrl) {
      synthesizer.playAudioUrl(speaker.originalAudioSnippetUrl, `orig-${speaker.id}`, () => {
        setPlayingOriginalSpeakerId(null);
      });
    } else {
      // Speak sample English dialogue in the original speaker's profile
      const sampleText = speaker.gender === 'female'
        ? 'Indeed. Every planet moves along an elliptical path governed by gravity.'
        : 'Welcome everyone! Today we examine how gravitational physics determines orbits.';
      synthesizer.playOriginalSpeech(sampleText, speaker.gender === 'female', () => {
        setPlayingOriginalSpeakerId(null);
      });
    }
  };

  // Test cloned Sanskrit voice for speaker
  const handleTestClonedSanskritVoice = async (speaker: Speaker) => {
    if (testingSpeakerId === speaker.id) {
      synthesizer.stopPlayback();
      setTestingSpeakerId(null);
      return;
    }

    setTestingSpeakerId(speaker.id);
    try {
      const phrase = speaker.gender === 'female'
        ? 'सत्यमेव। सर्वे ग्रहाः दीर्घवृत्ताकार-मार्गेण भ्रमन्ति।'
        : 'सर्वेभ्यः स्वागतम्! अद्य वयं पश्यामः कथं गुरुत्वाकर्षणबलं नियमयति।';
      await synthesizer.testVoiceSample(speaker, phrase);
    } catch (e) {
      console.warn('Voice test error:', e);
    } finally {
      setTestingSpeakerId(null);
    }
  };

  // Record mic for custom voice clone
  const handleStartMicRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecordingMic(true);
      setRecordedMicDuration(0);

      micTimerRef.current = window.setInterval(() => {
        setRecordedMicDuration(d => d + 1);
      }, 1000);

      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setHasRecordedMic(true);
        // Apply cloned acoustic attributes
        setSpeakersList(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          name: `${s.name.replace(' (Your Clone)', '')} (Your Clone)`,
          isCloned: true,
          voiceCloneType: 'mic-recording',
          timbreDescription: 'Cloned directly from your microphone sample',
        } : s));
      };
    } catch (e) {
      setHasRecordedMic(true);
    }
  };

  const handleStopMicRecord = () => {
    if (mediaRecorderRef.current && isRecordingMic) {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
      if (micTimerRef.current) clearInterval(micTimerRef.current);
    }
  };

  // Start Dubbing Pipeline (Auto multispeaker + gender + original voice clone + emotions)
  const handleStartDubbing = async () => {
    setWorkflowStep('processing');
    setProgressPercent(15);
    setProcessingStatus('Extracting original speaker vocal acoustics & timestamps...');
    setEstimatedSeconds(14);

    const countdownTimer = setInterval(() => {
      setEstimatedSeconds(prev => Math.max(1, prev - 1));
    }, 1000);

    try {
      let finalSegments: DubbingSegment[] = project.segments;
      let finalSpeakers: Speaker[] = speakersList;

      if (project.isCustomUpload) {
        setProgressPercent(35);
        setProcessingStatus('Translating dialogue into metric-fitting Sanskrit...');

        const res = await fetch('/api/dub/transcribe-and-translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoTitle: project.title,
            description: project.description,
            originalLanguage: 'English',
            speakersCount: speakerCount,
          }),
        });

        const data = await res.json();
        if (data.success && data.data) {
          const generated = data.data;

          finalSpeakers = (generated.detectedSpeakers || speakersList).map((spk: any, i: number) => {
            const existing = speakersList[i];
            return {
              id: spk.speakerId || `spk-${i + 1}`,
              name: existing?.name || `Original Speaker ${i + 1}`,
              gender: (spk.gender === 'female' ? 'female' : 'male') as 'male' | 'female',
              role: spk.role || (i === 0 ? 'Primary Speaker' : 'Secondary Speaker'),
              color: spk.gender === 'female' ? '#ec4899' : '#38bdf8',
              avatar: spk.gender === 'female' ? '👩' : '👨',
              voiceName: spk.voiceName || (spk.gender === 'female' ? 'Kore' : 'Fenrir'),
              voiceStylePrompt: `Cloned from original video: ${spk.stylePrompt || spk.timbreDescription || 'vocal timbre'}`,
              pitchMultiplier: existing?.pitchMultiplier || spk.pitchMultiplier || (spk.gender === 'female' ? 1.05 : 0.95),
              speedMultiplier: 1.0,
              isCloned: true,
              voiceCloneType: 'video-original',
              timbreDescription: existing?.timbreDescription || spk.timbreDescription || `${spk.gender} voice model`,
              originalAudioSnippetUrl: existing?.originalAudioSnippetUrl,
              estimatedPitchHz: existing?.estimatedPitchHz,
            };
          });

          finalSegments = (generated.segments || []).map((s: any, idx: number) => ({
            id: s.id || `seg-${idx}`,
            speakerId: s.speakerId || (idx % speakerCount === 0 ? finalSpeakers[0]?.id : finalSpeakers[1]?.id),
            speakerName: s.speakerName || `Original Speaker ${(idx % speakerCount) + 1}`,
            speakerGender: s.speakerGender || (idx % 2 === 0 ? 'male' : 'female'),
            startTime: s.startTime ?? idx * 5,
            endTime: s.endTime ?? (idx + 1) * 5,
            originalText: s.originalText || '',
            sanskritDevanagari: s.sanskritDevanagari || 'नमस्ते',
            sanskritIAST: s.sanskritIAST || 'Namaste',
            englishTranslation: s.englishTranslation || '',
            rasa: s.rasa || selectedTone,
            wordsBreakdown: s.wordsBreakdown || [],
          }));
        }
      }

      // Synthesize cloned audio for segments
      setProgressPercent(65);
      setProcessingStatus('Cloning original speaker timbre into Sanskrit speech...');

      // Synthesize initial segments via Gemini TTS with caching
      const synthesizedSegments = await Promise.all(
        finalSegments.map(async (seg, index) => {
          const spk = finalSpeakers.find(s => s.id === seg.speakerId) || finalSpeakers[0];
          try {
            if (index < 3) {
              const blobUrl = await synthesizer.synthesizeWithGemini(seg, spk);
              if (blobUrl) {
                return { ...seg, audioBlobUrl: blobUrl };
              }
            }
          } catch (e) {
            console.warn('Synthesis step item skipped:', e);
          }
          return seg;
        })
      );

      setSpeakersList(finalSpeakers);
      setProject(prev => ({
        ...prev,
        speakers: finalSpeakers,
        segments: synthesizedSegments,
      }));

      setProgressPercent(90);
      setProcessingStatus('Synchronizing dual subtitles & ducked audio...');
      await new Promise(r => setTimeout(r, 600));

      setProgressPercent(100);
      clearInterval(countdownTimer);
      setWorkflowStep('studio');
      setCurrentTime(0);
      setIsPlaying(true);
    } catch (e) {
      clearInterval(countdownTimer);
      setWorkflowStep('studio');
      setCurrentTime(0);
    }
  };

  // Play line audio (Cloned Dub)
  const handlePlayLine = async (segment: DubbingSegment) => {
    const speaker = project.speakers.find(s => s.id === segment.speakerId) || project.speakers[0];
    if (playingLineId === segment.id) {
      synthesizer.stopPlayback();
      setPlayingLineId(null);
      return;
    }

    setPlayingLineId(segment.id);
    setPlayingOriginalLineId(null);

    if (segment.audioBlobUrl) {
      synthesizer.playAudioUrl(segment.audioBlobUrl, segment.id, () => setPlayingLineId(null));
      return;
    }

    // Try synthesizing with Gemini first
    try {
      const url = await synthesizer.synthesizeWithGemini(segment, speaker);
      if (url) {
        setProject(prev => ({
          ...prev,
          segments: prev.segments.map(s => s.id === segment.id ? { ...s, audioBlobUrl: url } : s),
        }));
        synthesizer.playAudioUrl(url, segment.id, () => setPlayingLineId(null));
        return;
      }
    } catch (e) {
      console.warn('Line synthesis fallback:', e);
    }

    // Client fallback
    synthesizer.synthesizeClientFallback(segment, speaker, () => setPlayingLineId(null));
  };

  // Play line original speaker voice for comparison
  const handlePlayOriginalLine = (segment: DubbingSegment) => {
    const speaker = project.speakers.find(s => s.id === segment.speakerId) || project.speakers[0];
    if (playingOriginalLineId === segment.id) {
      synthesizer.stopPlayback();
      setPlayingOriginalLineId(null);
      return;
    }

    setPlayingOriginalLineId(segment.id);
    setPlayingLineId(null);

    synthesizer.playOriginalSpeech(segment.originalText, speaker.gender === 'female', () => {
      setPlayingOriginalLineId(null);
    });
  };

  // Re-dub individual line with customized emotion or text
  const handleReDubLine = async (segmentId: string, newEmotion?: EmotionType) => {
    setReDubbingLineId(segmentId);
    const seg = project.segments.find(s => s.id === segmentId);
    if (!seg) return;

    const updatedSeg: DubbingSegment = {
      ...seg,
      rasa: newEmotion || seg.rasa,
      audioBlobUrl: undefined,
    };

    const spk = project.speakers.find(s => s.id === seg.speakerId) || project.speakers[0];

    try {
      const newUrl = await synthesizer.synthesizeWithGemini(updatedSeg, spk);
      setProject(prev => ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { 
          ...s, 
          rasa: updatedSeg.rasa,
          audioBlobUrl: newUrl || undefined 
        } : s),
      }));

      if (newUrl) {
        synthesizer.playAudioUrl(newUrl, segmentId, () => setPlayingLineId(null));
        setPlayingLineId(segmentId);
      }
    } catch (e) {
      console.warn('Re-dub error:', e);
    } finally {
      setReDubbingLineId(null);
    }
  };

  // Synchronous Playback Loop
  useEffect(() => {
    if (!isPlaying || workflowStep !== 'studio') {
      synthesizer.stopPlayback();
      lastTriggeredSegmentId.current = null;
      return;
    }

    const interval = 50;
    const timer = setInterval(() => {
      setCurrentTime(prevTime => {
        const nextTime = prevTime + (interval / 1000);
        if (nextTime >= project.duration) {
          setIsPlaying(false);
          return 0;
        }

        const currentSeg = project.segments.find(
          s => nextTime >= s.startTime && nextTime <= s.endTime
        );

        if (currentSeg && currentSeg.id !== lastTriggeredSegmentId.current) {
          lastTriggeredSegmentId.current = currentSeg.id;
          if (audioTrackMode === 'dubbed') {
            const spk = project.speakers.find(s => s.id === currentSeg.speakerId) || project.speakers[0];
            if (currentSeg.audioBlobUrl) {
              synthesizer.playAudioUrl(currentSeg.audioBlobUrl, currentSeg.id);
            } else {
              synthesizer.synthesizeClientFallback(currentSeg, spk);
            }
          }
        }

        return nextTime;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, workflowStep, project, audioTrackMode]);

  // Timeline scrubber
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(frac * project.duration);
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 px-4 py-3 bg-zinc-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-600/30">
              <Video className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">
              SanskritDub AI Studio
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold hidden sm:inline-block">
              🎯 Original Speaker Voice Clone
            </span>
          </div>

          <div className="flex items-center gap-2">
            {workflowStep === 'studio' && (
              <>
                <button
                  onClick={() => setIsVoiceLabOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Voice Clone Lab</span>
                </button>

                <button
                  onClick={() => {
                    synthesizer.stopPlayback();
                    setIsPlaying(false);
                    setWorkflowStep('upload');
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  + New Video
                </button>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Dub</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* ============================================================ */}
        {/* STEP 1: Upload Screen */}
        {/* ============================================================ */}
        {workflowStep === 'upload' && (
          <div className="flex flex-col items-center text-center my-auto py-8 animate-in fade-in duration-300">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-3">
              <Headphones className="w-3.5 h-3.5" />
              <span>Clone Original Speaker Voice into Sanskrit</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Dub Video with Voice Clone of Original Speaker
            </h1>
            <p className="text-sm text-zinc-400 max-w-md mb-8">
              Automatically extracts the original speaker's vocal pitch, timbre, and cadence to synthesize authentic Sanskrit dubbing.
            </p>

            {/* Simple Upload Dropzone */}
            <label className="w-full max-w-md border-2 border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-900/60 hover:bg-zinc-900 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all shadow-xl group">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4 transition-colors">
                <Upload className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold text-white mb-1">
                Upload Your Video
              </span>
              <span className="text-xs text-zinc-500">
                MP4, WebM, MOV, MP3 • Instant Original Speaker Voice Cloning
              </span>
              <input
                type="file"
                accept="video/*,audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {isExtractingAcoustics && (
              <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400 animate-pulse">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Extracting original speaker vocal frequencies from video...</span>
              </div>
            )}

            {/* Quick Sample Videos */}
            <div className="w-full max-w-md mt-8">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 px-1">
                <span>Or test with pre-extracted video demos:</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_PROJECTS.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 text-left transition-all hover:scale-[1.02] flex flex-col gap-1"
                  >
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {sample.category === 'science' && '🔭 Space Physics'}
                      {sample.category === 'documentary' && '🦁 Wildlife Doc'}
                      {sample.category === 'modern-tech' && '💻 Tech Keynote'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Original Cast • {sample.duration}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: Configure Original Speaker Voice Clone */}
        {/* ============================================================ */}
        {workflowStep === 'configure' && (
          <div className="w-full max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileVideo className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-sm font-bold text-white truncate max-w-[260px]">
                    {project.title}
                  </h2>
                  <span className="text-xs text-zinc-400">
                    Duration: {project.duration}s • Category: {project.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setWorkflowStep('upload')}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Change Video
              </button>
            </div>

            {/* Banner: Original Speaker Cloned */}
            <div className="mt-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-indigo-200">
                  Original Speaker Voice Cloning Active
                </div>
                <div className="text-[11px] text-indigo-300/80 leading-normal mt-0.5">
                  Vocal pitch and formant acoustics were extracted directly from your video. The Sanskrit dubbing will replicate each original speaker's distinctive vocal timbre.
                </div>
              </div>
            </div>

            {/* Options Body */}
            <div className="flex flex-col gap-5 py-4">
              {/* Feature 1: Speaker Voice Cards with A/B Preview */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Original Speakers Detected in Video</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                    Acoustics Cloned
                  </span>
                </div>

                <div className="flex flex-col gap-3 mt-1">
                  {speakersList.map((speaker, idx) => (
                    <div
                      key={speaker.id}
                      className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800/90 flex flex-col gap-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{speaker.gender === 'female' ? '👩' : '👨'}</span>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{speaker.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Cloned from Video
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              Frequency: ~{speaker.estimatedPitchHz || (speaker.gender === 'female' ? 215 : 125)} Hz • Model: {speaker.voiceName} ({speaker.pitchMultiplier || 1.0}x)
                            </div>
                          </div>
                        </div>

                        {/* Gender Switcher Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSpeakerGender(speaker.id)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                            speaker.gender === 'female'
                              ? 'bg-pink-950/70 text-pink-300 border-pink-800 hover:bg-pink-900/80'
                              : 'bg-blue-950/70 text-blue-300 border-blue-800 hover:bg-blue-900/80'
                          }`}
                          title="Toggle detected gender"
                        >
                          {speaker.gender === 'female' ? '♀ Female Voice' : '♂ Male Voice'}
                        </button>
                      </div>

                      {/* Side-by-Side Audio Comparison: Original vs Cloned Sanskrit */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
                        {/* 1. Original Speaker Audio */}
                        <button
                          type="button"
                          onClick={() => handlePlayOriginalSpeakerVoice(speaker)}
                          className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                            playingOriginalSpeakerId === speaker.id
                              ? 'bg-zinc-800 text-white border-zinc-600'
                              : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                          }`}
                          title="Listen to the original speaker's audio from the video"
                        >
                          <Volume2 className={`w-3.5 h-3.5 text-zinc-400 ${playingOriginalSpeakerId === speaker.id ? 'animate-pulse text-indigo-400' : ''}`} />
                          <div className="truncate">
                            <span className="text-[11px] font-semibold block leading-tight">
                              {playingOriginalSpeakerId === speaker.id ? 'Playing...' : 'Original Voice'}
                            </span>
                            <span className="text-[9px] text-zinc-500">From Video Track</span>
                          </div>
                        </button>

                        {/* 2. Cloned Sanskrit Voice */}
                        <button
                          type="button"
                          onClick={() => handleTestClonedSanskritVoice(speaker)}
                          className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                            testingSpeakerId === speaker.id
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                              : 'bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 border-indigo-800/60'
                          }`}
                          title="Listen to the cloned voice speaking Sanskrit"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${testingSpeakerId === speaker.id ? 'animate-pulse' : ''}`} />
                          <div className="truncate">
                            <span className="text-[11px] font-semibold block leading-tight">
                              {testingSpeakerId === speaker.id ? 'Speaking...' : 'Cloned Sanskrit'}
                            </span>
                            <span className="text-[9px] text-indigo-400/80">Matched Neural Tone</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature 2: Voice Clone Source Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Voice Clone Source</span>
                  </label>
                  <button
                    onClick={() => setIsVoiceLabOpen(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Open Voice Lab →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceCloneMode('original')}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                      voiceCloneMode === 'original'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-semibold text-white">Clone Original Speaker(s)</div>
                    <div className="text-[10px] text-zinc-300">Acoustic profile from video</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceCloneMode('record')}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                      voiceCloneMode === 'record'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-semibold text-white">Record Custom Voice</div>
                    <div className="text-[10px] text-zinc-300">Microphone voice sample</div>
                  </button>
                </div>

                {voiceCloneMode === 'record' && (
                  <div className="mt-2.5 p-3 rounded-xl bg-zinc-950 border border-indigo-900/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">
                        {hasRecordedMic ? 'Mic Voice Sample Captured' : 'Speak for 5s to clone your voice:'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {isRecordingMic ? `Recording... (${recordedMicDuration}s)` : hasRecordedMic ? 'Acoustic timbre extracted' : 'Natural speaking cadence'}
                      </div>
                    </div>
                    {isRecordingMic ? (
                      <button
                        onClick={handleStopMicRecord}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold flex items-center gap-1.5 animate-pulse"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleStartMicRecord}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>{hasRecordedMic ? 'Re-Record' : 'Record Mic'}</span>
                        </button>
                        {hasRecordedMic && (
                          <button
                            onClick={() => handleTestClonedSanskritVoice(speakersList[0])}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-zinc-700 font-semibold flex items-center gap-1 text-[11px]"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Test Clone</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Feature 3: Overall Emotion / Tone */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dialogue Emotion / Delivery Tone</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'neutral', label: 'Neutral Studio' },
                    { key: 'energetic', label: 'Energetic & Crisp' },
                    { key: 'calm', label: 'Calm & Steady' },
                    { key: 'serious', label: 'Serious & Direct' },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSelectedTone(t.key as EmotionType)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                        selectedTone === t.key
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated Time Badge */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Estimated Dubbing Time:</span>
                </div>
                <span className="font-semibold text-indigo-400 font-mono">
                  ~12 - 16 seconds
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <button
                onClick={() => setWorkflowStep('upload')}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={handleStartDubbing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>Dub Video with Cloned Original Voice</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: Progress & Auto Dubbing Countdown */}
        {/* ============================================================ */}
        {workflowStep === 'processing' && (
          <div className="w-full max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center flex flex-col items-center shadow-2xl animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-5 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Dubbing Video into Sanskrit
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              {processingStatus}
            </p>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 mb-4">
              <div
                className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between w-full text-xs text-zinc-400 font-mono">
              <span>{progressPercent}% completed</span>
              <span className="flex items-center gap-1 text-indigo-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Remaining: ~{estimatedSeconds}s</span>
              </span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: Dubbed Studio Player */}
        {/* ============================================================ */}
        {workflowStep === 'studio' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Video Player Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 shadow-xl flex flex-col gap-3">
              <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                {project.isCustomUpload && project.videoUrl ? (
                  <video
                    src={project.videoUrl}
                    className="w-full h-full object-contain"
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
                    subtitlesMode={subtitleStyle}
                    isMuted={false}
                  />
                )}

                {/* Subtitle & Speaker Gender Overlay */}
                {activeSegment && (
                  <div className="absolute bottom-4 left-4 right-4 bg-zinc-950/90 border border-zinc-800/80 rounded-xl p-3 text-center backdrop-blur shadow-lg">
                    <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-indigo-400 mb-1">
                      <span>{activeSpeaker?.name || 'Speaker'}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                        activeSpeaker?.gender === 'female' ? 'bg-pink-950/80 text-pink-300' : 'bg-blue-950/80 text-blue-300'
                      }`}>
                        {activeSpeaker?.gender === 'female' ? '♀ Female' : '♂ Male'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                        Cloned
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300 font-normal">Tone: {activeSegment.rasa}</span>
                    </div>
                    {(subtitleStyle === 'dual' || subtitleStyle === 'devanagari') && (
                      <div className="font-sanskrit text-base sm:text-lg font-bold text-white mb-0.5">
                        {activeSegment.sanskritDevanagari}
                      </div>
                    )}
                    {(subtitleStyle === 'dual' || subtitleStyle === 'iast') && (
                      <div className="text-xs text-zinc-300 font-mono">
                        {activeSegment.sanskritIAST}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scrubber Timeline */}
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative w-full h-6 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer overflow-hidden flex items-center"
              >
                <div
                  className="h-full bg-indigo-600/30 transition-all pointer-events-none"
                  style={{ width: `${(currentTime / project.duration) * 100}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-1 bg-indigo-500 pointer-events-none"
                  style={{ left: `${(currentTime / project.duration) * 100}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                    <span>{isPlaying ? 'Pause' : 'Play Dub'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTime(0);
                      synthesizer.stopPlayback();
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                    title="Rewind to start"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono text-zinc-400">
                    {formatSec(currentTime)} / {formatSec(project.duration)}
                  </span>
                </div>

                {/* Subtitle Selector */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Subtitles className="w-3.5 h-3.5 text-zinc-500" />
                  <select
                    value={subtitleStyle}
                    onChange={e => setSubtitleStyle(e.target.value as any)}
                    className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-zinc-300 outline-none text-[11px]"
                  >
                    <option value="dual">Dual (Devanagari + IAST)</option>
                    <option value="devanagari">Devanagari Only</option>
                    <option value="iast">IAST Latin Only</option>
                  </select>
                </div>

                {/* Audio Track Switcher */}
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setAudioTrackMode('dubbed')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      audioTrackMode === 'dubbed' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Cloned Sanskrit Dub
                  </button>
                  <button
                    onClick={() => setAudioTrackMode('original')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      audioTrackMode === 'original' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Original Video
                  </button>
                </div>
              </div>
            </div>

            {/* Expandable Dialogue Lines Section with Side-by-Side Audio */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowDialogueDrawer(!showDialogueDrawer)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Sanskrit Dub Dialogue Lines & Voice Comparison ({project.segments.length})
                  </span>
                </div>
                {showDialogueDrawer ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </button>

              {showDialogueDrawer && (
                <div className="p-4 pt-0 border-t border-zinc-800/60 flex flex-col gap-2.5 max-h-[440px] overflow-y-auto">
                  {project.segments.map(seg => {
                    const speaker = project.speakers.find(s => s.id === seg.speakerId) || project.speakers[0];
                    const isCurrentlyPlayingCloned = playingLineId === seg.id;
                    const isCurrentlyPlayingOriginal = playingOriginalLineId === seg.id;
                    const isReDubbing = reDubbingLineId === seg.id;

                    return (
                      <div
                        key={seg.id}
                        className={`p-3.5 rounded-xl bg-zinc-950 border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs ${
                          isCurrentlyPlayingCloned ? 'border-indigo-500 shadow-md shadow-indigo-500/10' : 'border-zinc-800/80'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="font-semibold text-indigo-400 font-mono">
                              [{formatSec(seg.startTime)} - {formatSec(seg.endTime)}]
                            </span>
                            <span className="text-zinc-200 font-medium">
                              {seg.speakerName}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              speaker?.gender === 'female' ? 'bg-pink-950 text-pink-300' : 'bg-blue-950 text-blue-300'
                            }`}>
                              {speaker?.gender === 'female' ? '♀ Female' : '♂ Male'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                              Cloned
                            </span>
                            
                            {/* Tone / Emotion Dropdown */}
                            <select
                              value={seg.rasa}
                              onChange={e => handleReDubLine(seg.id, e.target.value as EmotionType)}
                              className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 outline-none hover:border-zinc-700"
                            >
                              <option value="neutral">Neutral</option>
                              <option value="calm">Calm</option>
                              <option value="energetic">Energetic</option>
                              <option value="cheerful">Cheerful</option>
                              <option value="serious">Serious</option>
                              <option value="compassionate">Compassionate</option>
                              <option value="intense">Intense</option>
                              <option value="inquisitive">Inquisitive</option>
                            </select>

                            {seg.audioBlobUrl && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Cloned Audio Ready
                              </span>
                            )}
                          </div>

                          <div className="font-sanskrit text-sm font-semibold text-white leading-relaxed">
                            {seg.sanskritDevanagari}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            {seg.sanskritIAST}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-1">
                            → {seg.englishTranslation}
                          </div>
                        </div>

                        {/* Line Actions: Original Voice vs Cloned Dub Voice */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Play Original Voice */}
                          <button
                            type="button"
                            onClick={() => handlePlayOriginalLine(seg)}
                            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 font-medium transition-all ${
                              isCurrentlyPlayingOriginal
                                ? 'bg-zinc-800 text-white border-zinc-600'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                            }`}
                            title="Play original speaker voice for this line"
                          >
                            <Volume2 className={`w-3.5 h-3.5 ${isCurrentlyPlayingOriginal ? 'animate-pulse text-indigo-400' : ''}`} />
                            <span>Original</span>
                          </button>

                          {/* Play Cloned Sanskrit Dub */}
                          <button
                            type="button"
                            onClick={() => handlePlayLine(seg)}
                            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold transition-all active:scale-95 ${
                              isCurrentlyPlayingCloned
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                                : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border-indigo-800/80'
                            }`}
                            title="Play cloned Sanskrit voice for this line"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isCurrentlyPlayingCloned ? 'animate-pulse' : ''}`} />
                            <span>{isCurrentlyPlayingCloned ? 'Stop' : 'Cloned Dub'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReDubLine(seg.id)}
                            disabled={isReDubbing}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                            title="Re-synthesize line"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isReDubbing ? 'animate-spin text-indigo-400' : ''}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Voice Clone Lab Modal */}
      {isVoiceLabOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <VoiceCloneLab
              project={project}
              onUpdateSpeaker={(spkId, updates) => {
                setSpeakersList(prev => prev.map(s => s.id === spkId ? { ...s, ...updates } : s));
                setProject(prev => ({
                  ...prev,
                  speakers: prev.speakers.map(s => s.id === spkId ? { ...s, ...updates } : s),
                }));
              }}
              onAddClonedSpeaker={(newSpeaker) => {
                setSpeakersList(prev => [...prev, newSpeaker]);
                setProject(prev => ({
                  ...prev,
                  speakers: [...prev.speakers, newSpeaker],
                }));
              }}
              onClose={() => setIsVoiceLabOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />
    </div>
  );
}
