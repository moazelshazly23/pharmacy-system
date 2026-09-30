import { dbService } from './db';
import { quranService } from './quranService';

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentSurahId: number | null;
  currentVerseNumber: number | null;
  currentVerseKey: string | null;
  surahName: string | null;
  playbackSpeed: number;
  currentRepeatCount: number;
  targetRepeats: number;
  fromVerse: number | null;
  toVerse: number | null;
  duration: number;
  currentTime: number;
  isBuffering: boolean;
  isOfflineCached: boolean;
}

type StateListener = (state: AudioPlaybackState) => void;

class AudioService {
  private audio: HTMLAudioElement | null = null;
  private listeners: Set<StateListener> = new Set();

  private state: AudioPlaybackState = {
    isPlaying: false,
    currentSurahId: null,
    currentVerseNumber: null,
    currentVerseKey: null,
    surahName: null,
    playbackSpeed: 1.0,
    currentRepeatCount: 1,
    targetRepeats: 1,
    fromVerse: null,
    toVerse: null,
    duration: 0,
    currentTime: 0,
    isBuffering: false,
    isOfflineCached: false,
  };

  private currentBlobUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.setupAudioListeners();
      this.setupMediaSession();
    }
  }

  private setupAudioListeners() {
    if (!this.audio) return;

    this.audio.onplay = () => {
      this.updateState({ isPlaying: true, isBuffering: false });
    };

    this.audio.onpause = () => {
      this.updateState({ isPlaying: false });
    };

    this.audio.onwaiting = () => {
      this.updateState({ isBuffering: true });
    };

    this.audio.onplaying = () => {
      if (this.audio) {
        this.audio.playbackRate = this.state.playbackSpeed;
      }
      this.updateState({ isBuffering: false, isPlaying: true });
    };

    this.audio.ontimeupdate = () => {
      if (this.audio) {
        this.updateState({
          currentTime: this.audio.currentTime,
          duration: this.audio.duration || 0,
        });
      }
    };

    this.audio.onended = () => {
      this.handleVerseEnded();
    };

    this.audio.onerror = (e) => {
      console.warn('Audio playback error:', e);
      this.updateState({ isPlaying: false, isBuffering: false });
    };
  }

  private updateState(partial: Partial<AudioPlaybackState>) {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public getState(): AudioPlaybackState {
    return this.state;
  }

  // Format numbers to 3 digits (e.g. 1 -> 001)
  private pad(num: number): string {
    return num.toString().padStart(3, '0');
  }

  public getAudioKey(surahId: number, verseNumber: number): string {
    return `minshawi_${this.pad(surahId)}${this.pad(verseNumber)}`;
  }

  // Audio Provider Abstraction
  // Checks Pre-bundled local MP3s -> IndexedDB Blob -> EveryAyah CDN (with auto-cache)
  public async getAudioSrc(surahId: number, verseNumber: number): Promise<{ url: string; isCached: boolean }> {
    const key = this.getAudioKey(surahId, verseNumber);
    const paddedSurah = this.pad(surahId);
    const paddedVerse = this.pad(verseNumber);

    // 1. Check Pre-bundled high quality local files (Surah 1, 67, 112, 114)
    const isBundled =
      (surahId === 1 && verseNumber <= 7) ||
      (surahId === 67 && verseNumber <= 30) ||
      (surahId === 112 && verseNumber <= 4) ||
      (surahId === 114 && verseNumber <= 6);

    if (isBundled) {
      return {
        url: `/audio/minshawi/${paddedSurah}${paddedVerse}.mp3`,
        isCached: true,
      };
    }

    // 2. Check IndexedDB cached blob
    try {
      const cachedBlob = await dbService.getCachedAudioBlob(key);
      if (cachedBlob) {
        if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = URL.createObjectURL(cachedBlob);
        return { url: this.currentBlobUrl, isCached: true };
      }
    } catch {
      // Storage unavailable, proceed to CDN
    }

    // 3. Fallback to EveryAyah Minshawi Murattal archive
    const remoteUrl = `https://everyayah.com/data/Minshawy_Murattal_128kbps/${paddedSurah}${paddedVerse}.mp3`;

    // Background fetch & save to IndexedDB cache for future offline capability
    this.cacheAudioInBackground(remoteUrl, key);

    return { url: remoteUrl, isCached: false };
  }

  private async cacheAudioInBackground(remoteUrl: string, key: string) {
    try {
      const res = await fetch(remoteUrl);
      if (res.ok) {
        const blob = await res.blob();
        await dbService.saveCachedAudioBlob(key, blob);
      }
    } catch {
      // If offline, fail silently
    }
  }

  public async playVerse(
    surahId: number,
    verseNumber: number,
    targetRepeats = 1,
    fromVerse: number | null = null,
    toVerse: number | null = null
  ) {
    if (!this.audio) return;

    const surah = await quranService.getSurah(surahId);
    const surahName = surah?.name_arabic || `سورة رقم ${surahId}`;
    const verseKey = `${surahId}:${verseNumber}`;

    const { url, isCached } = await this.getAudioSrc(surahId, verseNumber);

    this.audio.src = url;
    this.audio.playbackRate = this.state.playbackSpeed;

    this.updateState({
      currentSurahId: surahId,
      currentVerseNumber: verseNumber,
      currentVerseKey: verseKey,
      surahName,
      targetRepeats,
      currentRepeatCount: 1,
      fromVerse: fromVerse || verseNumber,
      toVerse: toVerse || (surah ? surah.verses_count : verseNumber),
      isOfflineCached: isCached,
      isBuffering: true,
    });

    try {
      await this.audio.play();
      this.updateMediaSessionMetadata(surahName, verseNumber);
    } catch (err) {
      console.warn('Playback error:', err);
      this.updateState({ isPlaying: false, isBuffering: false });
    }
  }

  private async handleVerseEnded() {
    // 1. Check if we should repeat this same verse
    if (this.state.currentRepeatCount < this.state.targetRepeats) {
      const nextRepeat = this.state.currentRepeatCount + 1;
      this.updateState({
        currentRepeatCount: nextRepeat,
      });
      if (this.audio) {
        this.audio.currentTime = 0;
        this.audio.playbackRate = this.state.playbackSpeed;
        try {
          await this.audio.play();
        } catch {
          setTimeout(() => this.audio?.play().catch(() => {}), 100);
        }
      }
      return;
    }

    // 2. All repetitions for current verse completed! Reset repeat counter
    this.updateState({ currentRepeatCount: 1 });

    // 3. Immediately advance to the next verse!
    if (this.state.currentSurahId && this.state.currentVerseNumber) {
      const current = this.state.currentVerseNumber;
      const surah = await quranService.getSurah(this.state.currentSurahId);
      const maxVerses = surah ? surah.verses_count : 30;
      const to = this.state.toVerse || maxVerses;

      if (current < to && current < maxVerses) {
        // Move to the next verse in range immediately
        await this.playVerse(
          this.state.currentSurahId,
          current + 1,
          this.state.targetRepeats,
          this.state.fromVerse,
          this.state.toVerse
        );
      } else {
        // Reached end of requested range or end of Surah
        this.updateState({ isPlaying: false, currentRepeatCount: 1 });
      }
    }
  }

  public async togglePlayPause() {
    if (!this.audio) return;

    if (this.state.isPlaying) {
      this.audio.pause();
    } else {
      if (this.state.currentSurahId && this.state.currentVerseNumber) {
        try {
          await this.audio.play();
        } catch {
          await this.playVerse(
            this.state.currentSurahId,
            this.state.currentVerseNumber,
            this.state.targetRepeats,
            this.state.fromVerse,
            this.state.toVerse
          );
        }
      }
    }
  }

  public pause() {
    if (this.audio && this.state.isPlaying) {
      this.audio.pause();
    }
  }

  public stop() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {
        // Ignore abort errors
      }
    }
    this.updateState({
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      currentSurahId: null,
      currentVerseNumber: null,
      currentVerseKey: null,
      surahName: '',
      currentRepeatCount: 1,
    });
  }

  public async nextVerse() {
    if (!this.state.currentSurahId || !this.state.currentVerseNumber) return;
    const surah = await quranService.getSurah(this.state.currentSurahId);
    if (!surah) return;

    if (this.state.currentVerseNumber < surah.verses_count) {
      await this.playVerse(
        this.state.currentSurahId,
        this.state.currentVerseNumber + 1,
        this.state.targetRepeats,
        this.state.fromVerse,
        this.state.toVerse
      );
    }
  }

  public async prevVerse() {
    if (!this.state.currentSurahId || !this.state.currentVerseNumber) return;

    if (this.state.currentVerseNumber > 1) {
      await this.playVerse(
        this.state.currentSurahId,
        this.state.currentVerseNumber - 1,
        this.state.targetRepeats,
        this.state.fromVerse,
        this.state.toVerse
      );
    }
  }

  public setPlaybackSpeed(speed: number) {
    if (this.audio) {
      this.audio.playbackRate = speed;
    }
    this.updateState({ playbackSpeed: speed });
  }

  public setTargetRepeats(repeats: number) {
    this.updateState({ targetRepeats: repeats });
  }

  public seek(seconds: number) {
    if (this.audio && Number.isFinite(seconds)) {
      this.audio.currentTime = seconds;
      this.updateState({ currentTime: seconds });
    }
  }

  // Import local user MP3 file into IndexedDB for 100% offline usage
  public async importUserAudioFile(surahId: number, verseNumber: number, file: File): Promise<boolean> {
    try {
      const key = this.getAudioKey(surahId, verseNumber);
      await dbService.saveCachedAudioBlob(key, file);
      return true;
    } catch (e) {
      console.error('Failed to import user audio file:', e);
      return false;
    }
  }

  // Pre-download complete Surah audio into IndexedDB for offline usage
  public async cacheSurahAudio(
    surahId: number,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<boolean> {
    const surah = await quranService.getSurah(surahId);
    if (!surah) return false;

    let count = 0;
    const total = surah.verses.length;

    for (const ayah of surah.verses) {
      const key = this.getAudioKey(surahId, ayah.verse_number);
      const exists = await dbService.getCachedAudioBlob(key);
      if (!exists) {
        try {
          const url = `https://everyayah.com/data/Minshawy_Murattal_128kbps/${this.pad(surahId)}${this.pad(ayah.verse_number)}.mp3`;
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            await dbService.saveCachedAudioBlob(key, blob);
          }
        } catch (e) {
          console.warn(`Failed to cache ayah ${ayah.verse_number}:`, e);
        }
      }
      count++;
      if (onProgress) onProgress(count, total);
    }

    return true;
  }

  // Android MediaSession API (Lock Screen & Notification Controls)
  private setupMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.togglePlayPause());
    } catch {}
    try {
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlayPause());
    } catch {}
    try {
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevVerse());
    } catch {}
    try {
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextVerse());
    } catch {}
    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
    } catch {}
  }

  private updateMediaSessionMetadata(surahName: string, verseNumber: number) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${surahName} - الآية ${verseNumber}`,
        artist: 'الشيخ محمد صديق المنشاوي (مرتل)',
        album: 'حافظ القرآن الكريم',
        artwork: [
          { src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      });
    } catch {
      // Ignore
    }
  }
}

export const audioService = new AudioService();
