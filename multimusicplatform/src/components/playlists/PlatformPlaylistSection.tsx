'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { UnifiedPlaylist } from '@/types/playlist';
import PlaylistItem from './PlaylistItem';

interface PlatformPlaylistSectionProps {
  platform: 'spotify' | 'youtube' | 'soundcloud';
  token: string | null;
  activePlaylistId: string | null;
  onPlaylistSelect: (playlist: UnifiedPlaylist) => void;
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
}: PlatformPlaylistSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playlists, setPlaylists] = useState<UnifiedPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const config = platformConfig[platform];

  const fetchPlaylists = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      if (platform === 'spotify') {
        // Client-side fetch directly from Spotify API
        if (!token) {
          setError('No Spotify token');
          return;
        }
        const spotifyPlaylists = await fetchSpotifyPlaylists(token);
        setPlaylists(spotifyPlaylists);
        setSource('client');
        setCachedAt(null);
      } else {
        // YouTube and SoundCloud go through backend with caching
        const response = await apiClient.getPlatformPlaylists(platform, forceRefresh);
        if (response.error) {
          setError(response.error);
          return;
        }
        setPlaylists(response.data?.playlists || []);
        setSource(response.data?.source || null);
        setCachedAt(response.data?.cachedAt || null);
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

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchPlaylists(true);
  };

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  // Format "last updated" text
  const getLastUpdatedText = (): string | null => {
    if (!cachedAt || platform === 'spotify') return null;
    const now = Math.floor(Date.now() / 1000);
    const diffMinutes = Math.floor((now - cachedAt) / 60);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const lastUpdated = getLastUpdatedText();

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

        {/* Refresh button for cached platforms */}
        {platform !== 'spotify' && hasFetched && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {lastUpdated && (
              <span className="text-xs text-gray-500">{lastUpdated}</span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`text-gray-400 hover:text-white transition-colors text-sm p-1 ${
                isLoading ? 'animate-spin' : ''
              }`}
              title="Refresh playlists"
            >
              🔄
            </button>
          </div>
        )}
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

  return allPlaylists;
}