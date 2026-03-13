'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { CustomPlaylist, UnifiedPlaylist } from '@/types/playlist';
import PlaylistCover from '@/components/music/PlaylistCover';
import { DefaultMusicIcon } from '@/components/icons/BrandIcons';

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
      <div className="flex items-center justify-between px-5 py-2.5 hover:bg-white/5 transition-colors group">
        <button onClick={() => setIsExpanded((prev) => !prev)} className="flex items-center gap-3 flex-1">
          <svg className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-2">
            <DefaultMusicIcon className="w-5 h-5 text-accent" />
            <span className="font-semibold text-sm text-white/90 group-hover:text-white transition-colors">My Playlists</span>
          </div>
        </button>

        <button onClick={onCreateClick} className="text-text-secondary hover:text-accent p-1 transition-colors" title="Create new playlist">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-2 mt-1 space-y-0.5">
          {isLoading && !hasFetched && <div className="px-4 py-3 text-xs text-text-secondary animate-pulse">Loading playlists...</div>}
          {error && <div className="px-4 py-2 text-xs text-red-400">{error}</div>}
          {hasFetched && playlists.length === 0 && !error && <div className="px-4 py-3 text-xs text-text-secondary italic">No playlists yet. Create one!</div>}

          {playlists.map((playlist) => {
            const isActive = activePlaylistId === playlist.playlistId;
            const isDeleting = deletingId === playlist.playlistId;

            return (
              <button
                key={playlist.playlistId}
                onClick={() => onPlaylistSelect(toUnifiedPlaylist(playlist))}
                disabled={isDeleting}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all duration-200 group relative
                  ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-text-secondary hover:bg-white/5 hover:text-white'}
                  ${isDeleting ? 'opacity-50' : ''}
                `}
              >
                {isActive && <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-full" />}
                
                <div className="shrink-0 w-10 h-10 overflow-hidden rounded-md border border-white/5 shadow-sm">
                  <PlaylistCover coverImage={playlist.coverImage} size="sm" />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className={`text-[13px] font-semibold truncate ${isActive ? 'text-white' : 'text-white/80'}`}>{playlist.name}</p>
                  <p className="text-[11px] text-text-secondary truncate mt-0.5">
                    {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
                  </p>
                </div>

                <span
                  onClick={(e) => handleDelete(e, playlist.playlistId)}
                  className={`shrink-0 p-1.5 rounded-md transition-all cursor-pointer ${isDeleting ? 'text-text-secondary' : 'text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10'}`}
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