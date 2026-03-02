'use client';

import { useState, useRef, useCallback } from 'react';
import { useQueue } from '@/hooks/useQueue';
import { CustomPlaylist } from '@/types/playlist';
import { apiClient } from '@/lib/api';
import { Track } from '@/lib/player-adapters/IPlayerAdapter';

interface QueueManagerProps {
  customPlaylists: CustomPlaylist[];
}

export default function QueueManager({ customPlaylists }: QueueManagerProps) {
  const {
    tracks,
    currentIndex,
    sourceLabel,
    jumpTo,
    removeFromQueue,
    moveTrack,
    clearQueue,
  } = useQueue();

  // Drag-and-drop state
  const [dragVisualIndex, setDragVisualIndex] = useState<number | null>(null);
  const [dragOverVisualIndex, setDragOverVisualIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Add-to-playlist dropdown state
  const [addToPlaylistTrackIndex, setAddToPlaylistTrackIndex] = useState<number | null>(null);
  const [addFeedback, setAddFeedback] = useState<{ trackIndex: number; playlistId: string } | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const upcomingTracks = currentIndex >= 0 ? tracks.slice(currentIndex + 1) : [];

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'spotify': return 'bg-spotify shadow-[0_0_8px_rgba(29,185,84,0.6)]';
      case 'soundcloud': return 'bg-soundcloud shadow-[0_0_8px_rgba(255,85,0,0.6)]';
      case 'youtube': return 'bg-youtube shadow-[0_0_8px_rgba(255,0,0,0.6)]';
      default: return 'bg-accent shadow-[0_0_8px_rgba(99,102,241,0.6)]';
    }
  };

  const handleAddToPlaylist = async (track: Track, playlistId: string, trackIndex: number) => {
    try {
      await apiClient.addTrackToCustomPlaylist(playlistId, {
        trackId: track.id,
        platform: track.platform,
        name: track.name,
        uri: track.uri,
        artists: track.artists,
        albumName: track.album.name,
        albumImageUrl: track.album.images[0]?.url || '',
        duration_ms: track.duration_ms,
        preview_url: track.preview_url || null,
      });
      setAddFeedback({ trackIndex, playlistId });
      setTimeout(() => setAddFeedback(null), 1500);
    } catch (err) {
      console.error('Failed to add track to playlist:', err);
    }
    setAddToPlaylistTrackIndex(null);
  };

  // --- Drag-and-drop handlers ---
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, visualIndex: number) => {
    setDragVisualIndex(visualIndex);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(visualIndex));
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4';
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, visualIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverVisualIndex(visualIndex);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>, visualIndex: number) => {
    e.preventDefault();
    setDragOverVisualIndex(visualIndex);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setDragOverVisualIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toVisualIndex: number) => {
    e.preventDefault();
    if (dragVisualIndex !== null && dragVisualIndex !== toVisualIndex) {
      const fromQueueIndex = currentIndex + 1 + dragVisualIndex;
      const toQueueIndex = currentIndex + 1 + toVisualIndex;
      moveTrack(fromQueueIndex, toQueueIndex);
    }
    setDragVisualIndex(null);
    setDragOverVisualIndex(null);
  }, [dragVisualIndex, currentIndex, moveTrack]);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    setDragVisualIndex(null);
    setDragOverVisualIndex(null);
    dragNodeRef.current = null;
  }, []);

  if (upcomingTracks.length === 0) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center shrink-0 border-t border-white/5">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">Seamless Queue</h3>
          {sourceLabel && (
            <p className="text-text-secondary text-xs truncate mt-0.5">From: {sourceLabel}</p>
          )}
        </div>
        <button
          onClick={clearQueue}
          className="p-1.5 rounded-md text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          title="Clear queue"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* List (drag-and-drop enabled) */}
      <div className="flex-1 overflow-y-auto relative px-2 pb-6">
        {/* The Seamless Connection Line */}
        <div className="absolute left-[26px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-accent via-surface-hover to-surface-hover z-0" />

        {upcomingTracks.map((track, i) => {
          const queueIndex = currentIndex + 1 + i;
          const isDragging = dragVisualIndex === i;
          const isDragOver = dragOverVisualIndex === i;
          const showAddDropdown = addToPlaylistTrackIndex === i;
          const justAdded = addFeedback?.trackIndex === i;

          return (
            <div
              key={`${track.id}-${queueIndex}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnter={(e) => handleDragEnter(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center gap-3 px-3 py-2 group cursor-pointer select-none transition-colors relative z-10 rounded-lg
                ${isDragging ? 'opacity-40' : 'hover:bg-white/5'}
                ${isDragOver && !isDragging ? 'border-t-2 border-accent' : 'border-t-2 border-transparent'}
              `}
              onClick={() => jumpTo(queueIndex)}
            >
              {/* Platform Badge (on the line) */}
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 outline outline-4 outline-surface ${getPlatformColor(track.platform)}`} />

              {/* Cover Art */}
              {track.album.images[0]?.url && (
                <img src={track.album.images[0].url} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{track.name}</p>
                <p className="text-text-secondary text-[11px] truncate">{track.artists.map(a => a.name).join(', ')}</p>
              </div>

              {/* Add to playlist button */}
              <div className="relative shrink-0" ref={showAddDropdown ? addMenuRef : undefined}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddToPlaylistTrackIndex(showAddDropdown ? null : i);
                  }}
                  className={`
                    p-1.5 rounded-md transition-opacity
                    ${justAdded ? 'text-green-400 opacity-100' : 'opacity-0 group-hover:opacity-100 text-text-secondary hover:text-white hover:bg-white/10'}
                  `}
                  title="Add to playlist"
                >
                  {justAdded ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  )}
                </button>

                {/* Playlist sub-dropdown */}
                {showAddDropdown && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-surface-hover border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <p className="px-3 py-2 text-[10px] text-text-secondary uppercase tracking-wider font-semibold border-b border-white/5">
                      Add to playlist
                    </p>
                    {customPlaylists.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-text-secondary text-center">No playlists yet</p>
                    ) : (
                      customPlaylists.map((pl) => (
                        <button
                          key={pl.playlistId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToPlaylist(track, pl.playlistId, i);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-accent text-xs">🎧</span>
                          <span className="truncate text-left flex-1">{pl.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); removeFromQueue(queueIndex); }}
                className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-opacity p-1.5 rounded-md hover:bg-red-500/10 shrink-0"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}