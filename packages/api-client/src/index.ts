import type {
  AuthResponse,
  RegisterInput,
  LoginInput,
  Playlist,
  Track,
  CreateTransfer,
} from '@tunemymusic/types';

export { API_VERSION } from './version.js';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class TuneMyMusicClient {
  private token?: string;

  constructor(
    private baseUrl: string,
    token?: string,
  ) {
    this.token = token;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = undefined;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { rawResponse?: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (options?.rawResponse) {
      return res as unknown as T;
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (!res.ok) {
        throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`);
      }
      return undefined as unknown as T;
    }

    if (!res.ok) {
      const errBody = json as any;
      throw new ApiError(res.status, errBody?.error ?? `HTTP ${res.status}`, json);
    }

    return json as T;
  }

  // -------------------------
  // Auth
  // -------------------------

  async register(input: RegisterInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/auth/register', input);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/auth/login', input);
  }

  async getMe(): Promise<any> {
    return this.request<any>('GET', '/api/auth/me');
  }

  // -------------------------
  // Connections
  // -------------------------

  async getConnections(): Promise<any[]> {
    const res = await this.request<{ connections: any[] }>('GET', '/api/connections');
    return res.connections;
  }

  async getAuthUrl(platform: string, redirectUri: string): Promise<{ url: string }> {
    const params = new URLSearchParams({ redirectUri });
    return this.request<{ url: string }>('GET', `/api/connections/${platform}/auth-url?${params}`);
  }

  async connectPlatform(
    platform: string,
    code: string,
    redirectUri: string,
  ): Promise<any> {
    const res = await this.request<{ connection: any }>('POST', `/api/connections/${platform}/callback`, {
      code,
      redirectUri,
    });
    return res.connection;
  }

  async disconnectPlatform(platform: string): Promise<void> {
    await this.request<void>('DELETE', `/api/connections/${platform}`);
  }

  // -------------------------
  // Playlists
  // -------------------------

  async getPlaylists(platform: string): Promise<Playlist[]> {
    const res = await this.request<{ playlists: Playlist[] }>('GET', `/api/playlists/${platform}`);
    return res.playlists;
  }

  async getPlaylistTracks(platform: string, playlistId: string): Promise<Track[]> {
    const res = await this.request<{ tracks: Track[] }>(
      'GET',
      `/api/playlists/${platform}/${playlistId}/tracks`,
    );
    return res.tracks;
  }

  // -------------------------
  // Transfers
  // -------------------------

  async createTransfer(input: CreateTransfer): Promise<any> {
    const res = await this.request<{ transfer: any }>('POST', '/api/transfers', input);
    return res.transfer;
  }

  async getTransfers(): Promise<any[]> {
    const res = await this.request<{ transfers: any[] }>('GET', '/api/transfers');
    return res.transfers;
  }

  async getTransfer(id: string): Promise<any> {
    const res = await this.request<{ transfer: any }>('GET', `/api/transfers/${id}`);
    return res.transfer;
  }

  async cancelTransfer(id: string): Promise<void> {
    await this.request<void>('POST', `/api/transfers/${id}/cancel`);
  }

  async retryTransfer(id: string): Promise<any> {
    const res = await this.request<{ transfer: any }>('POST', `/api/transfers/${id}/retry`);
    return res.transfer;
  }

  // -------------------------
  // Billing
  // -------------------------

  async getPlans(): Promise<any[]> {
    const res = await this.request<{ plans: any[] }>('GET', '/api/billing/plans');
    return res.plans;
  }

  async subscribe(
    planId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>('POST', '/api/billing/subscribe', {
      planId,
      successUrl,
      cancelUrl,
    });
  }

  async getBillingPortal(returnUrl: string): Promise<{ url: string }> {
    return this.request<{ url: string }>('POST', '/api/billing/portal', { returnUrl });
  }

  // -------------------------
  // Notifications
  // -------------------------

  async getNotifications(unreadOnly = false): Promise<any> {
    const params = unreadOnly ? '?unreadOnly=true' : '';
    return this.request<any>('GET', `/api/notifications${params}`);
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request<void>('PATCH', `/api/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request<void>('POST', '/api/notifications/read-all');
  }

  // -------------------------
  // User Profile
  // -------------------------

  async getUserProfile(): Promise<any> {
    const res = await this.request<{ user: any }>('GET', '/api/user/profile');
    return res.user;
  }

  async updateUserProfile(data: { name?: string; avatarUrl?: string | null }): Promise<any> {
    const res = await this.request<{ user: any }>('PATCH', '/api/user/profile', data);
    return res.user;
  }

  async deleteAccount(): Promise<void> {
    await this.request<void>('DELETE', '/api/user');
  }
}

export type { AuthResponse, RegisterInput, LoginInput, Playlist, Track, CreateTransfer };
export { ApiError };
