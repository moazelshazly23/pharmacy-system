import React, { useState, useEffect } from 'react';
import { RotateCcw, Brain, CheckCircle, AlertTriangle, Sparkles, ChevronLeft, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ayah, MemorizationRecord, Surah } from '../../types/quran';
import { dbService } from '../../services/db';
import { quranService } from '../../services/quranService';
import { audioService } from '../../services/audioService';
import { toArabicNumeral } from '../../utils/arabic';

interface ReviewItem {
  record: MemorizationRecord;
  surah: Surah;
  ayah: Ayah;
}

export const ReviewQueueView: React.FC = () => {
  const [dueItems, setDueItems] = useState<ReviewItem[]>([]);
  const [allRecords, setAllRecords] = useState<MemorizationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active review session
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  // Free Review Custom Range Picker
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [customSurahId, setCustomSurahId] = useState<number>(67);
  const [customFromVerse, setCustomFromVerse] = useState<number>(1);
  const [customToVerse, setCustomToVerse] = useState<number>(10);
  const [customSearchQuery, setCustomSearchQuery] = useState<string>('');
  const [surahsList, setSurahsList] = useState<{ id: number; name_arabic: string; verses_count: number }[]>([]);

  useEffect(() => {
    loadReviewQueue();
    quranService.getSurahsSummary().then((list) => {
      setSurahsList(list.map((s) => ({ id: s.id, name_arabic: s.name_arabic, verses_count: s.verses_count })));
    });
  }, []);

  const loadReviewQueue = async () => {
    setIsLoading(true);
    const records = await dbService.getAllMemorizationRecords();
    setAllRecords(records);

    const now = new Date();
    const due: ReviewItem[] = [];

    for (const rec of records) {
      const reviewDate = new Date(rec.next_review_date);
      // If review is due or overdue or marked as needs_review
      if (reviewDate <= now || rec.mastery_level === 'needs_review') {
        const surah = await quranService.getSurah(rec.surah_id);
        const ayah = surah?.verses.find((v) => v.verse_number === rec.verse_number);
        if (surah && ayah) {
          due.push({ record: rec, surah, ayah });
        }
      }
    }

    setDueItems(due);
    setIsLoading(false);
  };

  const handleStartReviewSession = () => {
    if (dueItems.length === 0) return;
    setIsReviewing(true);
    setCurrentIndex(0);
    setIsRevealed(false);
  };

  const handleStartCustomReview = async () => {
    setIsLoading(true);
    const surah = await quranService.getSurah(customSurahId);
    if (!surah) {
      setIsLoading(false);
      return;
    }
    const targetVerses = surah.verses.filter(
      (v) => v.verse_number >= customFromVerse && v.verse_number <= customToVerse
    );

    if (targetVerses.length === 0) {
      setIsLoading(false);
      return;
    }

    const customItems: ReviewItem[] = targetVerses.map((v) => ({
      record: {
        verse_key: `${customSurahId}:${v.verse_number}`,
        surah_id: customSurahId,
        verse_number: v.verse_number,
        repetitions_count: 5,
        mastery_level: 'learning',
        last_practiced_date: new Date().toISOString(),
        next_review_date: new Date().toISOString(),
        interval_days: 1,
        ease_factor: 2.5,
      },
      surah,
      ayah: v,
    }));

    setDueItems(customItems);
    setIsReviewing(true);
    setCurrentIndex(0);
    setIsRevealed(false);
    setShowCustomPicker(false);
    setIsLoading(false);
  };

  const handleScoreReview = async (quality: number) => {
    const current = dueItems[currentIndex];
    if (current) {
      await dbService.recordReviewAttempt(
        current.record.verse_key,
        current.record.surah_id,
        current.record.verse_number,
        quality
      );

      // Update today's ward progress
      const today = await dbService.getTodayWardProgress();
      today.verses_reviewed += 1;
      await dbService.saveTodayWardProgress(today);
    }

    if (currentIndex < dueItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsRevealed(false);
    } else {
      // Completed all due reviews
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
      setIsReviewing(false);
      loadReviewQueue();
    }
  };

  // Stats calculation
  const masteredCount = allRecords.filter((r) => r.mastery_level === 'mastered').length;
  const goodCount = allRecords.filter((r) => r.mastery_level === 'good').length;
  const learningCount = allRecords.filter((r) => r.mastery_level === 'learning').length;
  const needsReviewCount = allRecords.filter((r) => r.mastery_level === 'needs_review').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span>جاري فحص جدول المراجعة الذكية...</span>
      </div>
    );
  }

  // ACTIVE REVIEW FLASHCARD SESSION
  if (isReviewing && dueItems[currentIndex]) {
    const active = dueItems[currentIndex];

    return (
      <div className="max-w-xl mx-auto p-4 pb-32">
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-4 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="font-bold text-emerald-800 dark:text-emerald-300">
              جلسة مراجعة وتثبيت ذكية
            </span>
            <div className="flex items-center gap-2.5">
              <span className="font-bold">
                آية {toArabicNumeral(currentIndex + 1)} من {toArabicNumeral(dueItems.length)}
              </span>
              <button
                onClick={() => setIsReviewing(false)}
                className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-bold transition-all"
              >
                إنهاء الجلسة ✕
              </button>
            </div>
          </div>

          <div className="text-center my-6">
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400 block mb-2">
              سورة {active.surah.name_arabic} · الآية {toArabicNumeral(active.ayah.verse_number)}
            </span>

            {isRevealed ? (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-center my-3 animate-in fade-in">
                <p className="font-quran text-2xl sm:text-3xl leading-loose text-stone-900 dark:text-stone-100">
                  ﴿{active.ayah.text_uthmani}﴾
                </p>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => audioService.playVerse(active.surah.id, active.ayah.verse_number)}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-100 dark:bg-emerald-950 py-1.5 px-3 rounded-xl hover:bg-emerald-200 font-semibold"
                  >
                    <Volume2 size={16} />
                    <span>استماع للشيخ المنشاوي</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="my-8">
                <p className="text-xs text-stone-500 mb-4">
                  اقرأ الآية من ذاكرتك ثم اضغط للتحقق والتقييم:
                </p>
                <button
                  onClick={() => setIsRevealed(true)}
                  className="py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold shadow-md active:scale-98 transition-all"
                >
                  أظهر الآية للتحقق
                </button>
              </div>
            )}
          </div>

          {/* Rating Buttons */}
          {isRevealed && (
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 animate-in fade-in">
              <span className="text-xs font-semibold text-stone-500 block text-center mb-3">
                كيف كان استرجاعك لهذه الآية؟
              </span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleScoreReview(1)}
                  className="py-3 rounded-2xl bg-red-100 hover:bg-red-200 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-bold transition-all text-center"
                >
                  ❌ نسيت
                  <span className="text-[10px] block opacity-70 mt-0.5">غداً</span>
                </button>
                <button
                  onClick={() => handleScoreReview(2)}
                  className="py-3 rounded-2xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold transition-all text-center"
                >
                  ⚠️ صعب
                  <span className="text-[10px] block opacity-70 mt-0.5">خلال يومين</span>
                </button>
                <button
                  onClick={() => handleScoreReview(4)}
                  className="py-3 rounded-2xl bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-bold transition-all text-center"
                >
                  👍 جيد
                  <span className="text-[10px] block opacity-70 mt-0.5">بعد أسبوع</span>
                </button>
                <button
                  onClick={() => handleScoreReview(5)}
                  className="py-3 rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all text-center"
                >
                  🌟 متقن
                  <span className="text-[10px] block opacity-70 mt-0.5">بعد شهر</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // REVIEW QUEUE OVERVIEW
  return (
    <div className="max-w-xl mx-auto p-4 pb-32">
      {/* Header Banner */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <RotateCcw size={22} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                المراجعة الذكية
              </h2>
              <span className="text-xs text-stone-500">
                نظام التكرار المتباعد لتثبيت محفوظك
              </span>
            </div>
          </div>

          <div className="text-center">
            <span className="text-2xl font-black text-amber-600 block">
              {toArabicNumeral(dueItems.length)}
            </span>
            <span className="text-[11px] text-stone-400">آيات مستحقة اليوم</span>
          </div>
        </div>

        {dueItems.length > 0 ? (
          <button
            onClick={handleStartReviewSession}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Brain size={18} />
            <span>ابدأ جلسة المراجعة المجدولة ({toArabicNumeral(dueItems.length)} آية)</span>
          </button>
        ) : (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-center text-xs text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
            ما شاء الله! لا توجد آيات مستحقة للمراجعة في جدول اليوم، يمكنك مراجعة أي سورة تريدها بحرية بالأسفل.
          </div>
        )}
      </div>

      {/* Free Custom Range Review Hero Banner (Unrestricted) */}
      <div className="bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-3xl p-5 shadow-sm border border-emerald-700/50 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-emerald-200 font-bold flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-400" />
            <span>مراجعة حرة مخصصة (دون أي قيود)</span>
          </span>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-black">
            اختر ما تشاء
          </span>
        </div>
        <p className="text-xs text-emerald-100/90 leading-relaxed mb-3">
          حدد أي سورة من الـ ١١٤ سورة وأي نطاق من الآيات تود استرجاعه ومراجعته الآن بالبطاقات التفاعلية والاستماع.
        </p>
        <button
          onClick={() => setShowCustomPicker(true)}
          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-2xl text-xs sm:text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw size={16} />
          <span>🎯 اختيار سورة ونطاق آيات للمراجعة الحرة</span>
        </button>
      </div>

      {/* Free Custom Range Review Modal */}
      {showCustomPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  تحديد سورة وآيات المراجعة الحرة
                </h3>
                <span className="text-xs text-stone-400">راجع ما تشاء دون قيود على عدد الآيات</span>
              </div>
              <button
                onClick={() => setShowCustomPicker(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Quick Search */}
            <div className="mb-3">
              <input
                type="text"
                value={customSearchQuery}
                onChange={(e) => setCustomSearchQuery(e.target.value)}
                placeholder="🔍 ابحث عن اسم السورة (مثل: الملك، يس، الكهف)..."
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-emerald-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Surahs Grid */}
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                {surahsList
                  .filter((s) => !customSearchQuery || s.name_arabic.includes(customSearchQuery) || String(s.id).includes(customSearchQuery))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setCustomSurahId(s.id);
                        setCustomFromVerse(1);
                        setCustomToVerse(s.verses_count);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold text-right transition-all flex items-center justify-between ${
                        customSurahId === s.id
                          ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-500/50'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-50'
                      }`}
                    >
                      <span>سورة {s.name_arabic}</span>
                      <span className="text-[10px] opacity-75">({toArabicNumeral(s.verses_count)})</span>
                    </button>
                  ))}
              </div>

              {/* Range Inputs */}
              {(() => {
                const currentSurah = surahsList.find((s) => s.id === customSurahId);
                const maxV = currentSurah?.verses_count || 30;

                return (
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        نطاق الآيات للمراجعة:
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        المجموع: {toArabicNumeral(Math.max(1, customToVerse - customFromVerse + 1))} آيات
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="flex-1">
                        <span className="text-[11px] text-stone-400 block mb-1">من الآية:</span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setCustomFromVerse((v) => Math.max(1, v - 1))}
                            className="w-7 h-7 bg-stone-200 dark:bg-stone-700 rounded-r-lg font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={customToVerse}
                            value={customFromVerse}
                            onChange={(e) => setCustomFromVerse(Math.max(1, Math.min(customToVerse, Number(e.target.value))))}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-2 py-1 text-center text-sm font-bold text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomFromVerse((v) => Math.min(customToVerse, v + 1))}
                            className="w-7 h-7 bg-stone-200 dark:bg-stone-700 rounded-l-lg font-bold text-xs"
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
                            onClick={() => setCustomToVerse((v) => Math.max(customFromVerse, v - 1))}
                            className="w-7 h-7 bg-stone-200 dark:bg-stone-700 rounded-r-lg font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={customFromVerse}
                            max={maxV}
                            value={customToVerse}
                            onChange={(e) => setCustomToVerse(Math.min(maxV, Math.max(customFromVerse, Number(e.target.value))))}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-2 py-1 text-center text-sm font-bold text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomToVerse((v) => Math.min(maxV, v + 1))}
                            className="w-7 h-7 bg-stone-200 dark:bg-stone-700 rounded-l-lg font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setCustomFromVerse(1);
                          setCustomToVerse(Math.min(5, maxV));
                        }}
                        className="flex-1 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[11px] font-bold hover:bg-emerald-100"
                      >
                        أول ٥ آيات
                      </button>
                      <button
                        onClick={() => {
                          setCustomFromVerse(1);
                          setCustomToVerse(Math.min(10, maxV));
                        }}
                        className="flex-1 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[11px] font-bold hover:bg-emerald-100"
                      >
                        أول ١٠ آيات
                      </button>
                      <button
                        onClick={() => {
                          setCustomFromVerse(1);
                          setCustomToVerse(maxV);
                        }}
                        className="flex-1 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-200"
                      >
                        السورة كاملة
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              onClick={handleStartCustomReview}
              className="mt-4 w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>✓ بدء جلسة المراجعة ({toArabicNumeral(Math.max(1, customToVerse - customFromVerse + 1))} آيات)</span>
            </button>
          </div>
        </div>
      )}

      {/* Mastery Level Distribution Breakdown */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
        <h3 className="font-bold text-sm text-stone-800 dark:text-stone-200 mb-3">
          توزيع مستويات الإتقان:
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 block font-semibold">متقنة 🌟</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{toArabicNumeral(masteredCount)}</span>
          </div>

          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-center">
            <span className="text-xs text-blue-700 dark:text-blue-400 block font-semibold">جيدة 👍</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{toArabicNumeral(goodCount)}</span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center">
            <span className="text-xs text-amber-700 dark:text-amber-400 block font-semibold">قيد الحفظ 📖</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{toArabicNumeral(learningCount)}</span>
          </div>

          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-center">
            <span className="text-xs text-red-700 dark:text-red-400 block font-semibold">تحتاج مراجعة ⚠️</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{toArabicNumeral(needsReviewCount)}</span>
          </div>
        </div>
      </div>

      {/* Due Items Preview List */}
      {dueItems.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-stone-500 block px-2">
            قائمة الآيات المستحقة للمراجعة:
          </span>
          {dueItems.map(({ record, surah, ayah }) => (
            <div
              key={record.verse_key}
              className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-sm text-stone-800 dark:text-stone-200 block">
                  سورة {surah.name_arabic} · الآية {toArabicNumeral(ayah.verse_number)}
                </span>
                <span className="font-quran text-xs text-stone-500 line-clamp-1 mt-0.5">
                  ﴿{ayah.text_uthmani}﴾
                </span>
              </div>

              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  record.mastery_level === 'needs_review'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {record.mastery_level === 'needs_review' ? 'ضعيفة' : 'مستحقة'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
