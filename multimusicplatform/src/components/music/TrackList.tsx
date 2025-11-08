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
}

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  currentTrack: Track | null;
}

export default function TrackList({ tracks, onPlay, currentTrack }: TrackListProps) {
  const tracksWithPreview = tracks.filter(t => t.preview_url).length;
  
  return (
    <div>
      {tracksWithPreview < tracks.length && (
        <div className="mb-4 bg-yellow-500/20 border border-yellow-500 text-yellow-100 px-4 py-3 rounded">
          ℹ️ {tracksWithPreview} of {tracks.length} tracks have preview available. 
          This is normal - not all Spotify tracks have previews.
        </div>
      )}
      
      <div className="space-y-2">
        {tracks.map((track) => {
          const isPlaying = currentTrack?.id === track.id;
          const albumImage = track.album.images[0]?.url || '';
          const hasPreview = !!track.preview_url;

          return (
            <div
              key={track.id}
              className={`
                flex items-center gap-4 p-4 rounded-lg transition-all
                ${isPlaying ? 'bg-purple-600' : 'bg-white/10 hover:bg-white/20'}
                ${!hasPreview ? 'opacity-60' : 'cursor-pointer'}
                backdrop-blur-sm
              `}
              onClick={() => hasPreview && onPlay(track)}
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

              {/* Play indicator or no preview message */}
              <div className="text-2xl">
                {hasPreview ? (
                  isPlaying ? '⏸️' : '▶️'
                ) : (
                  <span className="text-xs text-gray-400">No preview</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
