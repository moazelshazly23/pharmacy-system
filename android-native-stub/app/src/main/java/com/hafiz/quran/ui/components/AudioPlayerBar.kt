package com.hafiz.quran.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hafiz.quran.service.AudioService

/**
 * Compose AudioPlayerBar that observes the AudioService singleton state.
 * Shared between the reader and the smart memorization screen.
 */
@Composable
fun AudioPlayerBar(
    modifier: Modifier = Modifier,
    audioService: AudioService = AudioService.getInstance(LocalContext.current)
) {
    val playbackState by audioService.playbackState.collectAsState()

    if (!playbackState.isPlaying && playbackState.durationMs == 0L) {
        // Player is idle and stopped
        return
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(24.dp),
        shadowElevation = 8.dp,
        color = Color(0xFF064E3B) // Dark Emerald
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Surah & Verse Information
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (playbackState.surahName.isNotEmpty()) "سورة ${playbackState.surahName}" else "القرآن الكريم",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "الآية ${playbackState.currentVerseNumber} · تكرار ${playbackState.currentRepeatCount} من ${playbackState.targetRepeats}",
                        color = Color(0xFF6EE7B7),
                        fontSize = 11.sp
                    )
                }

                // Offline badge
                if (playbackState.isOfflineCached) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF047857))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "محفوظ محلياً",
                            color = Color(0xFFD1FAE5),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Play / Pause Button
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFF59E0B)) // Amber
                        .clickable {
                            if (playbackState.isPlaying) {
                                audioService.pause()
                            } else {
                                audioService.resume()
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (playbackState.isPlaying) "❚❚" else "▶",
                        color = Color.Black,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }
            }

            // Progress bar
            if (playbackState.durationMs > 0) {
                val progress = (playbackState.currentPositionMs.toFloat() / playbackState.durationMs.toFloat())
                    .coerceIn(0f, 1f)

                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = Color(0xFFF59E0B),
                    trackColor = Color(0xFF047857)
                )
            }
        }
    }
}
