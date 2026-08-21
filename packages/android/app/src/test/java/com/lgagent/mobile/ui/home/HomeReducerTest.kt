package com.lgagent.mobile.ui.home

import com.lgagent.mobile.model.MobileHome
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class HomeReducerTest {
    private val staleHome = MobileHome(
        readModelVersion = 1,
        courseTitle = "Gateway onboarding",
        courseProgress = 42,
        currentTask = null,
        unreadNotificationCount = 0,
        recentFeedbackTitle = null,
    )

    @Test
    fun `offline action preserves only explicitly supplied stale content`() {
        val state = HomeReducer.reduce(
            HomeUiState(status = HomeStatus.CONTENT, content = staleHome),
            HomeAction.Offline(staleHome),
        )

        assertEquals(HomeStatus.OFFLINE, state.status)
        assertSame(staleHome, state.content)
    }

    @Test
    fun `session expiration removes previously authorized content`() {
        val state = HomeReducer.reduce(
            HomeUiState(status = HomeStatus.CONTENT, content = staleHome),
            HomeAction.SessionExpired,
        )

        assertEquals(HomeStatus.SESSION_EXPIRED, state.status)
        assertEquals(null, state.content)
    }

    @Test
    fun `forbidden response removes previously authorized content`() {
        val state = HomeReducer.reduce(
            HomeUiState(status = HomeStatus.CONTENT, content = staleHome),
            HomeAction.Forbidden,
        )

        assertEquals(HomeStatus.FORBIDDEN, state.status)
        assertEquals(null, state.content)
    }
}
