package com.lgagent.mobile.model

enum class MobileTaskStage {
    ENVIRONMENT_DISCOVERY,
    KNOWLEDGE_DELIVERY,
    INTERACTIVE_QA,
    HANDS_ON_CODING,
    MICRO_TEST,
    CI_ACCEPTANCE,
}

enum class MobileTaskStatus {
    NOT_STARTED,
    IN_PROGRESS,
    AWAITING_VALIDATION,
    COMPLETED,
    BLOCKED,
}

enum class MobileNextActionType {
    READ_KNOWLEDGE,
    ASK_AI,
    CONTINUE_ON_PC,
    REVIEW_FAILURE,
    WAIT_FOR_CI,
    VIEW_COMPLETION,
}

data class MobileNextAction(
    val type: MobileNextActionType,
    val label: String,
    val requiresPc: Boolean,
)

data class MobileTaskSummary(
    val id: String,
    val title: String,
    val summary: String?,
    val status: MobileTaskStatus,
    val currentStage: MobileTaskStage,
    val stagePosition: Int,
    val requiresPc: Boolean,
    val blockedReason: String?,
    val nextAction: MobileNextAction,
)

data class MobileStageProgress(
    val position: Int,
    val stage: MobileTaskStage,
    val state: StageState,
)

enum class StageState { COMPLETED, CURRENT, UPCOMING, BLOCKED }

data class MobileKnowledgeCard(
    val id: String,
    val title: String,
    val estimatedMinutes: Int?,
)

data class MobileTaskDetail(
    val summary: MobileTaskSummary,
    val description: String?,
    val taskVersion: Int,
    val stages: List<MobileStageProgress>,
    val knowledgeCards: List<MobileKnowledgeCard>,
)

data class MobileHome(
    val readModelVersion: Int,
    val courseTitle: String?,
    val courseProgress: Int,
    val currentTask: MobileTaskSummary?,
    val unreadNotificationCount: Int,
    val recentFeedbackTitle: String?,
)
