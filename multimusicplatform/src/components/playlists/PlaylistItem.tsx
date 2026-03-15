'use client';

import { useState, useEffect, useRef } from 'react';
import { UnifiedPlaylist, CustomPlaylist } from '@/types/playlist';

interface PlaylistItemProps {
  playlist: UnifiedPlaylist;
  isActive: boolean;
  onClick: (playlist: UnifiedPlaylist) => void;
  onRefresh: (playlist: UnifiedPlaylist) => void;
  customPlaylists?: CustomPlaylist[];
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

  const showRefresh = playlist.platform !== 'spotify';
  const showImport = !!onImportToPlaylist && !!customPlaylists?.length;

  const coverContent = playlist.imageUrl ? (
    <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
  ) : (
    <span className="text-muted">♪</span>
  );

  return (
    <div
      onClick={() => onClick(playlist)}
      className={`flex items-center gap-2.5 px-4 py-2.5 cursor-pointer border-l-2 transition-colors group ${
        isActive ? 'border-l-amber bg-amber-dim text-cream' : 'border-l-transparent text-text hover:bg-warm/50'
      }`}
      title={playlist.name}
    >
      {/* Cover: 32×32 */}
      <div className="w-8 h-8 flex-shrink-0 bg-raised border border-warm flex items-center justify-center text-sm overflow-hidden">
        {coverContent}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{playlist.name}</div>
        <div className="text-[11px] text-muted mt-0.5">
          {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
          {playlist.owner ? ` • ${playlist.owner}` : ''}
        </div>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            className={`p-1.5 transition-all ${isRefreshing ? 'animate-spin text-muted' : 'text-muted opacity-0 group-hover:opacity-100 hover:text-amber'}`}
            title="Refresh playlist tracks"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        )}

        {showImport && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isImporting) setShowImportDropdown(v => !v);
              }}
              disabled={isImporting}
              className={`p-1.5 transition-all ${isImporting ? 'text-amber animate-pulse cursor-not-allowed' : importDone ? 'text-green-400 opacity-100' : 'text-muted opacity-0 group-hover:opacity-100 hover:text-amber'}`}
              title="Import into custom playlist"
            >
              {isImporting ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              ) : importDone ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              )}
            </button>

            {showImportDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-raised border border-warm w-48 py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider font-semibold border-b border-warm">Import into…</p>
                {customPlaylists!.map(pl => (
                  <button key={pl.playlistId} onClick={() => handleImportTo(pl.playlistId)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sub hover:bg-warm/50 transition-colors text-left">
                    <span className="text-amber shrink-0 text-xs">♪</span>
                    <span className="truncate flex-1">{pl.name}</span>
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