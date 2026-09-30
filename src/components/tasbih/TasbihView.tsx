import React, { useState, useEffect } from 'react';
import { RotateCcw, Volume2, VolumeX, Sparkles, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { dbService } from '../../services/db';
import { toArabicNumeral } from '../../utils/arabic';

const DHIKR_FORMULAS = [
  'سُبْحَانَ اللَّهِ',
  'الْحَمْدُ لِلَّهِ',
  'اللَّهُ أَكْبَرُ',
  'لَا إِلَٰهَ إِلَّا اللَّهُ',
  'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
  'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ',
  'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
];

export const TasbihView: React.FC = () => {
  const [selectedDhikr, setSelectedDhikr] = useState<string>(DHIKR_FORMULAS[0]);
  const [targetCount, setTargetCount] = useState<number>(33);
  const [count, setCount] = useState<number>(0);
  const [lifetimeTotal, setLifetimeTotal] = useState<number>(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    loadDhikrStats(selectedDhikr);
  }, [selectedDhikr]);

  const loadDhikrStats = async (text: string) => {
    const records = await dbService.getSebhaRecords();
    const found = records.find((r) => r.dhikr_text === text);
    setLifetimeTotal(found ? found.count : 0);
    setCount(0);
  };

  const handleTap = async () => {
    const nextCount = count + 1;
    const nextLifetime = lifetimeTotal + 1;

    setCount(nextCount);
    setLifetimeTotal(nextLifetime);

    // Haptic vibration
    if (navigator.vibrate) {
      if (nextCount === targetCount) {
        navigator.vibrate([100, 50, 100, 50, 150]);
      } else {
        navigator.vibrate(30);
      }
    }

    // Save to database
    await dbService.saveSebhaRecord({
      dhikr_text: selectedDhikr,
      count: nextLifetime,
      last_updated: new Date().toISOString(),
    });

    // Update today's ward progress
    const today = await dbService.getTodayWardProgress();
    today.tasbih_count += 1;
    await dbService.saveTodayWardProgress(today);

    // If target reached, celebrate
    if (targetCount > 0 && nextCount === targetCount) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    }
  };

  const handleReset = () => {
    setCount(0);
  };

  const progressPct = targetCount > 0 ? Math.min(100, (count / targetCount) * 100) : 100;

  return (
    <div className="max-w-md mx-auto p-4 pb-32">
      {/* Formula Selector Carousel */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800 mb-4">
        <label className="text-xs text-stone-500 block mb-2 font-bold">صيغة الذكر:</label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {DHIKR_FORMULAS.map((formula, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDhikr(formula)}
              className={`py-2 px-3.5 rounded-2xl text-xs font-quran whitespace-nowrap transition-all border ${
                selectedDhikr === formula
                  ? 'bg-emerald-800 text-white border-emerald-700 shadow-md font-bold'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
            >
              {formula}
            </button>
          ))}
        </div>
      </div>

      {/* Target presets & Sound toggle */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-500 font-semibold">الهدف:</span>
          {[33, 100, 1000, 0].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTargetCount(t);
                setCount(0);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                targetCount === t
                  ? 'bg-amber-500 text-stone-900 shadow-xs'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
              }`}
            >
              {t === 0 ? 'حر' : toArabicNumeral(t)}
            </button>
          ))}
        </div>

        <button
          onClick={handleReset}
          className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700"
          title="تصفير العداد الحالي"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Big Tactile Electronic Tasbih Disc */}
      <div className="relative flex flex-col items-center justify-center my-6">
        <button
          onClick={handleTap}
          className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-gradient-to-b from-emerald-800 to-emerald-950 text-white shadow-2xl flex flex-col items-center justify-center p-6 border-8 border-emerald-700/60 active:scale-95 transition-all select-none focus:outline-hidden"
        >
          {/* Circular progress stroke ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="50%"
              cy="50%"
              r="46%"
              className="stroke-emerald-900/50"
              strokeWidth="6"
              fill="transparent"
            />
            {targetCount > 0 && (
              <circle
                cx="50%"
                cy="50%"
                r="46%"
                className="stroke-amber-400 transition-all duration-150"
                strokeWidth="6"
                strokeDasharray="290"
                strokeDashoffset={290 - (290 * progressPct) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            )}
          </svg>

          {/* Current formula */}
          <span className="font-quran text-lg text-emerald-200 mb-2 text-center max-w-[200px] leading-relaxed">
            {selectedDhikr}
          </span>

          {/* Big Digital Count */}
          <span className="font-cairo font-black text-5xl sm:text-6xl text-amber-300 tracking-tight my-1">
            {toArabicNumeral(count)}
          </span>

          {/* Target footer */}
          <span className="text-xs text-emerald-300/80 font-cairo">
            {targetCount > 0
              ? `من ${toArabicNumeral(targetCount)}`
              : 'تسبيح مفتوح'}
          </span>
        </button>
      </div>

      {/* Lifetime stats card */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-sm border border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
            <Award size={20} />
          </div>
          <div>
            <span className="text-xs text-stone-500 block">إجمالي التسبيح بهذه الصيغة:</span>
            <span className="font-bold text-base text-stone-800 dark:text-stone-200">
              {toArabicNumeral(lifetimeTotal)} تسبيحة
            </span>
          </div>
        </div>

        <div className="text-left text-xs text-emerald-600 dark:text-emerald-400 font-bold">
          مخزن محلياً
        </div>
      </div>
    </div>
  );
};
