'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { UnifiedPlaylist, CustomPlaylist } from '@/types/playlist';
import PlaylistItem from './PlaylistItem';
import { SpotifyIcon, YouTubeIcon, SoundCloudIcon } from '@/components/icons/BrandIcons';

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
  spotify: { name: 'Spotify', color: 'text-spotify', bg: 'bg-spotify/10' },
  youtube: { name: 'YouTube Music', color: 'text-youtube', bg: 'bg-youtube/10' },
  soundcloud: { name: 'SoundCloud', color: 'text-soundcloud', bg: 'bg-soundcloud/10' },
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

  const renderIcon = () => {
    const className = `w-5 h-5 ${config.color}`;
    switch (platform) {
      case 'spotify': return <SpotifyIcon className={className} />;
      case 'youtube': return <YouTubeIcon className={className} />;
      case 'soundcloud': return <SoundCloudIcon className={className} />;
    }
  };

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
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <svg 
            className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-2">
            {renderIcon()}
            <span className="font-semibold text-sm text-white/90 group-hover:text-white transition-colors">
              {config.name}
            </span>
          </div>
        </div>
        {hasFetched && (
          <span className="text-[11px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded-full">
            {playlists.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 mt-1 space-y-0.5">
          {isLoading && !hasFetched && (
            <div className="px-4 py-3 text-xs text-text-secondary animate-pulse">Loading playlists...</div>
          )}
          {error && <div className="px-4 py-2 text-xs text-red-400">{error}</div>}
          {hasFetched && playlists.length === 0 && !error && (
            <div className="px-4 py-3 text-xs text-text-secondary italic">No playlists found</div>
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