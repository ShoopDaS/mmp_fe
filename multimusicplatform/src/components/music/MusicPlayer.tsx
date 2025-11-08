'use client';

import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url: string | null;
}

interface MusicPlayerProps {
  track: Track;
}

export default function MusicPlayer({ track }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (audioRef.current && track.preview_url) {
      audioRef.current.src = track.preview_url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [track]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (!track.preview_url) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 text-center text-gray-400">
            ⚠️ Preview not available for this track
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        {/* Album art */}
        <img
          src={track.album.images[0]?.url || ''}
          alt={track.album.name}
          className="w-16 h-16 rounded"
        />

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{track.name}</h3>
          <p className="text-sm text-gray-300 truncate">
            {track.artists.map(a => a.name).join(', ')}
          </p>
        </div>

        {/* Controls */}
        <button
          onClick={togglePlay}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
        >
          <span className="text-2xl">{isPlaying ? '⏸️' : '▶️'}</span>
        </button>
      </div>
    </div>
  );
}
