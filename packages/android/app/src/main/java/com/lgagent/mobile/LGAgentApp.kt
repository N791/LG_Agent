package com.lgagent.mobile

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.lgagent.mobile.data.RepositoryProvider
import com.lgagent.mobile.ui.home.HomeScreen
import com.lgagent.mobile.ui.home.HomeViewModel
import com.lgagent.mobile.ui.home.NavigationEvent
import com.lgagent.mobile.ui.task.TaskDetailScreen
import com.lgagent.mobile.ui.task.TaskDetailViewModel
import com.lgagent.mobile.ui.theme.LGAgentTheme

private const val HomeRoute = "home"
private const val TaskRoute = "task/{taskId}"

@Composable
fun LGAgentApp() {
    LGAgentTheme {
        val repository = remember { RepositoryProvider.create() }
        val navController = rememberNavController()
        NavHost(navController = navController, startDestination = HomeRoute) {
            composable(HomeRoute) {
                val homeViewModel: HomeViewModel = viewModel(
                    factory = HomeViewModel.factory(repository),
                )
                val state = homeViewModel.state.collectAsStateWithLifecycle().value

                LaunchedEffect(homeViewModel) {
                    homeViewModel.navigationEvents.collect { event ->
                        when (event) {
                            is NavigationEvent.OpenTask -> navController.navigate("task/${event.taskId}")
                        }
                    }
                }

                HomeScreen(
                    state = state,
                    onRetry = homeViewModel::refresh,
                    onOpenTask = homeViewModel::openCurrentTask,
                )
            }
            composable(
                route = TaskRoute,
                arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
            ) { entry ->
                val taskId = requireNotNull(entry.arguments?.getString("taskId"))
                val taskViewModel: TaskDetailViewModel = viewModel(
                    key = "task-$taskId",
                    factory = TaskDetailViewModel.factory(taskId, repository),
                )
                val state = taskViewModel.state.collectAsStateWithLifecycle().value
                TaskDetailScreen(
                    state = state,
                    onBack = { navController.navigateUp() },
                    onRetry = taskViewModel::refresh,
                )
            }
        }
    }
}
