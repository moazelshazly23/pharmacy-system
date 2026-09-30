import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Repeat, Gauge, HardDriveDownload } from 'lucide-react';
import { audioService, AudioPlaybackState } from '../../services/audioService';

interface Props {
  onOpenSurah?: (surahId: number, verseNumber: number) => void;
}

export const AudioPlayerBar: React.FC<Props> = ({ onOpenSurah }) => {
  const [state, setState] = useState<AudioPlaybackState>(audioService.getState());

  useEffect(() => {
    return audioService.subscribe((newState) => {
      setState({ ...newState });
    });
  }, []);

  if (!state.currentSurahId || !state.currentVerseNumber) {
    return null;
  }

  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleToggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const currentIdx = speeds.indexOf(state.playbackSpeed);
    const nextIdx = currentIdx !== -1 ? (currentIdx + 1) % speeds.length : 0;
    audioService.setPlaybackSpeed(speeds[nextIdx]);
  };

  const handleToggleRepeats = () => {
    const repeats = [1, 2, 3, 5, 10];
    const nextIdx = (repeats.indexOf(state.targetRepeats) + 1) % repeats.length;
    audioService.setTargetRepeats(repeats[nextIdx]);
  };

  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 px-3 pb-1">
      <div className="max-w-lg mx-auto bg-stone-900/95 dark:bg-stone-900/95 text-stone-100 rounded-2xl shadow-xl backdrop-blur-md border border-emerald-900/40 p-2.5 transition-all">
        {/* Progress track */}
        <div
          className="w-full bg-stone-800 rounded-full h-1 mb-2 cursor-pointer relative overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            audioService.seek(pct * state.duration);
          }}
        >
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Track Info */}
          <div
            className="flex-1 min-w-0 cursor-pointer text-right"
            onClick={() => onOpenSurah && state.currentSurahId && state.currentVerseNumber && onOpenSurah(state.currentSurahId, state.currentVerseNumber)}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-emerald-400 truncate">
                {state.surahName}
              </span>
              <span className="text-xs text-stone-400">
                · الآية {state.currentVerseNumber}
              </span>
              {state.isOfflineCached && (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded-full border border-emerald-800">
                  <HardDriveDownload size={10} />
                  <span>محلي</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-stone-400 flex items-center gap-2">
              <span>الشيخ محمد صديق المنشاوي</span>
              <span>•</span>
              <span>{formatTime(state.currentTime)} / {formatTime(state.duration)}</span>
            </div>
          </div>

          {/* Quick Repeat & Speed badges */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleRepeats}
              title="عدد مرات تكرار الآية"
              className="px-1.5 py-1 text-[11px] rounded-lg bg-stone-800 text-stone-300 hover:text-emerald-400 flex items-center gap-1"
            >
              <Repeat size={12} />
              <span>{state.currentRepeatCount}/{state.targetRepeats}</span>
            </button>

            <button
              onClick={handleToggleSpeed}
              title="سرعة التلاوة (1x / 1.25x / 1.5x / 2x)"
              className="px-1.5 py-1 text-[11px] rounded-lg bg-stone-800 text-stone-300 hover:text-emerald-400 flex items-center gap-0.5 cursor-pointer"
            >
              <Gauge size={12} />
              <span>{state.playbackSpeed}x</span>
            </button>
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => audioService.prevVerse()}
              className="p-1.5 text-stone-300 hover:text-white rounded-lg active:scale-95"
              title="الآية السابقة"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={() => audioService.togglePlayPause()}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full active:scale-95 shadow-md flex items-center justify-center"
              title={state.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {state.isBuffering ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : state.isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="mr-0.5" />
              )}
            </button>

            <button
              onClick={() => audioService.nextVerse()}
              className="p-1.5 text-stone-300 hover:text-white rounded-lg active:scale-95"
              title="الآية التالية"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={() => audioService.stop()}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl active:scale-90 transition-all mr-1 cursor-pointer"
              title="إيقاف التلاوة وإغلاق الشريط"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
