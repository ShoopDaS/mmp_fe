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

      const data = await response.json();

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
}

export const apiClient = new ApiClient();
