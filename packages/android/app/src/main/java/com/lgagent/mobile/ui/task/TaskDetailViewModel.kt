package com.lgagent.mobile.ui.task

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.lgagent.mobile.data.MobileRepository
import com.lgagent.mobile.data.RepositoryOutcome
import com.lgagent.mobile.model.MobileTaskDetail
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface TaskDetailUiState {
    data object Loading : TaskDetailUiState
    data class Content(val detail: MobileTaskDetail) : TaskDetailUiState
    data class Offline(val staleDetail: MobileTaskDetail?) : TaskDetailUiState
    data object NotFound : TaskDetailUiState
    data object Forbidden : TaskDetailUiState
    data object SessionExpired : TaskDetailUiState
}

class TaskDetailViewModel(
    private val taskId: String,
    private val repository: MobileRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow<TaskDetailUiState>(TaskDetailUiState.Loading)
    val state: StateFlow<TaskDetailUiState> = mutableState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            mutableState.value = TaskDetailUiState.Loading
            mutableState.value = when (val outcome = repository.loadTask(taskId)) {
                is RepositoryOutcome.Success -> TaskDetailUiState.Content(outcome.value)
                is RepositoryOutcome.Offline -> TaskDetailUiState.Offline(outcome.staleValue)
                RepositoryOutcome.Empty -> TaskDetailUiState.NotFound
                RepositoryOutcome.Forbidden -> TaskDetailUiState.Forbidden
                RepositoryOutcome.SessionExpired -> TaskDetailUiState.SessionExpired
            }
        }
    }

    companion object {
        fun factory(taskId: String, repository: MobileRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    TaskDetailViewModel(taskId, repository) as T
            }
    }
}
