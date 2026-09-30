package com.hafiz.quran.engine

import android.content.Context
import com.hafiz.quran.data.local.AppDatabase
import com.hafiz.quran.data.local.entities.QuranAyahEntity
import com.hafiz.quran.service.AudioPlaybackState
import com.hafiz.quran.service.AudioService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class MemorizationStage {
    LISTEN_AND_REPEAT,
    PROGRESSIVE_HIDE,
    FILL_IN_THE_BLANKS,
    REORDER_VERSES,
    SPACED_REVIEW,
    COMPLETED
}

data class MemorizationSessionState(
    val surahId: Int = 1,
    val fromVerse: Int = 1,
    val toVerse: Int = 7,
    val surahName: String = "",
    val verses: List<QuranAyahEntity> = emptyList(),
    val currentVerseIndex: Int = 0,
    val currentStage: MemorizationStage = MemorizationStage.LISTEN_AND_REPEAT,
    val isLoading: Boolean = true,
    val error: String? = null,
    val starsEarned: Int = 0,
    val hideLevel: Int = 1, // 1 to 4
    val revealedWordIndices: Set<Int> = emptySet(),
    val blankWordIndex: Int = 1,
    val blankOptions: List<String> = emptyList(),
    val selectedAnswer: String? = null,
    val isAnswerCorrect: Boolean? = null
)

/**
 * MemorizationEngine that drives the 5-stage smart memorization workflow.
 * Uses the AudioService playback state singleton to synchronize recitation
 * and audio repetitions across offline and online environments.
 */
class MemorizationEngine(
    private val context: Context,
    private val audioService: AudioService = AudioService.getInstance(context)
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val quranDao = AppDatabase.getInstance(context).quranDao()

    private val _sessionState = MutableStateFlow(MemorizationSessionState())
    val sessionState: StateFlow<MemorizationSessionState> = _sessionState.asStateFlow()

    // Expose the shared audio playback state from the AudioService singleton
    val audioPlaybackState: StateFlow<AudioPlaybackState> = audioService.playbackState

    fun startSession(surahId: Int, fromVerse: Int, toVerse: Int, surahName: String = "") {
        _sessionState.update {
            it.copy(
                surahId = surahId,
                fromVerse = fromVerse,
                toVerse = toVerse,
                surahName = surahName,
                isLoading = true,
                error = null,
                currentStage = MemorizationStage.LISTEN_AND_REPEAT,
                currentVerseIndex = 0
            )
        }

        scope.launch(Dispatchers.IO) {
            try {
                val versesList = quranDao.getVersesRangeList(surahId, fromVerse, toVerse)
                if (versesList.isEmpty()) {
                    _sessionState.update {
                        it.copy(
                            isLoading = false,
                            error = "لم يتم العثور على آيات في هذا النطاق"
                        )
                    }
                    return@launch
                }

                _sessionState.update {
                    it.copy(
                        verses = versesList,
                        isLoading = false,
                        error = null
                    )
                }

                initCurrentAyahStage(versesList[0])
            } catch (e: Exception) {
                _sessionState.update {
                    it.copy(
                        isLoading = false,
                        error = e.localizedMessage ?: "حدث خطأ أثناء تحميل الآيات"
                    )
                }
            }
        }
    }

    private fun initCurrentAyahStage(ayah: QuranAyahEntity) {
        val words = ayah.textUthmani.trim().split("\\s+".toRegex())
        val targetIndex = if (words.size > 2) 1 else 0
        val correctWord = words.getOrNull(targetIndex) ?: ""

        val choices = mutableListOf(correctWord, "ٱللَّهَ", "ٱلرَّحْمَـٰنُ", "عَلِيمٌ").shuffled()

        _sessionState.update {
            it.copy(
                blankWordIndex = targetIndex,
                blankOptions = choices,
                selectedAnswer = null,
                isAnswerCorrect = null,
                revealedWordIndices = emptySet(),
                hideLevel = 1
            )
        }
    }

    // --- Audio Controls via AudioService Singleton ---
    fun playCurrentVerse(repeatCount: Int = 3) {
        val state = _sessionState.value
        val currentAyah = state.verses.getOrNull(state.currentVerseIndex) ?: return

        audioService.playVerse(
            surahId = state.surahId,
            verseNumber = currentAyah.verseNumber,
            surahName = state.surahName,
            targetRepeats = repeatCount,
            fromVerse = state.fromVerse,
            toVerse = state.toVerse
        )
    }

    fun pauseAudio() {
        audioService.pause()
    }

    fun resumeAudio() {
        audioService.resume()
    }

    // --- Navigation through Stages ---
    fun setStage(stage: MemorizationStage) {
        _sessionState.update { it.copy(currentStage = stage) }
    }

    fun nextVerseOrStage() {
        val state = _sessionState.value
        if (state.currentVerseIndex < state.verses.size - 1) {
            val nextIndex = state.currentVerseIndex + 1
            _sessionState.update { it.copy(currentVerseIndex = nextIndex) }
            initCurrentAyahStage(state.verses[nextIndex])
        } else {
            // Advance to next stage
            val nextStage = when (state.currentStage) {
                MemorizationStage.LISTEN_AND_REPEAT -> MemorizationStage.PROGRESSIVE_HIDE
                MemorizationStage.PROGRESSIVE_HIDE -> MemorizationStage.FILL_IN_THE_BLANKS
                MemorizationStage.FILL_IN_THE_BLANKS -> MemorizationStage.REORDER_VERSES
                MemorizationStage.REORDER_VERSES -> MemorizationStage.SPACED_REVIEW
                MemorizationStage.SPACED_REVIEW -> MemorizationStage.COMPLETED
                MemorizationStage.COMPLETED -> MemorizationStage.COMPLETED
            }
            _sessionState.update {
                it.copy(
                    currentStage = nextStage,
                    currentVerseIndex = 0,
                    starsEarned = it.starsEarned + 1
                )
            }
            if (state.verses.isNotEmpty()) {
                initCurrentAyahStage(state.verses[0])
            }
        }
    }

    fun toggleRevealWord(index: Int) {
        _sessionState.update {
            val current = it.revealedWordIndices.toMutableSet()
            if (current.contains(index)) current.remove(index) else current.add(index)
            it.copy(revealedWordIndices = current)
        }
    }

    fun setHideLevel(level: Int) {
        _sessionState.update { it.copy(hideLevel = level.coerceIn(1, 4), revealedWordIndices = emptySet()) }
    }

    fun selectBlankChoice(choice: String) {
        val state = _sessionState.value
        val currentAyah = state.verses.getOrNull(state.currentVerseIndex) ?: return
        val words = currentAyah.textUthmani.trim().split("\\s+".toRegex())
        val correctWord = words.getOrNull(state.blankWordIndex) ?: ""
        val isCorrect = choice.trim() == correctWord.trim()

        _sessionState.update {
            it.copy(
                selectedAnswer = choice,
                isAnswerCorrect = isCorrect,
                starsEarned = if (isCorrect) it.starsEarned + 1 else it.starsEarned
            )
        }
    }
}
