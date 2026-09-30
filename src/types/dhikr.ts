export interface DhikrItem {
  id: string;
  category_id: string;
  text: string;
  count: number;
  virtue?: string; // فضل الذكر
  source?: string; // المصدر (صحيح البخاري، مسلم، إلخ)
  audio_url?: string;
}

export interface DhikrCategory {
  id: string;
  title_ar: string;
  title_en: string;
  icon: string;
  items: DhikrItem[];
}

export interface SebhaRecord {
  dhikr_text: string;
  count: number;
  last_updated: string;
}

export interface HisnMuslimChapter {
  id: number;
  title: string;
  category: string;
  items: DhikrItem[];
}
