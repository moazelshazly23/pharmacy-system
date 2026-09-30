import React, { useEffect, useState, useRef } from 'react';
import { 
  Search, BookOpen, Volume2, Bookmark as BookmarkIcon, 
  Brain, Mic, Share2, Copy, Check, ChevronLeft, ChevronRight, 
  SlidersHorizontal, Sparkles, X, RotateCcw, Eye
} from 'lucide-react';
import { Ayah, Surah, SurahSummary } from '../../types/quran';
import { quranService } from '../../services/quranService';
import { audioService } from '../../services/audioService';
import { dbService } from '../../services/db';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  initialSurahId?: number;
  initialVerseNumber?: number;
  initialPageNumber?: number;
  currentTheme?: 'light' | 'dark' | 'sepia';
  onThemeChange?: (theme: 'light' | 'dark' | 'sepia') => void;
  onStartMemorize?: (surahId: number, fromVerse: number, toVerse: number) => void;
  onStartSammaani?: (surahId: number, fromVerse: number, toVerse: number) => void;
}

export const MushafReader: React.FC<Props> = ({
  initialSurahId = 1,
  initialVerseNumber = 1,
  initialPageNumber,
  currentTheme = 'light',
  onThemeChange,
  onStartMemorize,
  onStartSammaani,
}) => {
  const [surahsList, setSurahsList] = useState<SurahSummary[]>([]);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [activeVerseKey, setActiveVerseKey] = useState<string | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [selectedAyahSurah, setSelectedAyahSurah] = useState<Surah | null>(null);
  
  // View mode: 'surah' continuous or 'page' 604 pages
  const [viewMode, setViewMode] = useState<'surah' | 'page'>('surah');
  const [currentPage, setCurrentPage] = useState<number>(initialPageNumber || 1);
  const [pageData, setPageData] = useState<{ surah: Surah; verses: Ayah[] }[]>([]);

  // Navigation selector modal
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [navTab, setNavTab] = useState<'surah' | 'juz' | 'page'>('surah');
  const [searchFilter, setSearchFilter] = useState('');

  // Reader styling preferences
  const [fontSize, setFontSize] = useState<number>(26);
  const [readerTheme, setReaderTheme] = useState<'cream' | 'white' | 'dark' | 'sepia'>('cream');
  const [mushafContrast, setMushafContrast] = useState<'standard' | 'high' | 'ultra_sharp'>('high');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [tafseerText, setTafseerText] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentTheme === 'dark') {
      setReaderTheme('dark');
    } else if (currentTheme === 'sepia') {
      setReaderTheme('sepia');
    } else {
      setReaderTheme('cream');
    }
  }, [currentTheme]);

  useEffect(() => {
    dbService.getUserSettings().then((s) => {
      if (s.mushaf_contrast) {
        setMushafContrast(s.mushaf_contrast);
      }
      if (s.theme === 'dark') {
        setReaderTheme('dark');
      } else if (s.theme === 'sepia') {
        setReaderTheme('sepia');
      }
    });

    quranService.getSurahsSummary().then((list) => {
      setSurahsList(list);
    });

    if (initialPageNumber) {
      loadPage(initialPageNumber);
      setViewMode('page');
    } else {
      loadSurah(initialSurahId);
    }

    // Subscribe to audio player changes to highlight current active verse
    const unsubscribe = audioService.subscribe((state) => {
      if (state.currentVerseKey) {
        setActiveVerseKey(state.currentVerseKey);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check if verse is bookmarked
  useEffect(() => {
    if (selectedAyah && selectedAyahSurah) {
      dbService.getBookmarks().then((bms) => {
        const found = bms.some(
          (b) => b.surah_id === selectedAyahSurah.id && b.verse_number === selectedAyah.verse_number
        );
        setIsBookmarked(found);
      });
    }
  }, [selectedAyah, selectedAyahSurah]);

  const loadSurah = async (id: number) => {
    const s = await quranService.getSurah(id);
    if (s) {
      setCurrentSurah(s);
      setCurrentPage(s.pages[0]);
      dbService.saveLastReadPosition({
        surah_id: s.id,
        surah_name: s.name_arabic,
        verse_number: 1,
        page_number: s.pages[0],
        updated_at: new Date().toISOString(),
      });
    }
  };

  const loadPage = async (page: number) => {
    const data = await quranService.getPageVerses(page);
    setPageData(data);
    setCurrentPage(page);
    if (data.length > 0) {
      setCurrentSurah(data[0].surah);
      dbService.saveLastReadPosition({
        surah_id: data[0].surah.id,
        surah_name: data[0].surah.name_arabic,
        verse_number: data[0].verses[0]?.verse_number || 1,
        page_number: page,
        updated_at: new Date().toISOString(),
      });
    }
  };

  const handleSurahSelect = (id: number) => {
    loadSurah(id);
    setIsNavOpen(false);
  };

  const handlePageSelect = (page: number) => {
    setViewMode('page');
    loadPage(page);
    setIsNavOpen(false);
  };

  const handleJuzSelect = (juz: number) => {
    // Navigate to the start page of this Juz
    const juzStartPages: { [key: number]: number } = {
      1: 1, 2: 22, 3: 42, 4: 62, 5: 82, 6: 102, 7: 121, 8: 142, 9: 162, 10: 182,
      11: 201, 12: 222, 13: 242, 14: 262, 15: 282, 16: 302, 17: 322, 18: 342, 19: 362, 20: 382,
      21: 402, 22: 422, 23: 442, 24: 462, 25: 482, 26: 502, 27: 522, 28: 542, 29: 562, 30: 582
    };
    const targetPage = juzStartPages[juz] || 1;
    handlePageSelect(targetPage);
  };

  const handleAyahClick = (surah: Surah, ayah: Ayah) => {
    setSelectedAyah(ayah);
    setSelectedAyahSurah(surah);
    setTafseerText(null);
    dbService.saveLastReadPosition({
      surah_id: surah.id,
      surah_name: surah.name_arabic,
      verse_number: ayah.verse_number,
      page_number: ayah.page_number,
      updated_at: new Date().toISOString(),
    });
  };

  const handlePlayMinshawi = (repeats = 1) => {
    if (selectedAyah && selectedAyahSurah) {
      audioService.playVerse(
        selectedAyahSurah.id,
        selectedAyah.verse_number,
        repeats,
        selectedAyah.verse_number,
        selectedAyahSurah.verses_count
      );
      setSelectedAyah(null);
    }
  };

  const handleToggleBookmark = async () => {
    if (!selectedAyah || !selectedAyahSurah) return;

    const bms = await dbService.getBookmarks();
    const existing = bms.find(
      (b) => b.surah_id === selectedAyahSurah.id && b.verse_number === selectedAyah.verse_number
    );

    if (existing) {
      await dbService.deleteBookmark(existing.id);
      setIsBookmarked(false);
    } else {
      await dbService.saveBookmark({
        id: `bm_${selectedAyahSurah.id}_${selectedAyah.verse_number}`,
        type: 'ayah',
        surah_id: selectedAyahSurah.id,
        verse_number: selectedAyah.verse_number,
        page_number: selectedAyah.page_number,
        title: `سورة ${selectedAyahSurah.name_arabic} - الآية ${selectedAyah.verse_number}`,
        created_at: new Date().toISOString(),
      });
      setIsBookmarked(true);
    }
  };

  const handleCopyAyah = () => {
    if (!selectedAyah || !selectedAyahSurah) return;
    const text = `﴿${selectedAyah.text_uthmani}﴾ [سورة ${selectedAyahSurah.name_arabic}: ${selectedAyah.verse_number}]`;
    navigator.clipboard.writeText(text);
    setCopiedKey(selectedAyah.verse_key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Theme styles
  const getThemeClass = () => {
    switch (readerTheme) {
      case 'cream':
        return 'bg-[#fbf7ee] text-stone-900 border-[#ebdcc4]';
      case 'sepia':
        return 'bg-[#f4ecd8] text-[#4a3928] border-[#dfceaf]';
      case 'dark':
        return 'bg-stone-950 text-stone-100 border-stone-800';
      case 'white':
      default:
        return 'bg-white text-stone-900 border-stone-200';
    }
  };

  return (
    <div className="pb-32 min-h-screen">
      {/* Top Header Toolbar */}
      <header className="sticky top-[45px] sm:top-[49px] z-20 bg-emerald-800 dark:bg-emerald-950 text-white shadow-md px-4 py-2.5 transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setIsNavOpen(true)}
            className="flex items-center gap-2 bg-emerald-700/80 hover:bg-emerald-700 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border border-emerald-600/60"
          >
            <BookOpen size={16} />
            <span>
              {viewMode === 'surah' && currentSurah
                ? `سورة ${currentSurah.name_arabic}`
                : `الصفحة ${toArabicNumeral(currentPage)}`}
            </span>
          </button>

          {/* View mode toggle: Surah / Page */}
          <div className="flex items-center bg-emerald-900/60 p-0.5 rounded-lg border border-emerald-700/40 text-xs">
            <button
              onClick={() => {
                setViewMode('surah');
                if (currentSurah) loadSurah(currentSurah.id);
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'surah' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-200'
              }`}
            >
              سورة
            </button>
            <button
              onClick={() => {
                setViewMode('page');
                loadPage(currentPage);
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'page' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-200'
              }`}
            >
              صفحة
            </button>
          </div>

          {/* Font scale and theme controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFontSize((s) => Math.max(20, s - 2))}
              className="w-7 h-7 flex items-center justify-center bg-emerald-700/60 hover:bg-emerald-700 rounded-lg text-xs font-bold"
              title="تصغير الخط"
            >
              -A
            </button>
            <button
              onClick={() => setFontSize((s) => Math.min(38, s + 2))}
              className="w-7 h-7 flex items-center justify-center bg-emerald-700/60 hover:bg-emerald-700 rounded-lg text-sm font-bold"
              title="تكبير الخط"
            >
              +A
            </button>

            {/* Universal Theme Switcher inside Mushaf */}
            <div className="flex items-center gap-1 mr-1 bg-emerald-900/60 p-0.5 rounded-lg border border-emerald-700/40">
              <button
                onClick={() => {
                  setReaderTheme('cream');
                  if (onThemeChange) onThemeChange('light');
                }}
                className={`w-5 h-5 rounded-full bg-[#fbf7ee] border transition-all ${
                  readerTheme === 'cream' || readerTheme === 'white' ? 'ring-2 ring-amber-400 scale-105' : 'border-stone-400 opacity-60'
                }`}
                title="فاتح / كريمي"
              />
              <button
                onClick={() => {
                  setReaderTheme('sepia');
                  if (onThemeChange) onThemeChange('sepia');
                }}
                className={`w-5 h-5 rounded-full bg-[#dfceaf] border transition-all ${
                  readerTheme === 'sepia' ? 'ring-2 ring-amber-500 scale-105' : 'border-stone-400 opacity-60'
                }`}
                title="سيبيا تراثي"
              />
              <button
                onClick={() => {
                  setReaderTheme('dark');
                  if (onThemeChange) onThemeChange('dark');
                }}
                className={`w-5 h-5 rounded-full bg-stone-900 border transition-all ${
                  readerTheme === 'dark' ? 'ring-2 ring-emerald-400 scale-105' : 'border-stone-600 opacity-60'
                }`}
                title="الوضع الليلي"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Mushaf Content */}
      <main ref={containerRef} className="max-w-2xl mx-auto p-3 sm:p-4">
        <div
          className={`rounded-3xl shadow-sm border p-4 sm:p-7 min-h-[75vh] transition-colors relative ${getThemeClass()}`}
        >
          {/* CONTINUOUS SURAH VIEW */}
          {viewMode === 'surah' && currentSurah && (
            <div>
              {/* Surah Header Banner */}
              <div className="mb-6 p-4 rounded-2xl bg-emerald-900 text-amber-100 text-center relative overflow-hidden shadow-inner border border-amber-500/30">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:12px_12px]" />
                <h2 className="text-2xl sm:text-3xl font-bold font-quran mb-1 text-amber-200">
                  سُورَةُ {currentSurah.name_arabic}
                </h2>
                <div className="flex items-center justify-center gap-4 text-xs text-amber-100/90 font-cairo">
                  <span>{currentSurah.revelation_place === 'makkah' ? 'مكية 🕋' : 'مدنية 🕌'}</span>
                  <span>•</span>
                  <span>{toArabicNumeral(currentSurah.verses_count)} آيات</span>
                  <span>•</span>
                  <span>الجزء {toArabicNumeral(currentSurah.verses[0]?.juz_number || 1)}</span>
                </div>
              </div>

              {/* Bismillah (except Surah 9 At-Tawbah and Surah 1 Al-Fatiha where it's ayah 1) */}
              {currentSurah.id !== 9 && currentSurah.id !== 1 && (
                <div className="text-center my-6 py-2">
                  <span className="font-quran text-2xl sm:text-3xl text-emerald-900 dark:text-emerald-300">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </span>
                </div>
              )}

              {/* Verses stream */}
              <div
                className="font-quran text-justify leading-loose"
                style={{ fontSize: `${fontSize}px`, lineHeight: 2.3 }}
              >
                {currentSurah.verses.map((ayah) => {
                  const isActive = activeVerseKey === ayah.verse_key;
                  return (
                    <span
                      key={ayah.id}
                      onClick={() => handleAyahClick(currentSurah, ayah)}
                      className={`cursor-pointer inline px-1 py-0.5 rounded-lg transition-all duration-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 ${
                        isActive
                          ? 'bg-amber-200/80 dark:bg-amber-900/60 ring-2 ring-amber-500/60 rounded-md font-semibold'
                          : ''
                      }`}
                    >
                      <span>{ayah.text_uthmani}</span>
                      <span className="inline-flex items-center justify-center mx-1 text-emerald-700 dark:text-emerald-400 font-normal select-none">
                        <span className="text-[0.75em] text-amber-700 dark:text-amber-400"> ﴿{toArabicNumeral(ayah.verse_number)}﴾ </span>
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* Surah Navigation at bottom */}
              <div className="mt-8 pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
                {currentSurah.id > 1 ? (
                  <button
                    onClick={() => loadSurah(currentSurah.id - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  >
                    <ChevronRight size={16} />
                    <span>السورة السابقة</span>
                  </button>
                ) : <div />}

                {currentSurah.id < 114 && (
                  <button
                    onClick={() => loadSurah(currentSurah.id + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  >
                    <span>السورة التالية</span>
                    <ChevronLeft size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PAGE-BY-PAGE MUSHAF VIEW (604 PAGES) */}
          {viewMode === 'page' && (
            <div>
              {/* Page Header (Juz & Surah) */}
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 pb-3 mb-4 border-b border-stone-200 dark:border-stone-800 font-cairo">
                <span>الجزء {toArabicNumeral(pageData[0]?.verses[0]?.juz_number || 1)}</span>
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  {pageData[0]?.surah.name_arabic ? `سورة ${pageData[0].surah.name_arabic}` : ''}
                </span>
                <span>الحزب {toArabicNumeral(pageData[0]?.verses[0]?.hizb_number || 1)}</span>
              </div>

              {/* Page Content */}
              <div
                className="font-quran text-justify leading-loose min-h-[60vh]"
                style={{ fontSize: `${fontSize}px`, lineHeight: 2.3 }}
              >
                {pageData.map(({ surah, verses }) => (
                  <div key={surah.id} className="inline">
                    {/* If first verse of surah is on this page and not Fatiha/Tawbah, show bismillah */}
                    {verses.some((v) => v.verse_number === 1) && surah.id !== 1 && surah.id !== 9 && (
                      <div className="w-full text-center my-3 py-1 block">
                        <span className="font-quran text-xl sm:text-2xl text-emerald-900 dark:text-emerald-300">
                          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                        </span>
                      </div>
                    )}
                    {verses.map((ayah) => {
                      const isActive = activeVerseKey === ayah.verse_key;
                      return (
                        <span
                          key={ayah.id}
                          onClick={() => handleAyahClick(surah, ayah)}
                          className={`cursor-pointer inline px-1 py-0.5 rounded-lg transition-all ${
                            isActive
                              ? 'bg-amber-200/80 dark:bg-amber-900/60 ring-2 ring-amber-500/60 font-semibold'
                              : 'hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40'
                          }`}
                        >
                          <span>{ayah.text_uthmani}</span>
                          <span className="inline-flex items-center justify-center mx-1 text-emerald-700 dark:text-emerald-400 select-none">
                            <span className="text-[0.75em] text-amber-700 dark:text-amber-400"> ﴿{toArabicNumeral(ayah.verse_number)}﴾ </span>
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Page Footer Navigation */}
              <div className="mt-8 pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => loadPage(currentPage - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                  <span>الصفحة السابقة</span>
                </button>

                <div className="text-center font-bold text-sm text-emerald-700 dark:text-emerald-400">
                  {toArabicNumeral(currentPage)}
                </div>

                <button
                  disabled={currentPage >= 604}
                  onClick={() => loadPage(currentPage + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 disabled:opacity-30"
                >
                  <span>الصفحة التالية</span>
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* AYAH ACTION BOTTOM SHEET */}
      {selectedAyah && selectedAyahSurah && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-300">
                  سورة {selectedAyahSurah.name_arabic}
                </h3>
                <span className="text-xs text-stone-500">
                  الآية {toArabicNumeral(selectedAyah.verse_number)} · صفحة {toArabicNumeral(selectedAyah.page_number)} · الجزء {toArabicNumeral(selectedAyah.juz_number)}
                </span>
              </div>
              <button
                onClick={() => setSelectedAyah(null)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Ayah Text Card */}
            <div className="my-4 p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 text-right">
              <p className="font-quran text-lg leading-relaxed text-stone-900 dark:text-stone-100">
                ﴿{selectedAyah.text_uthmani}﴾
              </p>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {/* Play Single Minshawi */}
              <button
                onClick={() => handlePlayMinshawi(1)}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm active:scale-98 transition-all"
              >
                <Volume2 size={18} />
                <span>تلاوة الشيخ المنشاوي</span>
              </button>

              {/* Repeat 3x */}
              <button
                onClick={() => handlePlayMinshawi(3)}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm active:scale-98 transition-all"
              >
                <RotateCcw size={18} />
                <span>تكرار ٣ مرات</span>
              </button>

              {/* Flexible Memorization Range Picker */}
              <div className="col-span-2 bg-stone-50 dark:bg-stone-800/80 p-3 rounded-2xl border border-stone-200 dark:border-stone-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Brain size={16} className="text-emerald-600" />
                    <span>حفظ ذكي حر (بدءاً من الآية {toArabicNumeral(selectedAyah.verse_number)}):</span>
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    اختر ما تشاء
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      if (onStartMemorize) {
                        onStartMemorize(
                          selectedAyahSurah.id,
                          selectedAyah.verse_number,
                          selectedAyah.verse_number
                        );
                      }
                      setSelectedAyah(null);
                    }}
                    className="py-2 px-1 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all text-center"
                  >
                    آية واحدة
                  </button>

                  <button
                    onClick={() => {
                      if (onStartMemorize) {
                        onStartMemorize(
                          selectedAyahSurah.id,
                          selectedAyah.verse_number,
                          Math.min(selectedAyah.verse_number + 2, selectedAyahSurah.verses_count)
                        );
                      }
                      setSelectedAyah(null);
                    }}
                    className="py-2 px-1 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all text-center"
                  >
                    ٣ آيات
                  </button>

                  <button
                    onClick={() => {
                      if (onStartMemorize) {
                        onStartMemorize(
                          selectedAyahSurah.id,
                          selectedAyah.verse_number,
                          Math.min(selectedAyah.verse_number + 4, selectedAyahSurah.verses_count)
                        );
                      }
                      setSelectedAyah(null);
                    }}
                    className="py-2 px-1 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all text-center"
                  >
                    ٥ آيات
                  </button>

                  <button
                    onClick={() => {
                      if (onStartMemorize) {
                        onStartMemorize(
                          selectedAyahSurah.id,
                          selectedAyah.verse_number,
                          selectedAyahSurah.verses_count
                        );
                      }
                      setSelectedAyah(null);
                    }}
                    className="py-2 px-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all text-center shadow-xs"
                  >
                    نهاية السورة
                  </button>
                </div>
              </div>

              {/* Samma'ani Voice */}
              <button
                onClick={() => {
                  if (onStartSammaani) {
                    onStartSammaani(selectedAyahSurah.id, selectedAyah.verse_number, selectedAyah.verse_number);
                  }
                  setSelectedAyah(null);
                }}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-800 dark:text-amber-300 font-semibold text-sm active:scale-98 transition-all"
              >
                <Mic size={18} />
                <span>🎙️ سمّعني الآية</span>
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-3">
              <button
                onClick={handleToggleBookmark}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all ${
                  isBookmarked
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <BookmarkIcon size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
                <span>{isBookmarked ? 'محفوظة في الفهرس' : 'إضافة علامة'}</span>
              </button>

              <button
                onClick={handleCopyAyah}
                className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-2 rounded-xl transition-all"
              >
                {copiedKey === selectedAyah.verse_key ? (
                  <>
                    <Check size={16} className="text-emerald-600" />
                    <span className="text-emerald-600 font-bold">تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>نسخ الآية</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION SELECTOR MODAL (Surah / Juz / Page) */}
      {isNavOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-300">
                فهرس المصحف الشريف
              </h3>
              <button
                onClick={() => setIsNavOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-around bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl my-3 text-sm font-semibold">
              <button
                onClick={() => setNavTab('surah')}
                className={`flex-1 py-1.5 rounded-xl transition-all ${
                  navTab === 'surah' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
                }`}
              >
                السور (١١٤)
              </button>
              <button
                onClick={() => setNavTab('juz')}
                className={`flex-1 py-1.5 rounded-xl transition-all ${
                  navTab === 'juz' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
                }`}
              >
                الأجزاء (٣٠)
              </button>
              <button
                onClick={() => setNavTab('page')}
                className={`flex-1 py-1.5 rounded-xl transition-all ${
                  navTab === 'page' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
                }`}
              >
                الصفحات (٦٠٤)
              </button>
            </div>

            {/* Search Input for Surahs */}
            {navTab === 'surah' && (
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="ابحث عن اسم السورة..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-2xl px-10 py-2 text-sm text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500"
                />
                <Search size={16} className="absolute right-3 top-3 text-stone-400" />
              </div>
            )}

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto pr-1">
              {/* SURAHS LIST */}
              {navTab === 'surah' && (
                <div className="space-y-1.5">
                  {surahsList
                    .filter((s) => s.name_arabic.includes(searchFilter) || s.name_simple.toLowerCase().includes(searchFilter.toLowerCase()))
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSurahSelect(s.id)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-stone-100 dark:border-stone-800/80 transition-all text-right"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xs font-bold font-cairo">
                            {toArabicNumeral(s.id)}
                          </span>
                          <div>
                            <span className="font-bold text-base text-stone-900 dark:text-stone-100 block">
                              سورة {s.name_arabic}
                            </span>
                            <span className="text-xs text-stone-500">
                              {s.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} · {toArabicNumeral(s.verses_count)} آية
                            </span>
                          </div>
                        </div>

                        <div className="text-left text-xs text-stone-400">
                          <span>صفحة {toArabicNumeral(s.start_page)}</span>
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {/* JUZ LIST */}
              {navTab === 'juz' && (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
                    <button
                      key={juz}
                      onClick={() => handleJuzSelect(juz)}
                      className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 border border-stone-200 dark:border-stone-700/60 text-center font-bold text-sm text-stone-800 dark:text-stone-200 transition-all"
                    >
                      <span>الجزء {toArabicNumeral(juz)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* PAGES GRID */}
              {navTab === 'page' && (
                <div>
                  <div className="text-xs text-stone-500 mb-2">اختر الصفحة (من ١ إلى ٦٠٤):</div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                    {Array.from({ length: 604 }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePageSelect(p)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all ${
                          currentPage === p
                            ? 'bg-emerald-700 text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                        }`}
                      >
                        {toArabicNumeral(p)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
