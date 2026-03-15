'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CustomPlaylist, UnifiedPlaylist, CustomTrackItem } from '@/types/playlist';
import {
  fetchSpotifyPlaylistTracks, fetchYouTubePlaylistTracks, fetchSoundCloudPlaylistTracks,
  fetchSpotifyOwnedPlaylists, fetchYouTubeOwnedPlaylists, fetchSoundCloudOwnedPlaylists,
  addTrackToSpotifyPlaylist, addTrackToYouTubePlaylist, addTrackToSoundCloudPlaylist,
  fetchSpotifyPlaylistTrackUris, fetchYouTubePlaylistVideoIds, fetchSoundCloudPlaylistTrackIds,
} from '@/lib/platformHelpers';

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

// Track shape used by platform playlist actions
interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
}

type OwnedPlatformPlaylists = Partial<Record<'spotify' | 'youtube' | 'soundcloud', { id: string; name: string }[] | 'loading'>>;

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
  requestPlaylistTrackIds: (playlistIds: string[]) => void;

  playlistTracks: CustomTrackItem[];
  isLoadingPlaylistTracks: boolean;

  // Platform playlist state (for ContextMenu "Add to Platform Playlist")
  ownedPlatformPlaylists: OwnedPlatformPlaylists;
  requestOwnedPlatformPlaylists: (platform: 'spotify' | 'youtube' | 'soundcloud') => void;
  platformPlaylistTrackIds: Record<string, Set<string>>;
  setPlatformPlaylistTrackIds: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
  addToPlatformPlaylist: (track: Track, playlistId: string) => Promise<void>;

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

  // Platform playlist state
  const [ownedPlatformPlaylists, setOwnedPlatformPlaylists] = useState<OwnedPlatformPlaylists>({});
  const [platformPlaylistTrackIds, setPlatformPlaylistTrackIds] = useState<Record<string, Set<string>>>({});
  const fetchedPlatformsRef = useRef<Set<'spotify' | 'youtube' | 'soundcloud'>>(new Set());
  const fetchedPlatformPlaylistTrackIdsRef = useRef<Set<string>>(new Set());

  const [globalPlayToggle, setGlobalPlayToggle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
          tracks = await fetchSpotifyPlaylistTracks(activePlaylist.id, spotifyToken) as any;
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

  // Load track IDs for Stave playlists (for duplicate detection in ContextMenu)
  const requestPlaylistTrackIds = useCallback(async (playlistIds: string[]) => {
    const unloaded = playlistIds.filter(id => !playlistTrackIds[id]);
    if (!unloaded.length) return;
    await Promise.all(unloaded.map(async (id) => {
      try {
        const res = await apiClient.getCustomPlaylistTracks(id);
        if (res.data?.tracks) {
          setPlaylistTrackIds(prev => ({ ...prev, [id]: new Set(res.data!.tracks.map((t: CustomTrackItem) => t.trackId)) }));
        }
      } catch {}
    }));
  }, [playlistTrackIds, setPlaylistTrackIds]);

  // Load track IDs for platform playlists (for duplicate detection in ContextMenu)
  const requestPlatformPlaylistTrackIds = useCallback(async (platform: 'spotify' | 'youtube' | 'soundcloud', playlistIds: string[]) => {
    const unloaded = playlistIds.filter(id => !fetchedPlatformPlaylistTrackIdsRef.current.has(id));
    if (!unloaded.length) return;
    await Promise.all(unloaded.map(async (id) => {
      fetchedPlatformPlaylistTrackIdsRef.current.add(id);
      try {
        let trackIds: Set<string> = new Set();
        if (platform === 'spotify' && spotifyToken) trackIds = await fetchSpotifyPlaylistTrackUris(id, spotifyToken);
        else if (platform === 'youtube' && youtubeToken) trackIds = await fetchYouTubePlaylistVideoIds(id, youtubeToken);
        else if (platform === 'soundcloud' && soundcloudToken) trackIds = await fetchSoundCloudPlaylistTrackIds(id, soundcloudToken);
        setPlatformPlaylistTrackIds(prev => ({ ...prev, [id]: trackIds }));
      } catch { fetchedPlatformPlaylistTrackIdsRef.current.delete(id); }
    }));
  }, [spotifyToken, youtubeToken, soundcloudToken]);

  // Fetch user's owned playlists for a platform (lazy, cached)
  const requestOwnedPlatformPlaylists = useCallback(async (platform: 'spotify' | 'youtube' | 'soundcloud') => {
    if (fetchedPlatformsRef.current.has(platform)) return;
    fetchedPlatformsRef.current.add(platform);
    setOwnedPlatformPlaylists(prev => ({ ...prev, [platform]: 'loading' }));
    try {
      let playlists: { id: string; name: string }[] = [];
      if (platform === 'spotify' && spotifyToken) playlists = await fetchSpotifyOwnedPlaylists(spotifyToken);
      else if (platform === 'youtube' && youtubeToken) playlists = await fetchYouTubeOwnedPlaylists(youtubeToken);
      else if (platform === 'soundcloud' && soundcloudToken) playlists = await fetchSoundCloudOwnedPlaylists(soundcloudToken);
      setOwnedPlatformPlaylists(prev => ({ ...prev, [platform]: playlists }));
      if (playlists.length) requestPlatformPlaylistTrackIds(platform, playlists.map(pl => pl.id));
    } catch {
      setOwnedPlatformPlaylists(prev => ({ ...prev, [platform]: [] }));
      fetchedPlatformsRef.current.delete(platform);
    }
  }, [spotifyToken, youtubeToken, soundcloudToken, requestPlatformPlaylistTrackIds]);

  // Add a track to a platform playlist
  const addToPlatformPlaylist = useCallback(async (track: Track, playlistId: string) => {
    const scNumericId = track.id.replace('soundcloud-', '');
    const duplicateKey = track.platform === 'soundcloud' ? scNumericId : track.uri;
    if (platformPlaylistTrackIds[playlistId]?.has(duplicateKey)) return;
    if (track.platform === 'spotify' && spotifyToken) {
      await addTrackToSpotifyPlaylist(track.uri, playlistId, spotifyToken);
    } else if (track.platform === 'youtube' && youtubeToken) {
      await addTrackToYouTubePlaylist(track.uri, playlistId, youtubeToken);
    } else if (track.platform === 'soundcloud' && soundcloudToken) {
      await addTrackToSoundCloudPlaylist(scNumericId, playlistId, soundcloudToken);
    }
    setPlatformPlaylistTrackIds(prev => ({ ...prev, [playlistId]: new Set(prev[playlistId] || []).add(duplicateKey) }));
  }, [spotifyToken, youtubeToken, soundcloudToken, platformPlaylistTrackIds]);

  return (
    <HubContext.Provider value={{
      spotifyToken, youtubeToken, soundcloudToken, loadPlatformTokens,
      customPlaylists, setCustomPlaylists,
      activePlaylist, setActivePlaylist,
      playlistTrackIds, setPlaylistTrackIds, requestPlaylistTrackIds,
      playlistTracks, isLoadingPlaylistTracks,
      ownedPlatformPlaylists, requestOwnedPlatformPlaylists,
      platformPlaylistTrackIds, setPlatformPlaylistTrackIds, addToPlatformPlaylist,
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
