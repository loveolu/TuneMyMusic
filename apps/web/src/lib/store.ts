import { create } from 'zustand';
import { api } from './api';

interface UserData {
  id: string;
  email: string;
  name: string | null;
  plan: string;
}

interface AuthState {
  user: UserData | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserData) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (token, user) => {
    localStorage.setItem('tmm_token', token);
    localStorage.setItem('tmm_user', JSON.stringify(user));
    api.setToken(token);
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('tmm_token');
    localStorage.removeItem('tmm_user');
    api.setToken(null);
    set({ token: null, user: null, isAuthenticated: false });
  },
  loadFromStorage: () => {
    const token = localStorage.getItem('tmm_token');
    const userStr = localStorage.getItem('tmm_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as UserData;
        api.setToken(token);
        set({ token, user, isAuthenticated: true });
      } catch {
        // ignore parse errors
      }
    }
  },
}));
