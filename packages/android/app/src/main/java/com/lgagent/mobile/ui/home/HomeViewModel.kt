package com.lgagent.mobile.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.lgagent.mobile.data.MobileRepository
import com.lgagent.mobile.data.RepositoryOutcome
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

sealed interface NavigationEvent {
    data class OpenTask(val taskId: String) : NavigationEvent
}

class HomeViewModel(private val repository: MobileRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = mutableState.asStateFlow()

    private val navigationChannel = Channel<NavigationEvent>(Channel.BUFFERED)
    val navigationEvents = navigationChannel.receiveAsFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            mutableState.value = HomeReducer.reduce(mutableState.value, HomeAction.LoadStarted)
            val action = when (val outcome = repository.loadHome()) {
                is RepositoryOutcome.Success -> HomeAction.Loaded(outcome.value)
                is RepositoryOutcome.Offline -> HomeAction.Offline(outcome.staleValue)
                RepositoryOutcome.Empty -> HomeAction.Empty
                RepositoryOutcome.Forbidden -> HomeAction.Forbidden
                RepositoryOutcome.SessionExpired -> HomeAction.SessionExpired
            }
            mutableState.value = HomeReducer.reduce(mutableState.value, action)
        }
    }

    fun openCurrentTask() {
        val taskId = state.value.content?.currentTask?.id ?: return
        navigationChannel.trySend(NavigationEvent.OpenTask(taskId))
    }

    companion object {
        fun factory(repository: MobileRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    HomeViewModel(repository) as T
            }
    }
}
