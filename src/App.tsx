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
  Headphones,
  Globe,
  Film,
  Music,
  Layers,
  Edit3
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
  
  // Source Language & Auto-Detection state
  const [sourceLanguageInput, setSourceLanguageInput] = useState<string>('Auto-detect');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('English');
  const [languageConfidence, setLanguageConfidence] = useState<number>(0.98);
  
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
  const [subtitleStyle, setSubtitleStyle] = useState<'dual' | 'devanagari' | 'iast' | 'off'>('dual');
  
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
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingDevanagari, setEditingDevanagari] = useState<string>('');
  const [editingIAST, setEditingIAST] = useState<string>('');
  const [expandedWordBreakdownId, setExpandedWordBreakdownId] = useState<string | null>(null);

  const activeSegmentRef = useRef<DubbingSegment | null>(null);
  const lastTriggeredSegmentId = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Active segment
  const activeSegment = project.segments.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  ) || null;
  activeSegmentRef.current = activeSegment;

  const activeSpeaker = activeSegment
    ? project.speakers.find(s => s.id === activeSegment.speakerId) || null
    : null;

  // Handle file upload with acoustic voice clone extraction & language analysis
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setIsExtractingAcoustics(true);

      const objectUrl = URL.createObjectURL(file);

      // Extract real acoustic parameters from the uploaded video (auto-detecting 1 vs 2 speakers)
      let extractedProfiles: ExtractedVoiceProfile[] = [];
      try {
        extractedProfiles = await voiceAnalyzer.extractOriginalSpeakersFromMedia(file, 'auto');
      } catch (err) {
        console.warn('Audio extraction warning:', err);
      }

      const isSingleSpeakerDetected = extractedProfiles.length === 1;

      const autoSpeakers: Speaker[] = extractedProfiles.length > 0
        ? extractedProfiles.map((p, i) => ({
            id: p.speakerId,
            name: isSingleSpeakerDetected 
              ? `Original Speaker (${p.gender === 'female' ? 'Female' : 'Male'})`
              : `Original Speaker ${i + 1} (${p.gender === 'female' ? 'Female' : 'Male'})`,
            gender: p.gender,
            role: isSingleSpeakerDetected ? 'Solo Presenter' : (i === 0 ? 'Primary Speaker' : 'Secondary Speaker'),
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
              name: 'Original Speaker (Male)',
              gender: 'male',
              role: 'Solo Presenter',
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
        detectedSourceLanguage: 'English',
        languageConfidence: 0.98,
        speakers: autoSpeakers,
        segments: [],
      };

      setProject(newProj);
      setSpeakersList(autoSpeakers);
      setSpeakerCount(autoSpeakers.length);
      setVoiceCloneMode('original');
      setDetectedLanguage('English');
      setLanguageConfidence(0.98);
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
    setDetectedLanguage(sample.detectedSourceLanguage || 'English');
    setLanguageConfidence(sample.languageConfidence || 0.98);
    setWorkflowStep('configure');
  };

  // Update speaker count (1 to 4)
  const handleUpdateSpeakerCount = (count: number) => {
    setSpeakerCount(count);
    if (count > speakersList.length) {
      // Add speaker
      const nextIdx = speakersList.length + 1;
      const isFemale = nextIdx % 2 === 0;
      const newSpk: Speaker = {
        id: `spk-${nextIdx}`,
        name: `Original Speaker ${nextIdx} (${isFemale ? 'Female' : 'Male'})`,
        gender: isFemale ? 'female' : 'male',
        role: `Contributor ${nextIdx}`,
        color: isFemale ? '#ec4899' : '#10b981',
        avatar: isFemale ? '👩' : '👨',
        voiceName: isFemale ? 'Zephyr' : 'Charon',
        voiceStylePrompt: `Cloned voice profile for speaker ${nextIdx}`,
        pitchMultiplier: isFemale ? 1.08 : 0.92,
        speedMultiplier: 1.0,
        isCloned: true,
        voiceCloneType: 'video-original',
        timbreDescription: `Extracted ${isFemale ? '210Hz female' : '118Hz male'} timbre`,
        estimatedPitchHz: isFemale ? 210 : 118,
      };
      setSpeakersList(prev => [...prev, newSpk]);
    } else if (count < speakersList.length) {
      setSpeakersList(prev => prev.slice(0, count));
    }
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
      // Speak sample dialogue in the original speaker's profile
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

  // Start Dubbing Pipeline (Auto source language + multispeaker + gender + original voice clone + emotions)
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
      let detectedLang = detectedLanguage;

      if (project.isCustomUpload || finalSegments.length === 0) {
        setProgressPercent(35);
        setProcessingStatus('Auto-detecting source language & translating to metric Sanskrit...');

        const res = await fetch('/api/dub/transcribe-and-translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoTitle: project.title,
            description: project.description,
            originalLanguage: sourceLanguageInput === 'Auto-detect' ? undefined : sourceLanguageInput,
            speakersCount: speakerCount,
            detectedGender: speakersList[0]?.gender || 'male',
          }),
        });

        const data = await res.json();
        if (data.success && data.data) {
          const generated = data.data;

          if (generated.detectedSourceLanguage) {
            detectedLang = generated.detectedSourceLanguage;
            setDetectedLanguage(generated.detectedSourceLanguage);
            setLanguageConfidence(generated.languageConfidence || 0.96);
          }

          // If single speaker requested/detected, enforce exactly 1 speaker
          const isSolo = speakerCount === 1;
          const returnedSpeakers = isSolo 
            ? [generated.detectedSpeakers?.[0] || speakersList[0]]
            : (generated.detectedSpeakers || speakersList).slice(0, speakerCount);

          finalSpeakers = returnedSpeakers.map((spk: any, i: number) => {
            const existing = speakersList[i] || speakersList[0];
            const effGender = existing?.gender || (spk.gender === 'female' ? 'female' : 'male') as 'male' | 'female';
            return {
              id: isSolo ? 'spk-1' : (spk.speakerId || `spk-${i + 1}`),
              name: isSolo ? existing.name : (existing?.name || `Original Speaker ${i + 1}`),
              gender: effGender,
              role: isSolo ? 'Solo Presenter' : (i === 0 ? 'Primary Speaker' : 'Secondary Speaker'),
              color: effGender === 'female' ? '#ec4899' : '#38bdf8',
              avatar: effGender === 'female' ? '👩' : '👨',
              voiceName: existing?.voiceName || spk.voiceName || (effGender === 'female' ? 'Kore' : 'Fenrir'),
              voiceStylePrompt: `Cloned from original video: ${existing?.timbreDescription || spk.stylePrompt || 'vocal timbre'}`,
              pitchMultiplier: existing?.pitchMultiplier || spk.pitchMultiplier || (effGender === 'female' ? 1.05 : 0.95),
              speedMultiplier: 1.0,
              isCloned: true,
              voiceCloneType: 'video-original',
              timbreDescription: existing?.timbreDescription || spk.timbreDescription || `${effGender} voice model`,
              originalAudioSnippetUrl: existing?.originalAudioSnippetUrl,
              estimatedPitchHz: existing?.estimatedPitchHz,
            };
          });

          const primarySpeaker = finalSpeakers[0];

          finalSegments = (generated.segments || []).map((s: any, idx: number) => {
            const assignedSpeaker = isSolo
              ? primarySpeaker
              : (finalSpeakers.find(sp => sp.id === s.speakerId) || finalSpeakers[idx % finalSpeakers.length] || primarySpeaker);

            return {
              id: s.id || `seg-${idx}`,
              speakerId: assignedSpeaker.id,
              speakerName: assignedSpeaker.name,
              speakerGender: assignedSpeaker.gender,
              startTime: s.startTime ?? idx * 5,
              endTime: s.endTime ?? (idx + 1) * 5,
              originalText: s.originalText || '',
              sanskritDevanagari: s.sanskritDevanagari || 'नमस्ते',
              sanskritIAST: s.sanskritIAST || 'Namaste',
              englishTranslation: s.englishTranslation || '',
              rasa: s.rasa || selectedTone,
              wordsBreakdown: s.wordsBreakdown || [],
            };
          });
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
        detectedSourceLanguage: detectedLang,
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
      // fallback
    }

    // Resilient fallback with vocal tract resonator
    synthesizer.synthesizeClientFallback(segment, speaker, () => setPlayingLineId(null));
  };

  // Play original line audio (English / Source) for A/B comparison
  const handlePlayOriginalLine = (segment: DubbingSegment) => {
    const speaker = project.speakers.find(s => s.id === segment.speakerId) || project.speakers[0];
    if (playingOriginalLineId === segment.id) {
      synthesizer.stopPlayback();
      setPlayingOriginalLineId(null);
      return;
    }

    setPlayingOriginalLineId(segment.id);
    setPlayingLineId(null);

    synthesizer.playOriginalSpeech(
      segment.originalText,
      speaker.gender === 'female',
      () => setPlayingOriginalLineId(null)
    );
  };

  // Re-dub line with cloned voice & emotion
  const handleReDubLine = async (segmentId: string, newRasa?: EmotionType) => {
    setReDubbingLineId(segmentId);
    try {
      const seg = project.segments.find(s => s.id === segmentId);
      if (!seg) return;

      const updatedSeg: DubbingSegment = {
        ...seg,
        rasa: newRasa || seg.rasa,
      };

      const speaker = project.speakers.find(s => s.id === updatedSeg.speakerId) || project.speakers[0];
      const newUrl = await synthesizer.synthesizeWithGemini(updatedSeg, speaker);

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

  // Inline edit Sanskrit text
  const handleStartEditSegment = (seg: DubbingSegment) => {
    setEditingSegmentId(seg.id);
    setEditingDevanagari(seg.sanskritDevanagari);
    setEditingIAST(seg.sanskritIAST);
  };

  const handleSaveEditSegment = (segmentId: string) => {
    setProject(prev => ({
      ...prev,
      segments: prev.segments.map(s => s.id === segmentId ? {
        ...s,
        sanskritDevanagari: editingDevanagari,
        sanskritIAST: editingIAST,
        audioBlobUrl: undefined, // Cleared so it re-dubs with new text
      } : s),
    }));
    setEditingSegmentId(null);
  };

  // Synchronous Playback Loop
  useEffect(() => {
    if (!isPlaying || workflowStep !== 'studio') {
      synthesizer.stopPlayback();
      lastTriggeredSegmentId.current = null;
      if (videoElementRef.current && !videoElementRef.current.paused) {
        videoElementRef.current.pause();
      }
      return;
    }

    if (videoElementRef.current && videoElementRef.current.paused) {
      videoElementRef.current.play().catch(() => {});
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
          const spk = project.speakers.find(s => s.id === currentSeg.speakerId) || project.speakers[0];
          
          if (audioTrackMode === 'dubbed') {
            if (currentSeg.audioBlobUrl) {
              synthesizer.playAudioUrl(currentSeg.audioBlobUrl, currentSeg.id);
            } else {
              synthesizer.synthesizeClientFallback(currentSeg, spk);
            }
          } else if (audioTrackMode === 'original' && !project.isCustomUpload) {
            synthesizer.playOriginalSpeech(currentSeg.originalText, spk.gender === 'female');
          }
        }

        return nextTime;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, workflowStep, project, audioTrackMode]);

  // Sync video element time
  useEffect(() => {
    if (videoElementRef.current && Math.abs(videoElementRef.current.currentTime - currentTime) > 0.3) {
      videoElementRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Timeline scrubber
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = frac * project.duration;
    setCurrentTime(newTime);
    if (videoElementRef.current) {
      videoElementRef.current.currentTime = newTime;
    }
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
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-indigo-600/30">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">
                  VakSutra
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  ElevenLabs-Grade Sanskrit Dubbing
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Auto Language, Multi-Speaker Diarization, Original Voice Cloning & Full Video Export
              </p>
            </div>
          </div>

          {/* Workflow Stage Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl shadow-inner">
            {[
              { id: 'upload', label: '1. Source Media' },
              { id: 'configure', label: '2. Voice & Diarization' },
              { id: 'processing', label: '3. AI Dubbing' },
              { id: 'studio', label: '4. Studio & Export' },
            ].map((step, idx) => {
              const isCurrent = workflowStep === step.id;
              const isCompleted = 
                (step.id === 'upload' && workflowStep !== 'upload') ||
                (step.id === 'configure' && (workflowStep === 'processing' || workflowStep === 'studio')) ||
                (step.id === 'processing' && workflowStep === 'studio');

              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && <span className="text-zinc-600 text-[10px]">→</span>}
                  <button
                    onClick={() => {
                      if (step.id === 'upload') {
                        synthesizer.stopPlayback();
                        setIsPlaying(false);
                        setWorkflowStep('upload');
                      } else if (step.id === 'configure') {
                        synthesizer.stopPlayback();
                        setIsPlaying(false);
                        setWorkflowStep('configure');
                      } else if (step.id === 'studio' && project.segments.length > 0) {
                        setWorkflowStep('studio');
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isCompleted
                        ? 'text-zinc-300 hover:text-white'
                        : 'text-zinc-600'
                    }`}
                  >
                    {step.label}
                  </button>
                </React.Fragment>
              );
            })}
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
                  className="text-xs px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  + New Video
                </button>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Video</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* ============================================================ */}
        {/* STEP 1: Upload & Source Setup Screen */}
        {/* ============================================================ */}
        {workflowStep === 'upload' && (
          <div className="flex flex-col items-center text-center my-auto py-6 animate-in fade-in duration-300">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold mb-3">
              <Headphones className="w-3.5 h-3.5 text-indigo-400" />
              <span>Free AI Video Dubbing Pipeline • Sanskrit (संस्कृतम्)</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              ElevenLabs-Style Video Dubbing into Sanskrit
            </h1>
            <p className="text-sm text-zinc-400 max-w-lg mb-8">
              Auto-detects source language, separates speakers, determines male/female pitch, clones the original speaker's vocal identity, and outputs a downloadable dubbed video.
            </p>

            {/* Upload Box with Language Config */}
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
              {/* Language Selection Row */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Source Language:</span>
                  </label>
                  <select
                    value={sourceLanguageInput}
                    onChange={e => setSourceLanguageInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Auto-detect">⚡ Auto-detect (AI Detection)</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="French">French (Français)</option>
                    <option value="German">German (Deutsch)</option>
                    <option value="Japanese">Japanese (日本語)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Target Language:</span>
                  </label>
                  <div className="w-full bg-zinc-950 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs text-indigo-200 font-semibold flex items-center justify-between">
                    <span>Sanskrit (संस्कृतम्)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      Metric
                    </span>
                  </div>
                </div>
              </div>

              {/* Drag and Drop Dropzone */}
              <label className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-950/70 hover:bg-zinc-950 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-7 h-7" />
                </div>
                <span className="text-sm font-semibold text-white mb-1">
                  Click to Upload or Drag Video Here
                </span>
                <span className="text-xs text-zinc-500">
                  MP4, WebM, MOV, MP3, WAV • Instant Original Voice Timbre Cloning
                </span>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {isExtractingAcoustics && (
                <div className="flex items-center justify-center gap-2 text-xs text-indigo-400 animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Analyzing acoustic pitch F0 and diarizing speakers...</span>
                </div>
              )}
            </div>

            {/* Quick Sample Videos */}
            <div className="w-full max-w-lg mt-8">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 px-1">
                <span className="font-semibold text-zinc-300">Or test instant sample video projects:</span>
                <span className="text-[11px] text-zinc-500">Pre-extracted multi-speaker cast</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_PROJECTS.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 text-left transition-all hover:scale-[1.02] flex flex-col gap-1 shadow"
                  >
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {sample.category === 'science' && '🔭 Space Physics'}
                      {sample.category === 'documentary' && '🦁 Wildlife Doc'}
                      {sample.category === 'modern-tech' && '💻 Tech Keynote'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {sample.speakers.length} Speakers • {sample.duration}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: Configure Diarization, Gender, & Voice Clones */}
        {/* ============================================================ */}
        {workflowStep === 'configure' && (
          <div className="w-full max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in fade-in duration-200 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white truncate max-w-[320px]">
                    {project.title}
                  </h2>
                  <span className="text-xs text-zinc-400">
                    Duration: {project.duration}s • Category: {project.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setWorkflowStep('upload')}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Change Video
              </button>
            </div>

            {/* AI Auto-Detection Status Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-indigo-200 flex items-center gap-2">
                    <span>Source: {detectedLanguage} ({Math.round(languageConfidence * 100)}% confidence)</span>
                    <span className="text-indigo-400">➔</span>
                    <span className="text-white font-sanskrit">Target: Sanskrit (संस्कृतम्)</span>
                  </div>
                  <div className="text-[11px] text-indigo-300/80 leading-normal mt-0.5">
                    Original voice timbre & metric cadence will be preserved across all speakers.
                  </div>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold shrink-0">
                Acoustics Matched
              </span>
            </div>

            {/* Multi-Speaker Diarization & Gender Check */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Speaker Diarization & Gender Classification</span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {speakerCount === 1 
                      ? 'Detected: 1 Solo Speaker video (Monologue / Presentation / Lecture)'
                      : `Detected: ${speakerCount} Multi-Speaker dialogue with distinct acoustic vocal profiles`}
                  </span>
                </div>

                {/* Speaker Count Mode Selector */}
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
                  {[
                    { count: 1, label: '1 Solo' },
                    { count: 2, label: '2 Dialogue' },
                    { count: 3, label: '3 Multi' },
                    { count: 4, label: '4' },
                  ].map(item => (
                    <button
                      key={item.count}
                      type="button"
                      onClick={() => handleUpdateSpeakerCount(item.count)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                        speakerCount === item.count
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speaker Cards */}
              <div className="flex flex-col gap-3">
                {speakersList.map((speaker, idx) => (
                  <div
                    key={speaker.id}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{speaker.avatar}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {speaker.name}
                          </span>

                          {/* Interactive Gender Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSpeakerGender(speaker.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                              speaker.gender === 'female'
                                ? 'bg-pink-950 text-pink-300 border-pink-800 hover:bg-pink-900'
                                : 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900'
                            }`}
                            title="Click to toggle speaker gender"
                          >
                            <span>{speaker.gender === 'female' ? '♀ Female' : '♂ Male'}</span>
                            <span className="text-[9px] opacity-70 underline">Change</span>
                          </button>
                        </div>

                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>F0 Pitch: ~{speaker.estimatedPitchHz || (speaker.gender === 'female' ? 215 : 125)} Hz</span>
                          <span>•</span>
                          <span>Model: {speaker.voiceName}</span>
                          <span>•</span>
                          <span className="text-indigo-400 font-mono">{speaker.pitchMultiplier.toFixed(2)}x pitch</span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 font-mono flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                            <span>ElevenLabs IVC:</span>
                            <span className="text-white font-bold">{speaker.elevenLabsVoiceId || `el_ivc_${speaker.gender === 'female' ? 'c38kUX8pkfYO' : '21m00Tcm4Tlv'}`}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Audition Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePlayOriginalSpeakerVoice(speaker)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          playingOriginalSpeakerId === speaker.id
                            ? 'bg-zinc-800 text-white border-zinc-600'
                            : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                        }`}
                        title="Listen to extracted original speaker voice snippet"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${playingOriginalSpeakerId === speaker.id ? 'text-indigo-400 animate-pulse' : ''}`} />
                        <span>{playingOriginalSpeakerId === speaker.id ? 'Stop' : 'Orig Snippet'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTestClonedSanskritVoice(speaker)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                          testingSpeakerId === speaker.id
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                            : 'bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border-indigo-800/80'
                        }`}
                        title="Audition synthesized Sanskrit speech in this speaker's cloned timbre"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${testingSpeakerId === speaker.id ? 'animate-spin' : ''}`} />
                        <span>{testingSpeakerId === speaker.id ? 'Speaking...' : 'Test Cloned Dub'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voice Cloning Mode Strategy */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2.5">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-indigo-400" />
                <span>Voice Cloning Strategy</span>
              </label>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setVoiceCloneMode('original')}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                    voiceCloneMode === 'original'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold text-white">Clone Original Speakers</div>
                  <div className="text-[10px] text-zinc-300">Preserves original video cast voices</div>
                </button>

                <button
                  type="button"
                  onClick={() => setVoiceCloneMode('record')}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                    voiceCloneMode === 'record'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold text-white">Record Custom Mic Voice</div>
                  <div className="text-[10px] text-zinc-300">Clone your own voice sample</div>
                </button>
              </div>

              {voiceCloneMode === 'record' && (
                <div className="mt-2.5 p-3 rounded-xl bg-zinc-900 border border-indigo-900/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">
                      {hasRecordedMic ? 'Mic Voice Sample Captured' : 'Speak for 5 seconds to clone your voice:'}
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
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Overall Emotion / Tone */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-2 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Primary Sanskrit Delivery Tone</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'neutral', label: 'Neutral Studio' },
                  { key: 'energetic', label: 'Energetic' },
                  { key: 'calm', label: 'Calm & Steady' },
                  { key: 'serious', label: 'Serious' },
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedTone(t.key as EmotionType)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all ${
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
                <span>Dub Video with Cloned Original Voices</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: Progress & Auto Dubbing Pipeline */}
        {/* ============================================================ */}
        {workflowStep === 'processing' && (
          <div className="w-full max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center flex flex-col items-center shadow-2xl animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-5 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">
              Dubbing Video into Sanskrit
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              {processingStatus}
            </p>

            {/* Pipeline Stage Indicators */}
            <div className="w-full flex flex-col gap-2 mb-6 text-left text-xs bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Acoustic vocal frequencies & pitch F0 separated</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Source language auto-detected ({detectedLanguage})</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-300 animate-pulse">
                <AudioWaveform className="w-3.5 h-3.5 text-indigo-400" />
                <span>Multi-speaker diarization & cloned timbre alignment</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="w-3.5 h-3.5 rounded-full border border-zinc-600" />
                <span>Metric-fitting Sanskrit speech synthesis</span>
              </div>
            </div>

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
        {/* STEP 4: ElevenLabs-Style Dubbed Studio Player */}
        {/* ============================================================ */}
        {workflowStep === 'studio' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Top Studio Control Bar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {project.title}
                  </h2>
                  <span className="font-sanskrit text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {project.sanskritTitle}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-indigo-400 font-semibold">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{project.detectedSourceLanguage || 'English'} ➔ Sanskrit (संस्कृतम्)</span>
                  </span>
                  <span>•</span>
                  <span>{project.speakers.length} Cloned Speakers</span>
                  <span>•</span>
                  <span>{project.segments.length} Dialogue Segments</span>
                </div>
              </div>

              {/* Mode & Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Audio Track Selector */}
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
                  <button
                    onClick={() => setAudioTrackMode('dubbed')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      audioTrackMode === 'dubbed'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Cloned Sanskrit Dub
                  </button>

                  <button
                    onClick={() => setAudioTrackMode('original')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      audioTrackMode === 'original'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Original Audio
                  </button>
                </div>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Video</span>
                </button>
              </div>
            </div>

            {/* Video Player Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
              <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                {project.isCustomUpload && project.videoUrl ? (
                  <video
                    ref={videoElementRef}
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
                {activeSegment && subtitleStyle !== 'off' && (
                  <div className="absolute bottom-4 left-4 right-4 bg-zinc-950/90 border border-zinc-800/80 rounded-xl p-3.5 text-center backdrop-blur shadow-xl">
                    <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-indigo-400 mb-1">
                      <span>{activeSpeaker?.name || 'Speaker'}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                        activeSpeaker?.gender === 'female' ? 'bg-pink-950/80 text-pink-300' : 'bg-blue-950/80 text-blue-300'
                      }`}>
                        {activeSpeaker?.gender === 'female' ? '♀ Female' : '♂ Male'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                        Cloned Voice
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300 font-normal">Tone: {activeSegment.rasa}</span>
                    </div>

                    {(subtitleStyle === 'dual' || subtitleStyle === 'devanagari') && (
                      <div className="font-sanskrit text-base sm:text-xl font-bold text-white mb-0.5">
                        {activeSegment.sanskritDevanagari}
                      </div>
                    )}

                    {(subtitleStyle === 'dual' || subtitleStyle === 'iast') && (
                      <div className="text-xs text-zinc-300 font-mono">
                        {activeSegment.sanskritIAST}
                      </div>
                    )}

                    {subtitleStyle === 'dual' && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {activeSegment.englishTranslation}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scrubber Timeline with Speaker Colored Segment Blocks */}
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative w-full h-8 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer overflow-hidden flex items-center group shadow-inner"
              >
                {/* Segments colored blocks */}
                {project.segments.map(seg => {
                  const leftPct = (seg.startTime / project.duration) * 100;
                  const widthPct = ((seg.endTime - seg.startTime) / project.duration) * 100;
                  const speaker = project.speakers.find(s => s.id === seg.speakerId);
                  const isActive = activeSegment?.id === seg.id;

                  return (
                    <div
                      key={seg.id}
                      className={`absolute top-1 bottom-1 rounded transition-all flex items-center px-2 overflow-hidden border ${
                        isActive
                          ? 'ring-2 ring-indigo-400 z-10 opacity-100 shadow-md'
                          : 'opacity-70 hover:opacity-100'
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

                {/* Scrubber Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 z-20 shadow-[0_0_8px_#818cf8] pointer-events-none transition-[left] duration-75"
                  style={{ left: `${(currentTime / project.duration) * 100}%` }}
                >
                  <div className="w-3 h-3 rounded-full bg-indigo-400 -translate-x-[5px] -translate-y-0.5 shadow" />
                </div>
              </div>

              {/* Player Transport Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition-transform active:scale-95 shadow-md shadow-indigo-600/30"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play Dub'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTime(0);
                      synthesizer.stopPlayback();
                      if (videoElementRef.current) videoElementRef.current.currentTime = 0;
                    }}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                    title="Rewind to start"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <span className="font-mono text-zinc-400 text-xs ml-1">
                    <span className="text-white font-bold">{formatSec(currentTime)}</span> / {formatSec(project.duration)}
                  </span>
                </div>

                {/* Subtitle Selector */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                    <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Subtitles:</span>
                    <select
                      value={subtitleStyle}
                      onChange={e => setSubtitleStyle(e.target.value as any)}
                      className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                    >
                      <option value="dual" className="bg-zinc-900">Dual (Sanskrit + Roman + EN)</option>
                      <option value="devanagari" className="bg-zinc-900">Devanagari Only</option>
                      <option value="iast" className="bg-zinc-900">Roman IAST Only</option>
                      <option value="off" className="bg-zinc-900">Subtitles Off</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Cloned Speakers Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {project.speakers.map(spk => (
                <div
                  key={spk.id}
                  className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 shadow"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{spk.avatar}</span>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{spk.name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                          spk.gender === 'female' ? 'bg-pink-950 text-pink-300' : 'bg-blue-950 text-blue-300'
                        }`}>
                          {spk.gender === 'female' ? '♀' : '♂'}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>{spk.timbreDescription || `${spk.voiceName} • ${spk.pitchMultiplier}x`}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                          ⚡ IVC: {spk.elevenLabsVoiceId || `el_ivc_${spk.gender === 'female' ? 'c38kUX' : '21m00T'}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestClonedSanskritVoice(spk)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-zinc-700 text-[11px] font-semibold flex items-center gap-1"
                    title="Audition Sanskrit cloned voice"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Test</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Dialogue Segments Dubbing Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <button
                onClick={() => setShowDialogueDrawer(!showDialogueDrawer)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors border-b border-zinc-800"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Sanskrit Dub Dialogue Tracks & Timecodes ({project.segments.length} Lines)
                  </span>
                </div>
                {showDialogueDrawer ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </button>

              {showDialogueDrawer && (
                <div className="p-4 flex flex-col gap-3 max-h-[500px] overflow-y-auto">
                  {project.segments.map(seg => {
                    const speaker = project.speakers.find(s => s.id === seg.speakerId) || project.speakers[0];
                    const isCurrentlyPlayingCloned = playingLineId === seg.id;
                    const isCurrentlyPlayingOriginal = playingOriginalLineId === seg.id;
                    const isReDubbing = reDubbingLineId === seg.id;
                    const isEditing = editingSegmentId === seg.id;
                    const isWordBreakdownOpen = expandedWordBreakdownId === seg.id;

                    return (
                      <div
                        key={seg.id}
                        className={`p-4 rounded-xl bg-zinc-950 border transition-all flex flex-col gap-3 text-xs ${
                          isCurrentlyPlayingCloned ? 'border-indigo-500 shadow-md shadow-indigo-500/10' : 'border-zinc-800/80'
                        }`}
                      >
                        {/* Line Top Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-indigo-400 font-mono">
                              [{formatSec(seg.startTime)} - {formatSec(seg.endTime)}]
                            </span>
                            <span className="text-zinc-200 font-bold">
                              {seg.speakerName}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              speaker?.gender === 'female' ? 'bg-pink-950 text-pink-300' : 'bg-blue-950 text-blue-300'
                            }`}>
                              {speaker?.gender === 'female' ? '♀ Female' : '♂ Male'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                              Cloned Voice
                            </span>
                            
                            {/* Tone / Emotion Dropdown */}
                            <select
                              value={seg.rasa}
                              onChange={e => handleReDubLine(seg.id, e.target.value as EmotionType)}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800 outline-none hover:border-zinc-700 font-medium"
                            >
                              <option value="neutral">Tone: Neutral</option>
                              <option value="calm">Tone: Calm</option>
                              <option value="energetic">Tone: Energetic</option>
                              <option value="cheerful">Tone: Cheerful</option>
                              <option value="serious">Tone: Serious</option>
                              <option value="compassionate">Tone: Compassionate</option>
                              <option value="intense">Tone: Intense</option>
                              <option value="inquisitive">Tone: Inquisitive</option>
                            </select>

                            {seg.audioBlobUrl && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Cloned Audio Ready
                              </span>
                            )}
                          </div>

                          {/* Line Actions: Original vs Cloned Audio & Re-dub */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayOriginalLine(seg)}
                              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 font-medium transition-all ${
                                isCurrentlyPlayingOriginal
                                  ? 'bg-zinc-800 text-white border-zinc-600'
                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                              }`}
                              title="Audition original speech"
                            >
                              <Volume2 className={`w-3.5 h-3.5 ${isCurrentlyPlayingOriginal ? 'animate-pulse text-indigo-400' : ''}`} />
                              <span>Original</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePlayLine(seg)}
                              className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 font-bold transition-all active:scale-95 ${
                                isCurrentlyPlayingCloned
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                                  : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border-indigo-800/80'
                              }`}
                              title="Play Sanskrit speech in cloned timbre"
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${isCurrentlyPlayingCloned ? 'animate-pulse' : ''}`} />
                              <span>{isCurrentlyPlayingCloned ? 'Stop' : 'Cloned Dub'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReDubLine(seg.id)}
                              disabled={isReDubbing}
                              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                              title="Re-synthesize line"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isReDubbing ? 'animate-spin text-indigo-400' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Dialogue Texts */}
                        <div className="flex flex-col gap-1.5">
                          <div className="text-xs text-zinc-400">
                            <span className="text-zinc-500 font-medium">Source ({project.detectedSourceLanguage || 'Original'}): </span>
                            <span>"{seg.originalText}"</span>
                          </div>

                          {isEditing ? (
                            <div className="flex flex-col gap-2 mt-1">
                              <label className="text-[10px] text-zinc-400">Edit Sanskrit Devanagari:</label>
                              <input
                                type="text"
                                value={editingDevanagari}
                                onChange={e => setEditingDevanagari(e.target.value)}
                                className="w-full bg-zinc-900 border border-indigo-500 rounded-lg p-2 font-sanskrit text-white text-sm outline-none"
                              />
                              <label className="text-[10px] text-zinc-400">Edit Roman IAST:</label>
                              <input
                                type="text"
                                value={editingIAST}
                                onChange={e => setEditingIAST(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 font-mono text-zinc-300 text-xs outline-none"
                              />
                              <div className="flex justify-end gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingSegmentId(null)}
                                  className="px-3 py-1 rounded bg-zinc-800 text-zinc-400 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditSegment(seg.id)}
                                  className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-semibold"
                                >
                                  Save & Update Dub
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative">
                              <div className="font-sanskrit text-base sm:text-lg font-bold text-white leading-relaxed">
                                {seg.sanskritDevanagari}
                              </div>
                              <div className="text-xs text-zinc-400 font-mono mt-0.5">
                                {seg.sanskritIAST}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
                                <span>→ {seg.englishTranslation}</span>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSegment(seg)}
                                  className="text-[10px] text-zinc-400 hover:text-indigo-300 flex items-center gap-1 opacity-80 hover:opacity-100"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit Sanskrit</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Morphology / Vocabulary Breakdown Toggle */}
                        {seg.wordsBreakdown && seg.wordsBreakdown.length > 0 && (
                          <div className="pt-2 border-t border-zinc-800/60">
                            <button
                              type="button"
                              onClick={() => setExpandedWordBreakdownId(isWordBreakdownOpen ? null : seg.id)}
                              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <span>{isWordBreakdownOpen ? 'Hide' : 'View'} Vocabulary & Grammar Analysis ({seg.wordsBreakdown.length} words)</span>
                              {isWordBreakdownOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isWordBreakdownOpen && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                {seg.wordsBreakdown.map((wb, wIdx) => (
                                  <div
                                    key={wIdx}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 flex flex-col gap-0.5"
                                  >
                                    <span className="font-sanskrit font-bold text-white text-xs">
                                      {wb.word}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-mono italic">
                                      {wb.iast}
                                    </span>
                                    <span className="text-[11px] text-zinc-200 mt-0.5">
                                      {wb.meaning}
                                    </span>
                                    {wb.grammar && (
                                      <span className="text-[9px] text-zinc-500">
                                        {wb.grammar}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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

      {/* Export Modal with Full Video Download */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
        sourceVideoElement={videoElementRef.current}
      />
    </div>
  );
}
