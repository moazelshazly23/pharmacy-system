import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { BottomNavigation, TabType } from './components/layout/BottomNavigation';
import { HomeDashboard } from './components/home/HomeDashboard';
import { MushafReader } from './components/mushaf/MushafReader';
import { SmartMemorizationView } from './components/memorization/SmartMemorizationView';
import { AthkarView } from './components/athkar/AthkarView';
import { TasbihView } from './components/tasbih/TasbihView';
import { QuranSearchView } from './components/search/QuranSearchView';
import { ReviewQueueView } from './components/review/ReviewQueueView';
import { StatsView } from './components/stats/StatsView';
import { SettingsView } from './components/settings/SettingsView';
import { AudioPlayerBar } from './components/audio/AudioPlayerBar';
import { SammaaniModal } from './components/voice/SammaaniModal';
import { AndroidInfoModal } from './components/native/AndroidInfoModal';
import { dbService } from './services/db';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [moreSubView, setMoreSubView] = useState<'menu' | 'tasbih' | 'search' | 'review' | 'stats' | 'settings'>('menu');

  // Navigation targets
  const [mushafTarget, setMushafTarget] = useState<{ surahId?: number; verseNumber?: number; pageNumber?: number }>({
    surahId: 1,
    verseNumber: 1,
  });

  const [memorizeTarget, setMemorizeTarget] = useState<{ surahId: number; fromVerse: number; toVerse: number }>({
    surahId: 67,
    fromVerse: 1,
    toVerse: 30, // Default to full Surah (open range)
  });

  const [sammaaniTarget, setSammaaniTarget] = useState<{
    isOpen: boolean;
    surahId: number;
    fromVerse: number;
    toVerse: number;
  }>({
    isOpen: false,
    surahId: 67,
    fromVerse: 1,
    toVerse: 5,
  });

  const [isAndroidInfoOpen, setIsAndroidInfoOpen] = useState(false);
  const [kidsMode, setKidsMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'sepia'>('light');

  const applyTheme = (settings: { theme: 'light' | 'dark' | 'sepia'; auto_night_mode?: boolean; mushaf_contrast?: string }) => {
    let mode: 'light' | 'dark' | 'sepia' = settings.theme || 'light';
    if (settings.auto_night_mode) {
      const hour = new Date().getHours();
      if (hour >= 18 || hour < 6) {
        mode = 'dark';
      }
    }
    setCurrentTheme(mode);

    const html = document.documentElement;
    html.classList.remove('dark', 'theme-sepia', 'theme-light');
    if (mode === 'dark') {
      html.classList.add('dark');
    } else if (mode === 'sepia') {
      html.classList.add('theme-sepia');
    } else {
      html.classList.add('theme-light');
    }
  };

  const refreshSettings = () => {
    dbService.getUserSettings().then((s) => {
      setKidsMode(s.kids_mode);
      applyTheme(s);
    });
  };

  useEffect(() => {
    refreshSettings();
    const interval = setInterval(refreshSettings, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleStartMemorize = (surahId: number, fromVerse: number, toVerse: number) => {
    setMemorizeTarget({ surahId, fromVerse, toVerse });
    setActiveTab('memorize');
  };

  const handleOpenMushaf = (surahId?: number, verseNumber?: number, pageNumber?: number) => {
    setMushafTarget({ surahId, verseNumber, pageNumber });
    setActiveTab('mushaf');
  };

  const handleOpenSammaani = (surahId: number, fromVerse: number, toVerse: number) => {
    setSammaaniTarget({ isOpen: true, surahId, fromVerse, toVerse });
  };

  const handleKidsModeToggle = (enabled: boolean) => {
    setKidsMode(enabled);
  };

  const handleSwitchTheme = async (newTheme: 'light' | 'dark' | 'sepia') => {
    setCurrentTheme(newTheme);
    const settings = await dbService.getUserSettings();
    const updated = { ...settings, theme: newTheme, auto_night_mode: false };
    await dbService.saveUserSettings(updated);
    applyTheme(updated);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        currentTheme === 'sepia'
          ? 'bg-[#f4ecd8] text-[#2b1f13] font-cairo'
          : currentTheme === 'dark'
          ? 'bg-[#0c120f] text-[#f3f4f6] font-cairo'
          : kidsMode
          ? 'bg-amber-50/40 text-stone-900 font-cairo'
          : 'bg-stone-50 text-stone-900 font-cairo'
      }`}
    >
      {/* Universal Top Bar with Theme Controls on Every Single Page */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-3 sm:px-4 py-2 transition-colors">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & Current Section */}
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-sm sm:text-base text-emerald-900 dark:text-emerald-400 font-cairo">
                حافظ القرآن
              </span>
              <span className="text-[11px] text-stone-400 font-bold hidden sm:inline">
                • {activeTab === 'home' ? 'الرئيسية' : activeTab === 'mushaf' ? 'المصحف الشريف' : activeTab === 'memorize' ? 'الحفظ الذكي' : activeTab === 'athkar' ? 'الأذكار' : 'المزيد'}
              </span>
            </div>
          </div>

          {/* Universal Theme Switcher: Light, Dark, Sepia */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs">
            <button
              onClick={() => handleSwitchTheme('light')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all ${
                currentTheme === 'light'
                  ? 'bg-white text-stone-950 shadow-xs ring-1 ring-amber-400'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
              title="الوضع الفاتح"
            >
              <Sun size={14} className="text-amber-500" />
              <span className="text-[11px]">فاتح</span>
            </button>

            <button
              onClick={() => handleSwitchTheme('dark')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all ${
                currentTheme === 'dark'
                  ? 'bg-emerald-950 text-emerald-200 shadow-xs ring-1 ring-emerald-500'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
              title="الوضع الليلي"
            >
              <Moon size={14} className="text-indigo-400" />
              <span className="text-[11px]">ليلي</span>
            </button>

            <button
              onClick={() => handleSwitchTheme('sepia')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all ${
                currentTheme === 'sepia'
                  ? 'bg-[#dfceaf] text-[#2c1d11] shadow-xs ring-1 ring-amber-700'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
              title="ورق سيبيا تراثي"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9b48f] inline-block" />
              <span className="text-[11px]">سيبيا</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'home' && (
        <HomeDashboard
          onStartMemorize={handleStartMemorize}
          onOpenMushaf={handleOpenMushaf}
          onOpenAthkar={() => setActiveTab('athkar')}
          onOpenTasbih={() => {
            setActiveTab('more');
            setMoreSubView('tasbih');
          }}
          onOpenReview={() => {
            setActiveTab('more');
            setMoreSubView('review');
          }}
          onOpenSearch={() => {
            setActiveTab('more');
            setMoreSubView('search');
          }}
          onOpenStats={() => {
            setActiveTab('more');
            setMoreSubView('stats');
          }}
          onOpenSammaani={handleOpenSammaani}
          kidsMode={kidsMode}
        />
      )}

      {activeTab === 'mushaf' && (
        <MushafReader
          initialSurahId={mushafTarget.surahId || 1}
          initialVerseNumber={mushafTarget.verseNumber || 1}
          initialPageNumber={mushafTarget.pageNumber}
          currentTheme={currentTheme}
          onThemeChange={handleSwitchTheme}
          onStartMemorize={handleStartMemorize}
          onStartSammaani={handleOpenSammaani}
        />
      )}

      {activeTab === 'memorize' && (
        <SmartMemorizationView
          initialSurahId={memorizeTarget.surahId}
          initialFromVerse={memorizeTarget.fromVerse}
          initialToVerse={memorizeTarget.toVerse}
          onFinish={() => setActiveTab('home')}
          kidsMode={kidsMode}
        />
      )}

      {activeTab === 'athkar' && <AthkarView />}

      {activeTab === 'more' && (
        <div>
          {/* Subview Header with Back button if inside a tool */}
          {moreSubView !== 'menu' && (
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <button
                onClick={() => setMoreSubView('menu')}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl hover:bg-emerald-100"
              >
                <span>العودة لقائمة المزيد</span>
              </button>

              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">
                {moreSubView === 'tasbih' && 'المسبحة الإلكترونية'}
                {moreSubView === 'search' && 'البحث في القرآن الكريم'}
                {moreSubView === 'review' && 'المراجعة الذكية'}
                {moreSubView === 'stats' && 'إحصائيات الحفظ'}
                {moreSubView === 'settings' && 'الإعدادات وفحص السلامة'}
              </span>

              <div className="w-16" />
            </div>
          )}

          {/* Subviews */}
          {moreSubView === 'tasbih' && <TasbihView />}
          {moreSubView === 'search' && (
            <QuranSearchView
              onOpenAyah={(sId, vNum, pNum) => {
                handleOpenMushaf(sId, vNum, pNum);
              }}
            />
          )}
          {moreSubView === 'review' && <ReviewQueueView />}
          {moreSubView === 'stats' && (
            <StatsView
              onPracticeVerse={(sId, vNum) => {
                handleStartMemorize(sId, vNum, vNum);
              }}
            />
          )}
          {moreSubView === 'settings' && (
            <SettingsView
              onOpenAndroidInfo={() => setIsAndroidInfoOpen(true)}
              onKidsModeToggle={handleKidsModeToggle}
              onThemeChange={refreshSettings}
            />
          )}

          {/* More Main Menu */}
          {moreSubView === 'menu' && (
            <div className="max-w-xl mx-auto p-4 pb-32 space-y-3">
              <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 mb-2">
                <h2 className="font-bold text-lg text-emerald-900 dark:text-emerald-400 mb-1">
                  المزيد من الأدوات والخدمات
                </h2>
                <span className="text-xs text-stone-500">
                  جميع الأدوات تعمل دون الحاجة للاتصال بالإنترنت
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    id: 'tasbih',
                    title: 'المسبحة الإلكترونية',
                    desc: 'عداد تسبيح باللمس مع اهتزاز وحفظ الإجمالي محلياً',
                    icon: '📿',
                  },
                  {
                    id: 'search',
                    title: 'البحث الفوري في القرآن',
                    desc: 'بحث سريع في ٦٢٣٦ آية بدون تشكيل مع الانتقال المباشر',
                    icon: '🔍',
                  },
                  {
                    id: 'review',
                    title: 'المراجعة الذكية (Spaced Repetition)',
                    desc: 'جدول الآيات المستحقة للمراجعة لحفظ دائم لا يُنسى',
                    icon: '🔄',
                  },
                  {
                    id: 'stats',
                    title: 'لوحة الإحصائيات والإنجاز',
                    desc: 'تتبع السور المكتملة، نسبة الحفظ، وسلسلة الأيام',
                    icon: '📊',
                  },
                  {
                    id: 'settings',
                    title: 'الإعدادات وفحص سلامة النص القرآني',
                    desc: 'المظهر وراحة العين، فحص سلامة المصحف، والنسخ الاحتياطي',
                    icon: '⚙️',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMoreSubView(item.id as any)}
                    className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500 shadow-sm flex items-center justify-between text-right transition-all group"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-2xl p-2 rounded-2xl bg-stone-50 dark:bg-stone-800">
                        {item.icon}
                      </span>
                      <div>
                        <span className="font-bold text-sm text-stone-900 dark:text-stone-100 block group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                          {item.title}
                        </span>
                        <span className="text-xs text-stone-500">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Player Bar - Shown ONLY in Memorization tab per user specification */}
      {activeTab === 'memorize' && (
        <AudioPlayerBar
          onOpenSurah={(surahId, verseNumber) => {
            handleOpenMushaf(surahId, verseNumber);
          }}
        />
      )}

      {/* Sammaani Voice Assistant Modal */}
      {sammaaniTarget.isOpen && (
        <SammaaniModal
          surahId={sammaaniTarget.surahId}
          fromVerse={sammaaniTarget.fromVerse}
          toVerse={sammaaniTarget.toVerse}
          onClose={() => setSammaaniTarget({ ...sammaaniTarget, isOpen: false })}
        />
      )}

      {/* Android Native Info Modal */}
      {isAndroidInfoOpen && (
        <AndroidInfoModal onClose={() => setIsAndroidInfoOpen(false)} />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'more') setMoreSubView('menu');
        }}
        kidsMode={kidsMode}
      />
    </div>
  );
}
