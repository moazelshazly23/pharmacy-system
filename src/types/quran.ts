export interface Ayah {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  page_number: number;
  juz_number: number;
  hizb_number: number;
  rub_number: number;
}

export interface Surah {
  id: number;
  name_arabic: string;
  name_simple: string;
  revelation_place: 'makkah' | 'madinah' | string;
  revelation_order: number;
  bismillah_pre: boolean;
  verses_count: number;
  pages: [number, number];
  verses: Ayah[];
}

export interface SurahSummary {
  id: number;
  name_arabic: string;
  name_simple: string;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  verses_count: number;
  pages: [number, number];
  start_page: number;
  end_page: number;
  start_juz: number;
  end_juz: number;
}

export type MasteryLevel = 'new' | 'learning' | 'good' | 'mastered' | 'needs_review';

export interface MemorizationRecord {
  verse_key: string; // e.g. "67:1"
  surah_id: number;
  verse_number: number;
  mastery_level: MasteryLevel;
  repetitions_count: number;
  ease_factor: number; // SM-2 interval ease
  interval_days: number;
  next_review_date: string; // ISO date string
  last_practiced_date: string;
  notes?: string;
}

export interface Bookmark {
  id: string;
  type: 'ayah' | 'page' | 'ward';
  surah_id: number;
  verse_number?: number;
  page_number: number;
  title: string;
  created_at: string;
}

export interface DailyGoal {
  verses_per_day: number;
  target_surah_id: number;
  target_from_verse: number;
  target_to_verse: number;
  memorization_days: string[]; // ['sat', 'sun', ...]
  review_days: string[];
  reminder_time: string; // "07:00"
}

export interface WardTodayProgress {
  date: string;
  verses_memorized: number;
  verses_reviewed: number;
  morning_athkar_done: boolean;
  evening_athkar_done: boolean;
  tasbih_count: number;
  target_verses: number;
  target_review: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'sepia';
  auto_night_mode?: boolean;
  mushaf_contrast?: 'standard' | 'high' | 'ultra_sharp';
  font_family: 'amiri_quran' | 'scheherazade' | 'amiri';
  font_size: number; // e.g. 26
  reciter_id: string; // "minshawi" | "husary" | "abdulbasit"
  reciter_name: string;
  playback_speed: number;
  verse_repeats: number;
  range_repeats: number;
  language: 'ar' | 'en';
  kids_mode: boolean;
  haptic_feedback: boolean;
  auto_scroll: boolean;
}

export interface LastReadPosition {
  surah_id: number;
  surah_name: string;
  verse_number: number;
  page_number?: number;
  updated_at: string;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_active_date: string; // YYYY-MM-DD
}
