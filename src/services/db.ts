import { Ayah, Bookmark, DailyGoal, LastReadPosition, MemorizationRecord, StreakInfo, Surah, UserSettings, WardTodayProgress } from '../types/quran';
import { SebhaRecord, HisnMuslimChapter } from '../types/dhikr';
import { HISN_MUSLIM_CHAPTERS } from '../data/hisnMuslimData';
import { quranService } from './quranService';

const DB_NAME = 'HafizAlQuranDB';
const DB_VERSION = 3;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  auto_night_mode: false,
  mushaf_contrast: 'high',
  font_family: 'amiri_quran',
  font_size: 26,
  reciter_id: 'minshawi',
  reciter_name: 'الشيخ محمد صديق المنشاوي',
  playback_speed: 1.0,
  verse_repeats: 3,
  range_repeats: 1,
  language: 'ar',
  kids_mode: false,
  haptic_feedback: true,
  auto_scroll: true,
};

export const DEFAULT_GOAL: DailyGoal = {
  verses_per_day: 5,
  target_surah_id: 67, // Surah Al-Mulk
  target_from_verse: 1,
  target_to_verse: 30,
  memorization_days: ['sat', 'sun', 'mon', 'tue', 'wed'],
  review_days: ['thu', 'fri'],
  reminder_time: '06:30',
};

class DatabaseManager {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryStore: Map<string, any> = new Map();

  constructor() {
    this.initDefaultMemory();
  }

  private initDefaultMemory() {
    this.memoryStore.set('settings:current', DEFAULT_SETTINGS);
    this.memoryStore.set('goals:current', DEFAULT_GOAL);
    this.memoryStore.set('bookmarks', []);
    this.memoryStore.set('memorization', []);
    this.memoryStore.set('sebha', []);
    this.memoryStore.set('hisn_chapters', HISN_MUSLIM_CHAPTERS);
    this.memoryStore.set('hisn_progress', {});
    this.memoryStore.set('hisn_favorites', []);
  }

  // Safe localStorage helper (doesn't crash if blocked in iframe)
  private getLocal(key: string): any {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem('hafiz_' + key);
        return item ? JSON.parse(item) : null;
      }
    } catch {
      // Storage blocked or quota exceeded
    }
    return this.memoryStore.get(key) || null;
  }

  private setLocal(key: string, value: any): void {
    this.memoryStore.set(key, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('hafiz_' + key, JSON.stringify(value));
      }
    } catch {
      // Storage blocked or quota exceeded
    }
  }

  private openDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        if (typeof window === 'undefined' || !window.indexedDB) {
          resolve(null);
          return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('memorization')) {
              db.createObjectStore('memorization', { keyPath: 'verse_key' });
            }
            if (!db.objectStoreNames.contains('bookmarks')) {
              db.createObjectStore('bookmarks', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('daily_goals')) {
              db.createObjectStore('daily_goals', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('ward_progress')) {
              db.createObjectStore('ward_progress', { keyPath: 'date' });
            }
            if (!db.objectStoreNames.contains('sebha_stats')) {
              db.createObjectStore('sebha_stats', { keyPath: 'dhikr_text' });
            }
            if (!db.objectStoreNames.contains('user_settings')) {
              db.createObjectStore('user_settings', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('sessions')) {
              db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('audio_cache')) {
              db.createObjectStore('audio_cache', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('hisn_muslim_chapters')) {
              db.createObjectStore('hisn_muslim_chapters', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('hisn_muslim_progress')) {
              db.createObjectStore('hisn_muslim_progress', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('hisn_muslim_favorites')) {
              db.createObjectStore('hisn_muslim_favorites', { keyPath: 'id' });
            }
          } catch {
            // Ignore upgrade errors
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  // --- Memorization Records (SM-2 Spaced Repetition) ---
  async getMemorizationRecord(verse_key: string): Promise<MemorizationRecord | null> {
    try {
      const db = await this.openDB();
      if (!db) {
        const list = this.getLocal('memorization') || [];
        return list.find((r: MemorizationRecord) => r.verse_key === verse_key) || null;
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('memorization', 'readonly');
          const store = tx.objectStore('memorization');
          const req = store.get(verse_key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  }

  async getAllMemorizationRecords(): Promise<MemorizationRecord[]> {
    try {
      const db = await this.openDB();
      if (!db) {
        return this.getLocal('memorization') || [];
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('memorization', 'readonly');
          const store = tx.objectStore('memorization');
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    } catch {
      return [];
    }
  }

  async saveMemorizationRecord(record: MemorizationRecord): Promise<void> {
    // Keep local fallback updated
    const list = this.getLocal('memorization') || [];
    const idx = list.findIndex((r: MemorizationRecord) => r.verse_key === record.verse_key);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    this.setLocal('memorization', list);
    await this.recordActivity();

    try {
      const db = await this.openDB();
      if (!db) return;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('memorization', 'readwrite');
          const store = tx.objectStore('memorization');
          store.put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignored
    }
  }

  async recordReviewAttempt(verse_key: string, surah_id: number, verse_number: number, quality: number): Promise<MemorizationRecord> {
    const existing = await this.getMemorizationRecord(verse_key);
    let repetitions = existing ? existing.repetitions_count : 0;
    let easeFactor = existing ? existing.ease_factor : 2.5;
    let intervalDays = existing ? existing.interval_days : 0;

    if (quality >= 3) {
      if (repetitions === 0) {
        intervalDays = 1;
      } else if (repetitions === 1) {
        intervalDays = 3;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      repetitions += 1;
    } else {
      repetitions = 0;
      intervalDays = 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    let masteryLevel: MemorizationRecord['mastery_level'] = 'learning';
    if (repetitions >= 4 && quality >= 4) {
      masteryLevel = 'mastered';
    } else if (repetitions >= 2) {
      masteryLevel = 'good';
    } else if (quality < 3) {
      masteryLevel = 'needs_review';
    }

    const record: MemorizationRecord = {
      verse_key,
      surah_id,
      verse_number,
      mastery_level: masteryLevel,
      repetitions_count: repetitions,
      ease_factor: Number(easeFactor.toFixed(2)),
      interval_days: intervalDays,
      next_review_date: nextDate.toISOString(),
      last_practiced_date: new Date().toISOString(),
    };

    await this.saveMemorizationRecord(record);
    return record;
  }

  // --- Bookmarks ---
  async getBookmarks(): Promise<Bookmark[]> {
    try {
      const db = await this.openDB();
      if (!db) return this.getLocal('bookmarks') || [];
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('bookmarks', 'readonly');
          const store = tx.objectStore('bookmarks');
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve(this.getLocal('bookmarks') || []);
        } catch {
          resolve(this.getLocal('bookmarks') || []);
        }
      });
    } catch {
      return this.getLocal('bookmarks') || [];
    }
  }

  async saveBookmark(bookmark: Bookmark): Promise<void> {
    const list = this.getLocal('bookmarks') || [];
    const idx = list.findIndex((b: Bookmark) => b.id === bookmark.id);
    if (idx >= 0) list[idx] = bookmark;
    else list.push(bookmark);
    this.setLocal('bookmarks', list);

    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('bookmarks', 'readwrite');
      tx.objectStore('bookmarks').put(bookmark);
    } catch {
      // Ignored
    }
  }

  async deleteBookmark(id: string): Promise<void> {
    const list = (this.getLocal('bookmarks') || []).filter((b: Bookmark) => b.id !== id);
    this.setLocal('bookmarks', list);

    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('bookmarks', 'readwrite');
      tx.objectStore('bookmarks').delete(id);
    } catch {
      // Ignored
    }
  }

  // --- Daily Goal & Ward Today ---
  async getDailyGoal(): Promise<DailyGoal> {
    try {
      const db = await this.openDB();
      if (!db) return this.getLocal('daily_goal') || DEFAULT_GOAL;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('daily_goals', 'readonly');
          const req = tx.objectStore('daily_goals').get('current');
          req.onsuccess = () => resolve(req.result?.goal || this.getLocal('daily_goal') || DEFAULT_GOAL);
          req.onerror = () => resolve(this.getLocal('daily_goal') || DEFAULT_GOAL);
        } catch {
          resolve(this.getLocal('daily_goal') || DEFAULT_GOAL);
        }
      });
    } catch {
      return this.getLocal('daily_goal') || DEFAULT_GOAL;
    }
  }

  async saveDailyGoal(goal: DailyGoal): Promise<void> {
    this.setLocal('daily_goal', goal);
    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('daily_goals', 'readwrite');
      tx.objectStore('daily_goals').put({ id: 'current', goal });
    } catch {
      // Ignored
    }
  }

  getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  async getTodayWardProgress(): Promise<WardTodayProgress> {
    const today = this.getTodayKey();
    const defaultProgress: WardTodayProgress = {
      date: today,
      verses_memorized: 0,
      verses_reviewed: 0,
      morning_athkar_done: false,
      evening_athkar_done: false,
      tasbih_count: 0,
      target_verses: 5,
      target_review: 10,
    };

    try {
      const db = await this.openDB();
      if (!db) return this.getLocal('ward_' + today) || defaultProgress;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('ward_progress', 'readonly');
          const req = tx.objectStore('ward_progress').get(today);
          req.onsuccess = () => resolve(req.result || this.getLocal('ward_' + today) || defaultProgress);
          req.onerror = () => resolve(this.getLocal('ward_' + today) || defaultProgress);
        } catch {
          resolve(this.getLocal('ward_' + today) || defaultProgress);
        }
      });
    } catch {
      return this.getLocal('ward_' + today) || defaultProgress;
    }
  }

  async saveTodayWardProgress(progress: WardTodayProgress): Promise<void> {
    this.setLocal('ward_' + progress.date, progress);
    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('ward_progress', 'readwrite');
      tx.objectStore('ward_progress').put(progress);
    } catch {
      // Ignored
    }
  }

  // --- Sebha Records ---
  async getSebhaRecords(): Promise<SebhaRecord[]> {
    try {
      const db = await this.openDB();
      if (!db) return this.getLocal('sebha') || [];
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('sebha_stats', 'readonly');
          const req = tx.objectStore('sebha_stats').getAll();
          req.onsuccess = () => resolve(req.result || this.getLocal('sebha') || []);
          req.onerror = () => resolve(this.getLocal('sebha') || []);
        } catch {
          resolve(this.getLocal('sebha') || []);
        }
      });
    } catch {
      return this.getLocal('sebha') || [];
    }
  }

  async saveSebhaRecord(record: SebhaRecord): Promise<void> {
    const list = this.getLocal('sebha') || [];
    const idx = list.findIndex((r: SebhaRecord) => r.dhikr_text === record.dhikr_text);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    this.setLocal('sebha', list);

    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('sebha_stats', 'readwrite');
      tx.objectStore('sebha_stats').put(record);
    } catch {
      // Ignored
    }
  }

  // --- Athkar Daily Progress & Read Records ---
  async getAthkarProgress(category: string, date?: string): Promise<{ [id: string]: number }> {
    const day = date || this.getTodayKey();
    const key = `athkar_${day}_${category}`;
    const data = this.getLocal(key);
    return data && typeof data === 'object' ? data : {};
  }

  async saveAthkarProgress(category: string, counts: { [id: string]: number }, date?: string): Promise<void> {
    const day = date || this.getTodayKey();
    const key = `athkar_${day}_${category}`;
    this.setLocal(key, counts);
  }

  async resetAthkarProgress(category: string, date?: string): Promise<void> {
    const day = date || this.getTodayKey();
    const key = `athkar_${day}_${category}`;
    this.setLocal(key, {});
  }

  // --- Last Read Position for Ward Continuity ---
  async getLastReadPosition(): Promise<LastReadPosition> {
    const defaultPos: LastReadPosition = {
      surah_id: 67,
      surah_name: 'المُلْك',
      verse_number: 1,
      page_number: 562,
      updated_at: new Date().toISOString(),
    };
    return this.getLocal('last_read_position') || defaultPos;
  }

  async saveLastReadPosition(pos: LastReadPosition): Promise<void> {
    this.setLocal('last_read_position', pos);
  }

  // --- Daily Streak Gamification ---
  private getYesterdayKey(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getStreak(): Promise<StreakInfo> {
    const defaultStreak: StreakInfo = {
      current_streak: 1,
      longest_streak: 1,
      last_active_date: this.getTodayKey(),
    };
    const saved = this.getLocal('user_streak');
    if (!saved) {
      this.setLocal('user_streak', defaultStreak);
      return defaultStreak;
    }

    const today = this.getTodayKey();
    const yesterday = this.getYesterdayKey();

    // If last active was before yesterday, the streak broke
    if (saved.last_active_date !== today && saved.last_active_date !== yesterday) {
      const resetStreak: StreakInfo = {
        current_streak: 0,
        longest_streak: Math.max(saved.longest_streak || 1, 1),
        last_active_date: saved.last_active_date,
      };
      return resetStreak;
    }

    return saved;
  }

  async recordActivity(): Promise<StreakInfo> {
    const today = this.getTodayKey();
    const yesterday = this.getYesterdayKey();
    const current = await this.getStreak();

    if (current.last_active_date === today && current.current_streak > 0) {
      return current; // already logged activity today
    }

    let nextStreak = 1;
    if (current.last_active_date === yesterday) {
      nextStreak = (current.current_streak || 0) + 1;
    } else if (current.last_active_date === today) {
      nextStreak = Math.max(current.current_streak, 1);
    }

    const updated: StreakInfo = {
      current_streak: nextStreak,
      longest_streak: Math.max(current.longest_streak || 1, nextStreak),
      last_active_date: today,
    };

    this.setLocal('user_streak', updated);
    return updated;
  }

  // --- Hisn al-Muslim Local Database Storage ---
  async getHisnMuslimProgress(chapterId: number, date?: string): Promise<{ [id: string]: number }> {
    const day = date || this.getTodayKey();
    const key = `hisn_${day}_ch_${chapterId}`;
    const data = this.getLocal(key);
    return data && typeof data === 'object' ? data : {};
  }

  async saveHisnMuslimProgress(chapterId: number, counts: { [id: string]: number }, date?: string): Promise<void> {
    const day = date || this.getTodayKey();
    const key = `hisn_${day}_ch_${chapterId}`;
    this.setLocal(key, counts);
    await this.recordActivity();
  }

  async resetHisnMuslimProgress(chapterId: number, date?: string): Promise<void> {
    const day = date || this.getTodayKey();
    const key = `hisn_${day}_ch_${chapterId}`;
    this.setLocal(key, {});
  }

  async getHisnMuslimFavorites(): Promise<string[]> {
    const favs = this.getLocal('hisn_favorites');
    return Array.isArray(favs) ? favs : [];
  }

  async toggleHisnMuslimFavorite(itemId: string): Promise<boolean> {
    const favs = await this.getHisnMuslimFavorites();
    const exists = favs.includes(itemId);
    const updated = exists ? favs.filter((id) => id !== itemId) : [...favs, itemId];
    this.setLocal('hisn_favorites', updated);
    return !exists;
  }

  // --- User Settings ---
  async getUserSettings(): Promise<UserSettings> {
    try {
      const db = await this.openDB();
      if (!db) return this.getLocal('settings') || DEFAULT_SETTINGS;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('user_settings', 'readonly');
          const req = tx.objectStore('user_settings').get('current');
          req.onsuccess = () => resolve(req.result?.settings || this.getLocal('settings') || DEFAULT_SETTINGS);
          req.onerror = () => resolve(this.getLocal('settings') || DEFAULT_SETTINGS);
        } catch {
          resolve(this.getLocal('settings') || DEFAULT_SETTINGS);
        }
      });
    } catch {
      return this.getLocal('settings') || DEFAULT_SETTINGS;
    }
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    this.setLocal('settings', settings);
    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('user_settings', 'readwrite');
      tx.objectStore('user_settings').put({ id: 'current', settings });
    } catch {
      // Ignored
    }
  }

  // --- Audio Cache ---
  async getCachedAudioBlob(key: string): Promise<Blob | null> {
    try {
      const db = await this.openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('audio_cache', 'readonly');
          const req = tx.objectStore('audio_cache').get(key);
          req.onsuccess = () => resolve(req.result ? req.result.blob : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  }

  async saveCachedAudioBlob(key: string, blob: Blob): Promise<void> {
    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction('audio_cache', 'readwrite');
      tx.objectStore('audio_cache').put({ key, blob, timestamp: Date.now() });
    } catch {
      // Ignored
    }
  }

  // --- Quran Verses & Room Integration ---
  async getVersesRange(surahId: number, fromVerse: number, toVerse: number): Promise<Ayah[]> {
    // 1. Android Room Native Bridge (if running inside Android WebView with Room exposed)
    if (typeof window !== 'undefined' && (window as any).AndroidRoom?.getVersesRange) {
      try {
        const json = (window as any).AndroidRoom.getVersesRange(surahId, fromVerse, toVerse);
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (err) {
        console.warn('Android Room bridge error, falling back to local database:', err);
      }
    }

    // 2. Local Database / Storage Query
    const surah = await quranService.getSurah(surahId);
    if (!surah || !Array.isArray(surah.verses)) {
      return [];
    }

    return surah.verses
      .filter((v) => v.verse_number >= fromVerse && v.verse_number <= toVerse)
      .sort((a, b) => a.verse_number - b.verse_number);
  }

  async getSurah(surahId: number): Promise<Surah | null> {
    if (typeof window !== 'undefined' && (window as any).AndroidRoom?.getSurah) {
      try {
        const json = (window as any).AndroidRoom.getSurah(surahId);
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        if (parsed) return parsed;
      } catch (err) {
        console.warn('Android Room bridge error:', err);
      }
    }
    return quranService.getSurah(surahId);
  }

  // --- Backup & Restore ---
  async exportFullBackup(): Promise<string> {
    const memorization = await this.getAllMemorizationRecords();
    const bookmarks = await this.getBookmarks();
    const goal = await this.getDailyGoal();
    const settings = await this.getUserSettings();
    const sebha = await this.getSebhaRecords();

    const backupData = {
      app: 'HafizAlQuran',
      version: 1,
      export_date: new Date().toISOString(),
      memorization,
      bookmarks,
      goal,
      settings,
      sebha,
    };

    return JSON.stringify(backupData, null, 2);
  }

  async importFullBackup(jsonContent: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const data = JSON.parse(jsonContent);
      if (data.app !== 'HafizAlQuran') {
        return { success: false, count: 0, error: 'الملف غير صالح أو ليس نسخة احتياطية لتطبيق حافظ القرآن' };
      }

      if (Array.isArray(data.memorization)) {
        for (const record of data.memorization) {
          if (record.verse_key) await this.saveMemorizationRecord(record);
        }
      }

      if (Array.isArray(data.bookmarks)) {
        for (const bm of data.bookmarks) {
          if (bm.id) await this.saveBookmark(bm);
        }
      }

      if (data.goal) {
        await this.saveDailyGoal(data.goal);
      }

      if (data.settings) {
        await this.saveUserSettings(data.settings);
      }

      if (Array.isArray(data.sebha)) {
        for (const s of data.sebha) {
          if (s.dhikr_text) await this.saveSebhaRecord(s);
        }
      }

      return { success: true, count: (data.memorization?.length || 0) + (data.bookmarks?.length || 0) };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'خطأ أثناء قراءة ملف النسخة الاحتياطية';
      return { success: false, count: 0, error: errorMsg };
    }
  }

  // --- Hisn al-Muslim (حصن المسلم كاملاً) Local Database & Offline Storage ---
  async seedHisnMuslimDatabase(): Promise<void> {
    try {
      const db = await this.openDB();
      this.setLocal('hisn_chapters', HISN_MUSLIM_CHAPTERS);
      if (!db) return;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_chapters', 'readwrite');
          const store = tx.objectStore('hisn_muslim_chapters');
          for (const ch of HISN_MUSLIM_CHAPTERS) {
            store.put(ch);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignored
    }
  }

  async getHisnMuslimChapters(): Promise<HisnMuslimChapter[]> {
    try {
      const db = await this.openDB();
      if (!db) {
        return this.getLocal('hisn_chapters') || HISN_MUSLIM_CHAPTERS;
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_chapters', 'readonly');
          const store = tx.objectStore('hisn_muslim_chapters');
          const req = store.getAll();
          req.onsuccess = () => {
            const res = req.result;
            if (res && res.length >= HISN_MUSLIM_CHAPTERS.length) {
              resolve(res);
            } else {
              this.seedHisnMuslimDatabase().then(() => resolve(HISN_MUSLIM_CHAPTERS));
            }
          };
          req.onerror = () => resolve(HISN_MUSLIM_CHAPTERS);
        } catch {
          resolve(HISN_MUSLIM_CHAPTERS);
        }
      });
    } catch {
      return HISN_MUSLIM_CHAPTERS;
    }
  }

  async getHisnMuslimChapterById(id: number): Promise<HisnMuslimChapter | null> {
    const all = await this.getHisnMuslimChapters();
    return all.find((c) => c.id === id) || null;
  }

  async getHisnChapterProgress(chapterId: number, date?: string): Promise<{ [itemId: string]: number }> {
    const day = date || this.getTodayKey();
    const progressKey = `hm_prog_${day}_${chapterId}`;
    try {
      const db = await this.openDB();
      if (!db) {
        const data = this.getLocal(progressKey);
        return data && typeof data === 'object' ? data : {};
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_progress', 'readonly');
          const store = tx.objectStore('hisn_muslim_progress');
          const req = store.get(progressKey);
          req.onsuccess = () => {
            if (req.result && req.result.counts) {
              resolve(req.result.counts);
            } else {
              const local = this.getLocal(progressKey);
              resolve(local && typeof local === 'object' ? local : {});
            }
          };
          req.onerror = () => {
            const local = this.getLocal(progressKey);
            resolve(local && typeof local === 'object' ? local : {});
          };
        } catch {
          const local = this.getLocal(progressKey);
          resolve(local && typeof local === 'object' ? local : {});
        }
      });
    } catch {
      const local = this.getLocal(progressKey);
      return local && typeof local === 'object' ? local : {};
    }
  }

  async saveHisnChapterProgress(chapterId: number, counts: { [itemId: string]: number }, date?: string): Promise<void> {
    const day = date || this.getTodayKey();
    const progressKey = `hm_prog_${day}_${chapterId}`;
    this.setLocal(progressKey, counts);
    await this.recordActivity();

    try {
      const db = await this.openDB();
      if (!db) return;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_progress', 'readwrite');
          const store = tx.objectStore('hisn_muslim_progress');
          store.put({ id: progressKey, chapterId, day, counts, updated_at: new Date().toISOString() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignored
    }
  }

  async resetHisnChapterProgress(chapterId: number, date?: string): Promise<void> {
    const day = date || this.getTodayKey();
    const progressKey = `hm_prog_${day}_${chapterId}`;
    this.setLocal(progressKey, {});
    try {
      const db = await this.openDB();
      if (!db) return;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_progress', 'readwrite');
          const store = tx.objectStore('hisn_muslim_progress');
          store.delete(progressKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignored
    }
  }

  async getAllHisnProgress(date?: string): Promise<{ [chapterId: number]: { [itemId: string]: number } }> {
    const chapters = await this.getHisnMuslimChapters();
    const result: { [chapterId: number]: { [itemId: string]: number } } = {};
    for (const ch of chapters) {
      result[ch.id] = await this.getHisnChapterProgress(ch.id, date);
    }
    return result;
  }

  async getHisnFavorites(): Promise<string[]> {
    try {
      const db = await this.openDB();
      if (!db) {
        return this.getLocal('hisn_favorites') || [];
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_favorites', 'readonly');
          const store = tx.objectStore('hisn_muslim_favorites');
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result ? req.result.map((r: any) => r.id) : [];
            resolve(list);
          };
          req.onerror = () => resolve(this.getLocal('hisn_favorites') || []);
        } catch {
          resolve(this.getLocal('hisn_favorites') || []);
        }
      });
    } catch {
      return this.getLocal('hisn_favorites') || [];
    }
  }

  async toggleHisnFavorite(itemId: string): Promise<boolean> {
    const current = await this.getHisnFavorites();
    const isFav = current.includes(itemId);
    const updated = isFav ? current.filter((id) => id !== itemId) : [...current, itemId];
    this.setLocal('hisn_favorites', updated);

    try {
      const db = await this.openDB();
      if (!db) return !isFav;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('hisn_muslim_favorites', 'readwrite');
          const store = tx.objectStore('hisn_muslim_favorites');
          if (isFav) {
            store.delete(itemId);
          } else {
            store.put({ id: itemId, created_at: new Date().toISOString() });
          }
          tx.oncomplete = () => resolve(!isFav);
          tx.onerror = () => resolve(!isFav);
        } catch {
          resolve(!isFav);
        }
      });
    } catch {
      return !isFav;
    }
  }
}

export const dbService = new DatabaseManager();
