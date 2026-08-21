package com.lgagent.mobile.data

import com.lgagent.mobile.model.MobileHome
import com.lgagent.mobile.model.MobileTaskDetail

sealed interface RepositoryOutcome<out T> {
    data class Success<T>(val value: T) : RepositoryOutcome<T>
    data class Offline<T>(val staleValue: T?) : RepositoryOutcome<T>
    data object Empty : RepositoryOutcome<Nothing>
    data object Forbidden : RepositoryOutcome<Nothing>
    data object SessionExpired : RepositoryOutcome<Nothing>
}

interface MobileRepository {
    suspend fun loadHome(): RepositoryOutcome<MobileHome>
    suspend fun loadTask(taskId: String): RepositoryOutcome<MobileTaskDetail>
}
