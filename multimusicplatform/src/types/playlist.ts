export interface UnifiedPlaylist {
  id: string;
  platform: 'spotify' | 'youtube' | 'soundcloud' | 'mmp';
  name: string;
  trackCount: number;
  imageUrl: string | null;
  uri: string;
  owner: string;
}

export interface PlaylistsResponse {
  playlists: UnifiedPlaylist[];
  source: 'cache' | 'api' | 'client';
  cachedAt: number | null;
}

// ========== Custom (MMP) Playlists ==========

export interface CustomPlaylist {
  playlistId: string;
  name: string;
  description: string;
  coverImage?: string;
  imageUrl: string | null;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTrackItem {
  trackId: string;
  platform: 'spotify' | 'youtube' | 'soundcloud';
  name: string;
  uri: string;
  artists: { name: string }[];
  albumName: string;
  albumImageUrl: string;
  duration_ms: number;
  preview_url: string | null;
  order: number;
  addedAt: string;
}

export interface CustomPlaylistsResponse {
  playlists: CustomPlaylist[];
}

export interface CustomPlaylistTracksResponse {
  tracks: CustomTrackItem[];
}
