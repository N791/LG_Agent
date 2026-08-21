package com.lgagent.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
fun StageRail(
    currentStage: Int,
    blocked: Boolean,
    modifier: Modifier = Modifier,
) {
    val safeStage = currentStage.coerceIn(1, 6)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = "Task stage $safeStage of 6${if (blocked) ", blocked" else ""}"
                progressBarRangeInfo = ProgressBarRangeInfo(safeStage.toFloat(), 1f..6f, 4)
            },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        repeat(6) { index ->
            val step = index + 1
            val color: Color = when {
                blocked && step == safeStage -> MaterialTheme.colorScheme.error
                step <= safeStage -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
            Box(
                Modifier
                    .weight(1f)
                    .height(8.dp)
                    .background(color, RoundedCornerShape(99.dp)),
            )
        }
    }
}
