'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CustomPlaylist, UnifiedPlaylist, CustomTrackItem } from '@/types/playlist';
import { fetchSpotifyPlaylistTracks, fetchYouTubePlaylistTracks, fetchSoundCloudPlaylistTracks } from '@/lib/platformHelpers';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

const getStoredToken = (platform: string): string | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(`${platform}_token`);
  if (!stored) return null;
  try {
    const tokenData: StoredToken = JSON.parse(stored);
    if (tokenData.expiresAt <= Date.now()) {
      localStorage.removeItem(`${platform}_token`);
      return null;
    }
    return tokenData.accessToken;
  } catch {
    return null;
  }
};

const storeToken = (platform: string, accessToken: string, expiresIn: number): void => {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + ((expiresIn - 300) * 1000);
  localStorage.setItem(`${platform}_token`, JSON.stringify({ accessToken, expiresAt }));
};

interface HubContextType {
  spotifyToken: string | null;
  youtubeToken: string | null;
  soundcloudToken: string | null;
  loadPlatformTokens: () => Promise<void>;
  
  customPlaylists: CustomPlaylist[];
  setCustomPlaylists: React.Dispatch<React.SetStateAction<CustomPlaylist[]>>;
  
  activePlaylist: UnifiedPlaylist | null;
  setActivePlaylist: (p: UnifiedPlaylist | null) => void;
  
  playlistTrackIds: Record<string, Set<string>>;
  setPlaylistTrackIds: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;

  playlistTracks: CustomTrackItem[];
  isLoadingPlaylistTracks: boolean;

  // Global Player Controls
  globalPlayToggle: number;
  triggerTogglePlay: () => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

export function HubProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [youtubeToken, setYoutubeToken] = useState<string | null>(null);
  const [soundcloudToken, setSoundcloudToken] = useState<string | null>(null);
  
  const [customPlaylists, setCustomPlaylists] = useState<CustomPlaylist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<UnifiedPlaylist | null>(null);
  const [playlistTrackIds, setPlaylistTrackIds] = useState<Record<string, Set<string>>>({});
  
  const [playlistTracks, setPlaylistTracks] = useState<CustomTrackItem[]>([]);
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);
  
  const [globalPlayToggle, setGlobalPlayToggle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Track playing state globally
  
  const triggerTogglePlay = useCallback(() => setGlobalPlayToggle(p => p + 1), []);

  const loadPlatformTokens = useCallback(async () => {
    if (!isAuthenticated) return;

    const sp = getStoredToken('spotify');
    if (sp) setSpotifyToken(sp);
    else {
      apiClient.spotifyRefresh().then(res => {
        if (res.data?.accessToken) {
          setSpotifyToken(res.data.accessToken);
          storeToken('spotify', res.data.accessToken, res.data.expiresIn);
        }
      }).catch((err) => { console.warn('[HubContext] Spotify token refresh failed:', err); });
    }

    const yt = getStoredToken('youtube');
    if (yt) setYoutubeToken(yt);
    else {
      apiClient.youtubeRefresh().then(res => {
        if (res.data?.accessToken) {
          setYoutubeToken(res.data.accessToken);
          storeToken('youtube', res.data.accessToken, res.data.expiresIn);
        }
      }).catch((err) => { console.warn('[HubContext] YouTube token refresh failed:', err); });
    }

    const sc = getStoredToken('soundcloud');
    if (sc) setSoundcloudToken(sc);
    else {
      apiClient.soundcloudRefresh().then(res => {
        if (res.data?.accessToken) {
          setSoundcloudToken(res.data.accessToken);
          storeToken('soundcloud', res.data.accessToken, res.data.expiresIn);
        }
      }).catch((err) => { console.warn('[HubContext] SoundCloud token refresh failed:', err); });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadPlatformTokens();
  }, [loadPlatformTokens]);

  useEffect(() => {
    if (!activePlaylist) {
      setPlaylistTracks([]);
      return;
    }
    let cancelled = false;
    setIsLoadingPlaylistTracks(true);
    const load = async () => {
      let tracks: CustomTrackItem[] = [];
      try {
        if (activePlaylist.platform === 'mmp') {
          const res = await apiClient.getCustomPlaylistTracks(activePlaylist.id);
          if (res.data?.tracks) tracks = res.data.tracks;
        } else if (activePlaylist.platform === 'spotify' && spotifyToken) {
          tracks = await fetchSpotifyPlaylistTracks(activePlaylist.uri, spotifyToken) as any;
        } else if (activePlaylist.platform === 'youtube' && youtubeToken) {
          tracks = await fetchYouTubePlaylistTracks(activePlaylist.uri, youtubeToken) as any;
        } else if (activePlaylist.platform === 'soundcloud' && soundcloudToken) {
          tracks = await fetchSoundCloudPlaylistTracks(activePlaylist.id, soundcloudToken) as any;
        }
      } catch (e) { /* swallow, show empty */ }
      if (!cancelled) {
        setPlaylistTracks(tracks);
        setIsLoadingPlaylistTracks(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activePlaylist?.id]);

  return (
    <HubContext.Provider value={{
      spotifyToken, youtubeToken, soundcloudToken, loadPlatformTokens,
      customPlaylists, setCustomPlaylists,
      activePlaylist, setActivePlaylist,
      playlistTrackIds, setPlaylistTrackIds,
      playlistTracks, isLoadingPlaylistTracks,
      globalPlayToggle, triggerTogglePlay,
      isPlaying, setIsPlaying
    }}>
      {children}
    </HubContext.Provider>
  );
}

export function useHub() {
  const context = useContext(HubContext);
  if (context === undefined) throw new Error('useHub must be used within HubProvider');
  return context;
}