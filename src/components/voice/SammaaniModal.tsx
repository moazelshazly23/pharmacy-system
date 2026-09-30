import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, RotateCcw, CheckCircle, AlertCircle, Sparkles, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ayah, Surah } from '../../types/quran';
import { quranService } from '../../services/quranService';
import { audioService } from '../../services/audioService';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  surahId: number;
  fromVerse: number;
  toVerse: number;
  onClose: () => void;
}

export const SammaaniModal: React.FC<Props> = ({
  surahId,
  fromVerse,
  toVerse,
  onClose,
}) => {
  const [surah, setSurah] = useState<Surah | null>(null);
  const [targetVerses, setTargetVerses] = useState<Ayah[]>([]);
  const [currentVerseIndex, setCurrentVerseIndex] = useState<number>(0);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [evaluationResult, setEvaluationResult] = useState<{
    accuracyPercent: number;
    wordStatuses: { word: string; status: 'correct' | 'missing' | 'mismatch' }[];
    completed: boolean;
  } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    quranService.getSurah(surahId).then((s) => {
      if (s) {
        setSurah(s);
        const filtered = s.verses.filter(
          (v) => v.verse_number >= fromVerse && v.verse_number <= toVerse
        );
        setTargetVerses(filtered);
      }
    });

    // Check SpeechRecognition support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }

    return () => {
      stopListening();
    };
  }, [surahId, fromVerse, toVerse]);

  const activeAyah = targetVerses[currentVerseIndex];

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpokenTranscript('');
    setEvaluationResult(null);

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalStr = '';
        for (let i = 0; i < event.results.length; i++) {
          finalStr += event.results[i][0].transcript + ' ';
        }
        setSpokenTranscript(finalStr.trim());
      };

      recognition.onerror = (event: { error: string }) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const evaluateRecitation = () => {
    stopListening();
    if (!activeAyah) return;

    const targetWords = activeAyah.text_uthmani.split(/\s+/);
    const spokenWords = quranService.normalizeArabicText(spokenTranscript).split(/\s+/).filter(Boolean);

    let matchCount = 0;
    const statuses: { word: string; status: 'correct' | 'missing' | 'mismatch' }[] = [];

    targetWords.forEach((word) => {
      const normWord = quranService.normalizeArabicText(word);
      const isFound = spokenWords.some(
        (spk) => spk === normWord || spk.includes(normWord) || normWord.includes(spk)
      );

      if (isFound) {
        matchCount++;
        statuses.push({ word, status: 'correct' });
      } else {
        statuses.push({ word, status: 'missing' });
      }
    });

    const accuracy = targetWords.length > 0 ? Math.round((matchCount / targetWords.length) * 100) : 0;
    const result = {
      accuracyPercent: accuracy,
      wordStatuses: statuses,
      completed: accuracy >= 70,
    };

    setEvaluationResult(result);

    if (result.completed) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  };

  const handleNextVerse = () => {
    if (currentVerseIndex < targetVerses.length - 1) {
      setCurrentVerseIndex(currentVerseIndex + 1);
      setSpokenTranscript('');
      setEvaluationResult(null);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Mic size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                ميزة «سمّعني»
              </h3>
              <span className="text-xs text-stone-500">
                سورة {surah?.name_arabic} · الآية {activeAyah ? toArabicNumeral(activeAyah.verse_number) : ''}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Target Ayah Box */}
        {activeAyah && (
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-center mb-4">
            <span className="text-xs text-stone-400 block mb-2">الآية المستهدفة للتسميع:</span>
            <p className="font-quran text-2xl sm:text-3xl leading-loose text-stone-900 dark:text-stone-100">
              ﴿{activeAyah.text_uthmani}﴾
            </p>
          </div>
        )}

        {/* Spoken Text Display */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 mb-4 text-center min-h-[90px] flex flex-col justify-center">
          {spokenTranscript ? (
            <p className="font-cairo text-sm text-stone-800 dark:text-stone-200">
              &quot;{spokenTranscript}&quot;
            </p>
          ) : isListening ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-6 bg-red-500 rounded-full animate-pulse" />
                <span className="w-2 h-8 bg-amber-500 rounded-full animate-pulse delay-75" />
                <span className="w-2 h-5 bg-emerald-500 rounded-full animate-pulse delay-150" />
              </div>
              <span className="text-xs text-stone-500">جاري الاستماع لتلاوتك... اقرأ بصوت واضح</span>
            </div>
          ) : (
            <span className="text-xs text-stone-400">
              اضغط على زر الميكروفون بالأسفل وابدأ القراءة
            </span>
          )}
        </div>

        {/* Evaluation Word Highlights */}
        {evaluationResult && (
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 mb-4 animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-stone-700 dark:text-stone-300">
                نتيجة التسميع والتحليل اللفظي:
              </span>
              <span
                className={`font-bold text-sm px-2.5 py-0.5 rounded-full ${
                  evaluationResult.accuracyPercent >= 80
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : evaluationResult.accuracyPercent >= 50
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                الدقة: {toArabicNumeral(evaluationResult.accuracyPercent)}%
              </span>
            </div>

            {/* Word by word color coding */}
            <div className="font-quran text-lg leading-loose flex flex-wrap gap-1.5 justify-center py-2">
              {evaluationResult.wordStatuses.map((ws, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded-lg text-sm ${
                    ws.status === 'correct'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 line-through'
                  }`}
                  title={ws.status === 'correct' ? 'نُطقت بشكل سليم' : 'لم تُنطق أو غير واضحة'}
                >
                  {ws.word}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 text-[11px] text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-700">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>أُتقنت</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>تحتاج مراجعة</span>
              </span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 my-2">
          {!isListening ? (
            <button
              onClick={startListening}
              className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold shadow-md active:scale-98 transition-all"
            >
              <Mic size={20} />
              <span>ابدأ التسميع</span>
            </button>
          ) : (
            <button
              onClick={evaluateRecitation}
              className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md animate-pulse active:scale-98 transition-all"
            >
              <MicOff size={20} />
              <span>إيقاف وتقييم الحفظ</span>
            </button>
          )}

          {evaluationResult && (
            <button
              onClick={handleNextVerse}
              className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md active:scale-98 transition-all"
            >
              <span>{currentVerseIndex < targetVerses.length - 1 ? 'الآية التالية' : 'إتمام التسميع'}</span>
            </button>
          )}
        </div>

        {/* Holy Disclaimer Notice */}
        <p className="text-[11px] text-stone-400 dark:text-stone-500 text-center mt-4 border-t border-stone-100 dark:border-stone-800 pt-3">
          تنبيه: ميزة «سمّعني» أداة تقنية للمساعدة في التذكر واكتشاف مواضع النسيان فقط، وليست حكماً شرعياً على صحة القراءة وأحكام التجويد.
        </p>
      </div>
    </div>
  );
};
