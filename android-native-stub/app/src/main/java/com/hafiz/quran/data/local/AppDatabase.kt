package com.hafiz.quran.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.hafiz.quran.data.local.dao.QuranDao
import com.hafiz.quran.data.local.entities.*

@Database(
    entities = [
        QuranSurahEntity::class,
        QuranAyahEntity::class,
        MemorizationEntity::class,
        BookmarkEntity::class,
        DhikrProgressEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun quranDao(): QuranDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "hafiz_quran_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
