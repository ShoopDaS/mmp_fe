'use client';

import { useState, useRef, useCallback } from 'react';
import { useQueue } from '@/hooks/useQueue';

export default function QueueManager() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    tracks,
    currentIndex,
    loopMode,
    sourceLabel,
    jumpTo,
    removeFromQueue,
    moveTrack,
    clearQueue,
    cycleLoopMode,
  } = useQueue();

  // Drag-and-drop state
  const [dragVisualIndex, setDragVisualIndex] = useState<number | null>(null);
  const [dragOverVisualIndex, setDragOverVisualIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const currentTrack = currentIndex >= 0 && currentIndex < tracks.length ? tracks[currentIndex] : null;
  const upcomingTracks = currentIndex >= 0 ? tracks.slice(currentIndex + 1) : [];

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'spotify': return 'bg-green-500';
      case 'soundcloud': return 'bg-orange-500';
      case 'youtube': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const loopModeLabel = () => {
    switch (loopMode) {
      case 'none': return 'Off';
      case 'one': return '1';
      case 'all': return 'All';
    }
  };

  // --- Drag-and-drop handlers ---
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, visualIndex: number) => {
    setDragVisualIndex(visualIndex);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(visualIndex));
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.4';
      }
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
    // Only clear if leaving the actual element (not entering a child)
    if (e.currentTarget === e.target) {
      setDragOverVisualIndex(null);
    }
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
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    setDragVisualIndex(null);
    setDragOverVisualIndex(null);
    dragNodeRef.current = null;
  }, []);

  if (tracks.length === 0) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors relative"
        title="View Queue"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 18l2 2 4-4" />
        </svg>
        {upcomingTracks.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {upcomingTracks.length > 99 ? '99+' : upcomingTracks.length}
          </span>
        )}
      </button>

      {/* Queue Panel */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[60]">
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-white font-semibold text-sm">Queue</h3>
              {sourceLabel && (
                <p className="text-gray-400 text-xs truncate max-w-[180px]">From: {sourceLabel}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Loop mode toggle */}
              <button
                onClick={cycleLoopMode}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  loopMode !== 'none'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={`Loop: ${loopModeLabel()}`}
              >
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                  </svg>
                  {loopModeLabel()}
                </span>
              </button>
              {/* Clear queue */}
              <button
                onClick={() => { clearQueue(); setIsOpen(false); }}
                className="px-2 py-1 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded text-xs transition-colors"
                title="Clear Queue"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Now Playing */}
          {currentTrack && (
            <div className="p-3 bg-purple-900/30 border-b border-white/10 shrink-0">
              <p className="text-purple-300 text-[10px] uppercase tracking-wider font-semibold mb-1">Now Playing</p>
              <div className="flex items-center gap-2">
                {currentTrack.album.images[0]?.url && (
                  <img src={currentTrack.album.images[0].url} alt="" className="w-8 h-8 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{currentTrack.name}</p>
                  <p className="text-gray-400 text-xs truncate">{currentTrack.artists.map(a => a.name).join(', ')}</p>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${getPlatformColor(currentTrack.platform)}`} />
              </div>
            </div>
          )}

          {/* Upcoming Tracks (drag-and-drop enabled) */}
          <div className="flex-1 overflow-y-auto">
            {upcomingTracks.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No upcoming tracks</div>
            ) : (
              <>
                <p className="px-3 pt-2 pb-1 text-gray-500 text-[10px] uppercase tracking-wider font-semibold">
                  Up Next ({upcomingTracks.length}) &middot; Drag to reorder
                </p>
                {upcomingTracks.map((track, i) => {
                  const queueIndex = currentIndex + 1 + i;
                  const isDragging = dragVisualIndex === i;
                  const isDragOver = dragOverVisualIndex === i;

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
                        flex items-center gap-2 px-3 py-2 group cursor-pointer select-none transition-colors
                        ${isDragging ? 'opacity-40' : 'hover:bg-white/5'}
                        ${isDragOver && !isDragging ? 'border-t-2 border-purple-500' : 'border-t-2 border-transparent'}
                      `}
                      onClick={() => jumpTo(queueIndex)}
                    >
                      {/* Drag handle */}
                      <span
                        className="text-gray-600 group-hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
                        title="Drag to reorder"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                        </svg>
                      </span>

                      <span className="text-gray-500 text-xs w-5 text-right shrink-0">{i + 1}</span>
                      {track.album.images[0]?.url && (
                        <img src={track.album.images[0].url} alt="" className="w-8 h-8 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{track.name}</p>
                        <p className="text-gray-400 text-[11px] truncate">{track.artists.map(a => a.name).join(', ')}</p>
                      </div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getPlatformColor(track.platform)}`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(queueIndex);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity p-1"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
