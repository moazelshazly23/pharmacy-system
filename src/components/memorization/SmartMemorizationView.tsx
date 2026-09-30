import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, CheckCircle, ChevronLeft, ChevronRight, 
  Eye, EyeOff, Award, Sparkles, Brain, ArrowRight, Shuffle, Volume2, AlertCircle, Check,
  SlidersHorizontal, Gauge, Repeat, Plus, Minus, Settings2 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ayah, Surah } from '../../types/quran';
import { quranService } from '../../services/quranService';
import { audioService } from '../../services/audioService';
import { dbService } from '../../services/db';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  initialSurahId?: number;
  initialFromVerse?: number;
  initialToVerse?: number;
  onFinish?: () => void;
  kidsMode?: boolean;
}

type Stage = 'listen_repeat' | 'progressive_hide' | 'fill_blanks' | 'reorder' | 'random_review' | 'completed';

export const SmartMemorizationView: React.FC<Props> = ({
  initialSurahId = 67, // Al-Mulk
  initialFromVerse = 1,
  initialToVerse = 30, // Default to full Surah (open range)
  onFinish,
  kidsMode = false,
}) => {
  const [surahId, setSurahId] = useState<number>(initialSurahId);
  const [fromVerse, setFromVerse] = useState<number>(initialFromVerse);
  const [toVerse, setToVerse] = useState<number>(initialToVerse);
  const [surah, setSurah] = useState<Surah | null>(null);
  const [verses, setVerses] = useState<Ayah[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state if props change
  useEffect(() => {
    if (initialSurahId) setSurahId(initialSurahId);
    if (initialFromVerse !== undefined) setFromVerse(initialFromVerse);
    if (initialToVerse !== undefined) setToVerse(initialToVerse);
  }, [initialSurahId, initialFromVerse, initialToVerse]);

  // Flow State
  const [currentStage, setCurrentStage] = useState<Stage>('listen_repeat');
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number>(0);

  // Stage 1: Listen & Repeat
  const [repeatCount, setRepeatCount] = useState<number>(3);
  const [currentPlayRepeat, setCurrentPlayRepeat] = useState<number>(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(audioService.getState().playbackSpeed || 1.0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(true);
  const [justTransitionedVerse, setJustTransitionedVerse] = useState<boolean>(false);
  const [showRepeatsModal, setShowRepeatsModal] = useState<boolean>(false);

  const prevVerseNumRef = useRef<number | null>(null);
  const prevPlayingRef = useRef<boolean>(false);

  // Stage 2: Progressive Hiding (0: 0% hidden, 1: 30%, 2: 60%, 3: 100% hidden)
  const [hideLevel, setHideLevel] = useState<number>(1);
  const [revealedWordIndices, setRevealedWordIndices] = useState<number[]>([]);

  // Stage 3: Fill in the Blanks
  const [blankWordIndex, setBlankWordIndex] = useState<number>(1);
  const [blankChoices, setBlankChoices] = useState<string[]>([]);
  const [chosenAnswer, setChosenAnswer] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  // Stage 4: Reorder Verses
  const [scrambledVerses, setScrambledVerses] = useState<Ayah[]>([]);
  const [userOrderedVerses, setUserOrderedVerses] = useState<Ayah[]>([]);
  const [reorderStatus, setReorderStatus] = useState<'pending' | 'correct' | 'wrong'>('pending');

  // Stage 5: Spaced Repetition Review
  const [reviewVerses, setReviewVerses] = useState<Ayah[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number>(0);
  const [isPromptRevealed, setIsPromptRevealed] = useState<boolean>(false);

  // Session Statistics
  const [starsEarned, setStarsEarned] = useState<number>(0);

  // Surah selector modal
  const [showSurahSelector, setShowSurahSelector] = useState<boolean>(false);
  const [surahSearchQuery, setSurahSearchQuery] = useState<string>('');
  const [surahsList, setSurahsList] = useState<{ id: number; name_arabic: string; verses_count: number }[]>([]);

  useEffect(() => {
    quranService.getSurahsSummary().then((list) => {
      setSurahsList(list.map((s) => ({ id: s.id, name_arabic: s.name_arabic, verses_count: s.verses_count })));
    });
    dbService.getUserSettings().then((s) => {
      if (s?.verse_repeats && typeof s.verse_repeats === 'number') {
        setRepeatCount(s.verse_repeats);
        audioService.setTargetRepeats(s.verse_repeats);
      }
    });
  }, []);

  useEffect(() => {
    loadVerses();
  }, [surahId, fromVerse, toVerse]);

  useEffect(() => {
    const unsub = audioService.subscribe((state) => {
      const activeAyah = verses[currentAyahIndex];
      const isCurrentPlaying =
        state.isPlaying &&
        state.currentSurahId === surahId &&
        state.currentVerseNumber === activeAyah?.verse_number;

      // Handle automatic advance of ayah index when audio transitions to next verse
      if (state.currentSurahId === surahId && state.currentVerseNumber) {
        const vIndex = verses.findIndex((v) => v.verse_number === state.currentVerseNumber);
        if (vIndex !== -1 && vIndex !== currentAyahIndex) {
          setCurrentAyahIndex(vIndex);
          setJustTransitionedVerse(true);
          setTimeout(() => setJustTransitionedVerse(false), 2500);
          if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
        }
      }

      setIsPlayingAudio(isCurrentPlaying);
      if (state.currentRepeatCount) {
        setCurrentPlayRepeat(state.currentRepeatCount);
      }
      if (state.playbackSpeed) {
        setPlaybackSpeed(state.playbackSpeed);
      }

      // Check if session finished all repeats of the final verse in range
      const lastVerseNum = verses[verses.length - 1]?.verse_number;
      if (
        prevPlayingRef.current &&
        !state.isPlaying &&
        state.currentVerseNumber === lastVerseNum &&
        currentStage === 'listen_repeat'
      ) {
        triggerStageSuccess();
        setTimeout(() => {
          setCurrentStage('progressive_hide');
          setCurrentAyahIndex(0);
          setHideLevel(1);
        }, 700);
      }

      prevPlayingRef.current = state.isPlaying;
      prevVerseNumRef.current = state.currentVerseNumber;
    });

    return unsub;
  }, [surahId, currentAyahIndex, verses, currentStage]);

  const loadVerses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch specific verses and surah from Room via dbService
      const [fetchedVerses, fetchedSurah] = await Promise.all([
        dbService.getVersesRange(surahId, fromVerse, toVerse),
        dbService.getSurah(surahId),
      ]);

      if (!fetchedSurah) {
        throw new Error(`تعذر العثور على بيانات السورة رقم ${surahId}`);
      }

      if (!fetchedVerses || fetchedVerses.length === 0) {
        throw new Error(`لم يتم العثور على آيات في النطاق من ${fromVerse} إلى ${toVerse}`);
      }

      setSurah(fetchedSurah);
      setVerses(fetchedVerses);
      setCurrentAyahIndex(0);

      // Save as last read position for continuity
      await dbService.saveLastReadPosition({
        surah_id: surahId,
        surah_name: fetchedSurah.name_arabic,
        verse_number: fromVerse,
        page_number: fetchedVerses[0]?.page_number || 1,
        updated_at: new Date().toISOString(),
      });

      // Initialize all memorization steps with validated data
      initFillInTheBlanks(fetchedVerses[0]);
      initReorder(fetchedVerses);
      initRandomReview(fetchedSurah, fetchedVerses);
    } catch (err: unknown) {
      console.error('Failed to load verses from dbService:', err);
      const msg = err instanceof Error ? err.message : 'تعذر تحميل الآيات، يرجى المحاولة مرة أخرى.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // --- STAGE 1: LISTEN & REPEAT ---
  const handlePlayCurrentAyah = () => {
    const currentAyah = verses[currentAyahIndex];
    if (!currentAyah) return;
    if (isPlayingAudio) {
      audioService.pause();
    } else {
      const endVerse = autoAdvanceEnabled
        ? (verses[verses.length - 1]?.verse_number || currentAyah.verse_number)
        : currentAyah.verse_number;
      audioService.playVerse(surahId, currentAyah.verse_number, repeatCount, currentAyah.verse_number, endVerse);
    }
  };

  const handleSelectRepeatCount = async (cnt: number) => {
    const safeCnt = Math.max(1, Math.min(50, cnt));
    setRepeatCount(safeCnt);
    audioService.setTargetRepeats(safeCnt);
    try {
      const s = await dbService.getUserSettings();
      await dbService.saveUserSettings({ ...s, verse_repeats: safeCnt });
    } catch {
      // Ignored
    }
  };

  const handleToggleAutoAdvance = () => {
    const nextVal = !autoAdvanceEnabled;
    setAutoAdvanceEnabled(nextVal);
    const currentAyah = verses[currentAyahIndex];
    if (isPlayingAudio && currentAyah) {
      const endVerse = nextVal
        ? (verses[verses.length - 1]?.verse_number || currentAyah.verse_number)
        : currentAyah.verse_number;
      audioService.playVerse(surahId, currentAyah.verse_number, repeatCount, currentAyah.verse_number, endVerse);
    }
  };

  const handleSelectAyahInStage1 = (idx: number) => {
    if (idx < 0 || idx >= verses.length) return;
    setCurrentAyahIndex(idx);
    const targetAyah = verses[idx];
    if (isPlayingAudio && targetAyah) {
      const endVerse = autoAdvanceEnabled
        ? (verses[verses.length - 1]?.verse_number || targetAyah.verse_number)
        : targetAyah.verse_number;
      audioService.playVerse(surahId, targetAyah.verse_number, repeatCount, targetAyah.verse_number, endVerse);
    }
  };

  const handleNextAyahListen = () => {
    audioService.pause();
    setIsPlayingAudio(false);
    if (currentAyahIndex < verses.length - 1) {
      setCurrentAyahIndex(currentAyahIndex + 1);
    } else {
      // Completed Stage 1!
      triggerStageSuccess();
      setCurrentStage('progressive_hide');
      setCurrentAyahIndex(0);
      setHideLevel(1);
    }
  };

  // --- STAGE 2: PROGRESSIVE HIDING ---
  const currentAyah = verses[currentAyahIndex];
  const words = currentAyah ? currentAyah.text_uthmani.split(/\s+/) : [];

  const shouldHideWord = (index: number) => {
    if (revealedWordIndices.includes(index)) return false;
    if (hideLevel === 0) return false;
    if (hideLevel === 1) return index % 3 === 1; // 33% hidden
    if (hideLevel === 2) return index % 2 === 1; // 50% hidden
    if (hideLevel === 3) return index !== 0; // everything except first word
    if (hideLevel === 4) return true; // 100% hidden
    return false;
  };

  const toggleRevealWord = (index: number) => {
    if (revealedWordIndices.includes(index)) {
      setRevealedWordIndices(revealedWordIndices.filter((i) => i !== index));
    } else {
      setRevealedWordIndices([...revealedWordIndices, index]);
    }
  };

  const handleNextStage2 = () => {
    if (hideLevel < 4) {
      setHideLevel(hideLevel + 1);
      setRevealedWordIndices([]);
    } else {
      if (currentAyahIndex < verses.length - 1) {
        setCurrentAyahIndex(currentAyahIndex + 1);
        setHideLevel(1);
        setRevealedWordIndices([]);
      } else {
        triggerStageSuccess();
        setCurrentStage('fill_blanks');
        setCurrentAyahIndex(0);
        initFillInTheBlanks(verses[0]);
      }
    }
  };

  // --- STAGE 3: FILL IN THE BLANKS ---
  const initFillInTheBlanks = (ayah?: Ayah) => {
    if (!ayah) return;
    const w = ayah.text_uthmani.split(/\s+/);
    const targetIdx = Math.max(0, Math.floor(w.length / 2));
    setBlankWordIndex(targetIdx);

    const correctWord = w[targetIdx];
    // Gather 3 distractor words from other verses
    const distractors = [
      'الرَّحْمَٰنِ', 'الْعَزِيزُ', 'الْغَفُورُ', 'الْمُلْكُ', 'قَدِيرٌ', 'عَلِيمٌ', 'سَمِيعٌ'
    ].filter((d) => d !== correctWord).slice(0, 3);

    const choices = [correctWord, ...distractors].sort(() => Math.random() - 0.5);
    setBlankChoices(choices);
    setChosenAnswer(null);
    setIsAnswerCorrect(null);
  };

  const handleSelectBlankAnswer = (choice: string) => {
    const correctWord = words[blankWordIndex];
    setChosenAnswer(choice);
    if (choice === correctWord) {
      setIsAnswerCorrect(true);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
      setTimeout(() => {
        if (currentAyahIndex < verses.length - 1) {
          const nextIdx = currentAyahIndex + 1;
          setCurrentAyahIndex(nextIdx);
          initFillInTheBlanks(verses[nextIdx]);
        } else {
          triggerStageSuccess();
          setCurrentStage('reorder');
        }
      }, 1200);
    } else {
      setIsAnswerCorrect(false);
    }
  };

  // --- STAGE 4: REORDER VERSES ---
  const initReorder = (vList: Ayah[]) => {
    // If range is large, practice reordering a friendly subset of up to 5 verses so it is playable and fun
    const targetVerses = vList.length <= 5 ? vList : vList.slice(0, 5);
    const shuffled = [...targetVerses].sort(() => Math.random() - 0.5);
    setScrambledVerses(shuffled);
    setUserOrderedVerses([]);
    setReorderStatus('pending');
  };

  const handleSelectScrambledVerse = (ayah: Ayah) => {
    if (userOrderedVerses.some((v) => v.id === ayah.id)) return;
    const updated = [...userOrderedVerses, ayah];
    setUserOrderedVerses(updated);

    if (updated.length === scrambledVerses.length) {
      // Check if order matches among the scrambled subset
      const sortedTarget = [...scrambledVerses].sort((a, b) => a.verse_number - b.verse_number);
      const isCorrect = updated.every((v, idx) => v.verse_number === sortedTarget[idx]?.verse_number);
      if (isCorrect) {
        setReorderStatus('correct');
        triggerStageSuccess();
        setTimeout(() => {
          setCurrentStage('random_review');
        }, 1200);
      } else {
        setReorderStatus('wrong');
      }
    }
  };

  const handleResetReorder = () => {
    setUserOrderedVerses([]);
    setReorderStatus('pending');
  };

  // --- STAGE 5: COMPREHENSIVE REVIEW & SPACED REPETITION ---
  const initRandomReview = (s: Surah, currentV: Ayah[]) => {
    // Review all the verses the user chose to memorize for this session!
    // No arbitrary limits!
    setReviewVerses(currentV.length > 0 ? currentV : s.verses.slice(0, 5));
    setReviewIndex(0);
    setIsPromptRevealed(false);
  };

  const handleSpacedRepetitionScore = async (quality: number) => {
    const target = reviewVerses[reviewIndex];
    if (target) {
      await dbService.recordReviewAttempt(target.verse_key, surahId, target.verse_number, quality);
    }

    if (reviewIndex < reviewVerses.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setIsPromptRevealed(false);
    } else {
      // Completed all 5 stages!
      finishSession();
    }
  };

  const triggerStageSuccess = () => {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    setStarsEarned((s) => s + 1);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const finishSession = async () => {
    setCurrentStage('completed');
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 } });

    // Update today's ward progress
    const today = await dbService.getTodayWardProgress();
    today.verses_memorized += verses.length;
    await dbService.saveTodayWardProgress(today);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-stone-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold">جاري تحميل الآيات من قاعدة البيانات...</span>
      </div>
    );
  }

  if (error || !surah || verses.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-stone-900 rounded-3xl border border-red-200 dark:border-red-900/40 text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-2">
          تعذر بدء جلسة الحفظ
        </h3>
        <p className="text-xs text-stone-500 mb-4 leading-relaxed">
          {error || 'لم يتم العثور على آيات في هذا النطاق، يرجى تغيير السورة أو الآيات.'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={loadVerses}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <RotateCcw size={14} />
            <span>إعادة المحاولة</span>
          </button>
          <button
            onClick={() => setShowSurahSelector(true)}
            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition-all"
          >
            <span>اختيار سورة أخرى</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 pb-32">
      {/* Prominent Surah & Range Selector Hero Card */}
      <div className="bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-3xl p-4 sm:p-5 shadow-md border border-emerald-700/60 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-stone-950 font-black text-xl flex items-center justify-center shadow-sm">
            {toArabicNumeral(surahId)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-200">سورة الحفظ المحددة:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-100 font-bold text-[10px] border border-emerald-700">
                {surah?.revelation_place === 'makkah' ? 'مكية 🕋' : 'مدنية 🕌'}
              </span>
            </div>
            <h2 className="font-bold text-2xl text-amber-300 font-quran">
              سُورَةُ {surah?.name_arabic}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xs text-emerald-100 font-cairo ml-1">
                نطاق الحفظ: من ({toArabicNumeral(fromVerse)}) إلى ({toArabicNumeral(toVerse)}) • {toArabicNumeral(verses.length)} آيات
              </span>
            </div>

            {/* Quick Open Range Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  if (surah) {
                    setFromVerse(1);
                    setToVerse(surah.verses_count);
                  }
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all border cursor-pointer ${
                  surah && toVerse - fromVerse + 1 === surah.verses_count
                    ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-xs'
                    : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border-emerald-700/60'
                }`}
              >
                ✨ كامل السورة ({toArabicNumeral(surah?.verses_count || 30)})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFromVerse(1);
                  setToVerse(Math.min(surah?.verses_count || 30, 5));
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all border cursor-pointer ${
                  fromVerse === 1 && toVerse === 5
                    ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-xs'
                    : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border-emerald-700/60'
                }`}
              >
                ٥ آيات
              </button>

              <button
                type="button"
                onClick={() => {
                  setFromVerse(1);
                  setToVerse(Math.min(surah?.verses_count || 30, 10));
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all border cursor-pointer ${
                  fromVerse === 1 && toVerse === 10
                    ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-xs'
                    : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border-emerald-700/60'
                }`}
              >
                ١٠ آيات
              </button>

              <button
                type="button"
                onClick={() => setShowSurahSelector(true)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal size={11} />
                <span>تحديد مخصص...</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSurahSelector(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          <RotateCcw size={15} />
          <span>تغيير السورة / الآيات</span>
        </button>
      </div>

      {/* Session Progress Header */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <Brain size={22} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                مراحل التدريب الذكي على الحفظ
              </h3>
              <span className="text-xs text-stone-500">
                تكرار • إخفاء تدريجي • إكمال الفراغ • ترتيب • تثبيت
              </span>
            </div>
          </div>

          {/* Stars & Badge */}
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 font-bold text-xs">
            <span>⭐</span>
            <span>{starsEarned} نجوم</span>
          </div>
        </div>

        {/* 5 Stages Interactive Step Tabs */}
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-stone-100 dark:border-stone-800">
          {[
            { id: 'listen_repeat', label: '١. التلاوة' },
            { id: 'progressive_hide', label: '٢. الإخفاء' },
            { id: 'fill_blanks', label: '٣. الإكمال' },
            { id: 'reorder', label: '٤. الترتيب' },
            { id: 'random_review', label: '٥. التثبيت' },
          ].map((st, i) => {
            const isCompleted =
              (currentStage === 'progressive_hide' && i < 1) ||
              (currentStage === 'fill_blanks' && i < 2) ||
              (currentStage === 'reorder' && i < 3) ||
              (currentStage === 'random_review' && i < 4) ||
              currentStage === 'completed';
            const isCurrent = currentStage === st.id;

            return (
              <button
                key={st.id}
                onClick={() => {
                  setCurrentStage(st.id as Stage);
                  if (st.id === 'progressive_hide') {
                    setHideLevel(1);
                    setRevealedWordIndices([]);
                  } else if (st.id === 'fill_blanks') {
                    initFillInTheBlanks(verses[currentAyahIndex] || verses[0]);
                  } else if (st.id === 'reorder') {
                    initReorder(verses);
                  } else if (st.id === 'random_review' && surah) {
                    initRandomReview(surah, verses);
                  }
                }}
                className="flex-1 text-center py-1 rounded-xl transition-all cursor-pointer focus:outline-hidden"
              >
                <div
                  className={`h-1.5 rounded-full mb-1 transition-all ${
                    isCompleted
                      ? 'bg-emerald-600'
                      : isCurrent
                      ? 'bg-amber-500 ring-2 ring-amber-300'
                      : 'bg-stone-200 dark:bg-stone-800'
                  }`}
                />
                <span
                  className={`text-[10px] block truncate font-bold ${
                    isCurrent
                      ? 'text-amber-600 dark:text-amber-400'
                      : isCompleted
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  {st.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Surah Selector Modal */}
      {showSurahSelector && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  تحديد سورة وآيات الحفظ
                </h3>
                <span className="text-xs text-stone-400">اختر من سور القرآن الـ ١١٤</span>
              </div>
              <button
                onClick={() => setShowSurahSelector(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-800 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Quick Search */}
            <div className="mb-3">
              <input
                type="text"
                value={surahSearchQuery}
                onChange={(e) => setSurahSearchQuery(e.target.value)}
                placeholder="🔍 ابحث عن اسم السورة (مثل: الملك، يس، الكهف)..."
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-emerald-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Surahs Grid */}
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                {surahsList
                  .filter((s) => !surahSearchQuery || s.name_arabic.includes(surahSearchQuery) || String(s.id).includes(surahSearchQuery))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSurahId(s.id);
                        setFromVerse(1);
                        setToVerse(s.verses_count); // Set to full Surah by default (open range)
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold text-right transition-all flex items-center justify-between ${
                        surahId === s.id
                          ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-500/50'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-50'
                      }`}
                    >
                      <span>سورة {s.name_arabic}</span>
                      <span className="text-[10px] opacity-75">({toArabicNumeral(s.verses_count)})</span>
                    </button>
                  ))}
              </div>

              {/* Verses Range Inputs with Full Freedom */}
              {(() => {
                const activeSurahSummary = surahsList.find((s) => s.id === surahId);
                const maxVerseCount = activeSurahSummary?.verses_count || surah?.verses_count || 30;

                return (
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                    {/* Big Full Surah Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setFromVerse(1);
                        setToVerse(maxVerseCount);
                      }}
                      className={`w-full mb-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        fromVerse === 1 && toVerse === maxVerseCount
                          ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/80 hover:bg-emerald-50'
                      }`}
                    >
                      <Sparkles size={14} />
                      <span>✨ حفظ السورة كاملة ({toArabicNumeral(maxVerseCount)} آية)</span>
                    </button>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        تحديد نطاق حر (من وإلى):
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        المجموع: {toArabicNumeral(Math.max(1, toVerse - fromVerse + 1))} آيات
                      </span>
                    </div>

                    {/* Numeric Inputs with Steppers */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <span className="text-[11px] text-stone-400 block mb-1">من الآية:</span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setFromVerse((v) => Math.max(1, v - 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-r-xl font-bold text-xs hover:bg-stone-300"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={toVerse}
                            value={fromVerse}
                            onChange={(e) => setFromVerse(Math.max(1, Math.min(toVerse, Number(e.target.value))))}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 py-1 text-center text-sm font-bold text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() => setFromVerse((v) => Math.min(toVerse, v + 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-l-xl font-bold text-xs hover:bg-stone-300"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex-1">
                        <span className="text-[11px] text-stone-400 block mb-1">إلى الآية:</span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setToVerse((v) => Math.max(fromVerse, v - 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-r-xl font-bold text-xs hover:bg-stone-300"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={fromVerse}
                            max={maxVerseCount}
                            value={toVerse}
                            onChange={(e) => setToVerse(Math.min(maxVerseCount, Math.max(fromVerse, Number(e.target.value))))}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 py-1 text-center text-sm font-bold text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() => setToVerse((v) => Math.min(maxVerseCount, v + 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-l-xl font-bold text-xs hover:bg-stone-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Verses Count Slider */}
                    <div className="mb-3 px-1">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                        <span>سحب سريع لعدد الآيات:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {toArabicNumeral(toVerse - fromVerse + 1)} آية
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={maxVerseCount}
                        value={Math.min(maxVerseCount, toVerse - fromVerse + 1)}
                        onChange={(e) => {
                          const count = Number(e.target.value);
                          setToVerse(Math.min(maxVerseCount, fromVerse + count - 1));
                        }}
                        className="w-full accent-emerald-600 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Flexible Quick Presets */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setToVerse(fromVerse);
                        }}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950"
                      >
                        آية واحدة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setToVerse(Math.min(maxVerseCount, fromVerse + 2));
                        }}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950"
                      >
                        ٣ آيات
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setToVerse(Math.min(maxVerseCount, fromVerse + 4));
                        }}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950"
                      >
                        ٥ آيات
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setToVerse(Math.min(maxVerseCount, fromVerse + 9));
                        }}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950"
                      >
                        ١٠ آيات
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setToVerse(Math.min(maxVerseCount, fromVerse + 14));
                        }}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950"
                      >
                        صفحة (~١٥)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFromVerse(1);
                          setToVerse(maxVerseCount);
                        }}
                        className="py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold shadow-xs"
                      >
                        كاملة
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              onClick={() => setShowSurahSelector(false)}
              className="mt-4 w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-md transition-all active:scale-98"
            >
              ✓ تأكيد وبدء جلسة الحفظ
            </button>
          </div>
        </div>
      )}

      {/* DEDICATED REPEATS SELECTION MODAL */}
      {showRepeatsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  <Repeat size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    خيارات تكرار الآية الواحدة
                  </h3>
                  <span className="text-[11px] text-stone-400">
                    تحديد مرات التكرار قبل الانتقال التلقائي للآية التالية
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowRepeatsModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Stepper with +/- and Big Number Display */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 text-center">
                <span className="text-xs text-stone-500 block mb-2 font-bold">
                  عدد مرات تكرار الآية الواحدة:
                </span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectRepeatCount(repeatCount - 1)}
                    disabled={repeatCount <= 1}
                    className="w-11 h-11 rounded-2xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-black text-xl hover:bg-stone-300 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Minus size={20} />
                  </button>

                  <div className="min-w-28 px-4 py-2 bg-white dark:bg-stone-900 rounded-2xl border border-emerald-300 dark:border-emerald-700/80 shadow-xs">
                    <span className="font-quran text-3xl font-black text-emerald-700 dark:text-emerald-400 block">
                      {toArabicNumeral(repeatCount)}
                    </span>
                    <span className="text-[10px] text-stone-400 font-bold block">
                      {repeatCount === 1 ? 'مرة واحدة' : repeatCount === 2 ? 'مرتان' : 'مرات تكرار'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectRepeatCount(repeatCount + 1)}
                    disabled={repeatCount >= 50}
                    className="w-11 h-11 rounded-2xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-black text-xl hover:bg-stone-300 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                {/* Slider */}
                <div className="mt-3 px-2">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={repeatCount}
                    onChange={(e) => handleSelectRepeatCount(Number(e.target.value))}
                    className="w-full accent-emerald-600 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                    <span>١</span>
                    <span>٥</span>
                    <span>١٠</span>
                    <span>٢٠</span>
                    <span>٣٠</span>
                  </div>
                </div>
              </div>

              {/* Presets Grid with pedagogical hints */}
              <div>
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-2">
                  خيارات التكرار السريعة:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { count: 1, label: 'مرة واحدة', hint: 'استماع مباشر بدون تكرار' },
                    { count: 2, label: 'مرتان (2x)', hint: 'تكرار خفيف للمراجعة' },
                    { count: 3, label: '٣ تكرارات (3x)', hint: 'المعدل القياسي للحفظ' },
                    { count: 5, label: '٥ تكرارات (5x)', hint: 'تثبيت متين للألفاظ' },
                    { count: 7, label: '٧ تكرارات (7x)', hint: 'ترسيخ وحفظ قوي' },
                    { count: 10, label: '١٠ تكرارات (10x)', hint: 'حفظ مكثف للآيات الصعبة' },
                    { count: 15, label: '١٥ تكراراً (15x)', hint: 'إتقان تام قبل الانتقال' },
                    { count: 20, label: '٢٠ تكراراً (20x)', hint: 'تثبيت عميق لا يُنسى' },
                  ].map((preset) => {
                    const isSelected = repeatCount === preset.count;
                    return (
                      <button
                        key={preset.count}
                        type="button"
                        onClick={() => handleSelectRepeatCount(preset.count)}
                        className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-black ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-800 dark:text-stone-200'}`}>
                            {preset.label}
                          </span>
                          {isSelected && <Check size={14} className="text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-stone-400 block leading-tight">
                          {preset.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Advance Toggle Card */}
              <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block mb-0.5">
                    الانتقال التلقائي للآية التالية
                  </span>
                  <span className="text-[11px] text-stone-500 block leading-relaxed">
                    {autoAdvanceEnabled
                      ? `ستنتقل التلاوة تلقائياً للآية التالية بمجرد إكمال ${toArabicNumeral(repeatCount)} تكرارات.`
                      : 'سيتوقف الصوت بعد انتهاء تكرار الآية الحالية دون انتقال.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAutoAdvance}
                  className={`w-13 h-7 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                    autoAdvanceEnabled ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-600'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      autoAdvanceEnabled ? 'translate-x-0' : '-translate-x-6'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Confirmation Button */}
            <button
              onClick={() => setShowRepeatsModal(false)}
              className="mt-4 w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer"
            >
              ✓ تطبيق عدد التكرارات ({toArabicNumeral(repeatCount)} مرات)
            </button>
          </div>
        </div>
      )}

      {/* STAGE 1: LISTEN & REPEAT */}
      {currentStage === 'listen_repeat' && currentAyah && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 animate-in fade-in">
          {/* Header with session progression */}
          <div className="flex items-center justify-between text-xs text-stone-500 mb-4 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              المرحلة الأولى: الاستماع وتكرار التلاوة
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSurahSelector(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="اضغط لتغيير عدد الآيات المراد حفظها بحرية"
              >
                <span>الآية {toArabicNumeral(currentAyahIndex + 1)} من {toArabicNumeral(verses.length)}</span>
                <span className="text-[10px] text-stone-400">({toArabicNumeral(Math.round(((currentAyahIndex + 1) / verses.length) * 100))}%)</span>
                <SlidersHorizontal size={12} className="text-emerald-600 mr-0.5" />
              </button>
            </div>
          </div>

          {/* Quick Ayah Selector Dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4 overflow-x-auto py-1 scrollbar-none">
            {verses.map((v, idx) => {
              const isPast = idx < currentAyahIndex;
              const isCurrent = idx === currentAyahIndex;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelectAyahInStage1(idx)}
                  className={`h-2 rounded-full transition-all ${
                    isCurrent
                      ? 'w-7 bg-emerald-600 dark:bg-emerald-400'
                      : isPast
                      ? 'w-2.5 bg-emerald-300 dark:bg-emerald-800'
                      : 'w-2 bg-stone-300 dark:bg-stone-700'
                  }`}
                  title={`الانتقال للآية ${idx + 1}`}
                />
              );
            })}
          </div>

          {/* Ayah text display */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-center my-3 relative">
            <p className="font-quran text-2xl sm:text-3xl leading-loose text-stone-900 dark:text-stone-100">
              ﴿{currentAyah.text_uthmani}﴾
            </p>
            <div className="mt-3 text-xs text-stone-500 font-cairo">
              سورة {surah?.name_arabic} · الآية {toArabicNumeral(currentAyah.verse_number)}
            </div>
          </div>

          {/* VISUAL REPEAT INDICATOR & AUTO-ADVANCE CONTROLLER */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 mb-5">
            {/* Header: Title & Advanced Customization Button */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-stone-200/60 dark:border-stone-700/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <Repeat size={16} />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 block">
                    تكرار الآية الواحدة قبل الانتقال التلقائي:
                  </span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    بصوت الشيخ محمد صديق المنشاوي (مرتل)
                  </span>
                </div>
              </div>

              {/* Advanced Settings Modal Trigger */}
              <button
                type="button"
                onClick={() => setShowRepeatsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                title="فتح واجهة متقدمة لاختيار عدد التكرارات والتحكم في الانتقال"
              >
                <Settings2 size={13} />
                <span>خيارات التكرار ({toArabicNumeral(repeatCount)})</span>
              </button>
            </div>

            {/* Stepper + Quick Presets Bar */}
            <div className="bg-white dark:bg-stone-900 p-3 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 mb-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Stepper (- / count / +) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 font-bold ml-1">عدد التكرار:</span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleSelectRepeatCount(repeatCount - 1)}
                      disabled={repeatCount <= 1}
                      className="w-8 h-8 rounded-r-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold hover:bg-stone-200 disabled:opacity-30 border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-all cursor-pointer"
                      title="إنقاص التكرار"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="px-3.5 h-8 bg-stone-50 dark:bg-stone-800 border-y border-stone-300 dark:border-stone-700 flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-400 min-w-16">
                      {toArabicNumeral(repeatCount)} {repeatCount === 1 ? 'مرة' : repeatCount === 2 ? 'مرتان' : 'مرات'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectRepeatCount(repeatCount + 1)}
                      disabled={repeatCount >= 50}
                      className="w-8 h-8 rounded-l-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold hover:bg-stone-200 disabled:opacity-30 border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-all cursor-pointer"
                      title="زيادة التكرار"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Quick Presets Buttons */}
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {[1, 2, 3, 5, 7, 10].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleSelectRepeatCount(cnt)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        repeatCount === cnt
                          ? 'bg-emerald-700 text-white shadow-xs scale-105 ring-1 ring-emerald-500'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {toArabicNumeral(cnt)}x
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowRepeatsModal(true)}
                    className="px-2 py-1 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer"
                  >
                    تخصيص...
                  </button>
                </div>
              </div>
            </div>

            {/* Playback speed selector row */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700/80 mb-3 shadow-2xs">
              <span className="text-xs text-stone-600 dark:text-stone-300 font-bold flex items-center gap-1.5">
                <Gauge size={14} className="text-amber-500" />
                <span>سرعة الصوت:</span>
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 1.25, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => {
                      audioService.setPlaybackSpeed(spd);
                      setPlaybackSpeed(spd);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-amber-500 text-stone-950 font-black shadow-xs scale-105'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Badges for Current & Remaining Repeats */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <span className="text-xs text-stone-600 dark:text-stone-300">التكرار الحالي:</span>
                <span className="text-sm font-black text-amber-700 dark:text-amber-300">
                  {toArabicNumeral(currentPlayRepeat)} من {toArabicNumeral(repeatCount)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                <span className="text-xs text-stone-600 dark:text-stone-300">المتبقي:</span>
                <span className="text-sm font-black text-stone-800 dark:text-stone-200">
                  {toArabicNumeral(Math.max(0, repeatCount - currentPlayRepeat))} تكرارات
                </span>
              </div>
            </div>

            {/* Visual Step Pills / Dots Tracker */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-3 flex-wrap">
              {Array.from({ length: repeatCount }, (_, idx) => {
                const repeatNum = idx + 1;
                const isCompleted = repeatNum < currentPlayRepeat;
                const isCurrent = repeatNum === currentPlayRepeat;

                return (
                  <div
                    key={repeatNum}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isCurrent
                        ? isPlayingAudio
                          ? 'bg-amber-400 text-stone-950 font-black ring-4 ring-amber-400/40 shadow-sm scale-105 animate-pulse'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-400'
                        : 'bg-stone-200/70 dark:bg-stone-700/70 text-stone-400 dark:text-stone-500 border border-dashed border-stone-300 dark:border-stone-600'
                    }`}
                  >
                    {isCompleted ? (
                      <Check size={14} className="stroke-[3]" />
                    ) : isCurrent ? (
                      <Volume2 size={14} className={isPlayingAudio ? 'animate-bounce' : ''} />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-stone-400 inline-flex items-center justify-center text-[10px]">
                        {toArabicNumeral(repeatNum)}
                      </span>
                    )}
                    <span>
                      {isCompleted
                        ? `تكرار ${toArabicNumeral(repeatNum)} ✓`
                        : isCurrent
                        ? isPlayingAudio
                          ? `جاري التكرار ${toArabicNumeral(repeatNum)}`
                          : `التكرار ${toArabicNumeral(repeatNum)}`
                        : `متبقي (${toArabicNumeral(repeatNum)})`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Repeat Progress Bar */}
            <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-amber-400 to-amber-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round((currentPlayRepeat / repeatCount) * 100)}%`,
                }}
              />
            </div>

            {/* Auto-Advance Notification Banner */}
            <div className={`p-3 rounded-2xl transition-all border text-xs flex items-center justify-between mb-4 ${
              justTransitionedVerse
                ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-400 text-emerald-900 dark:text-emerald-200 scale-[1.02]'
                : 'bg-stone-100/90 dark:bg-stone-900/60 border-stone-200 dark:border-stone-700/60 text-stone-600 dark:text-stone-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">🔁</span>
                <div>
                  <span className="font-bold block text-stone-900 dark:text-stone-100">
                    {justTransitionedVerse
                      ? '✓ تم الانتقال التلقائي للآية التالية بنجاح!'
                      : 'الانتقال التلقائي إلى الآية التالية:'}
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    {currentAyahIndex < verses.length - 1
                      ? `عند اكتمال ${toArabicNumeral(repeatCount)} تكرارات، ستنتقل التلاوة تلقائياً للآية (${toArabicNumeral(verses[currentAyahIndex + 1]?.verse_number)})`
                      : 'هذه الآية الأخيرة في الجلسة؛ عند اكتمال التكرارات ستنتقل الجلسة تلقائياً لمرحلة الإخفاء التدريجي 🌟'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                مفعّل تلقائياً
              </span>
            </div>

            {/* Main Play/Pause Button */}
            <button
              onClick={handlePlayCurrentAyah}
              className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-sm sm:text-base shadow-md transition-all active:scale-98 ${
                isPlayingAudio
                  ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              {isPlayingAudio ? (
                <>
                  <Pause size={20} />
                  <span>إيقاف التلاوة مؤقتاً</span>
                  <span className="text-xs bg-black/15 px-2.5 py-1 rounded-xl">
                    تكرار {toArabicNumeral(currentPlayRepeat)} من {toArabicNumeral(repeatCount)}
                  </span>
                </>
              ) : (
                <>
                  <Volume2 size={20} />
                  <span>ابدأ التلاوة والتكرار التلقائي بصوت المنشاوي</span>
                </>
              )}
            </button>
          </div>

          {/* Ayah Navigation (Previous / Next / Next Stage) */}
          <div className="flex items-center gap-2">
            <button
              disabled={currentAyahIndex <= 0}
              onClick={() => handleSelectAyahInStage1(currentAyahIndex - 1)}
              className="flex-1 py-3 px-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold disabled:opacity-30 transition-all flex items-center justify-center gap-1"
            >
              <ChevronRight size={16} />
              <span>الآية السابقة</span>
            </button>

            <button
              onClick={handleNextAyahListen}
              className="flex-2 flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all active:scale-98"
            >
              <span>
                {currentAyahIndex < verses.length - 1 ? 'الانتقال للآية التالية' : 'أتممت الاستماع، انتقال للإخفاء'}
              </span>
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: PROGRESSIVE HIDING */}
      {currentStage === 'progressive_hide' && currentAyah && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-3 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="font-bold text-amber-700 dark:text-amber-400">
              المرحلة الثانية: الإخفاء التدريجي
            </span>
            <span>
              المستوى {hideLevel} من ٤ · آية {currentAyahIndex + 1} من {verses.length}
            </span>
          </div>

          <p className="text-xs text-stone-500 mb-3">
            اضغط على أي كلمة مخفية لإظهارها كمساعدة للتذكر:
          </p>

          {/* Interactive Hiding Card */}
          <div className="bg-stone-50 dark:bg-stone-800/60 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 text-center my-3 min-h-[160px] flex items-center justify-center">
            <div className="font-quran text-2xl sm:text-3xl leading-loose flex flex-wrap justify-center gap-x-2 gap-y-3">
              {words.map((word, idx) => {
                const hidden = shouldHideWord(idx);
                return (
                  <span
                    key={idx}
                    onClick={() => toggleRevealWord(idx)}
                    className={`cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                      hidden
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 border border-dashed border-amber-400 font-mono tracking-widest select-none'
                        : 'text-stone-900 dark:text-stone-100 hover:bg-emerald-100/50'
                    }`}
                  >
                    {hidden ? '•••••' : word}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Helper buttons */}
          <div className="flex items-center justify-between gap-2 my-4">
            <button
              onClick={() => setHideLevel((l) => Math.max(0, l - 1))}
              disabled={hideLevel === 0}
              className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold disabled:opacity-30"
            >
              إظهار أكثر
            </button>
            <button
              onClick={() => setHideLevel((l) => Math.min(4, l + 1))}
              disabled={hideLevel === 4}
              className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold disabled:opacity-30"
            >
              إخفاء أكثر
            </button>
          </div>

          <button
            onClick={handleNextStage2}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition-all active:scale-98"
          >
            <span>
              {hideLevel < 4
                ? 'إخفاء مستوى أصعب'
                : currentAyahIndex < verses.length - 1
                ? 'أتقنت، الآية التالية'
                : 'أتقنت الإخفاء، انتقال لاختبار الإكمال'}
            </span>
            <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* STAGE 3: FILL IN THE BLANKS */}
      {currentStage === 'fill_blanks' && currentAyah && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-3 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              المرحلة الثالثة: اختبار الإكمال
            </span>
            <span>
              آية {currentAyahIndex + 1} من {verses.length}
            </span>
          </div>

          <div className="bg-stone-50 dark:bg-stone-800/60 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 text-center my-4">
            <p className="font-quran text-2xl sm:text-3xl leading-loose text-stone-900 dark:text-stone-100">
              {words.map((w, i) => (
                <span key={i} className="mx-1">
                  {i === blankWordIndex ? (
                    <span
                      className={`inline-block px-3 py-1 rounded-xl font-bold border-2 ${
                        chosenAnswer === null
                          ? 'border-dashed border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                          : isAnswerCorrect
                          ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                          : 'border-red-500 bg-red-100 dark:bg-red-950 text-red-700'
                      }`}
                    >
                      {chosenAnswer || ' [ اختر الكلمة ] '}
                    </span>
                  ) : (
                    w
                  )}
                </span>
              ))}
            </p>
          </div>

          <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-3 text-center">
            اختر الكلمة الصحيحة لإكمال الآية:
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {blankChoices.map((choice, idx) => (
              <button
                key={idx}
                disabled={chosenAnswer !== null}
                onClick={() => handleSelectBlankAnswer(choice)}
                className={`py-3 px-2 rounded-2xl font-quran text-lg font-bold transition-all border ${
                  chosenAnswer === choice
                    ? isAnswerCorrect
                      ? 'bg-emerald-700 text-white border-emerald-600'
                      : 'bg-red-600 text-white border-red-500'
                    : 'bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>

          {isAnswerCorrect === false && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-400 text-xs text-center mb-3">
              حاول ثانية! الكلمة الصحيحة هي: <strong>{words[blankWordIndex]}</strong>
            </div>
          )}
        </div>
      )}

      {/* STAGE 4: REORDER SCRAMBLED VERSES */}
      {currentStage === 'reorder' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-3 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="font-bold text-amber-700 dark:text-amber-400">
              المرحلة الرابعة: اختبار ترتيب الآيات
            </span>
            <button
              onClick={handleResetReorder}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
            >
              <RotateCcw size={14} />
              <span>إعادة المحاولة</span>
            </button>
          </div>

          <p className="text-xs text-stone-500 mb-3">
            اضغط على الآيات بالترتيب القرآني الصحيح:
          </p>

          {/* Selected Ordered Sequence */}
          <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 min-h-[90px] mb-4">
            {userOrderedVerses.length === 0 ? (
              <span className="text-xs text-stone-400 italic block text-center py-6">
                لم تختر أي آية بعد، اضغط على البطاقات بالأسفل بالترتيب
              </span>
            ) : (
              <div className="space-y-2">
                {userOrderedVerses.map((v, i) => (
                  <div
                    key={v.id}
                    className="p-2 rounded-xl bg-white dark:bg-stone-800 text-xs font-quran text-stone-800 dark:text-stone-200 shadow-xs flex items-center justify-between"
                  >
                    <span>{i + 1}. {v.text_uthmani}</span>
                    <CheckCircle size={14} className="text-emerald-600" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scrambled Verses Pool */}
          <div className="space-y-2 mb-4">
            {scrambledVerses.map((v) => {
              const isSelected = userOrderedVerses.some((u) => u.id === v.id);
              return (
                <button
                  key={v.id}
                  disabled={isSelected}
                  onClick={() => handleSelectScrambledVerse(v)}
                  className={`w-full p-3 rounded-2xl text-right font-quran text-base transition-all border ${
                    isSelected
                      ? 'opacity-30 bg-stone-100 dark:bg-stone-800 line-through'
                      : 'bg-white dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-stone-200 dark:border-stone-700 shadow-xs'
                  }`}
                >
                  ﴿{v.text_uthmani}﴾
                </button>
              );
            })}
          </div>

          {reorderStatus === 'wrong' && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-400 text-xs text-center mb-3">
              الترتيب غير صحيح، اضغط «إعادة المحاولة» ورتّب من جديد!
            </div>
          )}
        </div>
      )}

      {/* STAGE 5: RANDOM REVIEW & SPACED REPETITION */}
      {currentStage === 'random_review' && reviewVerses[reviewIndex] && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-3 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              المرحلة الخامسة: التثبيت والمراجعة الذكية
            </span>
            <span>
              اختبار {reviewIndex + 1} من {reviewVerses.length}
            </span>
          </div>

          <div className="text-center my-4">
            <span className="text-xs text-stone-400 block mb-1">
              اقرأ من ذاكرتك الآية رقم {toArabicNumeral(reviewVerses[reviewIndex].verse_number)} من سورة {surah?.name_arabic}
            </span>

            {isPromptRevealed ? (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-center my-3">
                <p className="font-quran text-2xl sm:text-3xl leading-loose text-stone-900 dark:text-stone-100">
                  ﴿{reviewVerses[reviewIndex].text_uthmani}﴾
                </p>
              </div>
            ) : (
              <button
                onClick={() => setIsPromptRevealed(true)}
                className="my-6 py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold shadow-md text-sm transition-all"
              >
                أظهر الآية للتحقق من حفظك
              </button>
            )}
          </div>

          {isPromptRevealed && (
            <div>
              <p className="text-xs font-semibold text-stone-500 text-center mb-2.5">
                قيّم استرجاعك لهذه الآية لحساب موعد المراجعة القادمة:
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => handleSpacedRepetitionScore(1)}
                  className="py-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-bold hover:bg-red-200"
                >
                  ❌ نسيت
                </button>
                <button
                  onClick={() => handleSpacedRepetitionScore(2)}
                  className="py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-200"
                >
                  ⚠️ صعب
                </button>
                <button
                  onClick={() => handleSpacedRepetitionScore(4)}
                  className="py-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-bold hover:bg-blue-200"
                >
                  👍 جيد
                </button>
                <button
                  onClick={() => handleSpacedRepetitionScore(5)}
                  className="py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-200"
                >
                  🌟 متقن
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE COMPLETED CELEBRATION */}
      {currentStage === 'completed' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 text-center shadow-lg border border-amber-300/40 dark:border-amber-900/40 animate-in zoom-in-95">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            🏆
          </div>

          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-1 font-cairo">
            مُبَارَكٌ! تَمَّ الحِفْظُ بِنَجَاح
          </h2>
          <p className="text-sm text-stone-500 mb-6">
            أنجزت حفظ {toArabicNumeral(verses.length)} آيات من سورة {surah?.name_arabic} واجتزت المراحل الخمس.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
              <span className="block text-2xl mb-1">⭐</span>
              <span className="text-xs text-stone-500 block">النجوم</span>
              <span className="text-sm font-bold text-amber-700">{starsEarned + 5}</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
              <span className="block text-2xl mb-1">📖</span>
              <span className="text-xs text-stone-500 block">الآيات</span>
              <span className="text-sm font-bold text-emerald-700">+{verses.length}</span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
              <span className="block text-2xl mb-1">🔄</span>
              <span className="text-xs text-stone-500 block">المراجعة</span>
              <span className="text-sm font-bold text-blue-700">مجدولة</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (onFinish) onFinish();
              else {
                setCurrentStage('listen_repeat');
                setCurrentAyahIndex(0);
              }
            }}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition-all active:scale-98"
          >
            العودة للرئيسية ومتابعة الورد
          </button>
        </div>
      )}
    </div>
  );
};
