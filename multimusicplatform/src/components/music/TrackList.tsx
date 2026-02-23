'use client';

import { useState } from 'react';

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
  onTogglePlay?: () => void; // For pausing/resuming the current track
  onAddToQueue?: (track: Track) => void; // Add a single track to the queue
  currentTrack: Track | null;
  isPlaying?: boolean; // Whether the current track is playing
}

export default function TrackList({ tracks, onPlay, onTogglePlay, onAddToQueue, currentTrack, isPlaying = false }: TrackListProps) {
  const [addedTrackId, setAddedTrackId] = useState<string | null>(null);

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
      // If clicking the current track, toggle play/pause
      onTogglePlay();
    } else {
      // Otherwise, play the new track
      onPlay(track);
    }
  };

  const handleAddToQueue = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (onAddToQueue) {
      onAddToQueue(track);
      setAddedTrackId(track.id);
      setTimeout(() => setAddedTrackId(null), 1500);
    }
  };

  return (
    <div>
      <div className="space-y-2">
        {tracks.map((track) => {
          const isCurrentTrack = currentTrack?.id === track.id;
          const albumImage = track.album.images[0]?.url || '';
          const justAdded = addedTrackId === track.id;

          return (
            <div
              key={track.id}
              className={`
                flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer
                ${getPlatformColors(track.platform, isCurrentTrack)}
                backdrop-blur-sm
              `}
              onClick={() => handleTrackClick(track)}
            >
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

              {/* Add to queue button */}
              {onAddToQueue && (
                <button
                  onClick={(e) => handleAddToQueue(e, track)}
                  className={`p-2 rounded-full transition-all shrink-0 ${
                    justAdded
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                  }`}
                  title={justAdded ? 'Added!' : 'Add to queue'}
                >
                  {justAdded ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </button>
              )}

              {/* Play/Pause indicator */}
              <div className="text-2xl">
                {isCurrentTrack && isPlaying ? '⏸️' : '▶️'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
