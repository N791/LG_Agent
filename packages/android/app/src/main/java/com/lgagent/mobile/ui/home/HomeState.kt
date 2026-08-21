package com.lgagent.mobile.ui.home

import com.lgagent.mobile.model.MobileHome

enum class HomeStatus { LOADING, CONTENT, EMPTY, OFFLINE, FORBIDDEN, SESSION_EXPIRED }

data class HomeUiState(
    val status: HomeStatus = HomeStatus.LOADING,
    val content: MobileHome? = null,
)

sealed interface HomeAction {
    data object LoadStarted : HomeAction
    data class Loaded(val content: MobileHome) : HomeAction
    data object Empty : HomeAction
    data class Offline(val staleContent: MobileHome?) : HomeAction
    data object Forbidden : HomeAction
    data object SessionExpired : HomeAction
}

object HomeReducer {
    fun reduce(state: HomeUiState, action: HomeAction): HomeUiState = when (action) {
        HomeAction.LoadStarted -> state.copy(status = HomeStatus.LOADING)
        is HomeAction.Loaded -> HomeUiState(HomeStatus.CONTENT, action.content)
        HomeAction.Empty -> HomeUiState(HomeStatus.EMPTY)
        is HomeAction.Offline -> HomeUiState(HomeStatus.OFFLINE, action.staleContent)
        HomeAction.Forbidden -> HomeUiState(HomeStatus.FORBIDDEN)
        HomeAction.SessionExpired -> HomeUiState(HomeStatus.SESSION_EXPIRED)
    }
}
