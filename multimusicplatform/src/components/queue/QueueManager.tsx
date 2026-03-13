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

  if (upcomingTracks.length === 0) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full mt-4">
      {/* Header */}
      <div className="px-6 py-3 flex items-center shrink-0 border-t border-white/5">
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] text-text-secondary uppercase tracking-[0.2em] font-bold">Up Next</h3>
          {sourceLabel && <p className="text-white/60 text-[11px] truncate mt-0.5">From: {sourceLabel}</p>}
        </div>
        
        {/* Clear Queue Button */}
        <button 
          onClick={clearQueue} 
          className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-colors shrink-0" 
          title="Clear queue"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto relative px-2 pb-6 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        {/* Connection Line */}
        <div className="absolute left-[38px] top-4 bottom-6 w-[1.5px] bg-gradient-to-b from-accent/50 via-surface-hover to-transparent z-0" />

        {upcomingTracks.map((track, i) => {
          const queueIndex = currentIndex + 1 + i;
          const isDragging = dragVisualIndex === i;
          const isDragOver = dragOverVisualIndex === i;
          const showAddDropdown = addToPlaylistTrackIndex === i;
          const justAdded = addFeedback?.trackIndex === i;
          const meta = platformMeta(track.platform);

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
              className={`flex items-center gap-3 px-3 py-2 group cursor-pointer select-none transition-all relative z-10 rounded-lg
                ${isDragging ? 'opacity-40' : 'hover:bg-white/5'}
                ${isDragOver && !isDragging ? 'bg-surface-hover ring-1 ring-accent' : ''}
              `}
            >
              {/* Platform Badge on the Connection Line */}
              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-[2px] border-surface backdrop-blur-md ${meta.bg} ${meta.color} shadow-sm z-10`}>
                 {meta.icon}
              </div>

              {/* Cover Art */}
              <div className="shrink-0 w-8 h-8 rounded-md overflow-hidden bg-surface-hover flex items-center justify-center border border-white/5 shadow-sm">
                {track.album.images[0]?.url ? (
                  <img src={track.album.images[0].url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <DefaultMusicIcon className="w-4 h-4 text-white/20" />
                )}
              </div>
              
              {/* Info Stack */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-[13px] text-white font-medium truncate leading-tight">{track.name}</p>
                <p className="text-[11px] text-text-secondary truncate mt-0.5 leading-tight">{track.artists.map(a => a.name).join(', ')}</p>
              </div>

              {/* ACTION BUTTONS GROUP */}
              <div className="flex items-center gap-0.5 shrink-0">
                <div className="relative flex items-center" ref={showAddDropdown ? addMenuRef : undefined}>
                  
                  {/* Add to playlist Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddToPlaylistTrackIndex(showAddDropdown ? null : i); }}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${justAdded ? 'text-green-400 opacity-100' : 'opacity-0 group-hover:opacity-100 text-text-secondary hover:text-white hover:bg-white/10'}`}
                    title="Add to playlist"
                  >
                    {justAdded ? (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    )}
                  </button>

                  {/* Dropdown Menu */}
                  {showAddDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-surface-hover border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                      <p className="px-3 py-2 text-[10px] text-text-secondary uppercase tracking-wider font-bold border-b border-white/5">Add to playlist</p>
                      {customPlaylists.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-text-secondary text-center italic">No playlists yet</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                          {customPlaylists.map((pl) => (
                            <button key={pl.playlistId} onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(track, pl.playlistId, i); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-200 hover:bg-white/10 transition-colors">
                              <DefaultMusicIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                              <span className="truncate text-left flex-1">{pl.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove from Queue Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromQueue(queueIndex); }}
                  className="w-8 h-8 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}