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
  spotify: { name: 'Spotify', bgColor: 'bg-spotify' },
  youtube: { name: 'YouTube Music', bgColor: 'bg-youtube' },
  soundcloud: { name: 'SoundCloud', bgColor: 'bg-soundcloud' },
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
        const spotifyPlaylists = await fetchSpotifyPlaylists(token);
        setPlaylists(spotifyPlaylists);
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

  useEffect(() => {
    if (isExpanded && !hasFetched && !isLoading) {
      fetchPlaylists();
    }
  }, [isExpanded, hasFetched, isLoading, fetchPlaylists]);

  const handlePlaylistRefresh = async (playlist: UnifiedPlaylist) => {
    if (platform === 'spotify') {
      onPlaylistRefresh(playlist);
      return;
    }
    try {
      const response = await apiClient.refreshPlaylist(platform as 'youtube' | 'soundcloud', playlist.id);
      if (!response.error && response.data?.playlist) {
        setPlaylists((prev) => prev.map((p) => p.id === playlist.id ? response.data!.playlist : p));
      }
    } catch (err) {
      console.error(`Error refreshing ${platform} playlist ${playlist.id}:`, err);
    }
    onPlaylistRefresh(playlist);
  };

  return (
    <div className="mb-1">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${config.bgColor}`} />
          <span className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted">
            {config.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasFetched && (
            <span className="text-muted text-[10px]">{playlists.length}</span>
          )}
          <span className="text-muted text-[10px]">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="pb-2 mt-1 space-y-0.5">
          {isLoading && !hasFetched && (
            <div className="px-4 py-3 text-muted text-xs animate-pulse">Loading playlists...</div>
          )}
          {error && <div className="px-4 py-2 text-red-400 text-xs">{error}</div>}
          {hasFetched && playlists.length === 0 && !error && (
            <div className="px-4 py-3 text-muted text-xs italic">No playlists found</div>
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

async function fetchSpotifyPlaylists(token: string): Promise<UnifiedPlaylist[]> {
  const allPlaylists: UnifiedPlaylist[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/playlists';
  while (url) {
    const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
    const data: any = await response.json();
    for (const item of data.items || []) {
      allPlaylists.push({
        id: item.id, platform: 'spotify', name: item.name, trackCount: item.tracks?.total || 0,
        imageUrl: item.images?.[0]?.url || null, uri: item.uri, owner: item.owner?.display_name || '',
      });
    }
    url = data.next || null;
  }
  return allPlaylists;
}