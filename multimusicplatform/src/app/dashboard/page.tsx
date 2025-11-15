'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import Header from '@/components/layout/Header';
import PlatformCard from '@/components/dashboard/PlatformCard';
import ConnectButton from '@/components/dashboard/ConnectButton';

interface Platform {
  platform: string;
  platformUserId: string;
  connected: boolean;
  connectedAt: string;
  scope: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated) {
      loadPlatforms();
    }

    // Check for connection status
    const spotify = searchParams?.get('spotify');
    const youtube = searchParams?.get('youtube');
    const soundcloud = searchParams?.get('soundcloud');
    const error = searchParams?.get('error');

    if (spotify === 'connected') {
      setMessage({ type: 'success', text: 'Spotify connected successfully!' });
      router.replace('/dashboard');
      } else if (youtube === 'connected') {
        setMessage({ type: 'success', text: 'YouTube Music connected successfully!' });
        router.replace('/dashboard');
      } else if (soundcloud === 'connected') {  // Add this
        setMessage({ type: 'success', text: 'SoundCloud connected successfully!' });
        router.replace('/dashboard');
      } else if (error) {
        // Handle error messages
        let errorMsg = 'Connection failed';
        if (error.startsWith('youtube_')) {
          errorMsg = `YouTube Music: ${error.replace('youtube_', '')}`;
        } else if (error.startsWith('soundcloud_')) {  // Add this
          errorMsg = `SoundCloud: ${error.replace('soundcloud_', '')}`;
        } else {
          errorMsg = error;
        }
        setMessage({ type: 'error', text: errorMsg });
        router.replace('/dashboard');
      }
  }, [authLoading, isAuthenticated, router, searchParams]);

  const loadPlatforms = async () => {
    setIsLoading(true);
    const response = await apiClient.getUserPlatforms();
    if (response.data?.platforms) {
      setPlatforms(response.data.platforms);
    }
    setIsLoading(false);
  };

  const handleDisconnect = async (platform: string) => {
    const confirmed = confirm(`Disconnect ${platform}?`);
    if (!confirmed) return;

    const response = await apiClient.disconnectPlatform(platform);
    if (!response.error) {
      setMessage({ type: 'success', text: `${platform} disconnected` });
      loadPlatforms();
    } else {
      setMessage({ type: 'error', text: response.error });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const spotifyConnected = platforms.some(p => p.platform === 'spotify');
  const youtubeConnected = platforms.some(p => p.platform === 'youtube');
  const soundcloudConnected = platforms.some(p => p.platform === 'soundcloud'); 

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome, {user.displayName}!
          </h1>
          <p className="text-gray-300">
            {user.email}
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500 text-green-100'
              : 'bg-red-500/20 border border-red-500 text-red-100'
          }`}>
            {message.text}
          </div>
        )}

        {/* Connected Platforms */}
        {platforms.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Connected Platforms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platforms.map((platform) => (
                <PlatformCard
                  key={platform.platform}
                  platform={platform}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connect New Platform */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-4">
            {platforms.length === 0 ? 'Connect Your Music' : 'Add More Platforms'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConnectButton 
              platform="spotify" 
              connected={spotifyConnected}
              onConnect={loadPlatforms}
            />
            <ConnectButton 
              platform="youtube" 
              connected={youtubeConnected}
              onConnect={loadPlatforms}
            />
            <ConnectButton 
              platform="soundcloud" 
              connected={soundcloudConnected}
              onConnect={loadPlatforms}
            />
          </div>
        </div>

        {/* Actions */}
        {(spotifyConnected || youtubeConnected || soundcloudConnected) && (
          <div className="mt-8">
            <button
              onClick={() => router.push('/search')}
              className="w-full md:w-auto px-8 py-4 bg-spotify text-white rounded-lg font-semibold text-lg hover:bg-green-600 transition-colors"
            >
              🎵 Start Searching Music
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
