import React, { useState } from 'react';
import { X, Smartphone, Download, Check, Terminal, Layers, Database, Music } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const AndroidInfoModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'build' | 'room' | 'audio' | 'pwa'>('build');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                بناء تطبيق Android Native (APK Release & Debug)
              </h3>
              <span className="text-xs text-stone-500">
                Kotlin · Jetpack Compose · Room Database · Android Media3
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-around bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl my-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('build')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'build' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
            }`}
          >
            أوامر بناء APK
          </button>
          <button
            onClick={() => setActiveTab('room')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'room' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
            }`}
          >
            Room Database
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'audio' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
            }`}
          >
            محرك الصوت Media3
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'pwa' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-stone-500'
            }`}
          >
            تثبيت PWA WebAPK
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto pr-1 text-xs text-stone-700 dark:text-stone-300 space-y-3">
          {/* BUILD TAB */}
          {activeTab === 'build' && (
            <div className="space-y-3">
              <p className="leading-relaxed">
                تم تجهيز شفرة تطبيق Android Native الكاملة (Kotlin + Jetpack Compose) في مجلد <code>/android/</code> داخل المشروع. يمكنك بناء كل من <strong>Debug APK</strong> و <strong>Release APK</strong> بسهولة:
              </p>

              <div className="p-3 bg-stone-900 text-emerald-400 font-mono rounded-2xl relative">
                <div className="text-[11px] text-stone-400 mb-1"># بناء Debug APK:</div>
                <code>./gradlew assembleDebug</code>
                <div className="text-[11px] text-stone-400 mt-2 mb-1"># بناء Release APK (Signed):</div>
                <code>./gradlew assembleRelease</code>
                <button
                  onClick={() => copyText('./gradlew assembleDebug && ./gradlew assembleRelease', 'build_cmd')}
                  className="absolute left-2 top-2 p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white"
                >
                  {copiedCode === 'build_cmd' ? <Check size={14} className="text-emerald-400" /> : 'نسخ'}
                </button>
              </div>

              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">مسار مخرجات ملفات الـ APK:</div>
                <div>• Debug APK: <code>app/build/outputs/apk/debug/app-debug.apk</code></div>
                <div>• Release APK: <code>app/build/outputs/apk/release/app-release-unsigned.apk</code></div>
              </div>
            </div>
          )}

          {/* ROOM DATABASE TAB */}
          {activeTab === 'room' && (
            <div className="space-y-2">
              <p className="leading-relaxed">
                مخطط قاعدة بيانات Room المحلية متطابق تماماً مع متطلبات التخزين المحلي Offline:
              </p>
              <div className="p-3 bg-stone-900 text-stone-200 font-mono rounded-2xl text-[11px] overflow-x-auto leading-relaxed">
                <pre>{`@Entity(tableName = "quran_ayah")
data class QuranAyahEntity(
    @PrimaryKey val id: Int,
    val surahId: Int,
    val verseNumber: Int,
    val textUthmani: String,
    val pageNumber: Int,
    val juzNumber: Int,
    val hizbNumber: Int
)

@Entity(tableName = "memorization_progress")
data class MemorizationEntity(
    @PrimaryKey val verseKey: String, // "67:1"
    val masteryLevel: String, // new, learning, good, mastered
    val easeFactor: Float,
    val repetitions: Int,
    val intervalDays: Int,
    val nextReviewDate: Long
)`}</pre>
              </div>
            </div>
          )}

          {/* MEDIA3 AUDIO TAB */}
          {activeTab === 'audio' && (
            <div className="space-y-2">
              <p className="leading-relaxed">
                يستخدم التطبيق مكتبة <code>androidx.media3:media3-exoplayer</code> مع <code>MediaSessionService</code> للتشغيل في الخلفية والشاشة مقفلة (Lock Screen & Background Playback).
              </p>
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-1">
                <div className="font-bold text-amber-800 dark:text-amber-300">إضافة ملفات التلاوة المصرح بها:</div>
                <p>
                  ضع ملفات MP3 لـ Sheikh Minshawi في مجلد <code>app/src/main/assets/audio/minshawi/</code> بصيغة <code>001001.mp3</code> (سورة 1 آية 1). وسيقوم مشغل ExoPlayer بتشغيلها مباشرة من الـ Assets أوفلاين دون إنترنت.
                </p>
              </div>
            </div>
          )}

          {/* PWA WEBAPK TAB */}
          {activeTab === 'pwa' && (
            <div className="space-y-2">
              <p className="leading-relaxed">
                التطبيق مجهّز كـ <strong>Progressive Web App (PWA / WebAPK)</strong> متكامل، حيث يمكن تثبيته كأيقونة تطبيق مستقلة على شاشة هواتف Android عبر متصفح Chrome:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-2xl">
                <li>افتح رابط التطبيق في هاتف Android.</li>
                <li>اضغط على قائمة المتصفح (⋮).</li>
                <li>اختر <strong>«تثبيت التطبيق»</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
                <li>يتم إنشاء تطبيق Native WebAPK مستقل يعمل بالكامل بدون إنترنت عبر Service Worker!</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
