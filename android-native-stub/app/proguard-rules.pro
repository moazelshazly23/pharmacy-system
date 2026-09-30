# ProGuard rules for Hafiz Al-Quran Android App

# Keep Room Database schemas and DAOs
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Keep Media3 ExoPlayer classes
-keep class androidx.media3.** { *; }

# Keep Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Keep Models
-keep class com.hafiz.quran.data.local.entities.** { *; }
