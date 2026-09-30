import React, { useState, useEffect } from 'react';
import { Award, Flame, BookOpen, Clock, Brain, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { MemorizationRecord, SurahSummary } from '../../types/quran';
import { dbService } from '../../services/db';
import { quranService } from '../../services/quranService';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  onPracticeVerse?: (surahId: number, verseNumber: number) => void;
}

export const StatsView: React.FC<Props> = ({ onPracticeVerse }) => {
  const [records, setRecords] = useState<MemorizationRecord[]>([]);
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    const recs = await dbService.getAllMemorizationRecords();
    const sList = await quranService.getSurahsSummary();
    setRecords(recs);
    setSurahs(sList);
    setIsLoading(false);
  };

  const totalVersesInQuran = 6236;
  const memorizedVersesCount = records.filter(
    (r) => r.mastery_level === 'good' || r.mastery_level === 'mastered'
  ).length;

  const completionPercent = ((memorizedVersesCount / totalVersesInQuran) * 100).toFixed(1);

  // Group by Surah to find completed surahs
  const completedSurahsCount = surahs.filter((s) => {
    const surahRecords = records.filter(
      (r) =>
        r.surah_id === s.id &&
        (r.mastery_level === 'good' || r.mastery_level === 'mastered')
    );
    return surahRecords.length >= s.verses_count;
  }).length;

  // Weak verses needing review
  const weakVerses = records.filter((r) => r.mastery_level === 'needs_review');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span>جاري تجميع الإحصائيات...</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 pb-32">
      {/* Top Main Progress Card */}
      <div className="bg-gradient-to-tr from-emerald-900 to-emerald-800 text-white rounded-3xl p-6 shadow-md border border-emerald-700/50 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Award size={120} />
        </div>

        <span className="text-xs text-emerald-200 block mb-1 font-semibold">
          نسبة إتمام حفظ القرآن الكريم كاملاً
        </span>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl sm:text-5xl font-black font-cairo text-amber-300">
            {completionPercent}%
          </span>
          <span className="text-xs text-emerald-200">
            ({toArabicNumeral(memorizedVersesCount)} من {toArabicNumeral(totalVersesInQuran)} آية)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-emerald-950/60 rounded-full h-3 p-0.5 overflow-hidden border border-emerald-700/50">
          <div
            className="bg-gradient-to-r from-amber-400 to-amber-300 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(1, Number(completionPercent))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-emerald-200 mt-3 pt-2 border-t border-emerald-700/40">
          <span>المتبقي: {toArabicNumeral(totalVersesInQuran - memorizedVersesCount)} آية</span>
          <span className="flex items-center gap-1 text-amber-300 font-bold">
            <Flame size={14} />
            <span>٧ أيام متتالية</span>
          </span>
        </div>
      </div>

      {/* 4 Cards Quick Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Completed Surahs */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400">
            <BookOpen size={18} />
            <span className="text-xs font-bold">السور المكتملة</span>
          </div>
          <span className="text-2xl font-black text-stone-900 dark:text-stone-100 block">
            {toArabicNumeral(completedSurahsCount)}{' '}
            <span className="text-xs font-normal text-stone-400">من ١١٤</span>
          </span>
        </div>

        {/* Total Sessions */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2 mb-2 text-amber-600">
            <Brain size={18} />
            <span className="text-xs font-bold">جلسات الحفظ</span>
          </div>
          <span className="text-2xl font-black text-stone-900 dark:text-stone-100 block">
            {toArabicNumeral(records.length)}{' '}
            <span className="text-xs font-normal text-stone-400">آية متداولة</span>
          </span>
        </div>

        {/* Mastered */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2 mb-2 text-blue-600">
            <CheckCircle size={18} />
            <span className="text-xs font-bold">آيات متقنة 🌟</span>
          </div>
          <span className="text-2xl font-black text-stone-900 dark:text-stone-100 block">
            {toArabicNumeral(records.filter((r) => r.mastery_level === 'mastered').length)}
          </span>
        </div>

        {/* Needs Attention */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2 mb-2 text-red-500">
            <AlertTriangle size={18} />
            <span className="text-xs font-bold">تحتاج مراجعة</span>
          </div>
          <span className="text-2xl font-black text-stone-900 dark:text-stone-100 block">
            {toArabicNumeral(weakVerses.length)}
          </span>
        </div>
      </div>

      {/* Weak Verses List */}
      {weakVerses.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-200 flex items-center gap-1.5 text-red-600">
              <AlertTriangle size={16} />
              <span>مواضع تحتاج إلى تثبيت:</span>
            </h3>
            <span className="text-xs text-stone-400">
              {toArabicNumeral(weakVerses.length)} آيات
            </span>
          </div>

          <div className="space-y-2">
            {weakVerses.slice(0, 5).map((w) => {
              const surah = surahs.find((s) => s.id === w.surah_id);
              return (
                <div
                  key={w.verse_key}
                  className="p-3 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 flex items-center justify-between"
                >
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    سورة {surah?.name_arabic} · الآية {toArabicNumeral(w.verse_number)}
                  </span>
                  {onPracticeVerse && (
                    <button
                      onClick={() => onPracticeVerse(w.surah_id, w.verse_number)}
                      className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700"
                    >
                      ممارسة الآن
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
