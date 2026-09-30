import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Shield, Heart, Search, Check, RotateCcw,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Layers, ListFilter, Copy, CheckCircle2, ArrowRight,
  Sparkles, X, BookmarkCheck, Database
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { HisnMuslimChapter, DhikrItem } from '../../types/dhikr';
import { dbService } from '../../services/db';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  onBackToMain?: () => void;
}

export const HisnMuslimSection: React.FC<Props> = () => {
  // Database & Chapters state
  const [chapters, setChapters] = useState<HisnMuslimChapter[]>([]);
  const [allProgress, setAllProgress] = useState<{ [chapterId: number]: { [itemId: string]: number } }>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active view: null = chapter index, number = active chapter view
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);

  // Search & Filtering state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('الكل');

  // Chapter Reading Mode state
  const [viewMode, setViewMode] = useState<'pager' | 'list'>('pager');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load chapters, progress, and favorites from local database
  useEffect(() => {
    let isMounted = true;
    const loadFromDatabase = async () => {
      setIsLoading(true);
      try {
        // Ensure local database is seeded
        const chList = await dbService.getHisnMuslimChapters();
        const prog = await dbService.getAllHisnProgress();
        const favs = await dbService.getHisnFavorites();

        if (isMounted) {
          setChapters(chList);
          setAllProgress(prog);
          setFavorites(favs);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFromDatabase();
    return () => {
      isMounted = false;
    };
  }, []);

  // Categories list derived from chapters
  const categories = useMemo(() => {
    const set = new Set<string>();
    chapters.forEach((c) => set.add(c.category));
    return ['الكل', 'المفضلة ❤️', ...Array.from(set)];
  }, [chapters]);

  // Filtered chapters based on search query and category
  const filteredChapters = useMemo(() => {
    return chapters.filter((chapter) => {
      // Category filter
      if (selectedCategoryFilter === 'المفضلة ❤️') {
        const hasFavorite = chapter.items.some((item) => favorites.includes(item.id));
        if (!hasFavorite) return false;
      } else if (selectedCategoryFilter !== 'الكل' && chapter.category !== selectedCategoryFilter) {
        return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const inTitle = chapter.title.toLowerCase().includes(q);
      const inCategory = chapter.category.toLowerCase().includes(q);
      const inItems = chapter.items.some(
        (it) =>
          it.text.toLowerCase().includes(q) ||
          (it.virtue && it.virtue.toLowerCase().includes(q)) ||
          (it.source && it.source.toLowerCase().includes(q))
      );

      return inTitle || inCategory || inItems;
    });
  }, [chapters, selectedCategoryFilter, searchQuery, favorites]);

  // Matching items for direct search results when searching
  const directMatchingItems = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: { chapter: HisnMuslimChapter; item: DhikrItem }[] = [];

    for (const ch of chapters) {
      for (const item of ch.items) {
        if (
          item.text.toLowerCase().includes(q) ||
          (item.virtue && item.virtue.toLowerCase().includes(q)) ||
          (item.source && item.source.toLowerCase().includes(q))
        ) {
          results.push({ chapter: ch, item });
          if (results.length >= 15) break; // Limit search cards
        }
      }
      if (results.length >= 15) break;
    }
    return results;
  }, [chapters, searchQuery]);

  // Active chapter details
  const activeChapter = useMemo(() => {
    if (selectedChapterId === null) return null;
    return chapters.find((c) => c.id === selectedChapterId) || null;
  }, [chapters, selectedChapterId]);

  const activeChapterProgress = activeChapter ? allProgress[activeChapter.id] || {} : {};

  // Increment counter for a specific dhikr item
  const handleIncrement = async (chapterId: number, item: DhikrItem) => {
    const currentProgress = allProgress[chapterId] || {};
    const currentCount = currentProgress[item.id] || 0;

    if (currentCount < item.count) {
      const nextCount = currentCount + 1;
      const updatedChapterProg = { ...currentProgress, [item.id]: nextCount };

      setAllProgress((prev) => ({
        ...prev,
        [chapterId]: updatedChapterProg,
      }));

      // Persist to local database offline
      await dbService.saveHisnChapterProgress(chapterId, updatedChapterProg);

      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(nextCount === item.count ? [80, 40, 80] : 30);
      }

      // Check if all items in active chapter are completed
      if (activeChapter && activeChapter.id === chapterId) {
        const allDone = activeChapter.items.every((it) => {
          const count = it.id === item.id ? nextCount : updatedChapterProg[it.id] || 0;
          return count >= it.count;
        });

        if (allDone) {
          confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
        } else if (nextCount === item.count && viewMode === 'pager' && currentIndex < activeChapter.items.length - 1) {
          // Auto-advance to next dhikr in pager mode
          setTimeout(() => {
            setCurrentIndex((idx) => Math.min(idx + 1, activeChapter.items.length - 1));
          }, 380);
        }
      }
    }
  };

  // Toggle favorite dhikr
  const handleToggleFavorite = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isNowFav = await dbService.toggleHisnFavorite(itemId);
    setFavorites((prev) =>
      isNowFav ? [...prev, itemId] : prev.filter((id) => id !== itemId)
    );
  };

  // Copy dhikr text to clipboard
  const handleCopyText = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset chapter progress
  const handleResetChapter = async (chapterId: number) => {
    if (window.confirm('هل تريد إعادة تصفير عداد أذكار هذا الباب لليوم؟')) {
      await dbService.resetHisnChapterProgress(chapterId);
      setAllProgress((prev) => ({
        ...prev,
        [chapterId]: {},
      }));
      setCurrentIndex(0);
    }
  };

  // Switch to next or previous chapter
  const handleNavigateChapter = (direction: 'next' | 'prev') => {
    if (!activeChapter) return;
    const currentIdx = chapters.findIndex((c) => c.id === activeChapter.id);
    if (direction === 'next' && currentIdx < chapters.length - 1) {
      setSelectedChapterId(chapters[currentIdx + 1].id);
      setCurrentIndex(0);
    } else if (direction === 'prev' && currentIdx > 0) {
      setSelectedChapterId(chapters[currentIdx - 1].id);
      setCurrentIndex(0);
    }
  };

  // Calculate overall stats
  const totalChaptersCount = chapters.length;
  const completedChaptersCount = chapters.filter((c) => {
    const prog = allProgress[c.id] || {};
    return c.items.length > 0 && c.items.every((it) => (prog[it.id] || 0) >= it.count);
  }).length;

  if (isLoading) {
    return (
      <div className="py-20 text-center text-stone-500">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span className="text-sm font-bold text-stone-700 dark:text-stone-300">
          جاري تحميل كتاب حصن المسلم من قاعدة البيانات المحلية...
        </span>
        <p className="text-xs text-stone-400 mt-1">البيانات مخزنة بالكامل على جهازك وتعمل أوفلاين</p>
      </div>
    );
  }

  // --- CHAPTER VIEW: Display selected chapter ---
  if (activeChapter) {
    const chapterProgress = allProgress[activeChapter.id] || {};
    const completedItems = activeChapter.items.filter(
      (item) => (chapterProgress[item.id] || 0) >= item.count
    ).length;
    const totalItems = activeChapter.items.length;
    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const isChapterDone = percent === 100;
    const activePagerItem = activeChapter.items[currentIndex] || activeChapter.items[0];
    const isPagerItemDone = (chapterProgress[activePagerItem?.id] || 0) >= (activePagerItem?.count || 1);
    const isPagerItemFav = favorites.includes(activePagerItem?.id);

    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Top Header & Breadcrumb */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => {
                setSelectedChapterId(null);
                setCurrentIndex(0);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all"
            >
              <ArrowRight size={15} />
              <span>فهرس الأبواب</span>
            </button>

            {/* Quick Next / Prev Chapter navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleNavigateChapter('prev')}
                disabled={chapters.findIndex((c) => c.id === activeChapter.id) === 0}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-30 hover:text-emerald-700 transition-colors"
                title="الباب السابق"
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-[11px] font-bold text-stone-400 px-1">
                باب {toArabicNumeral(activeChapter.id)} / {toArabicNumeral(chapters.length)}
              </span>
              <button
                onClick={() => handleNavigateChapter('next')}
                disabled={chapters.findIndex((c) => c.id === activeChapter.id) === chapters.length - 1}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-30 hover:text-emerald-700 transition-colors"
                title="الباب التالي"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {activeChapter.category}
                </span>
                {isChapterDone && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    تم الباب كاملاً 🌟
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                {activeChapter.title}
              </h2>
              <span className="text-xs text-stone-500">
                أنجزت {toArabicNumeral(completedItems)} من {toArabicNumeral(totalItems)} ({toArabicNumeral(percent)}%)
              </span>
            </div>

            {/* View Mode & Reset Controls */}
            <div className="flex items-center gap-1.5">
              <div className="flex bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
                <button
                  onClick={() => setViewMode('pager')}
                  className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 font-bold ${
                    viewMode === 'pager'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                  title="تصفح ذكر بذكر"
                >
                  <Layers size={13} />
                  <span>تصفح</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 font-bold ${
                    viewMode === 'list'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                  title="عرض الكل"
                >
                  <ListFilter size={13} />
                  <span>قائمة</span>
                </button>
              </div>

              <button
                onClick={() => handleResetChapter(activeChapter.id)}
                className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                title="إعادة التصفير لليوم"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* PAGER VIEW */}
        {viewMode === 'pager' && activePagerItem ? (
          <div className="space-y-4 animate-in fade-in">
            {/* Nav Arrows */}
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
                الذكر {toArabicNumeral(currentIndex + 1)} من {toArabicNumeral(totalItems)}
              </span>

              <button
                disabled={currentIndex >= activeChapter.items.length - 1}
                onClick={() => setCurrentIndex((i) => Math.min(activeChapter.items.length - 1, i + 1))}
                className="flex items-center gap-1 text-emerald-800 dark:text-emerald-400 disabled:opacity-30 p-1"
              >
                <span>الذكر التالي</span>
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Dhikr Card */}
            <div
              className={`rounded-3xl p-6 sm:p-8 transition-all shadow-md border relative ${
                isPagerItemDone
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 ring-2 ring-emerald-500/30'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
              }`}
            >
              {/* Top Card Tools */}
              <div className="flex items-center justify-between mb-4">
                {isPagerItemDone ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <Check size={14} />
                    <span>تمت القراءة ومحفوظ محلياً</span>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-stone-400">
                    الذكر رقم {toArabicNumeral(currentIndex + 1)}
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  {/* Favorite Button */}
                  <button
                    onClick={(e) => handleToggleFavorite(activePagerItem.id, e)}
                    className={`p-2 rounded-xl border transition-all ${
                      isPagerItemFav
                        ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 border-rose-200 dark:border-rose-900'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:text-rose-500'
                    }`}
                    title={isPagerItemFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                  >
                    <Heart size={16} className={isPagerItemFav ? 'fill-current' : ''} />
                  </button>

                  {/* Copy Button */}
                  <button
                    onClick={(e) => handleCopyText(activePagerItem.text, activePagerItem.id, e)}
                    className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-emerald-700 border border-stone-200 dark:border-stone-700 transition-colors"
                    title="نسخ الذكر"
                  >
                    {copiedId === activePagerItem.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Text */}
              <p className="font-quran text-xl sm:text-2xl leading-loose text-stone-900 dark:text-stone-100 text-right mb-6 select-none font-medium">
                {activePagerItem.text}
              </p>

              {/* Virtue & Source */}
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

              {/* Tap Counter Button */}
              <button
                onClick={() => handleIncrement(activeChapter.id, activePagerItem)}
                disabled={isPagerItemDone}
                className={`w-full py-4 rounded-2xl font-bold text-base sm:text-lg transition-all active:scale-98 shadow-md flex items-center justify-center gap-3 ${
                  isPagerItemDone
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                }`}
              >
                {isPagerItemDone ? (
                  <>
                    <Check size={22} />
                    <span>اكتملت القراءة ({toArabicNumeral(activePagerItem.count)})</span>
                  </>
                ) : (
                  <>
                    <span>اضغط للقراءة</span>
                    <span className="text-xl font-black px-3 py-0.5 rounded-xl bg-black/10">
                      {toArabicNumeral(chapterProgress[activePagerItem.id] || 0)} / {toArabicNumeral(activePagerItem.count)}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Jump Dots */}
            <div className="flex gap-1.5 overflow-x-auto py-2 scrollbar-none justify-center">
              {activeChapter.items.map((item, idx) => {
                const done = (chapterProgress[item.id] || 0) >= item.count;
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
            {activeChapter.items.map((item, idx) => {
              const currentCount = chapterProgress[item.id] || 0;
              const isDone = currentCount >= item.count;
              const isExpanded = expandedInfoId === item.id;
              const isFav = favorites.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl p-5 transition-all shadow-sm border ${
                    isDone
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-stone-400">
                      الذكر رقم {toArabicNumeral(idx + 1)}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleToggleFavorite(item.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isFav ? 'text-rose-500' : 'text-stone-400 hover:text-rose-500'
                        }`}
                        title="المفضلة"
                      >
                        <Heart size={15} className={isFav ? 'fill-current' : ''} />
                      </button>

                      <button
                        onClick={(e) => handleCopyText(item.text, item.id, e)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
                        title="نسخ الذكر"
                      >
                        {copiedId === item.id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                      </button>

                      {isDone && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Check size={12} />
                          <span>مقروء ومحفوظ</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="font-quran text-lg sm:text-xl leading-loose text-stone-900 dark:text-stone-100 text-right mb-4">
                    {item.text}
                  </p>

                  {/* Collapsible Info */}
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

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      onClick={() => setExpandedInfoId(isExpanded ? null : item.id)}
                      className="flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-700 transition-colors"
                    >
                      <span>{isExpanded ? 'إخفاء الفضل والمصدر' : 'فضل الذكر والمصدر'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <button
                      onClick={() => handleIncrement(activeChapter.id, item)}
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
                        <span>
                          {toArabicNumeral(currentCount)} / {toArabicNumeral(item.count)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- CHAPTER INDEX VIEW: Full Book Chapters Browser ---
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Book Banner */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-emerald-700/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <Shield size={26} />
            </div>
            <div>
              <span className="text-amber-300 text-xs font-bold flex items-center gap-1">
                <Sparkles size={13} />
                كتاب حصن المسلم كاملاً
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                أذكار الكتاب والسنة للشيخ القحطاني
              </h2>
            </div>
          </div>
        </div>

        <p className="text-xs text-stone-200 leading-relaxed mb-4">
          يحتوي على كافة أذكار وأدعية كتاب «حصن المسلم» الصحيحة مع فضل كل ذكر وتخريجه الحديثي.
        </p>

        {/* Offline & Stats Pill */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-emerald-200 font-bold">
            <Database size={13} />
            <span>مخزن محلياً بقاعدة البيانات ويعمل أوفلاين 🟢</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 text-stone-200">
            <BookOpen size={13} />
            <span>{toArabicNumeral(totalChaptersCount)} باباً</span>
          </div>

          {completedChaptersCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 font-bold">
              <BookmarkCheck size={13} />
              <span>أنجزت {toArabicNumeral(completedChaptersCount)} اليوم</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث في أبواب وأذكار حصن المسلم (مثال: سفر، كرب، نوم، استغفار)..."
          className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl py-3 pr-10 pl-10 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 transition-all text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
        />
        <Search className="absolute right-3.5 top-3.5 text-stone-400" size={17} />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-3.5 top-3.5 text-stone-400 hover:text-stone-600"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* Category Chips Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-2 px-2">
        {categories.map((cat) => {
          const isSelected = selectedCategoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`py-1.5 px-3.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-emerald-800 text-white border-emerald-700 shadow-sm'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Direct Search Matches View (if searching specific text) */}
      {searchQuery.trim().length >= 2 && directMatchingItems.length > 0 && (
        <div className="bg-amber-50/60 dark:bg-stone-900/90 rounded-3xl p-4 border border-amber-200 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
            <span>نتائج مباشرة من نصوص الأذكار والأحاديث:</span>
            <span>{toArabicNumeral(directMatchingItems.length)} نتيجة</span>
          </div>

          <div className="space-y-2.5">
            {directMatchingItems.map(({ chapter, item }) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedChapterId(chapter.id);
                  const itemIdx = chapter.items.findIndex((i) => i.id === item.id);
                  setCurrentIndex(itemIdx >= 0 ? itemIdx : 0);
                }}
                className="p-3 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 cursor-pointer hover:border-emerald-600 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 mb-1">
                  <span className="text-emerald-700 dark:text-emerald-400">{chapter.title}</span>
                  <span>{chapter.category}</span>
                </div>
                <p className="font-quran text-sm text-stone-800 dark:text-stone-200 line-clamp-2">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapters Grid / List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs font-bold text-stone-500">
          <span>أبواب كتاب حصن المسلم ({toArabicNumeral(filteredChapters.length)})</span>
          <span>اضغط لتصفح وقراءة الباب</span>
        </div>

        {filteredChapters.length === 0 ? (
          <div className="py-12 text-center text-stone-500 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6">
            <BookOpen size={32} className="mx-auto mb-2 text-stone-300" />
            <p className="text-sm font-bold">لا توجد أبواب مطابقة لبحثك</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('الكل');
              }}
              className="mt-3 text-xs text-emerald-700 font-bold hover:underline"
            >
              عرض جميع الأبواب (٣٢ باباً)
            </button>
          </div>
        ) : (
          filteredChapters.map((chapter) => {
            const prog = allProgress[chapter.id] || {};
            const doneCount = chapter.items.filter((it) => (prog[it.id] || 0) >= it.count).length;
            const total = chapter.items.length;
            const isCompleted = total > 0 && doneCount === total;
            const progressRatio = total > 0 ? Math.round((doneCount / total) * 100) : 0;
            const hasFavorite = chapter.items.some((it) => favorites.includes(it.id));

            return (
              <div
                key={chapter.id}
                onClick={() => {
                  setSelectedChapterId(chapter.id);
                  setCurrentIndex(0);
                }}
                className={`group p-4 rounded-3xl border transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center justify-between gap-3 ${
                  isCompleted
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 hover:border-emerald-500'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-emerald-600/50'
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  {/* Chapter Number Badge */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 transition-transform group-hover:scale-105 ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {isCompleted ? <Check size={18} /> : toArabicNumeral(chapter.id)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        {chapter.category}
                      </span>
                      {hasFavorite && (
                        <Heart size={12} className="text-rose-500 fill-current" />
                      )}
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 truncate">
                      {chapter.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                      <span>{toArabicNumeral(total)} أذكار</span>
                      <span>•</span>
                      {isCompleted ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          اكتملت قراءته اليوم 🌟
                        </span>
                      ) : doneCount > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          أنجزت {toArabicNumeral(doneCount)} من {toArabicNumeral(total)}
                        </span>
                      ) : (
                        <span>لم يُقرأ اليوم</span>
                      )}
                    </div>

                    {/* Mini progress bar if started */}
                    {doneCount > 0 && !isCompleted && (
                      <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${progressRatio}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <ChevronLeft size={18} className="text-stone-400 group-hover:text-emerald-700 group-hover:-translate-x-0.5 transition-all shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
