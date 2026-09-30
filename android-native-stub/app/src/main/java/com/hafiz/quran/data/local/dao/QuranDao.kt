package com.hafiz.quran.data.local.dao

import androidx.room.*
import com.hafiz.quran.data.local.entities.*
import kotlinx.coroutines.flow.Flow

@Dao
interface QuranDao {
    @Query("SELECT * FROM quran_surah ORDER BY id ASC")
    fun getAllSurahs(): Flow<List<QuranSurahEntity>>

    @Query("SELECT * FROM quran_ayah WHERE surahId = :surahId ORDER BY verseNumber ASC")
    fun getVersesBySurah(surahId: Int): Flow<List<QuranAyahEntity>>

    @Query("SELECT * FROM quran_ayah WHERE surahId = :surahId AND verseNumber BETWEEN :fromVerse AND :toVerse ORDER BY verseNumber ASC")
    fun getVersesRange(surahId: Int, fromVerse: Int, toVerse: Int): Flow<List<QuranAyahEntity>>

    @Query("SELECT * FROM quran_ayah WHERE surahId = :surahId AND verseNumber BETWEEN :fromVerse AND :toVerse ORDER BY verseNumber ASC")
    suspend fun getVersesRangeList(surahId: Int, fromVerse: Int, toVerse: Int): List<QuranAyahEntity>

    @Query("SELECT * FROM quran_ayah WHERE pageNumber = :pageNumber ORDER BY id ASC")
    fun getVersesByPage(pageNumber: Int): Flow<List<QuranAyahEntity>>

    @Query("SELECT * FROM quran_ayah WHERE juzNumber = :juzNumber ORDER BY id ASC")
    fun getVersesByJuz(juzNumber: Int): Flow<List<QuranAyahEntity>>

    @Query("SELECT * FROM quran_ayah WHERE textUthmani LIKE '%' || :query || '%' LIMIT 50")
    suspend fun searchQuran(query: String): List<QuranAyahEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSurahs(surahs: List<QuranSurahEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAyahs(ayahs: List<QuranAyahEntity>)

    // Memorization Progress
    @Query("SELECT * FROM memorization_progress")
    fun getAllMemorization(): Flow<List<MemorizationEntity>>

    @Query("SELECT * FROM memorization_progress WHERE nextReviewDate <= :currentTime OR masteryLevel = 'needs_review'")
    suspend fun getDueReviews(currentTime: Long): List<MemorizationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveMemorization(record: MemorizationEntity)

    // Bookmarks
    @Query("SELECT * FROM bookmarks ORDER BY createdAt DESC")
    fun getBookmarks(): Flow<List<BookmarkEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBookmark(bookmark: BookmarkEntity)

    @Delete
    suspend fun deleteBookmark(bookmark: BookmarkEntity)
}
