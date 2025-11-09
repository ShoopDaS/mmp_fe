'use client';

interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url: string | null;
  platform: 'spotify' | 'soundcloud' | 'youtube';
}

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  currentTrack: Track | null;
}

export default function TrackList({ tracks, onPlay, currentTrack }: TrackListProps) {
  return (
    <div>
      <div className="space-y-2">
        {tracks.map((track) => {
          const isPlaying = currentTrack?.id === track.id;
          const albumImage = track.album.images[0]?.url || '';

          return (
            <div
              key={track.id}
              className={`
                flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer
                ${isPlaying ? 'bg-purple-600' : 'bg-white/10 hover:bg-white/20'}
                backdrop-blur-sm
              `}
              onClick={() => onPlay(track)}
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

              {/* Play indicator */}
              <div className="text-2xl">
                {isPlaying ? '⏸️' : '▶️'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
