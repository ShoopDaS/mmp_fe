'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  preview_url: string | null;
  platform: 'spotify' | 'soundcloud' | 'youtube';
}

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onTogglePlay?: () => void;
  onAddToQueue?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  isCustomPlaylist?: boolean;
  onRemoveFromPlaylist?: (track: Track) => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
}

export default function TrackList({
  tracks,
  onPlay,
  onTogglePlay,
  onAddToQueue,
  onPlayNext,
  currentTrack,
  isPlaying = false,
  isCustomPlaylist = false,
  onRemoveFromPlaylist,
  onReorderTracks,
}: TrackListProps) {
  const [feedbackId, setFeedbackId] = useState<{ trackId: string; action: 'queued' | 'next' } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop state (custom playlists only)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const getPlatformColors = (platform: Track['platform'], isCurrentTrack: boolean) => {
    if (isCurrentTrack) {
      return 'bg-purple-600 border-l-4 border-purple-400';
    }

    switch (platform) {
      case 'spotify':
        return 'bg-green-600/40 hover:bg-green-600/60 border-l-4 border-green-400';
      case 'soundcloud':
        return 'bg-orange-600/40 hover:bg-orange-600/60 border-l-4 border-orange-400';
      case 'youtube':
        return 'bg-red-600/40 hover:bg-red-600/60 border-l-4 border-red-400';
      default:
        return 'bg-white/10 hover:bg-white/20';
    }
  };

  const handleTrackClick = (track: Track) => {
    const isCurrentTrack = currentTrack?.id === track.id;

    if (isCurrentTrack && onTogglePlay) {
      onTogglePlay();
    } else {
      onPlay(track);
    }
  };

  const showFeedback = (trackId: string, action: 'queued' | 'next') => {
    setFeedbackId({ trackId, action });
    setTimeout(() => setFeedbackId(null), 1500);
  };

  const handleAddToQueue = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (onAddToQueue) {
      onAddToQueue(track);
      showFeedback(track.id, 'queued');
    }
  };

  const handlePlayNext = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (onPlayNext) {
      onPlayNext(track);
      showFeedback(track.id, 'next');
    }
  };

  // --- Drag-and-drop handlers for custom playlists ---
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    requestAnimationFrame(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.4';
      }
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex && onReorderTracks) {
      onReorderTracks(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, onReorderTracks]);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, []);

  const canDrag = isCustomPlaylist && !!onReorderTracks;

  return (
    <div>
      <div className="space-y-2">
        {tracks.map((track, index) => {
          const isCurrentTrack = currentTrack?.id === track.id;
          const albumImage = track.album.images[0]?.url || '';
          const feedback = feedbackId?.trackId === track.id ? feedbackId.action : null;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;

          return (
            <div
              key={track.id}
              draggable={canDrag}
              onDragStart={canDrag ? (e) => handleDragStart(e, index) : undefined}
              onDragOver={canDrag ? (e) => handleDragOver(e, index) : undefined}
              onDragEnter={canDrag ? (e) => handleDragEnter(e, index) : undefined}
              onDragLeave={canDrag ? handleDragLeave : undefined}
              onDrop={canDrag ? (e) => handleDrop(e, index) : undefined}
              onDragEnd={canDrag ? handleDragEnd : undefined}
              className={`
                flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer relative group
                ${getPlatformColors(track.platform, isCurrentTrack)}
                ${openMenuId === track.id ? 'z-20' : 'z-0'}
                ${isDragging ? 'opacity-40' : ''}
                ${isDragOver ? 'ring-2 ring-purple-500' : ''}
                backdrop-blur-sm
              `}
              onClick={() => handleTrackClick(track)}
            >
              {/* Drag handle for custom playlists */}
              {canDrag && (
                <span
                  className="text-gray-600 group-hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag to reorder"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                  </svg>
                </span>
              )}

              {/* Play/Pause indicator */}
              <div className="text-2xl shrink-0">
                {isCurrentTrack && isPlaying ? '⏸️' : '▶️'}
              </div>

              {/* Album art */}
              {albumImage && (
                <img
                  src={albumImage}
                  alt={track.album.name}
                  className="w-16 h-16 rounded"
                />
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{track.name}</h3>
                <p className="text-sm text-gray-300 truncate">
                  {track.artists.map(a => a.name).join(', ')}
                </p>
                <p className="text-xs text-gray-400 truncate">{track.album.name}</p>
              </div>

              {/* Track menu (kebab) */}
              <div className="relative shrink-0" ref={openMenuId === track.id ? menuRef : undefined}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === track.id ? null : track.id);
                  }}
                  className="p-2 rounded-full bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition-all"
                  title="More options"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {openMenuId === track.id && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                    {onPlayNext && (
                      <button
                        onClick={(e) => {
                          handlePlayNext(e, track);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        {feedback === 'next' ? (
                          <>
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-400">Up next!</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            Add next in queue
                          </>
                        )}
                      </button>
                    )}
                    {onAddToQueue && (
                      <button
                        onClick={(e) => {
                          handleAddToQueue(e, track);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        {feedback === 'queued' ? (
                          <>
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-400">Added!</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add to queue
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Remove from custom playlist button */}
              {isCustomPlaylist && onRemoveFromPlaylist && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromPlaylist(track);
                  }}
                  className="shrink-0 p-2 rounded-full bg-white/10 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-600/30 hover:text-red-400 transition-all"
                  title="Remove from playlist"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
