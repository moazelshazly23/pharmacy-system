import React, { useState } from 'react';
import { Search, BookOpen, Volume2, ArrowRight, X } from 'lucide-react';
import { quranService } from '../../services/quranService';
import { audioService } from '../../services/audioService';
import { toArabicNumeral } from '../../utils/arabic';

interface Props {
  onOpenAyah: (surahId: number, verseNumber: number, pageNumber: number) => void;
}

export const QuranSearchView: React.FC<Props> = ({ onOpenAyah }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    {
      surah_id: number;
      surah_name: string;
      verse_number: number;
      verse_key: string;
      page_number: number;
      juz_number: number;
      text_uthmani: string;
    }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const res = await quranService.searchQuran(text, 60);
    setResults(res);
    setIsSearching(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 pb-32">
      {/* Search Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="ابحث في آيات القرآن الكريم (بدون الحاجة للحركات)..."
            className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-2xl pr-11 pl-10 py-3 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-emerald-600"
            autoFocus
          />
          <Search size={18} className="absolute right-4 top-3.5 text-stone-400" />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="absolute left-3 top-3 text-stone-400 hover:text-stone-600 p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto pt-3 text-xs">
          <span className="text-stone-400 py-1 font-semibold whitespace-nowrap">مقترحات:</span>
          {['الرحمن', 'الصابرين', 'الجنة', 'المتقين', 'قل هو الله أحد', 'النور'].map((sug) => (
            <button
              key={sug}
              onClick={() => handleSearch(sug)}
              className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 whitespace-nowrap"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      {query && (
        <div className="flex items-center justify-between text-xs text-stone-500 mb-3 px-2">
          <span>نتائج البحث عن «{query}»</span>
          <span>{toArabicNumeral(results.length)} موضع في القرآن الكريم</span>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-3">
        {results.map((res) => (
          <div
            key={res.verse_key}
            onClick={() => onOpenAyah(res.surah_id, res.verse_number, res.page_number)}
            className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500 shadow-sm transition-all cursor-pointer text-right group"
          >
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
              <span className="font-bold text-emerald-800 dark:text-emerald-400">
                سورة {res.surah_name} · الآية {toArabicNumeral(res.verse_number)}
              </span>
              <span>
                صفحة {toArabicNumeral(res.page_number)} · الجزء {toArabicNumeral(res.juz_number)}
              </span>
            </div>

            <p className="font-quran text-lg leading-relaxed text-stone-900 dark:text-stone-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
              ﴿{res.text_uthmani}﴾
            </p>

            <div className="flex items-center justify-end gap-3 mt-3 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-400 group-hover:text-emerald-600">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  audioService.playVerse(res.surah_id, res.verse_number);
                }}
                className="flex items-center gap-1 hover:text-emerald-700"
              >
                <Volume2 size={14} />
                <span>استماع</span>
              </button>
              <div className="flex items-center gap-1 font-bold">
                <span>فتح في المصحف</span>
                <ArrowRight size={14} className="rotate-180" />
              </div>
            </div>
          </div>
        ))}

        {query && results.length === 0 && !isSearching && (
          <div className="text-center py-12 text-stone-400">
            <Search size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">لم يتم العثور على نتائج لكلمة «{query}»</p>
            <span className="text-xs text-stone-500">تأكد من كتابة الكلمة بشكل صحيح</span>
          </div>
        )}
      </div>
    </div>
  );
};
