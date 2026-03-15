'use client';

import { useState, useRef, useCallback } from 'react';
import { useContextMenu } from '@/contexts/ContextMenuContext';

interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  platform: 'spotify' | 'soundcloud' | 'youtube';
}

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onTogglePlay?: () => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  isCustomPlaylist?: boolean;
  onRemoveFromPlaylist?: (track: Track) => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  mode?: 'search' | 'library' | 'library-platform';
}

export default function TrackList({
  tracks, onPlay, onTogglePlay, currentTrack, isPlaying = false,
  isCustomPlaylist = false, onRemoveFromPlaylist, onReorderTracks,
  mode = 'search',
}: TrackListProps) {
  const { openMenu } = useContextMenu();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const pipBg = (platform: string) => {
    switch (platform) {
      case 'spotify': return 'bg-spotify';
      case 'youtube': return 'bg-youtube';
      case 'soundcloud': return 'bg-soundcloud';
      default: return 'bg-muted';
    }
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id && onTogglePlay) onTogglePlay();
    else onPlay(track);
  };

  const handleKebabClick = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    // Wrap remove so the animation plays before actual removal
    const wrappedRemove = onRemoveFromPlaylist ? (t: Track) => {
      setRemovingId(t.id);
      setTimeout(() => { onRemoveFromPlaylist(t); setRemovingId(null); }, 300);
    } : undefined;
    openMenu(e, mode, track, { onRemoveFromPlaylist: wrappedRemove });
  };

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    requestAnimationFrame(() => { if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4'; });
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
    if (e.currentTarget === e.target) setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex && onReorderTracks) onReorderTracks(dragIndex, toIndex);
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, onReorderTracks]);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, []);

  const canDrag = isCustomPlaylist && !!onReorderTracks;

  return (
    <div className="flex flex-col">
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const albumImage = track.album.images[0]?.url || '';
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index && dragIndex !== index;
        const pipBgClass = pipBg(track.platform);

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
              flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-warm border-l-2 transition-colors group relative
              ${isCurrentTrack ? 'bg-amber-dim border-l-amber' : 'border-l-transparent hover:bg-warm/50'}
              ${removingId === track.id ? 'opacity-0 translate-x-8 scale-95 pointer-events-none' : ''}
              ${isDragging && removingId !== track.id ? 'opacity-40' : ''}
              ${isDragOver ? 'ring-1 ring-amber bg-warm/50' : ''}
            `}
            onClick={() => handleTrackClick(track)}
          >
            {canDrag && (
              <span className="text-muted group-hover:text-sub cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder" onMouseDown={(e) => e.stopPropagation()}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" /></svg>
              </span>
            )}

            {/* Number / play icon */}
            <div className="w-6 text-center flex-shrink-0 relative">
              {isCurrentTrack ? (
                isPlaying ? (
                  <svg className="w-3.5 h-3.5 mx-auto fill-current text-amber" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                ) : (
                  <svg className="w-3.5 h-3.5 mx-auto fill-current text-amber" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )
              ) : (
                <>
                  <span className="font-condensed text-[11px] text-muted group-hover:hidden">{index + 1}</span>
                  <span className="hidden group-hover:block text-amber text-[11px]">▶</span>
                </>
              )}
            </div>

            {/* Thumbnail with platform pip */}
            <div className="relative shrink-0">
              {albumImage ? (
                <img src={albumImage} alt={track.album.name} className="w-11 h-11 object-cover border border-warm" />
              ) : (
                <div className="w-11 h-11 bg-raised border border-warm flex items-center justify-center text-muted">🎵</div>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-bg ${pipBgClass}`} />
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className={`text-[14px] font-light truncate ${isCurrentTrack ? 'text-amber' : 'text-cream'}`}>{track.name}</p>
              <p className="text-[12px] text-sub truncate mt-0.5">
                {track.artists.map(a => a.name).join(', ')} <span className="text-muted mx-1">·</span> {track.album.name}
              </p>
            </div>

            {/* Duration */}
            <span className="font-condensed text-[12px] text-muted flex-shrink-0 min-w-[38px] text-right tabular-nums">
              {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
            </span>

            {/* Kebab — opens global ContextMenu */}
            <button
              onClick={(e) => handleKebabClick(e, track)}
              className="w-7 h-7 flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-amber transition-opacity shrink-0"
            >
              ⋮
            </button>
          </div>
        );
      })}
    </div>
  );
}
