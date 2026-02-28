'use client';

import { useState, useEffect, useRef } from 'react';
import { UnifiedPlaylist, CustomPlaylist } from '@/types/playlist';

interface PlaylistItemProps {
  playlist: UnifiedPlaylist;
  isActive: boolean;
  onClick: (playlist: UnifiedPlaylist) => void;
  onRefresh: (playlist: UnifiedPlaylist) => void;
  /** Custom playlists to show in the import dropdown */
  customPlaylists?: CustomPlaylist[];
  /** Called when user picks a custom playlist target; returns a Promise so we can show loading state */
  onImportToPlaylist?: (sourcePlaylist: UnifiedPlaylist, targetPlaylistId: string) => Promise<void>;
}

export default function PlaylistItem({
  playlist,
  isActive,
  onClick,
  onRefresh,
  customPlaylists,
  onImportToPlaylist,
}: PlaylistItemProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showImportDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowImportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showImportDropdown]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    await onRefresh(playlist);
    setIsRefreshing(false);
  };

  const handleImportTo = async (targetPlaylistId: string) => {
    setShowImportDropdown(false);
    setIsImporting(true);
    try {
      await onImportToPlaylist!(playlist, targetPlaylistId);
      setImportDone(true);
      setTimeout(() => setImportDone(false), 2000);
    } finally {
      setIsImporting(false);
    }
  };

  // Only show refresh for YouTube and SoundCloud (Spotify is always fresh client-side)
  const showRefresh = playlist.platform !== 'spotify';
  const showImport = !!onImportToPlaylist && !!customPlaylists?.length;

  return (
    <div
      onClick={() => onClick(playlist)}
      className={`
        relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group cursor-pointer
        ${isActive
          ? 'bg-white/20 text-white'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }
      `}
      title={playlist.name}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-white/10">
        {playlist.imageUrl ? (
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            {playlist.id === 'liked-songs' ? '♥' : '🎵'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{playlist.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
          {playlist.owner ? ` · ${playlist.owner}` : ''}
        </p>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Refresh button (YouTube / SoundCloud only) */}
        {showRefresh && (
          <span
            onClick={handleRefresh}
            className={`
              text-xs p-1 rounded transition-all cursor-pointer
              ${isRefreshing
                ? 'animate-spin text-gray-300'
                : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-white'
              }
            `}
            title="Refresh playlist tracks"
          >
            🔄
          </span>
        )}

        {/* Import button */}
        {showImport && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isImporting) setShowImportDropdown(v => !v);
              }}
              className={`
                text-xs p-1 rounded transition-all
                ${isImporting
                  ? 'text-purple-400 animate-pulse cursor-not-allowed'
                  : importDone
                  ? 'text-green-400 opacity-100'
                  : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-purple-400 cursor-pointer'
                }
              `}
              title="Import into custom playlist"
              disabled={isImporting}
            >
              {isImporting ? '⏳' : importDone ? '✓' : '⬇'}
            </button>

            {/* Custom playlist dropdown */}
            {showImportDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-white/15 rounded-lg shadow-2xl w-52 py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-semibold border-b border-white/10">
                  Import into…
                </p>
                {customPlaylists!.map(pl => (
                  <button
                    key={pl.playlistId}
                    onClick={() => handleImportTo(pl.playlistId)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors text-left"
                  >
                    <span className="text-purple-400 shrink-0 text-xs">🎧</span>
                    <span className="truncate">{pl.name}</span>
                    <span className="text-xs text-gray-500 shrink-0 ml-auto">{pl.trackCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
