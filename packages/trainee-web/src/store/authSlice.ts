import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  role: string;
  organizationId: string;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  user: User | null;
}

const userStr = localStorage.getItem('user');

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  tokenExpiresAt: (() => {
    const val = localStorage.getItem('tokenExpiresAt');
    return val ? Number(val) : null;
  })(),
  user: userStr ? (JSON.parse(userStr) as User) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Set full credentials after login.
     */
    setCredentials: (
      state,
      action: PayloadAction<{
        user: User;
        token: string;
        refreshToken: string;
        tokenExpiresAt: number;
      }>,
    ) => {
      const { user, token, refreshToken, tokenExpiresAt } = action.payload;
      state.user = user;
      state.token = token;
      state.refreshToken = refreshToken;
      state.tokenExpiresAt = tokenExpiresAt;
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tokenExpiresAt', String(tokenExpiresAt));
      localStorage.setItem('user', JSON.stringify(user));
    },

    /**
     * Update tokens only (used during silent refresh).
     */
    setTokens: (
      state,
      action: PayloadAction<{
        token: string;
        refreshToken: string;
        tokenExpiresAt: number;
      }>,
    ) => {
      const { token, refreshToken, tokenExpiresAt } = action.payload;
      state.token = token;
      state.refreshToken = refreshToken;
      state.tokenExpiresAt = tokenExpiresAt;
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tokenExpiresAt', String(tokenExpiresAt));
    },

    /**
     * Clear all auth state and localStorage.
     */
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiresAt');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, setTokens, logout } = authSlice.actions;
export default authSlice.reducer;
