package com.hafiz.quran.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "quran_surah")
data class QuranSurahEntity(
    @PrimaryKey val id: Int,
    val nameArabic: String,
    val nameSimple: String,
    val revelationPlace: String,
    val revelationOrder: Int,
    val versesCount: Int,
    val startPage: Int,
    val endPage: Int
)

@Entity(tableName = "quran_ayah")
data class QuranAyahEntity(
    @PrimaryKey val id: Int,
    val surahId: Int,
    val verseNumber: Int,
    val verseKey: String,
    val textUthmani: String,
    val pageNumber: Int,
    val juzNumber: Int,
    val hizbNumber: Int,
    val rubNumber: Int
)

@Entity(tableName = "memorization_progress")
data class MemorizationEntity(
    @PrimaryKey val verseKey: String, // "67:1"
    val surahId: Int,
    val verseNumber: Int,
    val masteryLevel: String, // new, learning, good, mastered, needs_review
    val repetitionsCount: Int,
    val easeFactor: Float,
    val intervalDays: Int,
    val nextReviewDate: Long, // timestamp
    val lastPracticedDate: Long
)

@Entity(tableName = "bookmarks")
data class BookmarkEntity(
    @PrimaryKey val id: String,
    val type: String,
    val surahId: Int,
    val verseNumber: Int?,
    val pageNumber: Int,
    val title: String,
    val createdAt: Long
)

@Entity(tableName = "dhikr_progress")
data class DhikrProgressEntity(
    @PrimaryKey val dhikrId: String,
    val categoryId: String,
    val count: Int,
    val totalDone: Int,
    val lastUpdated: Long
)
