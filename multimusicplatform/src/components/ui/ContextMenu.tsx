'use client';
import { useState } from 'react';
import { useContextMenu } from '@/contexts/ContextMenuContext';
import { useQueue } from '@/hooks/useQueue';
import { useHub } from '@/contexts/HubContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';

export default function ContextMenu() {
  const { state, closeMenu } = useContextMenu();
  const queue = useQueue();
  const { customPlaylists, setCustomPlaylists, playlistTrackIds, setPlaylistTrackIds } = useHub();
  const { showToast } = useToast();
  const [showPlaylists, setShowPlaylists] = useState(false);

  if (!state.isOpen || !state.track) return null;
  const track = state.track;

  const handleAddNext = () => {
    queue.playNext(track as any);
    showToast('Added next in queue');
    closeMenu();
  };

  const handleAddToQueue = () => {
    queue.addToQueue([track] as any);
    showToast('Added to queue');
    closeMenu();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (playlistTrackIds[playlistId]?.has(track.id)) {
      showToast('Already in playlist');
      closeMenu();
      return;
    }
    try {
      await apiClient.addTrackToCustomPlaylist(playlistId, {
        trackId: track.id, platform: track.platform, name: track.name, uri: track.uri,
        artists: track.artists, albumName: track.album.name, albumImageUrl: track.album.images[0]?.url || '',
        duration_ms: track.duration_ms, preview_url: track.preview_url || null,
      });
      setCustomPlaylists(prev => prev.map(p => p.playlistId === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p));
      setPlaylistTrackIds(prev => ({ ...prev, [playlistId]: new Set(prev[playlistId] || []).add(track.id) }));
      showToast('Added to playlist');
    } catch {
      showToast('Failed to add');
    }
    closeMenu();
  };

  return (
    <div
      className="fixed z-[10000]"
      style={{ left: state.x, top: state.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-card border border-warm min-w-[210px] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <button onClick={handleAddNext} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
          <span className="w-4 text-muted">↑</span> Add Next in Queue
        </button>
        <button onClick={handleAddToQueue} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
          <span className="w-4 text-muted">↓</span> Add to Queue
        </button>
        <div className="h-px bg-warm mx-0 my-1" />
        <button onClick={() => setShowPlaylists(!showPlaylists)} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
          <span className="w-4 text-muted">+</span> Add to Stave Playlist
          <span className="ml-auto text-muted">{showPlaylists ? '▾' : '▸'}</span>
        </button>
        {showPlaylists && (
          <div className="border-t border-warm">
            {customPlaylists.length === 0 ? (
              <p className="px-4 py-2.5 font-condensed text-xs text-muted italic">No playlists yet</p>
            ) : customPlaylists.map(pl => {
              const alreadyIn = playlistTrackIds[pl.playlistId]?.has(track.id);
              return (
                <button
                  key={pl.playlistId}
                  onClick={() => !alreadyIn && handleAddToPlaylist(pl.playlistId)}
                  disabled={alreadyIn}
                  className={`w-full flex items-center gap-3 px-6 py-2 font-condensed text-xs tracking-wider transition-colors text-left ${alreadyIn ? 'text-muted cursor-not-allowed' : 'text-text hover:bg-amber-dim hover:text-cream'}`}
                >
                  <span className="truncate">{pl.name}</span>
                  {alreadyIn && <span className="ml-auto text-amber text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        {state.mode === 'library' && (
          <>
            <div className="h-px bg-warm mx-0 my-1" />
            <button onClick={() => { showToast('Remove — wire in WP-7'); closeMenu(); }} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-red-400 hover:bg-red-500/10 transition-colors text-left">
              <span className="w-4">✕</span> Remove from Playlist
            </button>
          </>
        )}
      </div>
    </div>
  );
}
