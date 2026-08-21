package com.lgagent.mobile.ui.home

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.lgagent.mobile.model.MobileHome
import com.lgagent.mobile.model.MobileNextAction
import com.lgagent.mobile.model.MobileNextActionType
import com.lgagent.mobile.model.MobileTaskStage
import com.lgagent.mobile.model.MobileTaskStatus
import com.lgagent.mobile.model.MobileTaskSummary
import com.lgagent.mobile.ui.theme.LGAgentTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class HomeScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun blockedTaskShowsStageReasonAndOnePrimaryAction() {
        var opened = false
        composeRule.setContent {
            LGAgentTheme {
                HomeScreen(
                    state = HomeUiState(HomeStatus.CONTENT, fixtureHome()),
                    onRetry = {},
                    onOpenTask = { opened = true },
                )
            }
        }

        composeRule.onNodeWithText("Your next move").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Task stage 6 of 6, blocked").assertIsDisplayed()
        composeRule.onNodeWithText("Blocked: Tenant isolation did not pass.").assertIsDisplayed()
        composeRule.onNodeWithText("Review failure and next steps").performClick()
        assertTrue(opened)
    }

    private fun fixtureHome() = MobileHome(
        readModelVersion = 1,
        courseTitle = "Gateway onboarding",
        courseProgress = 42,
        currentTask = MobileTaskSummary(
            id = "task-1",
            title = "Repair authorization scope",
            summary = "The organization predicate is missing.",
            status = MobileTaskStatus.BLOCKED,
            currentStage = MobileTaskStage.CI_ACCEPTANCE,
            stagePosition = 6,
            requiresPc = false,
            blockedReason = "Tenant isolation did not pass.",
            nextAction = MobileNextAction(
                MobileNextActionType.REVIEW_FAILURE,
                "Review failure and next steps",
                false,
            ),
        ),
        unreadNotificationCount = 1,
        recentFeedbackTitle = "CI validation needs your attention",
    )
}
