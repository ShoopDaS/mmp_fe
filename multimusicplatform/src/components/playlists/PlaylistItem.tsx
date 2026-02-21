'use client';

import { UnifiedPlaylist } from '@/types/playlist';

interface PlaylistItemProps {
  playlist: UnifiedPlaylist;
  isActive: boolean;
  onClick: (playlist: UnifiedPlaylist) => void;
}

export default function PlaylistItem({ playlist, isActive, onClick }: PlaylistItemProps) {
  return (
    <button
      onClick={() => onClick(playlist)}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
        ${isActive
          ? 'bg-white/20 text-white'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }
      `}
      title={playlist.name}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-white/10">
        {playlist.imageUrl ? (
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            🎵
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{playlist.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
          {playlist.owner ? ` · ${playlist.owner}` : ''}
        </p>
      </div>
    </button>
  );
}