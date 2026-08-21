package com.lgagent.mobile.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.lgagent.mobile.model.MobileHome
import com.lgagent.mobile.model.MobileTaskStatus
import com.lgagent.mobile.ui.components.StageRail

@Composable
fun HomeScreen(
    state: HomeUiState,
    onRetry: () -> Unit,
    onOpenTask: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        when (state.status) {
            HomeStatus.LOADING -> StateMessage(
                title = "Loading your next step",
                body = "Checking your current task and latest validation status.",
                modifier = Modifier.padding(innerPadding),
            )
            HomeStatus.EMPTY -> StateMessage(
                title = "No task is assigned yet",
                body = "New work will appear here when your onboarding plan is updated.",
                actionLabel = "Check again",
                onAction = onRetry,
                modifier = Modifier.padding(innerPadding),
            )
            HomeStatus.FORBIDDEN -> StateMessage(
                title = "This workspace is not available",
                body = "Your organization has not enabled mobile access for this plan.",
                modifier = Modifier.padding(innerPadding),
            )
            HomeStatus.SESSION_EXPIRED -> StateMessage(
                title = "Company sign-in required",
                body = "Connect the enterprise identity provider before protected tasks can be shown.",
                actionLabel = "Try again",
                onAction = onRetry,
                modifier = Modifier.padding(innerPadding),
            )
            HomeStatus.OFFLINE -> {
                val staleContent = state.content
                if (staleContent == null) {
                    StateMessage(
                        title = "You are offline",
                        body = "Reconnect to load authorized task details. Sensitive content is not stored by default.",
                        actionLabel = "Retry",
                        onAction = onRetry,
                        modifier = Modifier.padding(innerPadding),
                    )
                } else {
                    HomeContent(
                        home = staleContent,
                        onOpenTask = onOpenTask,
                        stale = true,
                        modifier = Modifier.padding(innerPadding),
                    )
                }
            }
            HomeStatus.CONTENT -> state.content?.let {
                HomeContent(
                    home = it,
                    onOpenTask = onOpenTask,
                    modifier = Modifier.padding(innerPadding),
                )
            }
        }
    }
}

@Composable
private fun HomeContent(
    home: MobileHome,
    onOpenTask: () -> Unit,
    modifier: Modifier = Modifier,
    stale: Boolean = false,
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("home-content"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "LG / FIELD GUIDE",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (home.unreadNotificationCount > 0) {
                    Text(
                        text = "${home.unreadNotificationCount} unread",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (stale) {
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Text(
                        text = "Offline copy — status may be out of date",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                home.courseTitle?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = "Your next move",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineLarge,
                )
                Text(
                    text = "See the current stage, blocker, and one action you can take now.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        home.currentTask?.let { task ->
            item {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("current-task-card"),
                    shape = MaterialTheme.shapes.large,
                    tonalElevation = 2.dp,
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = "STAGE ${task.stagePosition} / 6",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            if (task.requiresPc) {
                                Text(
                                    text = "PC REQUIRED",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.secondary,
                                )
                            }
                        }
                        Text(task.title, style = MaterialTheme.typography.titleLarge)
                        task.summary?.let {
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
                        task.blockedReason?.let {
                            Text(
                                text = "Blocked: $it",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.error,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Button(
                            onClick = onOpenTask,
                            modifier = Modifier
                                .fillMaxWidth()
                                .sizeIn(minHeight = 48.dp),
                        ) {
                            Text(task.nextAction.label)
                        }
                    }
                }
            }
        }
        home.recentFeedbackTitle?.let { feedback ->
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Latest feedback", style = MaterialTheme.typography.labelSmall)
                    Text(feedback, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

@Composable
private fun StateMessage(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.padding(28.dp),
            horizontalAlignment = Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = title,
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (actionLabel != null) {
                Spacer(Modifier.height(4.dp))
                Button(onClick = onAction, modifier = Modifier.sizeIn(minHeight = 48.dp)) {
                    Text(actionLabel)
                }
            }
        }
    }
}
