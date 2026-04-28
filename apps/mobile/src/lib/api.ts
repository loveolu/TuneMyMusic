import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/**
 * Resolve the API base URL with the following priority:
 *
 *   1. EXPO_PUBLIC_API_URL  — Expo's recommended public env var; surfaces
 *      via process.env at runtime in the JS bundle. Set it in .env or via
 *      EAS build profiles for staging/prod builds.
 *   2. expo-constants extra.apiUrl — set in app.json's `extra` block. Useful
 *      for stable per-environment overrides without re-bundling.
 *   3. Hard fallback to http://localhost:3001 for the simple-case dev loop
 *      (Expo Go on a simulator, server running on the host).
 *
 * NOTE: physical Android devices on the same Wi-Fi as the dev machine
 * cannot resolve `localhost`. Set EXPO_PUBLIC_API_URL=http://<your-LAN-ip>:3001
 * in `.env` to test on real hardware.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return 'http://localhost:3001';
}

const API_URL = resolveApiUrl();

class ApiClient {
  private token: string | null = null;

  async init() {
    this.token = await SecureStore.getItemAsync('tmm_token');
  }

  async setToken(token: string | null) {
    this.token = token;
    if (token) await SecureStore.setItemAsync('tmm_token', token);
    else await SecureStore.deleteItemAsync('tmm_token');
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `API error: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }
  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
