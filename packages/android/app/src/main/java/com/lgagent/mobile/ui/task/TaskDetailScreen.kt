package com.lgagent.mobile.ui.task

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.lgagent.mobile.model.MobileTaskDetail
import com.lgagent.mobile.model.MobileTaskStage
import com.lgagent.mobile.model.MobileTaskStatus
import com.lgagent.mobile.model.StageState
import com.lgagent.mobile.ui.components.StageRail

@Composable
fun TaskDetailScreen(
    state: TaskDetailUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        when (state) {
            TaskDetailUiState.Loading -> TaskStateMessage(
                title = "Loading task details",
                body = "Checking the latest authorized task state.",
                onBack = onBack,
                modifier = Modifier.padding(innerPadding),
            )
            TaskDetailUiState.NotFound -> TaskStateMessage(
                title = "Task not found",
                body = "It may have been removed or is no longer assigned to you.",
                onBack = onBack,
                modifier = Modifier.padding(innerPadding),
            )
            TaskDetailUiState.Forbidden -> TaskStateMessage(
                title = "Access changed",
                body = "This task is no longer available under your organization policy.",
                onBack = onBack,
                modifier = Modifier.padding(innerPadding),
            )
            TaskDetailUiState.SessionExpired -> TaskStateMessage(
                title = "Sign in again",
                body = "Your session expired before this task could be authorized.",
                onBack = onBack,
                actionLabel = "Retry",
                onAction = onRetry,
                modifier = Modifier.padding(innerPadding),
            )
            is TaskDetailUiState.Offline -> {
                val staleDetail = state.staleDetail
                if (staleDetail == null) {
                    TaskStateMessage(
                        title = "Task unavailable offline",
                        body = "Reconnect to authorize this content. Full logs and source are never cached.",
                        onBack = onBack,
                        actionLabel = "Retry",
                        onAction = onRetry,
                        modifier = Modifier.padding(innerPadding),
                    )
                } else {
                    TaskContent(
                        detail = staleDetail,
                        onBack = onBack,
                        stale = true,
                        modifier = Modifier.padding(innerPadding),
                    )
                }
            }
            is TaskDetailUiState.Content -> TaskContent(
                detail = state.detail,
                onBack = onBack,
                modifier = Modifier.padding(innerPadding),
            )
        }
    }
}

@Composable
private fun TaskContent(
    detail: MobileTaskDetail,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    stale: Boolean = false,
) {
    val task = detail.summary
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
            ) {
                Text("Back")
            }
        }
        if (stale) {
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Text(
                        "Offline copy — verify status before acting",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "TASK / V${detail.taskVersion}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = task.title,
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineLarge,
                )
                detail.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                StageRail(
                    currentStage = task.stagePosition,
                    blocked = task.status == MobileTaskStatus.BLOCKED,
                )
            }
        }
        item {
            Text(
                text = "Six-stage path",
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
        }
        items(detail.stages.size) { index ->
            val stage = detail.stages[index]
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics {
                        contentDescription =
                            "Stage ${stage.position}, ${stage.stage.label()}, ${stage.state.label()}"
                    },
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Surface(
                    modifier = Modifier.size(32.dp),
                    shape = MaterialTheme.shapes.small,
                    color = when (stage.state) {
                        StageState.BLOCKED -> MaterialTheme.colorScheme.error
                        StageState.COMPLETED,
                        StageState.CURRENT,
                        -> MaterialTheme.colorScheme.primary
                        StageState.UPCOMING -> MaterialTheme.colorScheme.surfaceVariant
                    },
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = stage.position.toString(),
                            style = MaterialTheme.typography.labelLarge,
                            color = if (stage.state == StageState.UPCOMING) {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            } else {
                                MaterialTheme.colorScheme.onPrimary
                            },
                        )
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(stage.stage.label(), fontWeight = FontWeight.SemiBold)
                    Text(
                        stage.state.label(),
                        style = MaterialTheme.typography.labelLarge,
                        color = if (stage.state == StageState.BLOCKED) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
        if (detail.knowledgeCards.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Knowledge for this task",
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.titleLarge,
                    )
                    detail.knowledgeCards.forEach { card ->
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            shape = MaterialTheme.shapes.medium,
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(card.title, modifier = Modifier.weight(1f))
                                card.estimatedMinutes?.let {
                                    Text("$it min", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskStateMessage(
    title: String,
    body: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        Text(
            body,
            modifier = Modifier.padding(top = 8.dp, bottom = 20.dp),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (actionLabel != null) {
            Button(
                onClick = onAction,
                modifier = Modifier
                    .fillMaxWidth()
                    .sizeIn(minHeight = 48.dp),
            ) {
                Text(actionLabel)
            }
        }
        OutlinedButton(
            onClick = onBack,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
                .sizeIn(minHeight = 48.dp),
        ) {
            Text("Back to home")
        }
    }
}

private fun MobileTaskStage.label(): String = when (this) {
    MobileTaskStage.ENVIRONMENT_DISCOVERY -> "Environment discovery"
    MobileTaskStage.KNOWLEDGE_DELIVERY -> "Knowledge delivery"
    MobileTaskStage.INTERACTIVE_QA -> "Interactive Q&A"
    MobileTaskStage.HANDS_ON_CODING -> "Hands-on coding"
    MobileTaskStage.MICRO_TEST -> "Automated micro-test"
    MobileTaskStage.CI_ACCEPTANCE -> "CI acceptance"
}

private fun StageState.label(): String = name.lowercase().replaceFirstChar(Char::uppercase)
