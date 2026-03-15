'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { CustomPlaylist, UnifiedPlaylist } from '@/types/playlist';
import PlaylistCover from '@/components/music/PlaylistCover';

interface CustomPlaylistSectionProps {
  activePlaylistId: string | null;
  onPlaylistSelect: (playlist: UnifiedPlaylist) => void;
  onCreateClick: () => void;
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
    } finally {
      setDeletingId(null);
    }
  };

  const toUnifiedPlaylist = (cp: CustomPlaylist): UnifiedPlaylist => ({
    id: cp.playlistId, platform: 'mmp', name: cp.name, trackCount: cp.trackCount,
    imageUrl: cp.imageUrl, uri: '', owner: '',
  });

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-4 py-2 cursor-pointer" onClick={() => setIsExpanded((prev) => !prev)}>
        <span className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted">My Playlists</span>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onCreateClick(); }} className="text-muted hover:text-amber text-lg leading-none transition-colors" title="Create new playlist">+</button>
          <span className="text-muted text-[10px]">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="pb-2 mt-1 space-y-0.5">
          {isLoading && !hasFetched && <div className="px-4 py-3 text-muted text-xs animate-pulse">Loading playlists...</div>}
          {error && <div className="px-4 py-2 text-red-400 text-xs">{error}</div>}
          {hasFetched && playlists.length === 0 && !error && <div className="px-4 py-3 text-muted text-xs italic">No playlists yet. Create one!</div>}

          {playlists.map((playlist) => {
            const isActive = activePlaylistId === playlist.playlistId;
            const isDeleting = deletingId === playlist.playlistId;

            return (
              <button
                key={playlist.playlistId}
                onClick={() => onPlaylistSelect(toUnifiedPlaylist(playlist))}
                disabled={isDeleting}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors group border-l-2 ${
                  isActive ? 'border-l-amber bg-amber-dim text-cream' : 'border-l-transparent text-text hover:bg-warm/50'
                } ${isDeleting ? 'opacity-50' : ''}`}
              >
                <div className="shrink-0 w-8 h-8 overflow-hidden border border-warm bg-raised">
                  <PlaylistCover coverImage={playlist.coverImage} size="sm" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{playlist.name}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <span
                  onClick={(e) => handleDelete(e, playlist.playlistId)}
                  className={`shrink-0 p-1.5 transition-all cursor-pointer ${isDeleting ? 'text-muted' : 'text-muted opacity-0 group-hover:opacity-100 hover:text-red-400'}`}
                  title="Delete playlist"
                >
                  {isDeleting ? '...' : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}