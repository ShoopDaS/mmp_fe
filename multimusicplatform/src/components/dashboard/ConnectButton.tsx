'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface ConnectButtonProps {
  platform: 'spotify' | 'soundcloud' | 'youtube';
  connected: boolean;
  onConnect?: () => void;
  comingSoon?: boolean;
}

const platformInfo = {
  spotify: {
    name: 'Spotify',
    icon: '🎵',
    color: 'bg-green-600 hover:bg-green-700',
    description: 'Stream millions of songs',
  },
  soundcloud: {
    name: 'SoundCloud',
    icon: '🔊',
    color: 'bg-orange-600 hover:bg-orange-700',
    description: 'Discover independent artists',
  },
  youtube: {  // Add YouTube
    name: 'YouTube Music',
    icon: '🎬',
    color: 'bg-red-600 hover:bg-red-700',
    description: 'Access your YouTube Music library',
  },
};

export default function ConnectButton({
  platform,
  connected,
  onConnect,
  comingSoon = false,
}: ConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const info = platformInfo[platform];

  const handleConnect = async () => {
    if (connected || comingSoon) return;

    setIsLoading(true);

    if (platform === 'spotify') {
      const response = await apiClient.spotifyConnect();
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } else if (platform === 'youtube') {
      const response = await apiClient.youtubeConnect();
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } else if (platform === 'soundcloud') {
      const response = await apiClient.soundcloudConnect();
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      }
    }

    setIsLoading(false);
  };

  if (connected) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border-2 border-green-500">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{info.icon}</span>
          <div>
            <h3 className="text-xl font-semibold text-white">{info.name}</h3>
            <p className="text-sm text-gray-300">Already connected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading || comingSoon}
      className={`
        w-full text-left rounded-lg p-6 transition-all
        ${comingSoon ? 'bg-gray-700 cursor-not-allowed' : `${info.color} hover:scale-105 shadow-lg`}
        ${isLoading ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl">{info.icon}</span>
        <div>
          <h3 className="text-xl font-semibold text-white">{info.name}</h3>
          <p className="text-sm text-gray-200">{info.description}</p>
        </div>
      </div>
      <div className="mt-4 text-sm text-white/80">
        {comingSoon ? '🔜 Coming Soon' : isLoading ? 'Connecting...' : '→ Click to connect'}
      </div>
    </button>
  );
}
