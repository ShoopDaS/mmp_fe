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
