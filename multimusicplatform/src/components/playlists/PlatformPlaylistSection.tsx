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

  // Spotify-only: pinned playlists (Discover Weekly, Daily Mix, etc.)
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('mmp-spotify-pinned') || '[]'); }
    catch { return []; }
  });
  const [pinnedPlaylists, setPinnedPlaylists] = useState<UnifiedPlaylist[]>([]);
  const [addInput, setAddInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  // Load pinned playlists whenever token or pinnedIds change (Spotify only)
  useEffect(() => {
    if (platform !== 'spotify' || !token || !isExpanded || pinnedIds.length === 0) return;
    fetchPinnedPlaylists(token, pinnedIds).then(setPinnedPlaylists);
  }, [platform, token, isExpanded, pinnedIds]);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  const handlePlaylistRefresh = async (playlist: UnifiedPlaylist) => {
    if (platform === 'spotify') {
      onPlaylistRefresh(playlist);
      return;
    }

    try {
      const response = await apiClient.refreshPlaylist(
        platform as 'youtube' | 'soundcloud',
        playlist.id
      );
      if (!response.error && response.data?.playlist) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id ? response.data!.playlist : p
          )
        );
      }
    } catch (err) {
      console.error(`Error refreshing ${platform} playlist ${playlist.id}:`, err);
    }

    onPlaylistRefresh(playlist);
  };

  const handleAddPinned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !addInput.trim()) return;
    const id = extractPlaylistId(addInput.trim());
    if (!id) {
      setAddError('Invalid Spotify URL or URI');
      return;
    }
    if (pinnedIds.includes(id)) {
      setAddError('Already pinned');
      return;
    }
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/playlists/${id}?fields=id,name,images,tracks.total,uri,owner`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Playlist not found or not accessible');
      const data = await res.json();
      const playlist: UnifiedPlaylist = {
        id: data.id,
        platform: 'spotify',
        name: data.name,
        trackCount: data.tracks?.total || 0,
        imageUrl: data.images?.[0]?.url || null,
        uri: data.uri,
        owner: data.owner?.id === 'spotify' ? 'Spotify' : (data.owner?.display_name || ''),
      };
      const newIds = [...pinnedIds, id];
      setPinnedIds(newIds);
      localStorage.setItem('mmp-spotify-pinned', JSON.stringify(newIds));
      setPinnedPlaylists((prev) => [...prev, playlist]);
      setAddInput('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add playlist');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUnpin = (id: string) => {
    const newIds = pinnedIds.filter((pid) => pid !== id);
    setPinnedIds(newIds);
    localStorage.setItem('mmp-spotify-pinned', JSON.stringify(newIds));
    setPinnedPlaylists((prev) => prev.filter((p) => p.id !== id));
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
            <span className="text-xs text-gray-500">
              ({pinnedPlaylists.length + playlists.length})
            </span>
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

          {/* Pinned playlists (Spotify only) — shown first */}
          {platform === 'spotify' && pinnedPlaylists.map((playlist) => (
            <div key={`pinned-${playlist.id}`} className="relative group">
              <PlaylistItem
                playlist={playlist}
                isActive={activePlaylistId === playlist.id}
                onClick={onPlaylistSelect}
                onRefresh={handlePlaylistRefresh}
                customPlaylists={customPlaylists}
                onImportToPlaylist={onImportToPlaylist}
              />
              <button
                onClick={() => handleUnpin(playlist.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-sm leading-none px-1 z-10"
                title="Unpin playlist"
              >
                ×
              </button>
            </div>
          ))}

          {hasFetched && pinnedPlaylists.length === 0 && playlists.length === 0 && !error && (
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

          {/* Add pinned playlist by URL (Spotify only) */}
          {platform === 'spotify' && hasFetched && (
            <div className="mt-2 px-1">
              <form onSubmit={handleAddPinned} className="flex gap-1">
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => { setAddInput(e.target.value); setAddError(null); }}
                  placeholder="Paste Spotify playlist URL to pin…"
                  className="flex-1 text-xs bg-white/5 rounded px-2 py-1.5 text-gray-300 placeholder-gray-600 outline-none focus:bg-white/10"
                />
                <button
                  type="submit"
                  disabled={!addInput.trim() || isAdding}
                  className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40 transition-colors"
                >
                  {isAdding ? '…' : '+'}
                </button>
              </form>
              {addError && <p className="text-xs text-red-400 mt-1 px-1">{addError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== Spotify Client-Side Fetch ==========

function extractPlaylistId(input: string): string | null {
  // URL: https://open.spotify.com/playlist/37i9dQZEVXcJZyENOWUFo7?si=...
  const urlMatch = input.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  // URI: spotify:playlist:37i9dQZEVXcJZyENOWUFo7
  const uriMatch = input.match(/spotify:playlist:([A-Za-z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  // Raw 22-char alphanumeric ID
  if (/^[A-Za-z0-9]{22}$/.test(input)) return input;
  return null;
}

async function fetchPinnedPlaylists(token: string, ids: string[]): Promise<UnifiedPlaylist[]> {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/playlists/${id}?fields=id,name,images,tracks.total,uri,owner`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return {
          id: data.id,
          platform: 'spotify' as const,
          name: data.name,
          trackCount: data.tracks?.total || 0,
          imageUrl: data.images?.[0]?.url || null,
          uri: data.uri,
          owner: data.owner?.id === 'spotify' ? 'Spotify' : (data.owner?.display_name || ''),
        } as UnifiedPlaylist;
      } catch {
        return null;
      }
    })
  );
  return results.filter((p): p is UnifiedPlaylist => p !== null);
}

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

    for (const item of (data.items || [])) {
      if (!item) continue;
      allPlaylists.push({
        id: item.id,
        platform: 'spotify',
        name: item.name,
        trackCount: item.tracks?.total || 0,
        imageUrl: item.images?.[0]?.url || null,
        uri: item.uri,
        owner: item.owner?.id === 'spotify' ? 'Spotify' : (item.owner?.display_name || ''),
      });
    }

    url = data.next || null;
  }

  return allPlaylists;
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
