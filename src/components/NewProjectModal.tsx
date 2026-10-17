import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  Sparkles, 
  Languages, 
  Users, 
  AlertCircle
} from 'lucide-react';
import { VideoProject, Speaker } from '../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: VideoProject) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'topic'>('upload');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [speakersCount, setSpeakersCount] = useState<number>(2);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      if (!videoTitle) {
        setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleCreate = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const title = videoTitle || (uploadedFile ? uploadedFile.name : 'Sanskrit Dubbed Video');
      
      const res = await fetch('/api/dub/transcribe-and-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: title,
          description: videoDesc || 'Video dubbed into fluent, accurate Sanskrit',
          originalLanguage: sourceLanguage,
          sourceText: sourceText,
          speakersCount: speakersCount,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.data || !data.data.segments) {
        throw new Error(data.error || 'Failed to generate Sanskrit dubbing script');
      }

      const generated = data.data;

      const speakers: Speaker[] = [];
      const speakerIds = Array.from(new Set(generated.segments.map((s: any) => s.speakerId)));
      
      const defaultVoices: Array<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'> = [
        'Fenrir', 'Zephyr', 'Puck', 'Kore', 'Charon'
      ];
      const defaultColors = ['#38bdf8', '#818cf8', '#34d399', '#f43f5e', '#a855f7'];

      speakerIds.forEach((spkId: any, idx) => {
        const segWithSpk = generated.segments.find((s: any) => s.speakerId === spkId);
        const gender = (segWithSpk?.speakerGender || (idx % 2 === 0 ? 'male' : 'female')) as 'male' | 'female';
        speakers.push({
          id: spkId,
          name: segWithSpk?.speakerName || `Speaker ${idx + 1}`,
          gender: gender,
          role: idx === 0 ? 'Lead Speaker' : 'Co-host',
          color: defaultColors[idx % defaultColors.length],
          avatar: gender === 'female' ? '👩' : '👨',
          voiceName: gender === 'female' ? 'Kore' : 'Fenrir',
          voiceStylePrompt: `Clean, professional, articulate ${gender} studio delivery`,
          pitchMultiplier: gender === 'female' ? 1.04 : 0.96,
          speedMultiplier: 1.0,
        });
      });

      const maxEnd = Math.max(...generated.segments.map((s: any) => s.endTime || 0), 20);

      const newProj: VideoProject = {
        id: `proj-${Date.now()}`,
        title: title,
        sanskritTitle: generated.title || 'संस्कृत-अनुवादः',
        description: generated.summary || videoDesc || 'AI-powered Sanskrit video dubbing project',
        category: 'documentary',
        duration: Math.ceil(maxEnd),
        canvasTheme: 'cosmic',
        videoUrl: uploadedFile ? URL.createObjectURL(uploadedFile) : undefined,
        isCustomUpload: Boolean(uploadedFile),
        speakers: speakers.length > 0 ? speakers : [
          {
            id: 'spk-1',
            name: 'Speaker 1',
            gender: 'male',
            role: 'Presenter',
            color: '#38bdf8',
            avatar: '🎙️',
            voiceName: 'Fenrir',
            voiceStylePrompt: 'Professional announcer voice',
            pitchMultiplier: 1.0,
            speedMultiplier: 1.0,
          }
        ],
        segments: generated.segments.map((s: any, idx: number) => ({
          id: s.id || `seg-gen-${idx}`,
          speakerId: s.speakerId || 'spk-1',
          speakerName: s.speakerName || 'Speaker',
          startTime: s.startTime ?? idx * 5,
          endTime: s.endTime ?? (idx + 1) * 5,
          originalText: s.originalText || '',
          sanskritDevanagari: s.sanskritDevanagari || 'नमस्ते',
          sanskritIAST: s.sanskritIAST || 'Namaste',
          englishTranslation: s.englishTranslation || '',
          rasa: s.rasa || 'neutral',
          timingFitNote: s.timingFitNote || 'Aligned with dialogue tempo',
          wordsBreakdown: s.wordsBreakdown || [],
        })),
      };

      onCreateProject(newProj);
      onClose();
    } catch (err: any) {
      console.error('Error creating project:', err);
      setErrorMsg(err.message || 'Failed to process and dub video');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Import Video for Sanskrit Dubbing
            </h2>
            <p className="text-xs text-zinc-400">
              Upload local video or provide transcript to automatically translate and dub into Sanskrit
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Video File</span>
          </button>
          <button
            onClick={() => setActiveTab('topic')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'topic'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Prompt / Topic Script</span>
          </button>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          {activeTab === 'upload' && (
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Video or Audio File
              </label>
              <label className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-950 transition-colors">
                <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
                <span className="text-xs font-semibold text-zinc-200">
                  {uploadedFile ? uploadedFile.name : 'Choose video file (MP4, WebM, MOV)'}
                </span>
                <span className="text-[11px] text-zinc-500 mt-1">
                  Local playback with zero latency
                </span>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Project Title
            </label>
            <input
              type="text"
              placeholder="e.g., Tech Product Announcement, Nature Doc..."
              value={videoTitle}
              onChange={e => setVideoTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-zinc-400" />
                <span>Source Language</span>
              </label>
              <select
                value={sourceLanguage}
                onChange={e => setSourceLanguage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
                <option value="Japanese">Japanese (日本語)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>Speakers in Scene</span>
              </label>
              <select
                value={speakersCount}
                onChange={e => setSpeakersCount(parseInt(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
              >
                <option value={1}>1 Speaker (Solo Narrator / Keynote)</option>
                <option value={2}>2 Speakers (Interview / Dialogue)</option>
                <option value={3}>3 Speakers (Multi-Speaker Panel)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              {activeTab === 'upload' ? 'Transcript or Scene Summary (Optional)' : 'Dialogue Script or Topic Prompt'}
            </label>
            <textarea
              rows={3}
              placeholder={
                activeTab === 'upload'
                  ? 'Paste original transcript to ensure exact word-for-word translation...'
                  : 'Describe what the video is about or paste the dialogue script...'
              }
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>{isProcessing ? 'Translating & Segmenting...' : 'Generate Dubbing Project'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
