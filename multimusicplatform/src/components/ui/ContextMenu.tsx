'use client';
import { useState, useEffect } from 'react';
import { useContextMenu } from '@/contexts/ContextMenuContext';
import { useQueue } from '@/hooks/useQueue';
import { useHub } from '@/contexts/HubContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';

export default function ContextMenu() {
  const { state, closeMenu } = useContextMenu();
  const queue = useQueue();
  const {
    customPlaylists, setCustomPlaylists, playlistTrackIds, setPlaylistTrackIds, requestPlaylistTrackIds,
    ownedPlatformPlaylists, platformPlaylistTrackIds, requestOwnedPlatformPlaylists, addToPlatformPlaylist,
  } = useHub();
  const { showToast } = useToast();
  const [showStavePlaylists, setShowStavePlaylists] = useState(false);
  const [showPlatformPlaylists, setShowPlatformPlaylists] = useState(false);

  // Reset submenus whenever a new menu opens
  useEffect(() => {
    if (state.isOpen) {
      setShowStavePlaylists(false);
      setShowPlatformPlaylists(false);
    }
  }, [state.track?.id, state.isOpen]);

  if (!state.isOpen || !state.track) return null;
  const track = state.track;

  // Show "Add to Platform Playlist" for all platforms
  const canAddToPlatform = true;
  const platformLabel = track.platform === 'spotify' ? 'Spotify' : track.platform === 'soundcloud' ? 'SoundCloud' : 'YouTube';
  const platformPlaylists = ownedPlatformPlaylists[track.platform as 'spotify' | 'youtube' | 'soundcloud'];

  // Label differs by mode
  const stavePlaylists_label = state.mode === 'library-platform' ? 'Import to Stave Playlist' : 'Add to Stave Playlist';

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

  const handleAddToStavePlaylist = async (playlistId: string) => {
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

  const handleAddToPlatformPlaylist = async (playlistId: string) => {
    try {
      await addToPlatformPlaylist(track, playlistId);
      showToast('Added to playlist');
    } catch {
      showToast('Failed to add');
    }
    closeMenu();
  };

  const handleRemove = () => {
    state.onRemoveFromPlaylist?.(track);
    closeMenu();
  };

  const handleToggleStavePlaylists = () => {
    if (!showStavePlaylists && customPlaylists.length) {
      const unloaded = customPlaylists.map(pl => pl.playlistId).filter(id => !playlistTrackIds[id]);
      if (unloaded.length) requestPlaylistTrackIds(unloaded);
    }
    setShowStavePlaylists(s => !s);
  };

  const handleTogglePlatformPlaylists = () => {
    if (!showPlatformPlaylists) {
      requestOwnedPlatformPlaylists(track.platform as 'spotify' | 'youtube');
    }
    setShowPlatformPlaylists(s => !s);
  };

  return (
    <div
      id="stave-context-menu"
      className="fixed z-[10000]"
      style={{ left: state.x, top: state.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-card border border-warm min-w-[210px] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

        {/* Queue actions */}
        <button onClick={handleAddNext} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
          <span className="w-4 text-muted">↑</span> Add Next in Queue
        </button>
        <button onClick={handleAddToQueue} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
          <span className="w-4 text-muted">↓</span> Add to Queue
        </button>
        <div className="h-px bg-warm my-1" />

        {/* Add to Stave Playlist */}
        <button onClick={handleToggleStavePlaylists} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
          <span className="w-4 text-muted">+</span> {stavePlaylists_label}
          <span className="ml-auto text-muted">{showStavePlaylists ? '▾' : '▸'}</span>
        </button>
        {showStavePlaylists && (
          <div className="border-t border-warm max-h-44 overflow-y-auto">
            {customPlaylists.length === 0 ? (
              <p className="px-4 py-2.5 font-condensed text-xs text-muted italic">No playlists yet</p>
            ) : customPlaylists.map(pl => {
              const alreadyIn = playlistTrackIds[pl.playlistId]?.has(track.id);
              return (
                <button
                  key={pl.playlistId}
                  onClick={() => !alreadyIn && handleAddToStavePlaylist(pl.playlistId)}
                  disabled={alreadyIn}
                  className={`w-full flex items-center gap-3 px-6 py-2 font-condensed text-xs tracking-wider transition-colors text-left ${alreadyIn ? 'text-muted cursor-not-allowed' : 'text-text hover:bg-amber-dim hover:text-cream'}`}
                >
                  <span className="truncate flex-1">{pl.name}</span>
                  {alreadyIn && <span className="ml-auto text-amber text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Add to Platform Playlist (search mode only, non-SoundCloud) */}
        {canAddToPlatform && (
          <>
            <button onClick={handleTogglePlatformPlaylists} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-text hover:bg-amber-dim hover:text-cream transition-colors text-left">
              <span className="w-4 text-muted">↗</span> Add to {platformLabel} Playlist
              <span className="ml-auto text-muted">{showPlatformPlaylists ? '▾' : '▸'}</span>
            </button>
            {showPlatformPlaylists && (
              <div className="border-t border-warm max-h-44 overflow-y-auto">
                {!platformPlaylists || platformPlaylists === 'loading' ? (
                  <p className="px-4 py-2.5 font-condensed text-xs text-muted italic animate-pulse">Loading...</p>
                ) : platformPlaylists.length === 0 ? (
                  <p className="px-4 py-2.5 font-condensed text-xs text-muted italic">No playlists found</p>
                ) : platformPlaylists.map(pl => {
                  const platformDupKey = track.platform === 'soundcloud' ? track.id.replace('soundcloud-', '') : track.uri;
                  const alreadyIn = platformPlaylistTrackIds[pl.id]?.has(platformDupKey);
                  return (
                    <button
                      key={pl.id}
                      onClick={() => !alreadyIn && handleAddToPlatformPlaylist(pl.id)}
                      disabled={alreadyIn}
                      className={`w-full flex items-center gap-3 px-6 py-2 font-condensed text-xs tracking-wider transition-colors text-left ${alreadyIn ? 'text-muted cursor-not-allowed' : 'text-text hover:bg-amber-dim hover:text-cream'}`}
                    >
                      <span className="truncate flex-1">{pl.name}</span>
                      {alreadyIn && <span className="ml-auto text-amber text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Remove from Playlist (library mode only) */}
        {state.mode === 'library' && state.onRemoveFromPlaylist && (
          <>
            <div className="h-px bg-warm my-1" />
            <button onClick={handleRemove} className="w-full flex items-center gap-3 px-4 py-2.5 font-condensed text-xs tracking-wider text-red-400 hover:bg-red-500/10 transition-colors text-left">
              <span className="w-4">✕</span> Remove from Playlist
            </button>
          </>
        )}

      </div>
    </div>
  );
}
