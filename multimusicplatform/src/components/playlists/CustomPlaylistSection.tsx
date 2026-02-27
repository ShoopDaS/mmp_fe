'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { CustomPlaylist, UnifiedPlaylist } from '@/types/playlist';
import PlaylistCover from '@/components/music/PlaylistCover';

interface CustomPlaylistSectionProps {
  activePlaylistId: string | null;
  onPlaylistSelect: (playlist: UnifiedPlaylist) => void;
  onCreateClick: () => void;
  /** Externally-managed playlist list so parent can update after create */
  playlists: CustomPlaylist[];
  onPlaylistsChange: (playlists: CustomPlaylist[]) => void;
}

export default function CustomPlaylistSection({
  activePlaylistId,
  onPlaylistSelect,
  onCreateClick,
  playlists,
  onPlaylistsChange,
}: CustomPlaylistSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getCustomPlaylists();
      if (response.error) {
        setError(response.error);
        return;
      }
      onPlaylistsChange(response.data?.playlists || []);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setIsLoading(false);
    }
  }, [onPlaylistsChange]);

  useEffect(() => {
    if (!hasFetched && !isLoading) {
      fetchPlaylists();
    }
  }, [hasFetched, isLoading, fetchPlaylists]);

  const handleDelete = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this playlist?')) return;

    setDeletingId(playlistId);
    try {
      const response = await apiClient.deleteCustomPlaylist(playlistId);
      if (!response.error) {
        onPlaylistsChange(playlists.filter((p) => p.playlistId !== playlistId));
      }
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const toUnifiedPlaylist = (cp: CustomPlaylist): UnifiedPlaylist => ({
    id: cp.playlistId,
    platform: 'mmp',
    name: cp.name,
    trackCount: cp.trackCount,
    imageUrl: cp.imageUrl,
    uri: '',
    owner: '',
  });

  return (
    <div className="border-b border-white/10">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 flex-1"
        >
          <span
            className={`transition-transform duration-200 text-xs text-gray-400 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          >
            ▶
          </span>
          <span className="text-lg">🎧</span>
          <span className="font-medium text-sm text-purple-400">My Playlists</span>
          {hasFetched && (
            <span className="text-xs text-gray-500">({playlists.length})</span>
          )}
        </button>

        {/* Create button */}
        <button
          onClick={onCreateClick}
          className="text-gray-400 hover:text-white text-lg px-1 transition-colors"
          title="Create new playlist"
        >
          +
        </button>
      </div>

      {/* Playlist list */}
      {isExpanded && (
        <div className="px-2 pb-2">
          {isLoading && !hasFetched && (
            <div className="px-3 py-4 text-center text-sm text-gray-400">
              Loading playlists...
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          {hasFetched && playlists.length === 0 && !error && (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No playlists yet. Create one!
            </div>
          )}

          {playlists.map((playlist) => {
            const isActive = activePlaylistId === playlist.playlistId;
            const isDeleting = deletingId === playlist.playlistId;

            return (
              <button
                key={playlist.playlistId}
                onClick={() => onPlaylistSelect(toUnifiedPlaylist(playlist))}
                disabled={isDeleting}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }
                  ${isDeleting ? 'opacity-50' : ''}
                `}
              >
                {/* Thumbnail */}
                <PlaylistCover coverImage={playlist.coverImage} size="sm" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{playlist.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
                  </p>
                  {playlist.description && (
                    <p className="text-xs text-gray-500 truncate">{playlist.description}</p>
                  )}
                </div>

                {/* Delete button */}
                <span
                  onClick={(e) => handleDelete(e, playlist.playlistId)}
                  className={`
                    flex-shrink-0 text-xs p-1 rounded transition-all cursor-pointer
                    ${isDeleting
                      ? 'text-gray-300'
                      : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-400'
                    }
                  `}
                  title="Delete playlist"
                >
                  {isDeleting ? '...' : '✕'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
