package com.lgagent.mobile.data

object RepositoryProvider {
    fun create(): MobileRepository = UnconfiguredMobileRepository
}

private object UnconfiguredMobileRepository : MobileRepository {
    override suspend fun loadHome() = RepositoryOutcome.SessionExpired
    override suspend fun loadTask(taskId: String) = RepositoryOutcome.SessionExpired
}
