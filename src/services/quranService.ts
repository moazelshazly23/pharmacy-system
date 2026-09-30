import { Ayah, Surah, SurahSummary } from '../types/quran';

class QuranService {
  private fullQuranCache: Surah[] | null = null;
  private surahsSummaryCache: SurahSummary[] | null = null;
  private loadingPromise: Promise<Surah[]> | null = null;

  async loadAllQuran(): Promise<Surah[]> {
    if (this.fullQuranCache) return this.fullQuranCache;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = fetch('/data/quran_full.json')
      .then((res) => {
        if (!res.ok) throw new Error('فشل تحميل بيانات القرآن الكريم');
        return res.json();
      })
      .then((data: Surah[]) => {
        this.fullQuranCache = data;
        return data;
      })
      .catch((err) => {
        console.error('Error loading quran_full.json:', err);
        return [];
      });

    return this.loadingPromise;
  }

  async getSurahsSummary(): Promise<SurahSummary[]> {
    if (this.surahsSummaryCache) return this.surahsSummaryCache;

    try {
      const res = await fetch('/data/surahs_summary.json');
      if (res.ok) {
        const data = await res.json();
        this.surahsSummaryCache = data;
        return data;
      }
    } catch {
      // Fallback to full quran
    }

    const full = await this.loadAllQuran();
    this.surahsSummaryCache = full.map((s) => ({
      id: s.id,
      name_arabic: s.name_arabic,
      name_simple: s.name_simple,
      revelation_place: s.revelation_place,
      revelation_order: s.revelation_order,
      bismillah_pre: s.bismillah_pre,
      verses_count: s.verses_count,
      pages: s.pages,
      start_page: s.pages[0],
      end_page: s.pages[1],
      start_juz: s.verses[0]?.juz_number || 1,
      end_juz: s.verses[s.verses.length - 1]?.juz_number || 30,
    }));

    return this.surahsSummaryCache;
  }

  async getSurah(id: number): Promise<Surah | null> {
    const all = await this.loadAllQuran();
    return all.find((s) => s.id === id) || null;
  }

  async getAyah(surahId: number, verseNumber: number): Promise<Ayah | null> {
    const surah = await this.getSurah(surahId);
    if (!surah) return null;
    return surah.verses.find((v) => v.verse_number === verseNumber) || null;
  }

  async getAyahsRange(surahId: number, fromVerse: number, toVerse: number): Promise<Ayah[]> {
    const surah = await this.getSurah(surahId);
    if (!surah) return [];
    return surah.verses.filter((v) => v.verse_number >= fromVerse && v.verse_number <= toVerse);
  }

  async getPageVerses(pageNumber: number): Promise<{ surah: Surah; verses: Ayah[] }[]> {
    const all = await this.loadAllQuran();
    const result: { surah: Surah; verses: Ayah[] }[] = [];

    for (const s of all) {
      const pageVerses = s.verses.filter((v) => v.page_number === pageNumber);
      if (pageVerses.length > 0) {
        result.push({ surah: s, verses: pageVerses });
      }
    }

    return result;
  }

  async getJuzVerses(juzNumber: number): Promise<{ surah: Surah; verses: Ayah[] }[]> {
    const all = await this.loadAllQuran();
    const result: { surah: Surah; verses: Ayah[] }[] = [];

    for (const s of all) {
      const juzVerses = s.verses.filter((v) => v.juz_number === juzNumber);
      if (juzVerses.length > 0) {
        result.push({ surah: s, verses: juzVerses });
      }
    }

    return result;
  }

  async getHizbVerses(hizbNumber: number): Promise<{ surah: Surah; verses: Ayah[] }[]> {
    const all = await this.loadAllQuran();
    const result: { surah: Surah; verses: Ayah[] }[] = [];

    for (const s of all) {
      const hizbVerses = s.verses.filter((v) => v.hizb_number === hizbNumber);
      if (hizbVerses.length > 0) {
        result.push({ surah: s, verses: hizbVerses });
      }
    }

    return result;
  }

  // Normalize Arabic text for diacritic-insensitive search & speech comparison
  normalizeArabicText(text: string): string {
    if (!text) return '';
    return text
      // Remove all Arabic diacritical marks (Tashkeel, Sukun, Shaddah, Tanween, Superscript Alif)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      // Standardize Alef variations (أ, إ, آ, ٱ -> ا)
      .replace(/[أإآٱ]/g, 'ا')
      // Standardize Taa Marbuta (ة -> ه)
      .replace(/ة/g, 'ه')
      // Standardize Alif Maqsura (ى -> ي)
      .replace(/ى/g, 'ي')
      // Remove Tatweel/Kashida (ـ)
      .replace(/ـ/g, '')
      // Clean extra spaces & punctuation
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟؛،«»"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Fast offline search across all 6236 verses
  async searchQuran(query: string, maxResults = 50): Promise<{
    surah_id: number;
    surah_name: string;
    verse_number: number;
    verse_key: string;
    page_number: number;
    juz_number: number;
    text_uthmani: string;
    highlighted_match: string;
  }[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const normQuery = this.normalizeArabicText(trimmed);
    if (!normQuery) return [];

    const all = await this.loadAllQuran();
    const results: {
      surah_id: number;
      surah_name: string;
      verse_number: number;
      verse_key: string;
      page_number: number;
      juz_number: number;
      text_uthmani: string;
      highlighted_match: string;
    }[] = [];

    for (const surah of all) {
      for (const ayah of surah.verses) {
        const normVerse = this.normalizeArabicText(ayah.text_uthmani);
        const matchIndex = normVerse.indexOf(normQuery);

        if (matchIndex !== -1) {
          results.push({
            surah_id: surah.id,
            surah_name: surah.name_arabic,
            verse_number: ayah.verse_number,
            verse_key: ayah.verse_key,
            page_number: ayah.page_number,
            juz_number: ayah.juz_number,
            text_uthmani: ayah.text_uthmani,
            highlighted_match: ayah.text_uthmani,
          });

          if (results.length >= maxResults) {
            return results;
          }
        }
      }
    }

    return results;
  }

  // Automated integrity verification check
  async validateIntegrity(): Promise<{
    passed: boolean;
    surahs_count: number;
    total_verses_count: number;
    first_surah_name: string;
    last_surah_name: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    const all = await this.loadAllQuran();

    if (all.length !== 114) {
      errors.push(`عدد السور غير صحيح: ${all.length} سورة (المطلوب 114)`);
    }

    const totalVerses = all.reduce((sum, s) => sum + s.verses.length, 0);
    if (totalVerses !== 6236) {
      errors.push(`إجمالي عدد الآيات غير صحيح: ${totalVerses} آية (المطلوب 6236)`);
    }

    // Verify Surah 1 (Al-Fatiha) = 7 verses
    if (all[0]?.verses.length !== 7) {
      errors.push(`سورة الفاتحة يجب أن تكون 7 آيات، وجدت ${all[0]?.verses.length}`);
    }

    // Verify Surah 2 (Al-Baqarah) = 286 verses
    if (all[1]?.verses.length !== 286) {
      errors.push(`سورة البقرة يجب أن تكون 286 آية، وجدت ${all[1]?.verses.length}`);
    }

    // Verify Surah 114 (An-Nas) = 6 verses
    if (all[113]?.verses.length !== 6) {
      errors.push(`سورة الناس يجب أن تكون 6 آيات، وجدت ${all[113]?.verses.length}`);
    }

    // Verify ordering
    for (let i = 0; i < all.length; i++) {
      if (all[i].id !== i + 1) {
        errors.push(`خطأ في ترتيب السورة رقم ${i + 1}`);
      }
    }

    return {
      passed: errors.length === 0,
      surahs_count: all.length,
      total_verses_count: totalVerses,
      first_surah_name: all[0]?.name_arabic || '',
      last_surah_name: all[113]?.name_arabic || '',
      errors,
    };
  }
}

export const quranService = new QuranService();
