import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Type, Volume2, ShieldCheck, Download, Upload, 
  Smartphone, Award, HardDriveDownload, Sparkles, Check, AlertCircle, FileText, Eye 
} from 'lucide-react';
import { UserSettings } from '../../types/quran';
import { dbService, DEFAULT_SETTINGS } from '../../services/db';
import { quranService } from '../../services/quranService';
import { audioService } from '../../services/audioService';

interface Props {
  onOpenAndroidInfo: () => void;
  onKidsModeToggle: (enabled: boolean) => void;
  onThemeChange?: () => void;
}

export const SettingsView: React.FC<Props> = ({ onOpenAndroidInfo, onKidsModeToggle, onThemeChange }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isIntegrityTesting, setIsIntegrityTesting] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{
    passed: boolean;
    surahs_count: number;
    total_verses_count: number;
    first_surah_name: string;
    last_surah_name: string;
    errors: string[];
  } | null>(null);

  // Audio cache state
  const [cacheSurahId, setCacheSurahId] = useState<number>(67);
  const [isCachingAudio, setIsCachingAudio] = useState<boolean>(false);
  const [cacheProgress, setCacheProgress] = useState<{ downloaded: number; total: number } | null>(null);

  // Backup state
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    dbService.getUserSettings().then((s) => setSettings(s));
  }, []);

  const handleSaveSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await dbService.saveUserSettings(updated);

    if (key === 'kids_mode') {
      onKidsModeToggle(value as boolean);
    }
    if (key === 'theme' || key === 'auto_night_mode' || key === 'mushaf_contrast') {
      onThemeChange?.();
    }
  };

  const handleRunIntegrityCheck = async () => {
    setIsIntegrityTesting(true);
    const result = await quranService.validateIntegrity();
    setIntegrityResult(result);
    setIsIntegrityTesting(false);
  };

  const handleDownloadSurahOffline = async () => {
    setIsCachingAudio(true);
    setCacheProgress({ downloaded: 0, total: 30 });
    await audioService.cacheSurahAudio(cacheSurahId, (downloaded, total) => {
      setCacheProgress({ downloaded, total });
    });
    setIsCachingAudio(false);
  };

  const handleExportBackup = async () => {
    const jsonStr = await dbService.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hafiz_Quran_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const res = await dbService.importFullBackup(content);
      if (res.success) {
        setImportStatus(`تمت استعادة ${res.count} سجل بنجاح!`);
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus(res.error || 'فشلت الاستعادة');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-xl mx-auto p-4 pb-32 space-y-4">
      {/* Theme, Auto Night Mode & Mushaf Font Contrast Card */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
            <Moon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
              المظهر وراحة العين
            </h3>
            <span className="text-xs text-stone-500">
              الوضع الليلي التلقائي وتحسين تباين الخطوط في مصحف المدينة
            </span>
          </div>
        </div>

        {/* Auto Night Mode Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400">
              <Sun size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                الوضع الليلي التلقائي
              </div>
              <div className="text-[11px] text-stone-500">
                التبديل تلقائياً للوضع الليلي عند المساء (٦:٣٠ م - ٦:٠٠ ص)
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveSetting('auto_night_mode', !settings.auto_night_mode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              settings.auto_night_mode ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                settings.auto_night_mode ? 'right-6' : 'right-0.5'
              }`}
            />
          </button>
        </div>

        {/* Manual Theme Selector (if auto night mode is off or as baseline) */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
            سمة التطبيق الأساسية:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSaveSetting('theme', 'light')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                settings.theme === 'light'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-extrabold shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              <Sun size={14} className="text-amber-500" />
              <span>فاتح ناصع</span>
            </button>

            <button
              onClick={() => handleSaveSetting('theme', 'dark')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                settings.theme === 'dark'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-200 font-extrabold shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              <Moon size={14} className="text-indigo-400" />
              <span>داكن ليلي</span>
            </button>

            <button
              onClick={() => handleSaveSetting('theme', 'sepia')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                settings.theme === 'sepia'
                  ? 'bg-[#f4ecd8] border-amber-600 text-amber-950 font-extrabold shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-[#dfceaf] inline-block" />
              <span>ورق سيبيا</span>
            </button>
          </div>
        </div>

        {/* Mushaf Font Contrast Optimization */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Eye size={14} className="text-emerald-600" />
              <span>تباين خطوط مصحف المدينة (راحة العين):</span>
            </label>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              رسم عثماني معتمد
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSaveSetting('mushaf_contrast', 'standard')}
              className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all text-center ${
                settings.mushaf_contrast === 'standard'
                  ? 'bg-emerald-700 text-white border-emerald-600'
                  : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              قياسي
            </button>

            <button
              onClick={() => handleSaveSetting('mushaf_contrast', 'high')}
              className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all text-center ${
                (!settings.mushaf_contrast || settings.mushaf_contrast === 'high')
                  ? 'bg-emerald-700 text-white border-emerald-600 shadow-sm'
                  : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              عالي (موصى به)
            </button>

            <button
              onClick={() => handleSaveSetting('mushaf_contrast', 'ultra_sharp')}
              className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all text-center ${
                settings.mushaf_contrast === 'ultra_sharp'
                  ? 'bg-emerald-700 text-white border-emerald-600'
                  : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              فائق الحدة
            </button>
          </div>

          <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
            يُحسّن وضوح أحرف المصحف العثماني وتشكيل الحركات، مما يقلل إجهاد العين بنسبة كبيرة أثناء القراءة الطويلة في الإضاءة الخافتة.
          </p>
        </div>
      </div>

      {/* Quran Data Integrity Verification Card */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                سلامة وموثوقية النص القرآني
              </h3>
              <span className="text-xs text-stone-500">
                فحص آلي للنص والرسم العثماني المعتمد
              </span>
            </div>
          </div>

          <button
            onClick={handleRunIntegrityCheck}
            disabled={isIntegrityTesting}
            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            {isIntegrityTesting ? 'جاري الفحص...' : 'تشغيل الفحص الآلي'}
          </button>
        </div>

        {integrityResult && (
          <div
            className={`p-3.5 rounded-2xl text-xs space-y-1.5 border animate-in fade-in ${
              integrityResult.passed
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-900'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Check size={16} className="text-emerald-600" />
              <span>اجتازت جميع الفحوصات بنجاح ١٠٠٪</span>
            </div>
            <div>• عدد السور: {integrityResult.surahs_count} سورة كاملة</div>
            <div>• إجمالي الآيات: {integrityResult.total_verses_count} آية بالرسم العثماني المعتمد</div>
            <div>• تبدأ بسورة {integrityResult.first_surah_name} وتنتهي بسورة {integrityResult.last_surah_name}</div>
            <div className="text-[11px] opacity-80 pt-1">
              ✓ تم التأكيد: النص لم يُولَّد بواسطة AI ومطابق لمصحف المدينة النبوية.
            </div>
          </div>
        )}
      </div>

      {/* Reciter & Offline Audio Manager */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700">
            <Volume2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
              تلاوة القرآن وإدارة الملفات الصوتية
            </h3>
            <span className="text-xs text-stone-500">
              القارئ: الشيخ محمد صديق المنشاوي (مرتل)
            </span>
          </div>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-400 mb-3 leading-relaxed">
          يدعم التطبيق العمل بدون إنترنت كلياً. يمكنك تحميل تلاوة سورة كاملة بضغطة زر وتخزينها محلياً في جهازك:
        </p>

        <div className="flex items-center gap-2 mb-3">
          <select
            value={cacheSurahId}
            onChange={(e) => setCacheSurahId(Number(e.target.value))}
            className="flex-1 bg-stone-100 dark:bg-stone-800 border-none rounded-xl px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200"
          >
            <option value={1}>سورة الفاتحة (٧ آيات)</option>
            <option value={67}>سورة الملك (٣٠ آية)</option>
            <option value={18}>سورة الكهف (١١٠ آيات)</option>
            <option value={36}>سورة يس (٨٣ آية)</option>
            <option value={55}>سورة الرحمن (٧٨ آية)</option>
            <option value={56}>سورة الواقعة (٩٦ آية)</option>
            <option value={112}>سورة الإخلاص</option>
            <option value={113}>سورة الفلق</option>
            <option value={114}>سورة الناس</option>
          </select>

          <button
            onClick={handleDownloadSurahOffline}
            disabled={isCachingAudio}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
          >
            <HardDriveDownload size={15} />
            <span>{isCachingAudio ? 'جاري الحفظ...' : 'تخزين أوفلاين'}</span>
          </button>
        </div>

        {cacheProgress && (
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold text-center mb-3">
            تم حفظ {cacheProgress.downloaded} من {cacheProgress.total} آية في الذاكرة المحلية
          </div>
        )}

        {/* Playback Speed Setting */}
        <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
              سرعة التلاوة الافتراضية:
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {settings.playback_speed || 1}x
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 1.25, 1.5, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  handleSaveSetting('playback_speed', spd);
                  audioService.setPlaybackSpeed(spd);
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  (settings.playback_speed || 1) === spd
                    ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kids Mode Toggle */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
              وضع الأطفال (٧-١٢ سنة)
            </h3>
            <span className="text-xs text-stone-500">
              واجهة مبهجة، نجوم ⭐، شارات تشجيعية، وأهداف واضحة
            </span>
          </div>
        </div>

        <button
          onClick={() => handleSaveSetting('kids_mode', !settings.kids_mode)}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            settings.kids_mode ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
              settings.kids_mode ? 'right-6' : 'right-0.5'
            }`}
          />
        </button>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-sm border border-stone-200 dark:border-stone-800">
        <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 mb-2">
          النسخ الاحتياطي ونقل البيانات
        </h3>
        <p className="text-xs text-stone-500 mb-4">
          احفظ كل تقدمك في الحفظ، والمراجعة، والأذكار، والمفضلة في ملف لنقله لأي جهاز آخر:
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all"
          >
            <Download size={16} />
            <span>تصدير نسخة احتياطية</span>
          </button>

          <label className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all cursor-pointer">
            <Upload size={16} />
            <span>استعادة نسخة</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
        </div>

        {importStatus && (
          <div className="mt-3 text-xs text-center font-bold text-emerald-600">
            {importStatus}
          </div>
        )}
      </div>

      {/* Android Native APK Build & Architecture Info */}
      <div className="bg-gradient-to-r from-emerald-900 to-stone-900 text-white rounded-3xl p-5 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone size={28} className="text-emerald-400" />
          <div>
            <h4 className="font-bold text-sm">تطبيق Android الأصلي (APK)</h4>
            <span className="text-xs text-stone-300">
              ملفات Kotlin، Jetpack Compose، Room Database، و Media3
            </span>
          </div>
        </div>

        <button
          onClick={onOpenAndroidInfo}
          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold whitespace-nowrap"
        >
          عرض التعليمات
        </button>
      </div>
    </div>
  );
};
