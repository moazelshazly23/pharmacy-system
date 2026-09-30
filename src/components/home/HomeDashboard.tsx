import React, { useState, useEffect } from 'react';
import { 
  Play, Brain, RotateCcw, Heart, Flame, BookOpen, 
  Mic, Search, Award, Sparkles, ChevronLeft, CheckCircle2, Circle 
} from 'lucide-react';
import { Bookmark, DailyGoal, LastReadPosition, StreakInfo, WardTodayProgress } from '../../types/quran';
import { dbService } from '../../services/db';
import { quranService } from '../../services/quranService';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  onStartMemorize: (surahId: number, fromVerse: number, toVerse: number) => void;
  onOpenMushaf: (surahId?: number, verseNumber?: number, pageNumber?: number) => void;
  onOpenAthkar: () => void;
  onOpenTasbih: () => void;
  onOpenReview: () => void;
  onOpenSearch: () => void;
  onOpenStats: () => void;
  onOpenSammaani: (surahId: number, fromVerse: number, toVerse: number) => void;
  kidsMode: boolean;
}

export const HomeDashboard: React.FC<Props> = ({
  onStartMemorize,
  onOpenMushaf,
  onOpenAthkar,
  onOpenTasbih,
  onOpenReview,
  onOpenSearch,
  onOpenStats,
  onOpenSammaani,
  kidsMode,
}) => {
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [wardProgress, setWardProgress] = useState<WardTodayProgress | null>(null);
  const [lastBookmark, setLastBookmark] = useState<Bookmark | null>(null);
  const [lastReadPosition, setLastReadPosition] = useState<LastReadPosition | null>(null);
  const [streak, setStreak] = useState<StreakInfo>({ current_streak: 1, longest_streak: 1, last_active_date: '' });

  // Free Range Picker Sheet
  const [showRangePicker, setShowRangePicker] = useState<boolean>(false);
  const [pickerSurahId, setPickerSurahId] = useState<number>(67);
  const [pickerFromVerse, setPickerFromVerse] = useState<number>(1);
  const [pickerToVerse, setPickerToVerse] = useState<number>(30);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [surahsList, setSurahsList] = useState<{ id: number; name_arabic: string; verses_count: number }[]>([]);

  useEffect(() => {
    loadHomeData();
    quranService.getSurahsSummary().then((list) => {
      setSurahsList(list.map((s) => ({ id: s.id, name_arabic: s.name_arabic, verses_count: s.verses_count })));
    });
  }, []);

  const loadHomeData = async () => {
    try {
      const [g, w, bms, lastPos, st] = await Promise.all([
        dbService.getDailyGoal(),
        dbService.getTodayWardProgress(),
        dbService.getBookmarks(),
        dbService.getLastReadPosition(),
        dbService.getStreak(),
      ]);
      setGoal(g);
      setWardProgress(w);
      setLastReadPosition(lastPos);
      if (st) {
        setStreak(st);
      }
      if (lastPos) {
        setPickerSurahId(lastPos.surah_id);
        setPickerFromVerse(lastPos.verse_number);
        setPickerToVerse(lastPos.verse_number + 4);
      }
      if (bms && bms.length > 0) {
        setLastBookmark(bms[bms.length - 1]);
      }
    } catch (e) {
      console.warn('Error loading home data:', e);
    }
  };

  // Calculate overall day completion percentage
  let completedItems = 0;
  let totalItems = 4; // memorize, review, morning athkar, tasbih
  if (wardProgress) {
    if (wardProgress.verses_memorized > 0) completedItems++;
    if (wardProgress.verses_reviewed > 0) completedItems++;
    if (wardProgress.morning_athkar_done) completedItems++;
    if (wardProgress.tasbih_count >= 33) completedItems++;
  }
  const wardPercentage = Math.round((completedItems / totalItems) * 100);

  return (
    <div className="max-w-xl mx-auto p-4 pb-32 space-y-4">
      {/* Top Greeting & Brand Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold block">
            السلام عليكم ورحمة الله 🌙
          </span>
          <h1 className="text-2xl font-black font-cairo text-emerald-900 dark:text-emerald-400 tracking-tight">
            حافظ القرآن
          </h1>
          <span className="text-[11px] text-stone-400 block -mt-0.5">
            رفيقك في حفظ كتاب الله
          </span>
        </div>

        {/* Dynamic Streak Flame Badge */}
        <div className="flex items-center gap-1.5 bg-gradient-to-l from-amber-500/20 to-amber-500/10 dark:from-amber-950/60 dark:to-amber-950/20 border border-amber-300 dark:border-amber-800 px-3.5 py-1.5 rounded-2xl shadow-xs transition-all">
          <Flame
            size={20}
            className={`text-amber-500 fill-amber-500 ${streak.current_streak > 0 ? 'animate-pulse' : 'opacity-40'}`}
          />
          <div className="text-right">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
              {streak.current_streak > 0 ? `${toArabicNumeral(streak.current_streak)} أيام` : 'ابدأ اليوم'}
            </span>
            <span className="text-[9px] text-amber-700/80 dark:text-amber-400/80 block -mt-0.5">
              {streak.current_streak > 0 ? 'متتالية 🔥' : 'سلسلة جديدة 🌱'}
            </span>
          </div>
        </div>
      </div>

      {/* Kids Mode Cheerful Praise Banner (if active) */}
      {kidsMode && (
        <div className="p-3.5 rounded-3xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-stone-900 shadow-md flex items-center justify-between animate-in zoom-in-95">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌟</span>
            <div>
              <span className="font-bold text-sm block">أهلاً بك يا بطل القرآن!</span>
              <span className="text-xs opacity-90">احفظ وراجع بالقدر الذي تحبه والنجوم في انتظارك ⭐</span>
            </div>
          </div>
          <span className="text-xl">🏆</span>
        </div>
      )}

      {/* Daily Ward Card (وردي اليوم) */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>🌙</span>
            <span>وردي اليوم</span>
          </h2>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {toArabicNumeral(wardPercentage)}% مكتمل
          </span>
        </div>

        {/* Linear Progress Bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2.5 overflow-hidden mb-4">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(5, wardPercentage)}%` }}
          />
        </div>

        {/* 4 Pillars of Ward (Free, user-defined) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Memorize */}
          <div
            onClick={() => setShowRangePicker(true)}
            className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-right"
          >
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>📖 حفظ حر</span>
              {wardProgress && wardProgress.verses_memorized > 0 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Circle size={14} className="text-stone-300" />
              )}
            </div>
            <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block truncate">
              {wardProgress && wardProgress.verses_memorized > 0
                ? `${toArabicNumeral(wardProgress.verses_memorized)} آيات محفوظة`
                : 'احفظ ما تشاء'}
            </span>
          </div>

          {/* Review */}
          <div
            onClick={onOpenReview}
            className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-right"
          >
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>🔄 مراجعة حرة</span>
              {wardProgress && wardProgress.verses_reviewed > 0 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Circle size={14} className="text-stone-300" />
              )}
            </div>
            <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block truncate">
              {wardProgress && wardProgress.verses_reviewed > 0
                ? `${toArabicNumeral(wardProgress.verses_reviewed)} آيات مراجعة`
                : 'راجع ما تشاء'}
            </span>
          </div>

          {/* Athkar */}
          <div
            onClick={onOpenAthkar}
            className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-right"
          >
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>🤲 أذكار</span>
              {wardProgress?.morning_athkar_done ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Circle size={14} className="text-stone-300" />
              )}
            </div>
            <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">
              {wardProgress?.morning_athkar_done ? 'الصباح ✅' : 'الصباح ⏳'}
            </span>
          </div>

          {/* Tasbih */}
          <div
            onClick={onOpenTasbih}
            className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-right"
          >
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>📿 تسبيح</span>
              {wardProgress && wardProgress.tasbih_count >= 33 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Circle size={14} className="text-stone-300" />
              )}
            </div>
            <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block truncate">
              {toArabicNumeral(wardProgress?.tasbih_count || 0)} تسبيحة
            </span>
          </div>
        </div>
      </div>

      {/* Gamified Daily Streak Card */}
      <div className="bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-orange-500/10 dark:from-amber-950/40 dark:via-stone-900 dark:to-orange-950/30 rounded-3xl p-4 sm:p-5 border border-amber-300/80 dark:border-amber-800/80 shadow-xs relative overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-stone-950 flex items-center justify-center font-black shadow-sm text-xl shrink-0">
              🔥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  سلسلة الالتزام القرآني
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  {streak.current_streak >= 7 ? 'همّة عالية 🌟' : 'استمر وثبّت 🌱'}
                </span>
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block mt-0.5">
                «أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ»
              </span>
            </div>
          </div>

          <div className="text-left shrink-0">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block">
              {toArabicNumeral(streak.current_streak)}
            </span>
            <span className="text-[10px] text-stone-400 block">
              {streak.current_streak === 1 ? 'يوم متواصل' : 'أيام متتالية'}
            </span>
          </div>
        </div>

        {/* Milestone Badges Row */}
        <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-amber-200/60 dark:border-amber-800/40">
          <div className={`p-2 rounded-xl text-center text-xs transition-all ${streak.current_streak >= 3 ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold shadow-xs' : 'bg-stone-100 dark:bg-stone-800/60 text-stone-400'}`}>
            <span className="text-sm block">🥉</span>
            <span className="text-[10px] block mt-0.5 font-bold">٣ أيام</span>
            <span className="text-[9px] opacity-75 block">{streak.current_streak >= 3 ? 'مكتمل ✓' : 'البداية'}</span>
          </div>
          <div className={`p-2 rounded-xl text-center text-xs transition-all ${streak.current_streak >= 7 ? 'bg-amber-200 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 font-bold shadow-xs' : 'bg-stone-100 dark:bg-stone-800/60 text-stone-400'}`}>
            <span className="text-sm block">🥈</span>
            <span className="text-[10px] block mt-0.5 font-bold">٧ أيام</span>
            <span className="text-[9px] opacity-75 block">{streak.current_streak >= 7 ? 'مكتمل ✓' : 'أسبوع'}</span>
          </div>
          <div className={`p-2 rounded-xl text-center text-xs transition-all ${streak.current_streak >= 14 ? 'bg-amber-300 dark:bg-amber-700 text-stone-950 dark:text-white font-bold shadow-xs' : 'bg-stone-100 dark:bg-stone-800/60 text-stone-400'}`}>
            <span className="text-sm block">🥇</span>
            <span className="text-[10px] block mt-0.5 font-bold">١٤ يوماً</span>
            <span className="text-[9px] opacity-75 block">{streak.current_streak >= 14 ? 'مكتمل ✓' : 'أسبوعان'}</span>
          </div>
          <div className={`p-2 rounded-xl text-center text-xs transition-all ${streak.current_streak >= 30 ? 'bg-amber-400 dark:bg-amber-600 text-stone-950 dark:text-white font-bold ring-2 ring-amber-400 shadow-sm' : 'bg-stone-100 dark:bg-stone-800/60 text-stone-400'}`}>
            <span className="text-sm block">💎</span>
            <span className="text-[10px] block mt-0.5 font-bold">٣٠ يوماً</span>
            <span className="text-[9px] opacity-75 block">{streak.current_streak >= 30 ? 'مكتمل ✓' : 'شهر نور'}</span>
          </div>
        </div>

        {streak.longest_streak > 1 && (
          <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 mt-2.5 pt-2 border-t border-amber-200/40 dark:border-amber-800/30">
            <span>🏆 أطول سلسلة متتالية حققتها:</span>
            <span className="font-bold">{toArabicNumeral(streak.longest_streak)} يوماً</span>
          </div>
        )}
      </div>

      {/* Free Memorization & Review Hero Card */}
      <div className="bg-gradient-to-tr from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-emerald-700/50 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-emerald-200 font-bold">
            حفظ ومراجعة حرة دون قيود ✨
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-black">
            اختر ما تشاء
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black font-cairo text-amber-300 mb-1">
          احفظ وراجع بالقدر الذي تختاره
        </h3>
        <p className="text-xs text-emerald-100/90 mb-4 leading-relaxed">
          حدد أي سورة من سور القرآن الـ ١١٤ وأي عدد من الآيات ترغب في إتقانه اليوم بحرية تامة دون أي تقييد بعدد محدد مسبقاً.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={() => setShowRangePicker(true)}
            className="w-full sm:flex-1 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-2xl text-xs sm:text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Brain size={18} />
            <span>ابدأ الحفظ الذكي الحر</span>
          </button>

          <button
            onClick={onOpenReview}
            className="w-full sm:w-auto py-3 px-5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm border border-emerald-600 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={17} />
            <span>جلسة مراجعة حرة</span>
          </button>
        </div>
      </div>

      {/* Continue Reading & Ward Last Position */}
      {lastReadPosition && (
        <div
          onClick={() => onOpenMushaf(lastReadPosition.surah_id, lastReadPosition.verse_number, lastReadPosition.page_number)}
          className="bg-white dark:bg-stone-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 dark:border-stone-800 flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <BookOpen size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-stone-400 block">
                آخر موضع توقفت عنده في الورد:
              </span>
              <span className="font-bold text-base text-stone-900 dark:text-stone-100 block font-cairo">
                سورة {lastReadPosition.surah_name} · الآية {toArabicNumeral(lastReadPosition.verse_number)}
              </span>
              {lastReadPosition.page_number && (
                <span className="text-[11px] text-stone-500">
                  الصفحة {toArabicNumeral(lastReadPosition.page_number)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs group-hover:bg-emerald-700 group-hover:text-white transition-all">
            <span>استئناف الورد</span>
            <ChevronLeft size={16} />
          </div>
        </div>
      )}

      {/* Quick Access Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenTasbih}
          className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500 shadow-sm flex items-center gap-3 text-right transition-all group"
        >
          <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform">
            <span>📿</span>
          </div>
          <div>
            <span className="font-bold text-sm text-stone-900 dark:text-stone-100 block">
              المسبحة الإلكترونية
            </span>
            <span className="text-[11px] text-stone-400">عداد الذكر والتسبيح</span>
          </div>
        </button>

        <button
          onClick={onOpenSearch}
          className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500 shadow-sm flex items-center gap-3 text-right transition-all group"
        >
          <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 group-hover:scale-105 transition-transform">
            <Search size={18} />
          </div>
          <div>
            <span className="font-bold text-sm text-stone-900 dark:text-stone-100 block">
              البحث في القرآن
            </span>
            <span className="text-[11px] text-stone-400">محرك بحث فوري أوفلاين</span>
          </div>
        </button>

        <button
          onClick={onOpenReview}
          className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500 shadow-sm flex items-center gap-3 text-right transition-all group"
        >
          <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
            <RotateCcw size={18} />
          </div>
          <div>
            <span className="font-bold text-sm text-stone-900 dark:text-stone-100 block">
              المراجعة الذكية
            </span>
            <span className="text-[11px] text-stone-400">تثبيت الآيات بالتكرار المتباعد</span>
          </div>
        </button>

        <button
          onClick={onOpenStats}
          className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500 shadow-sm flex items-center gap-3 text-right transition-all group"
        >
          <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 group-hover:scale-105 transition-transform">
            <Award size={18} />
          </div>
          <div>
            <span className="font-bold text-sm text-stone-900 dark:text-stone-100 block">
              إحصائيات الإنجاز
            </span>
            <span className="text-[11px] text-stone-400">السور والأجزاء المكتملة</span>
          </div>
        </button>
      </div>

      {/* Free Range Selection Modal for Memorization & Review */}
      {showRangePicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  تحديد سورة ونطاق الحفظ الحر
                </h3>
                <span className="text-xs text-stone-400">احفظ ما تشاء دون قيود على عدد الآيات</span>
              </div>
              <button
                onClick={() => setShowRangePicker(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Quick Search */}
            <div className="mb-3">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="🔍 ابحث عن السورة (مثل: الملك، الواقعة، يس)..."
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-emerald-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Surahs Grid */}
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                {surahsList
                  .filter((s) => !pickerSearch || s.name_arabic.includes(pickerSearch) || String(s.id).includes(pickerSearch))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setPickerSurahId(s.id);
                        setPickerFromVerse(1);
                        setPickerToVerse(s.verses_count); // Open to all verses of the surah
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold text-right transition-all flex items-center justify-between ${
                        pickerSurahId === s.id
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
                const currentSurah = surahsList.find((s) => s.id === pickerSurahId);
                const maxV = currentSurah?.verses_count || 30;

                return (
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        نطاق الآيات المطلوب:
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        المجموع: {toArabicNumeral(Math.max(1, pickerToVerse - pickerFromVerse + 1))} آيات
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="flex-1">
                        <span className="text-[11px] text-stone-400 block mb-1">من الآية:</span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setPickerFromVerse((v) => Math.max(1, v - 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-r-xl font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={pickerToVerse}
                            value={pickerFromVerse}
                            onChange={(e) => setPickerFromVerse(Math.max(1, Math.min(pickerToVerse, Number(e.target.value))))}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 py-1 text-center text-sm font-bold text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() => setPickerFromVerse((v) => Math.min(pickerToVerse, v + 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-l-xl font-bold text-xs"
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
                            onClick={() => setPickerToVerse((v) => Math.max(pickerFromVerse, v - 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-r-xl font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={pickerFromVerse}
                            max={maxV}
                            value={pickerToVerse}
                            onChange={(e) => setPickerToVerse(Math.min(maxV, Math.max(pickerFromVerse, Number(e.target.value))))}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 py-1 text-center text-sm font-bold text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() => setPickerToVerse((v) => Math.min(maxV, v + 1))}
                            className="w-7 h-8 bg-stone-200 dark:bg-stone-700 rounded-l-xl font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                      <button
                        type="button"
                        onClick={() => setPickerToVerse(pickerFromVerse)}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100"
                      >
                        آية واحدة
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerToVerse(Math.min(maxV, pickerFromVerse + 2))}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100"
                      >
                        ٣ آيات
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerToVerse(Math.min(maxV, pickerFromVerse + 4))}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100"
                      >
                        ٥ آيات
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerToVerse(Math.min(maxV, pickerFromVerse + 9))}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100"
                      >
                        ١٠ آيات
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerToVerse(Math.min(maxV, pickerFromVerse + 14))}
                        className="py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px] font-bold hover:bg-emerald-100"
                      >
                        صفحة (~١٥)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPickerFromVerse(1);
                          setPickerToVerse(maxV);
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

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRangePicker(false);
                  onStartMemorize(pickerSurahId, pickerFromVerse, pickerToVerse);
                }}
                className="flex-1 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Brain size={18} />
                <span>بدء الحفظ ({toArabicNumeral(Math.max(1, pickerToVerse - pickerFromVerse + 1))} آيات)</span>
              </button>

              <button
                onClick={() => {
                  setShowRangePicker(false);
                  onOpenReview();
                }}
                className="py-3.5 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold rounded-2xl transition-all active:scale-98 cursor-pointer text-xs"
              >
                المراجعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
