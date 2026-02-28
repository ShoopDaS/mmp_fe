'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { UnifiedPlaylist, CustomPlaylist } from '@/types/playlist';
import PlaylistItem from './PlaylistItem';

interface PlatformPlaylistSectionProps {
  platform: 'spotify' | 'youtube' | 'soundcloud';
  token: string | null;
  activePlaylistId: string | null;
  onPlaylistSelect: (playlist: UnifiedPlaylist) => void;
  onPlaylistRefresh: (playlist: UnifiedPlaylist) => void;
  customPlaylists?: CustomPlaylist[];
  onImportToPlaylist?: (sourcePlaylist: UnifiedPlaylist, targetPlaylistId: string) => Promise<void>;
}

const platformConfig = {
  spotify: { name: 'Spotify', icon: '🎵', color: 'text-green-400' },
  youtube: { name: 'YouTube Music', icon: '🎬', color: 'text-red-400' },
  soundcloud: { name: 'SoundCloud', icon: '🔊', color: 'text-orange-400' },
};

export default function PlatformPlaylistSection({
  platform,
  token,
  activePlaylistId,
  onPlaylistSelect,
  onPlaylistRefresh,
  customPlaylists,
  onImportToPlaylist,
}: PlatformPlaylistSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playlists, setPlaylists] = useState<UnifiedPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = platformConfig[platform];

  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (platform === 'spotify') {
        if (!token) {
          setError('No Spotify token');
          return;
        }
        const [spotifyPlaylists, likedCount] = await Promise.all([
          fetchSpotifyPlaylists(token),
          fetchSpotifyLikedCount(token),
        ]);

        const likedSongsEntry: UnifiedPlaylist = {
          id: 'liked-songs',
          platform: 'spotify',
          name: 'Liked Songs',
          trackCount: likedCount,
          imageUrl: null,
          uri: 'spotify:collection:tracks',
          owner: 'You',
        };

        setPlaylists([likedSongsEntry, ...spotifyPlaylists]);
      } else {
        const response = await apiClient.getPlatformPlaylists(platform, false);
        if (response.error) {
          setError(response.error);
          return;
        }
        setPlaylists(response.data?.playlists || []);
      }
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setIsLoading(false);
    }
  }, [platform, token]);

  // Lazy load: fetch on first expand
  useEffect(() => {
    if (isExpanded && !hasFetched && !isLoading) {
      fetchPlaylists();
    }
  }, [isExpanded, hasFetched, isLoading, fetchPlaylists]);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  const handlePlaylistRefresh = async (playlist: UnifiedPlaylist) => {
    if (platform === 'spotify') {
      // Spotify is client-side only, just re-fetch tracks
      onPlaylistRefresh(playlist);
      return;
    }

    // For YT/SC: call backend to refresh this specific playlist from source
    try {
      const response = await apiClient.refreshPlaylist(
        platform as 'youtube' | 'soundcloud',
        playlist.id
      );
      if (!response.error && response.data?.playlist) {
        // Update just this one playlist in the sidebar list
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id ? response.data!.playlist : p
          )
        );
      }
    } catch (err) {
      console.error(`Error refreshing ${platform} playlist ${playlist.id}:`, err);
    }

    // Then reload that specific playlist's tracks
    onPlaylistRefresh(playlist);
  };

  return (
    <div className="border-b border-white/10 last:border-b-0">
      {/* Section header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className={`transition-transform duration-200 text-xs text-gray-400 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          >
            ▶
          </span>
          <span className="text-lg">{config.icon}</span>
          <span className={`font-medium text-sm ${config.color}`}>{config.name}</span>
          {hasFetched && (
            <span className="text-xs text-gray-500">({playlists.length})</span>
          )}
        </div>
      </button>

      {/* Playlist list */}
      {isExpanded && (
        <div className="px-2 pb-2">
          {isLoading && !hasFetched && (
            <div className="px-3 py-4 text-center text-sm text-gray-400">
              Loading playlists...
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {hasFetched && playlists.length === 0 && !error && (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No playlists found
            </div>
          )}

          {playlists.map((playlist) => (
            <PlaylistItem
              key={`${playlist.platform}-${playlist.id}`}
              playlist={playlist}
              isActive={activePlaylistId === playlist.id}
              onClick={onPlaylistSelect}
              onRefresh={handlePlaylistRefresh}
              customPlaylists={customPlaylists}
              onImportToPlaylist={onImportToPlaylist}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Spotify Client-Side Fetch ==========

async function fetchSpotifyPlaylists(token: string): Promise<UnifiedPlaylist[]> {
  const allPlaylists: UnifiedPlaylist[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data: any = await response.json();

    for (const item of data.items || []) {
      allPlaylists.push({
        id: item.id,
        platform: 'spotify',
        name: item.name,
        trackCount: item.tracks?.total || 0,
        imageUrl: item.images?.[0]?.url || null,
        uri: item.uri,
        owner: item.owner?.display_name || '',
      });
    }

    url = data.next || null;
  }

  const algorithmic = allPlaylists.filter(p => p.owner === 'Spotify');
  const regular     = allPlaylists.filter(p => p.owner !== 'Spotify');
  return [...algorithmic, ...regular];
}

async function fetchSpotifyLikedCount(token: string): Promise<number> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  } catch {
    return 0;
  }
}