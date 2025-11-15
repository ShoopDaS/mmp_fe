'use client';

interface Platform {
  platform: string;
  platformUserId: string;
  connected: boolean;
  connectedAt: string;
  scope: string;
}

interface PlatformCardProps {
  platform: Platform;
  onDisconnect: (platform: string) => void;
}

const platformInfo: Record<string, { name: string; icon: string; color: string }> = {
  spotify: {
    name: 'Spotify',
    icon: '🎵',
    color: 'from-green-600 to-green-800',
  },
  soundcloud: {
    name: 'SoundCloud',
    icon: '🔊',
    color: 'from-orange-600 to-orange-800',
  },
  youtube: {  // Add YouTube
    name: 'YouTube Music',
    icon: '🎬',
    color: 'from-red-600 to-red-800',
  },
};

export default function PlatformCard({ platform, onDisconnect }: PlatformCardProps) {
  const info = platformInfo[platform.platform] || {
    name: platform.platform,
    icon: '🎧',
    color: 'from-gray-600 to-gray-800',
  };

  const connectedDate = new Date(platform.connectedAt).toLocaleDateString();

  return (
    <div className={`bg-gradient-to-br ${info.color} rounded-lg p-6 shadow-xl`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{info.icon}</span>
          <div>
            <h3 className="text-xl font-semibold text-white">{info.name}</h3>
            <p className="text-sm text-white/70">Connected {connectedDate}</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
          ✓ Active
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-white/20">
        <button
          onClick={() => onDisconnect(platform.platform)}
          className="text-sm text-white/80 hover:text-white underline"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
