package com.lgagent.mobile.data

import com.lgagent.mobile.model.MobileHome
import com.lgagent.mobile.model.MobileKnowledgeCard
import com.lgagent.mobile.model.MobileNextAction
import com.lgagent.mobile.model.MobileNextActionType
import com.lgagent.mobile.model.MobileStageProgress
import com.lgagent.mobile.model.MobileTaskDetail
import com.lgagent.mobile.model.MobileTaskStage
import com.lgagent.mobile.model.MobileTaskStatus
import com.lgagent.mobile.model.MobileTaskSummary
import com.lgagent.mobile.model.StageState

object RepositoryProvider {
    fun create(): MobileRepository = LocalGoldenPathRepository
}

private object LocalGoldenPathRepository : MobileRepository {
    private val task = MobileTaskSummary(
        id = "golden-gateway-auth",
        title = "Repair the gateway authorization check",
        summary = "The CI run found a missing organization predicate in the task lookup.",
        status = MobileTaskStatus.BLOCKED,
        currentStage = MobileTaskStage.CI_ACCEPTANCE,
        stagePosition = 6,
        requiresPc = false,
        blockedReason = "The tenant-isolation contract did not pass.",
        nextAction = MobileNextAction(
            type = MobileNextActionType.REVIEW_FAILURE,
            label = "Review failure and next steps",
            requiresPc = false,
        ),
    )

    private val detail = MobileTaskDetail(
        summary = task,
        description = "Keep the authorization decision on the server and scope the query before loading the task.",
        taskVersion = 1,
        stages = MobileTaskStage.entries.mapIndexed { index, stage ->
            val position = index + 1
            MobileStageProgress(
                position = position,
                stage = stage,
                state = when {
                    position < 6 -> StageState.COMPLETED
                    else -> StageState.BLOCKED
                },
            )
        },
        knowledgeCards = listOf(
            MobileKnowledgeCard("org-scope", "Organization-scoped queries", 4),
            MobileKnowledgeCard("resource-policy", "Resource policy boundaries", 3),
        ),
    )

    override suspend fun loadHome(): RepositoryOutcome<MobileHome> = RepositoryOutcome.Success(
        MobileHome(
            readModelVersion = 1,
            courseTitle = "Enterprise gateway onboarding",
            courseProgress = 42,
            currentTask = task,
            unreadNotificationCount = 1,
            recentFeedbackTitle = "CI validation needs your attention",
        ),
    )

    override suspend fun loadTask(taskId: String): RepositoryOutcome<MobileTaskDetail> =
        if (taskId == task.id) RepositoryOutcome.Success(detail) else RepositoryOutcome.Empty
}
