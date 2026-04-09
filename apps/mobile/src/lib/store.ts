import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
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
  isLoading: boolean;
  login: (token: string, user: UserData) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (token, user) => {
    await SecureStore.setItemAsync('tmm_token', token);
    await SecureStore.setItemAsync('tmm_user', JSON.stringify(user));
    await api.setToken(token);
    set({ token, user, isAuthenticated: true });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('tmm_token');
    await SecureStore.deleteItemAsync('tmm_user');
    await api.setToken(null);
    set({ token: null, user: null, isAuthenticated: false });
  },
  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('tmm_token');
      const userStr = await SecureStore.getItemAsync('tmm_user');
      if (token && userStr) {
        const user = JSON.parse(userStr) as UserData;
        await api.setToken(token);
        set({ token, user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
