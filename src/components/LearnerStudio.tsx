import React, { useState } from 'react';
import { 
  BookOpen, 
  Volume2, 
  Search, 
  Copy, 
  Check, 
  Languages,
  FileSpreadsheet
} from 'lucide-react';
import { VideoProject, SanskritWordDetail } from '../types';

interface LearnerStudioProps {
  project: VideoProject;
  onPronounceWord: (word: string) => void;
}

export const LearnerStudio: React.FC<LearnerStudioProps> = ({
  project,
  onPronounceWord,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Collect all unique words across all segments
  const allWords: SanskritWordDetail[] = [];
  const seenWords = new Set<string>();

  project.segments.forEach(seg => {
    if (seg.wordsBreakdown) {
      seg.wordsBreakdown.forEach(w => {
        if (!seenWords.has(w.word)) {
          seenWords.add(w.word);
          allWords.push(w);
        }
      });
    }
  });

  const filteredWords = allWords.filter(
    w =>
      w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.iast.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyStudyNotes = () => {
    let md = `# Video Dubbing Transcript & Vocabulary: ${project.title}\n\n`;
    md += `**Description**: ${project.description}\n\n`;
    md += `## Dubbed Dialogue & Word Breakdown\n\n`;

    project.segments.forEach((seg, i) => {
      md += `### Segment ${i + 1}: ${seg.speakerName} [Tone: ${seg.rasa}]\n`;
      md += `**Sanskrit**: ${seg.sanskritDevanagari}\n`;
      md += `**Roman Phonetics (IAST)**: ${seg.sanskritIAST}\n`;
      md += `**English Translation**: ${seg.englishTranslation}\n\n`;

      if (seg.wordsBreakdown && seg.wordsBreakdown.length > 0) {
        md += `| Word | Phonetic | English Meaning | Grammar / Part of Speech |\n`;
        md += `|---|---|---|---|\n`;
        seg.wordsBreakdown.forEach(w => {
          md += `| ${w.word} | ${w.iast} | ${w.meaning} | ${w.grammar || '-'} |\n`;
        });
        md += `\n`;
      }
    });

    navigator.clipboard.writeText(md);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2500);
  };

  const currentFlashcard = allWords[flashcardIndex];

  return (
    <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-6 shadow-xl max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Language Reference & Vocabulary
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Phonetic breakdown, grammatical functions, and glossary extracted from this video
          </p>
        </div>

        <button
          onClick={handleCopyStudyNotes}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors"
        >
          {copiedNotes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedNotes ? 'Copied to Clipboard' : 'Copy Full Transcript (MD)'}</span>
        </button>
      </div>

      {/* Grid: Flashcard & Vocabulary Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
        {/* Left Column: Interactive Word Card */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>Vocabulary Practice</span>
            <span className="text-zinc-500 text-[11px]">
              {allWords.length > 0 ? `${flashcardIndex + 1} of ${allWords.length}` : '0'}
            </span>
          </span>

          {currentFlashcard ? (
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="min-h-[220px] rounded-xl bg-zinc-950 border border-zinc-800 p-5 flex flex-col justify-between cursor-pointer hover:border-zinc-700 transition-all shadow-inner relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  {isFlipped ? 'Meaning & Part of Speech' : 'Word (Click to reveal meaning)'}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onPronounceWord(currentFlashcard.word);
                  }}
                  className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  title="Hear pronunciation"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-center my-auto py-2">
                {!isFlipped ? (
                  <>
                    <div className="font-sanskrit text-2xl font-bold text-white tracking-wide">
                      {currentFlashcard.word}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-1">
                      {currentFlashcard.iast}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-bold text-white">
                      {currentFlashcard.meaning}
                    </div>
                    {currentFlashcard.grammar && (
                      <div className="text-xs text-indigo-400 mt-2 bg-indigo-950/60 px-2.5 py-1 rounded-md inline-block border border-indigo-800/40">
                        {currentFlashcard.grammar}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] text-zinc-500">
                <span>Click card to flip</span>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setFlashcardIndex(prev => (prev > 0 ? prev - 1 : allWords.length - 1));
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setFlashcardIndex(prev => (prev < allWords.length - 1 ? prev + 1 : 0));
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-zinc-950 text-center text-xs text-zinc-500">
              No words available.
            </div>
          )}

          {/* Linguistic Pronunciation Guide */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2 text-xs text-zinc-400">
            <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
              Linguistic Pronunciation Notes
            </span>
            <ul className="space-y-1 text-[11px]">
              <li>• <b className="text-zinc-200">Retroflex consonants (ṭ, ḍ, ṇ, ṣ)</b>: Tongue tip curled back toward the palate.</li>
              <li>• <b className="text-zinc-200">Long vowels (ā, ī, ū)</b>: Sustained for roughly twice the duration of short vowels.</li>
              <li>• <b className="text-zinc-200">Aspiration (kh, gh, th, dh)</b>: Emitted with an audible breath of air.</li>
            </ul>
          </div>
        </div>

        {/* Right Columns: Vocabulary Table */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Dialogue Vocabulary ({allWords.length} Words)
            </span>

            {/* Search */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter words..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/60 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-400 sticky top-0 border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Word (Script)</th>
                  <th className="py-2.5 px-3 font-semibold">Roman Phonetic</th>
                  <th className="py-2.5 px-3 font-semibold">English Translation</th>
                  <th className="py-2.5 px-3 font-semibold">Part of Speech</th>
                  <th className="py-2.5 px-2 text-right">Audio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredWords.map((word, i) => (
                  <tr
                    key={i}
                    className="hover:bg-zinc-900/60 transition-colors cursor-pointer"
                    onClick={() => onPronounceWord(word.word)}
                  >
                    <td className="py-2 px-3 font-sanskrit text-sm font-semibold text-white">
                      {word.word}
                    </td>
                    <td className="py-2 px-3 text-zinc-300 font-mono text-xs">
                      {word.iast}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">
                      {word.meaning}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[10px] text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        {word.grammar || 'Noun / Particle'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onPronounceWord(word.word);
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Pronounce"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
