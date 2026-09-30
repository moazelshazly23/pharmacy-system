package com.hafiz.quran.service

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Playback state model observed by AudioPlayerBar and MemorizationEngine.
 */
data class AudioPlaybackState(
    val currentSurahId: Int = 1,
    val currentVerseNumber: Int = 1,
    val surahName: String = "",
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val currentRepeatCount: Int = 1,
    val targetRepeats: Int = 1,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val isOfflineCached: Boolean = false,
    val fromVerse: Int? = null,
    val toVerse: Int? = null,
    val playbackSpeed: Float = 1.0f
)

/**
 * Unified Media3 Audio Service for Hafiz Al-Quran.
 * Handles local audio file resolution, offline caching, and provides a singleton state
 * to synchronize playback between AudioPlayerBar and MemorizationEngine.
 */
class AudioService private constructor(private val context: Context) {

    private val applicationContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val player: ExoPlayer by lazy {
        ExoPlayer.Builder(applicationContext).build().apply {
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    _playbackState.update { it.copy(isPlaying = isPlaying) }
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_BUFFERING -> {
                            _playbackState.update { it.copy(isBuffering = true) }
                        }
                        Player.STATE_READY -> {
                            _playbackState.update {
                                it.copy(
                                    isBuffering = false,
                                    durationMs = duration.coerceAtLeast(0L)
                                )
                            }
                        }
                        Player.STATE_ENDED -> {
                            handleVerseEnded()
                        }
                        Player.STATE_IDLE -> {
                            _playbackState.update { it.copy(isPlaying = false, isBuffering = false) }
                        }
                    }
                }
            })
        }
    }

    private val _playbackState = MutableStateFlow(AudioPlaybackState())
    val playbackState: StateFlow<AudioPlaybackState> = _playbackState.asStateFlow()

    private fun pad(number: Int): String = number.toString().padStart(3, '0')

    /**
     * Resolves the audio source:
     * 1. Checks application internal storage (e.g. files/audio/minshawi/067001.mp3)
     * 2. Checks APK asset directory
     * 3. Falls back to EveryAyah CDN and caches in the background for offline use
     */
    private suspend fun resolveAudioUri(surahId: Int, verseNumber: Int): Pair<Uri, Boolean> = withContext(Dispatchers.IO) {
        val fileName = "${pad(surahId)}${pad(verseNumber)}.mp3"
        val audioDir = File(applicationContext.filesDir, "audio/minshawi")
        if (!audioDir.exists()) {
            audioDir.mkdirs()
        }

        // 1. Check local internal files directory
        val localFile = File(audioDir, fileName)
        if (localFile.exists() && localFile.length() > 0) {
            return@withContext Pair(Uri.fromFile(localFile), true)
        }

        // 2. Check bundled assets (for preloaded Surahs like Al-Mulk, Al-Fatiha, etc.)
        try {
            val assetPath = "audio/minshawi/$fileName"
            applicationContext.assets.open(assetPath).use {
                return@withContext Pair(Uri.parse("file:///android_asset/$assetPath"), true)
            }
        } catch (_: Exception) {
            // Asset not bundled, fallback to remote CDN
        }

        // 3. Fallback to EveryAyah CDN
        val remoteUrl = "https://everyayah.com/data/Minshawy_Murattal_128kbps/$fileName"

        // Cache in background for subsequent offline playback
        cacheAudioInBackground(remoteUrl, localFile)

        Pair(Uri.parse(remoteUrl), false)
    }

    private fun cacheAudioInBackground(remoteUrl: String, destinationFile: File) {
        scope.launch(Dispatchers.IO) {
            try {
                if (destinationFile.exists() && destinationFile.length() > 0) return@launch
                val url = URL(remoteUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 10000
                connection.readTimeout = 15000
                connection.connect()

                if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                    val tempFile = File(destinationFile.parentFile, "${destinationFile.name}.tmp")
                    connection.inputStream.use { input ->
                        FileOutputStream(tempFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                    if (tempFile.renameTo(destinationFile)) {
                        _playbackState.update { current ->
                            if (current.currentSurahId == destinationFile.name.substring(0, 3).toIntOrNull() &&
                                current.currentVerseNumber == destinationFile.name.substring(3, 6).toIntOrNull()
                            ) {
                                current.copy(isOfflineCached = true)
                            } else {
                                current
                            }
                        }
                    }
                }
            } catch (_: Exception) {
                // Fail silently in background
            }
        }
    }

    /**
     * Play a specific verse with target repetitions and optional range constraints.
     */
    fun playVerse(
        surahId: Int,
        verseNumber: Int,
        surahName: String = "",
        targetRepeats: Int = 1,
        fromVerse: Int? = null,
        toVerse: Int? = null
    ) {
        scope.launch {
            _playbackState.update {
                it.copy(
                    currentSurahId = surahId,
                    currentVerseNumber = verseNumber,
                    surahName = surahName,
                    targetRepeats = targetRepeats,
                    currentRepeatCount = 1,
                    fromVerse = fromVerse ?: verseNumber,
                    toVerse = toVerse ?: verseNumber,
                    isBuffering = true
                )
            }

            val (uri, isCached) = resolveAudioUri(surahId, verseNumber)
            _playbackState.update { it.copy(isOfflineCached = isCached) }

            val mediaItem = MediaItem.fromUri(uri)
            player.setMediaItem(mediaItem)
            player.playbackParameters = PlaybackParameters(_playbackState.value.playbackSpeed)
            player.prepare()
            player.play()
        }
    }

    fun pause() {
        player.pause()
        _playbackState.update { it.copy(isPlaying = false) }
    }

    fun resume() {
        player.play()
        _playbackState.update { it.copy(isPlaying = true) }
    }

    fun stop() {
        player.stop()
        _playbackState.update { it.copy(isPlaying = false, isBuffering = false) }
    }

    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs)
    }

    fun setPlaybackSpeed(speed: Float) {
        val clamped = speed.coerceIn(0.5f, 2.0f)
        _playbackState.update { it.copy(playbackSpeed = clamped) }
        player.playbackParameters = PlaybackParameters(clamped)
    }

    fun setTargetRepeats(repeats: Int) {
        _playbackState.update { it.copy(targetRepeats = repeats.coerceAtLeast(1)) }
    }

    private fun handleVerseEnded() {
        val state = _playbackState.value

        // Check if repetition is still needed for current verse
        if (state.currentRepeatCount < state.targetRepeats) {
            _playbackState.update { it.copy(currentRepeatCount = it.currentRepeatCount + 1) }
            player.seekTo(0)
            player.play()
            return
        }

        // Verse repeat completed, check if range continuation is enabled
        val endVerse = state.toVerse ?: state.currentVerseNumber
        if (state.currentVerseNumber < endVerse) {
            val nextVerse = state.currentVerseNumber + 1
            playVerse(
                surahId = state.currentSurahId,
                verseNumber = nextVerse,
                surahName = state.surahName,
                targetRepeats = state.targetRepeats,
                fromVerse = state.fromVerse,
                toVerse = state.toVerse
            )
        } else {
            // Entire range or verse completed
            _playbackState.update { it.copy(isPlaying = false, currentRepeatCount = 1) }
        }
    }

    fun release() {
        player.release()
    }

    companion object {
        @Volatile
        private var INSTANCE: AudioService? = null

        fun getInstance(context: Context): AudioService {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: AudioService(context).also { INSTANCE = it }
            }
        }
    }
}
