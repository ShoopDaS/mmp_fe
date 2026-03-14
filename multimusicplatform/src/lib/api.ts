import { PlaylistsResponse, CustomPlaylist, CustomPlaylistsResponse, CustomPlaylistTracksResponse } from '@/types/playlist';
import { DEFAULT_COVER } from '@/lib/constants/playlist';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  statusCode?: number;
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = BACKEND_URL;
  }

  private getHeaders(includeAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private getSessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('session_token');
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth: boolean = false
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(requiresAuth),
          ...options.headers,
        },
      });

      // 204 No Content (common for DELETE) has no body — skip JSON parsing
      if (response.status === 204) {
        return { statusCode: 204 };
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        return response.ok ? { statusCode: response.status } : { error: 'Request failed', statusCode: response.status };
      }

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          statusCode: response.status,
        };
      }

      return { data: data.data || data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
        statusCode: 500,
      };
    }
  }

  // Auth endpoints
  async googleLogin() {
    return this.request<{ authUrl: string; state: string }>('/auth/google/login', {
      method: 'POST',
    });
  }

  async spotifyLogin() {
    return this.request<{ authUrl: string; state: string }>('/auth/spotify/login', {
      method: 'POST',
    });
  }

  // Platform endpoints
  async spotifyConnect() {
    return this.request<{ authUrl: string; state: string }>(
      '/platforms/spotify/connect',
      { method: 'POST' },
      true
    );
  }

  async spotifyRefresh() {
    return this.request<{ accessToken: string; expiresIn: number }>(
      '/platforms/spotify/refresh',
      { method: 'POST' },
      true
    );
  }

  async youtubeConnect() {
    return this.request<{ authUrl: string; state: string }>(
      '/platforms/youtube/connect',
      { method: 'POST' },
      true
    );
  }

  async youtubeRefresh() {
    return this.request<{ accessToken: string; expiresIn: number }>(
      '/platforms/youtube/refresh',
      { method: 'POST' },
      true
    );
  }

  async soundcloudConnect() {
    return this.request<{ authUrl: string; state: string }>(
      '/platforms/soundcloud/connect',
      { method: 'POST' },
      true
    );
  }

  async soundcloudRefresh() {
    return this.request<{ accessToken: string; expiresIn: number }>(
      '/platforms/soundcloud/refresh',
      { method: 'POST' },
      true
    );
  }

  async soundcloudSearch(query: string) {
    return this.request<{ tracks: any[] }>(
      `/platforms/soundcloud/search?q=${encodeURIComponent(query)}`,
      { method: 'GET' },
      true
    );
  }

  // Playlist endpoints (YouTube & SoundCloud via backend with caching)
  async getPlatformPlaylists(platform: 'youtube' | 'soundcloud', forceRefresh: boolean = false) {
    return this.request<PlaylistsResponse>(
      `/platforms/${platform}/playlists?force_refresh=${forceRefresh}`,
      { method: 'GET' },
      true
    );
  }

  async refreshPlaylist(platform: 'youtube' | 'soundcloud', playlistId: string) {
    return this.request<{ playlist: any; source: string }>(
      `/platforms/${platform}/playlists/${encodeURIComponent(playlistId)}`,
      { method: 'GET' },
      true
    );
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/user/profile', {}, true);
  }

  async getUserPlatforms() {
    return this.request<{ platforms: any[] }>('/user/platforms', {}, true);
  }

  async getUserAuthProviders() {
    return this.request<{ providers: any[] }>('/user/auth-providers', {}, true);
  }

  async disconnectPlatform(platform: string) {
    return this.request(`/user/platforms/${platform}`, { method: 'DELETE' }, true);
  }

  // ========== Custom Playlist Endpoints ==========

  async getCustomPlaylists() {
    return this.request<CustomPlaylistsResponse>(
      '/user/playlists',
      { method: 'GET' },
      true
    );
  }

  async createCustomPlaylist(name: string, description?: string, coverImage?: string) {
    return this.request<CustomPlaylist>(
      '/user/playlists',
      {
        method: 'POST',
        body: JSON.stringify({ name, description: description || '', coverImage: coverImage || DEFAULT_COVER }),
      },
      true
    );
  }

  async updateCustomPlaylist(playlistId: string, updates: { name?: string; description?: string; coverImage?: string }) {
    return this.request<CustomPlaylist>(
      `/user/playlists/${encodeURIComponent(playlistId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
      true
    );
  }

  async deleteCustomPlaylist(playlistId: string) {
    return this.request(
      `/user/playlists/${encodeURIComponent(playlistId)}`,
      { method: 'DELETE' },
      true
    );
  }

  async getCustomPlaylistTracks(playlistId: string) {
    return this.request<CustomPlaylistTracksResponse>(
      `/user/playlists/${encodeURIComponent(playlistId)}/tracks`,
      { method: 'GET' },
      true
    );
  }

  async addTrackToCustomPlaylist(playlistId: string, track: {
    trackId: string;
    platform: 'spotify' | 'youtube' | 'soundcloud';
    name: string;
    uri: string;
    artists: { name: string }[];
    albumName: string;
    albumImageUrl: string;
    duration_ms: number;
    preview_url: string | null;
  }) {
    return this.request(
      `/user/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        method: 'POST',
        body: JSON.stringify(track),
      },
      true
    );
  }

  async removeTrackFromCustomPlaylist(playlistId: string, trackId: string) {
    return this.request(
      `/user/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
      { method: 'DELETE' },
      true
    );
  }

  async reorderCustomPlaylistTracks(playlistId: string, reorders: { trackId: string; order: number }[]) {
    return this.request(
      `/user/playlists/${encodeURIComponent(playlistId)}/tracks/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify(reorders),
      },
      true
    );
  }
}

export const apiClient = new ApiClient();
