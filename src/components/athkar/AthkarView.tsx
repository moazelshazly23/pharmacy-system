import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Bed, Sunrise, Clock, Utensils, Home, Compass, 
  BookOpen, Heart, Sparkles, Check, RotateCcw, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Layers, ListFilter, Volume2, Award, Shield
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ATHKAR_CATEGORIES } from '../../data/athkarData';
import { DhikrCategory, DhikrItem } from '../../types/dhikr';
import { dbService } from '../../services/db';
import { toArabicNumeral } from '../../utils/arabic';
import { HisnMuslimSection } from './HisnMuslimSection';

const iconMap: { [key: string]: React.ElementType } = {
  Sun,
  Moon,
  Bed,
  Sunrise,
  Clock,
  Utensils,
  Home,
  Compass,
  BookOpen,
  Heart,
  Sparkles,
};

export const AthkarView: React.FC = () => {
  // Navigation / Category selection
  const [activeMainSection, setActiveMainSection] = useState<'morning_evening' | 'hisn_muslim' | 'all_categories'>('morning_evening');
  const [selectedSubTab, setSelectedSubTab] = useState<'morning' | 'evening'>('morning');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('morning');

  // Browsing mode: 'pager' (one by one sequential browsing) vs 'list' (full list)
  const [viewMode, setViewMode] = useState<'pager' | 'list'>('pager');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Persistence: item counts saved in local database
  const [itemCounts, setItemCounts] = useState<{ [id: string]: number }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);

  // Active category
  const activeCategoryId = activeMainSection === 'morning_evening' ? selectedSubTab : selectedCategoryId;
  const selectedCategory = ATHKAR_CATEGORIES.find((c) => c.id === activeCategoryId) || ATHKAR_CATEGORIES[0];

  // Load saved 'read' progress from local database for the active category
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    dbService.getAthkarProgress(activeCategoryId).then((saved) => {
      if (isMounted) {
        setItemCounts(saved || {});
        setIsLoading(false);
      }
    });
    // Reset pager index when category changes
    setCurrentIndex(0);
    return () => {
      isMounted = false;
    };
  }, [activeCategoryId]);

  const completedCount = selectedCategory.items.filter(
    (item) => (itemCounts[item.id] || 0) >= item.count
  ).length;
  const totalCount = selectedCategory.items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handleIncrement = async (item: DhikrItem) => {
    const current = itemCounts[item.id] || 0;
    if (current < item.count) {
      const next = current + 1;
      const updatedCounts = { ...itemCounts, [item.id]: next };
      setItemCounts(updatedCounts);

      // Persist to local database
      await dbService.saveAthkarProgress(activeCategoryId, updatedCounts);

      if (navigator.vibrate) {
        navigator.vibrate(next === item.count ? [100, 50, 100] : 30);
      }

      // Check if all items in current category are now completed
      const allDone = selectedCategory.items.every((it) => {
        const itCount = it.id === item.id ? next : updatedCounts[it.id] || 0;
        return itCount >= it.count;
      });

      if (allDone) {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        const today = await dbService.getTodayWardProgress();
        if (activeCategoryId === 'morning') today.morning_athkar_done = true;
        if (activeCategoryId === 'evening') today.evening_athkar_done = true;
        await dbService.saveTodayWardProgress(today);
      } else if (next === item.count && viewMode === 'pager' && currentIndex < selectedCategory.items.length - 1) {
        // Auto-advance to next dhikr after a brief pause when completing current dhikr
        setTimeout(() => {
          setCurrentIndex((idx) => Math.min(idx + 1, selectedCategory.items.length - 1));
        }, 350);
      }
    }
  };

  const handleResetCategory = async () => {
    if (window.confirm('هل تريد إعادة تصفير أذكار هذا القسم لليوم؟')) {
      await dbService.resetAthkarProgress(activeCategoryId);
      setItemCounts({});
      setCurrentIndex(0);
    }
  };

  const activePagerItem = selectedCategory.items[currentIndex] || selectedCategory.items[0];
  const isCurrentPagerDone = (itemCounts[activePagerItem?.id] || 0) >= (activePagerItem?.count || 1);

  return (
    <div className="max-w-xl mx-auto p-4 pb-32">
      {/* Top Main Section Switcher */}
      <div className="grid grid-cols-3 gap-1.5 bg-stone-100 dark:bg-stone-900/80 p-1.5 rounded-3xl mb-4 border border-stone-200 dark:border-stone-800">
        <button
          onClick={() => setActiveMainSection('morning_evening')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] sm:text-xs font-bold transition-all ${
            activeMainSection === 'morning_evening'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          <Sparkles size={14} />
          <span>الصباح والمساء</span>
        </button>

        <button
          onClick={() => setActiveMainSection('hisn_muslim')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] sm:text-xs font-bold transition-all ${
            activeMainSection === 'hisn_muslim'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          <Shield size={14} className="text-amber-400" />
          <span>حصن المسلم</span>
        </button>

        <button
          onClick={() => setActiveMainSection('all_categories')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] sm:text-xs font-bold transition-all ${
            activeMainSection === 'all_categories'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          <BookOpen size={14} />
          <span>بقية الأذكار</span>
        </button>
      </div>

      {/* Hisn al-Muslim Full Book Section */}
      {activeMainSection === 'hisn_muslim' ? (
        <HisnMuslimSection />
      ) : (
        <>
          {/* Sub Tabs: Morning vs Evening (if in morning_evening section) */}
          {activeMainSection === 'morning_evening' ? (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedSubTab('morning')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all border ${
                  selectedSubTab === 'morning'
                    ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                }`}
              >
                <Sun size={18} className={selectedSubTab === 'morning' ? 'text-stone-950' : 'text-amber-500'} />
                <span>أذكار الصباح</span>
              </button>

              <button
                onClick={() => setSelectedSubTab('evening')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all border ${
                  selectedSubTab === 'evening'
                    ? 'bg-indigo-900 text-white border-indigo-700 shadow-sm'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                }`}
              >
                <Moon size={18} className={selectedSubTab === 'evening' ? 'text-indigo-200' : 'text-indigo-400'} />
                <span>أذكار المساء</span>
              </button>
            </div>
          ) : (
        /* Category Slider for Other Categories */
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none mb-4 -mx-2 px-2">
          {ATHKAR_CATEGORIES.filter((c) => c.id !== 'morning' && c.id !== 'evening').map((cat) => {
            const Icon = iconMap[cat.icon] || Heart;
            const isSelected = selectedCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-700 shadow-md'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-emerald-50'
                }`}
              >
                <Icon size={16} />
                <span>{cat.title_ar}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Progress & Display Options Header */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span>{selectedCategory.title_ar}</span>
              {progressPercent === 100 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                  اكتمل اليوم 🌟
                </span>
              )}
            </h2>
            <span className="text-xs text-stone-500">
              أنجزت {toArabicNumeral(completedCount)} من {toArabicNumeral(totalCount)} ذكراً ({toArabicNumeral(progressPercent)}%)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Pager vs List */}
            <div className="flex bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
              <button
                onClick={() => setViewMode('pager')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 font-bold ${
                  viewMode === 'pager'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
                title="تصفح متتابع ذكر بذكر"
              >
                <Layers size={14} />
                <span>تصفح</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 font-bold ${
                  viewMode === 'list'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
                title="عرض القائمة كاملة"
              >
                <ListFilter size={14} />
                <span>قائمة</span>
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleResetCategory}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              title="إعادة التصفير لليوم"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-stone-500">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs">جاري تحميل الأذكار المحفوظة...</span>
        </div>
      ) : viewMode === 'pager' && activePagerItem ? (
        /* SEQUENTIAL BROWSING / PAGER VIEW */
        <div className="space-y-4 animate-in fade-in">
          {/* Card Indicator */}
          <div className="flex items-center justify-between px-2 text-xs font-bold text-stone-500">
            <button
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="flex items-center gap-1 text-emerald-800 dark:text-emerald-400 disabled:opacity-30 p-1"
            >
              <ChevronRight size={16} />
              <span>الذكر السابق</span>
            </button>

            <span>
              الذكر {toArabicNumeral(currentIndex + 1)} من {toArabicNumeral(totalCount)}
            </span>

            <button
              disabled={currentIndex >= selectedCategory.items.length - 1}
              onClick={() => setCurrentIndex((i) => Math.min(selectedCategory.items.length - 1, i + 1))}
              className="flex items-center gap-1 text-emerald-800 dark:text-emerald-400 disabled:opacity-30 p-1"
            >
              <span>الذكر التالي</span>
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Main Dhikr Pager Card */}
          <div
            className={`rounded-3xl p-6 sm:p-8 transition-all shadow-md border relative ${
              isCurrentPagerDone
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
            }`}
          >
            {/* Status Pill */}
            {isCurrentPagerDone && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-4">
                <Check size={14} />
                <span>تمت القراءة اليوم ومحفوظة في جهازك</span>
              </div>
            )}

            {/* Dhikr Arabic Text */}
            <p className="font-quran text-xl sm:text-2xl leading-loose text-stone-900 dark:text-stone-100 text-right mb-6 select-none font-medium">
              {activePagerItem.text}
            </p>

            {/* Virtue & Hadith Source */}
            {(activePagerItem.virtue || activePagerItem.source) && (
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-100 dark:border-stone-700/60 text-xs text-stone-600 dark:text-stone-300 space-y-1.5 mb-6 leading-relaxed">
                {activePagerItem.virtue && (
                  <div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-400">فضل الذكر: </span>
                    <span>{activePagerItem.virtue}</span>
                  </div>
                )}
                {activePagerItem.source && (
                  <div>
                    <span className="font-bold text-stone-500">المصدر: </span>
                    <span>{activePagerItem.source}</span>
                  </div>
                )}
              </div>
            )}

            {/* Huge Tap Button Counter */}
            <button
              onClick={() => handleIncrement(activePagerItem)}
              disabled={isCurrentPagerDone}
              className={`w-full py-4 rounded-2xl font-bold text-base sm:text-lg transition-all active:scale-98 shadow-md flex items-center justify-center gap-3 ${
                isCurrentPagerDone
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
              }`}
            >
              {isCurrentPagerDone ? (
                <>
                  <Check size={22} />
                  <span>اكتملت القراءة ({toArabicNumeral(activePagerItem.count)})</span>
                </>
              ) : (
                <>
                  <span>اضغط للقراءة</span>
                  <span className="text-xl font-black px-3 py-0.5 rounded-xl bg-black/10">
                    {toArabicNumeral(itemCounts[activePagerItem.id] || 0)} / {toArabicNumeral(activePagerItem.count)}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Bottom Pager Quick Jump Bar */}
          <div className="flex gap-1.5 overflow-x-auto py-2 scrollbar-none justify-center">
            {selectedCategory.items.map((item, idx) => {
              const done = (itemCounts[item.id] || 0) >= item.count;
              const isSelected = idx === currentIndex;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    isSelected
                      ? 'w-7 bg-emerald-700 dark:bg-emerald-400'
                      : done
                      ? 'w-2.5 bg-emerald-300 dark:bg-emerald-800'
                      : 'w-2.5 bg-stone-300 dark:bg-stone-700'
                  }`}
                  title={`الذكر ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>
      ) : (
        /* FULL LIST VIEW */
        <div className="space-y-4 animate-in fade-in">
          {selectedCategory.items.map((item, idx) => {
            const currentCount = itemCounts[item.id] || 0;
            const isDone = currentCount >= item.count;
            const isExpanded = expandedInfoId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-3xl p-5 transition-all shadow-sm border ${
                  isDone
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                }`}
              >
                {/* Header tag */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-stone-400">
                    الذكر رقم {toArabicNumeral(idx + 1)}
                  </span>
                  {isDone && (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Check size={12} />
                      <span>مقروء ومحفوظ</span>
                    </span>
                  )}
                </div>

                {/* Dhikr Text */}
                <p className="font-quran text-lg sm:text-xl leading-loose text-stone-900 dark:text-stone-100 text-right mb-4">
                  {item.text}
                </p>

                {/* Collapsible Virtue & Source */}
                {isExpanded && (
                  <div className="my-3 p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-100 dark:border-stone-700/60 text-xs text-stone-600 dark:text-stone-300 space-y-1.5 animate-in fade-in">
                    {item.virtue && (
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">فضل الذكر: </span>
                        <span>{item.virtue}</span>
                      </div>
                    )}
                    {item.source && (
                      <div>
                        <span className="font-bold text-stone-500">المصدر: </span>
                        <span>{item.source}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Card Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    onClick={() => setExpandedInfoId(isExpanded ? null : item.id)}
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-700 transition-colors"
                  >
                    <span>{isExpanded ? 'إخفاء الفضل والمصدر' : 'فضل الذكر والمصدر'}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* Counter Button */}
                  <button
                    onClick={() => handleIncrement(item)}
                    disabled={isDone}
                    className={`flex items-center gap-2 py-2 px-5 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-sm ${
                      isDone
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-amber-500 hover:bg-amber-600 text-stone-900'
                    }`}
                  >
                    {isDone ? (
                      <>
                        <Check size={18} />
                        <span>اكتمل ({toArabicNumeral(item.count)})</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {toArabicNumeral(currentCount)} / {toArabicNumeral(item.count)}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};

