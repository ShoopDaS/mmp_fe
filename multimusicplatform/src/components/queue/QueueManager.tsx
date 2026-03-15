'use client';

import { useState, useRef, useCallback } from 'react';
import { useQueue } from '@/hooks/useQueue';
import { CustomPlaylist } from '@/types/playlist';
import { apiClient } from '@/lib/api';
import { Track } from '@/lib/player-adapters/IPlayerAdapter';
import { SpotifyIcon, SoundCloudIcon, YouTubeIcon, DefaultMusicIcon } from '@/components/icons/BrandIcons';

interface QueueManagerProps {
  customPlaylists: CustomPlaylist[];
}

export default function QueueManager({ customPlaylists }: QueueManagerProps) {
  const { tracks, currentIndex, sourceLabel, jumpTo, removeFromQueue, moveTrack, clearQueue } = useQueue();

  // Drag-and-drop state
  const [dragVisualIndex, setDragVisualIndex] = useState<number | null>(null);
  const [dragOverVisualIndex, setDragOverVisualIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Add-to-playlist dropdown state
  const [addToPlaylistTrackIndex, setAddToPlaylistTrackIndex] = useState<number | null>(null);
  const [addFeedback, setAddFeedback] = useState<{ trackIndex: number; playlistId: string } | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const upcomingTracks = currentIndex >= 0 ? tracks.slice(currentIndex + 1) : [];

  const platformMeta = (platform: string) => {
    switch (platform) {
      case 'spotify': return { icon: <SpotifyIcon className="w-3.5 h-3.5" />, color: 'text-spotify', bg: 'bg-spotify/20 border-spotify/30' };
      case 'youtube': return { icon: <YouTubeIcon className="w-3.5 h-3.5" />, color: 'text-youtube', bg: 'bg-youtube/20 border-youtube/30' };
      case 'soundcloud': return { icon: <SoundCloudIcon className="w-3.5 h-3.5" />, color: 'text-soundcloud', bg: 'bg-soundcloud/20 border-soundcloud/30' };
      default: return { icon: <DefaultMusicIcon className="w-3.5 h-3.5" />, color: 'text-accent', bg: 'bg-accent/20 border-accent/30' };
    }
  };

  const handleAddToPlaylist = async (track: Track, playlistId: string, trackIndex: number) => {
    try {
      await apiClient.addTrackToCustomPlaylist(playlistId, {
        trackId: track.id, platform: track.platform, name: track.name, uri: track.uri,
        artists: track.artists, albumName: track.album.name, albumImageUrl: track.album.images[0]?.url || '',
        duration_ms: track.duration_ms, preview_url: track.preview_url || null,
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
    requestAnimationFrame(() => { if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4'; });
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

  const currentTrack = currentIndex >= 0 && currentIndex < tracks.length ? tracks[currentIndex] : null;

  const platformDotColor = (platform: string) => {
    switch (platform) {
      case 'spotify': return 'bg-spotify';
      case 'youtube': return 'bg-youtube';
      case 'soundcloud': return 'bg-soundcloud';
      default: return 'bg-amber';
    }
  };

  if (upcomingTracks.length === 0) return null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-warm">
        <span className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted">
          Up Next &middot; {upcomingTracks.length} track{upcomingTracks.length !== 1 ? 's' : ''}
        </span>
        <button onClick={clearQueue} className="text-muted hover:text-cream transition-colors" title="Clear queue">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Currently playing track */}
      {currentTrack && (
        <div className="bg-amber-dim border-l-2 border-l-amber py-2.5 px-5 flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${platformDotColor(currentTrack.platform)}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-cream font-medium truncate">{currentTrack.name}</p>
            <p className="text-[12px] text-sub truncate">{currentTrack.artists.map(a => a.name).join(', ')}</p>
          </div>
          <span className="font-condensed text-[9px] tracking-[0.15em] uppercase text-amber">Playing</span>
        </div>
      )}

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto">
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
              onClick={() => jumpTo(queueIndex)}
              className={`group flex items-center gap-3 py-2.5 px-5 cursor-pointer select-none transition-colors
                ${isDragging ? 'opacity-40' : 'hover:bg-warm/50'}
                ${isDragOver && !isDragging ? 'bg-warm border-l-2 border-l-amber' : 'border-l-2 border-l-transparent'}
              `}
            >
              {/* Drag handle */}
              <span className="text-muted text-sm opacity-0 group-hover:opacity-70 transition-opacity cursor-grab shrink-0">&#x2807;</span>

              {/* Platform dot */}
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${platformDotColor(track.platform)}`} />

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-cream truncate">{track.name}</p>
                <p className="text-[12px] text-sub truncate">{track.artists.map(a => a.name).join(', ')}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <div className="relative" ref={showAddDropdown ? addMenuRef : undefined}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddToPlaylistTrackIndex(showAddDropdown ? null : i); }}
                    className={`w-7 h-7 flex items-center justify-center transition-all ${justAdded ? 'text-green-400 opacity-100' : 'opacity-0 group-hover:opacity-70 text-muted hover:text-cream'}`}
                    title="Add to playlist"
                  >
                    {justAdded ? (
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    )}
                  </button>
                  {showAddDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-raised border border-warm shadow-2xl z-50 overflow-hidden">
                      <p className="px-3 py-2 text-[9px] font-condensed tracking-[0.15em] uppercase text-muted border-b border-warm">Add to playlist</p>
                      {customPlaylists.length === 0 ? (
                        <p className="px-3 py-3 text-[11px] text-muted text-center italic">No playlists yet</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          {customPlaylists.map((pl) => (
                            <button key={pl.playlistId} onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(track, pl.playlistId, i); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-cream hover:bg-warm transition-colors">
                              <span className="truncate text-left flex-1">{pl.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromQueue(queueIndex); }}
                  className="w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-70 text-muted hover:text-red-400 transition-all shrink-0"
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}