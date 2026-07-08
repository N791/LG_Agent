import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  username: string;
  role: string;
  organizationId: string;
  nickname?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
}

const userInfoString = localStorage.getItem('user_info');
const initialState: AuthState = {
  token: localStorage.getItem('access_token'),
  user: userInfoString ? (JSON.parse(userInfoString) as User) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem('access_token', action.payload.token);
      localStorage.setItem('user_info', JSON.stringify(action.payload.user));
    },
    clearAuth: (state) => {
      state.token = null;
      state.user = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
