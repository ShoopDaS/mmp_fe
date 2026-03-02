'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import PlatformCard from '@/components/dashboard/PlatformCard';
import ConnectButton from '@/components/dashboard/ConnectButton';

interface AuthProvider {
  provider: string;
  email: string;
  linked: boolean;
  linkedAt: string;
}

interface Platform {
  platform: string;
  platformUserId: string;
  connected: boolean;
  connectedAt: string;
  scope: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated) {
      loadData();
    }

    // Check for connection status from OAuth callbacks
    const spotify = searchParams?.get('spotify');
    const youtube = searchParams?.get('youtube');
    const soundcloud = searchParams?.get('soundcloud');
    const error = searchParams?.get('error');

    if (spotify === 'connected') {
      setMessage({ type: 'success', text: 'Spotify connected successfully!' });
      router.replace('/profile');
    } else if (youtube === 'connected') {
      setMessage({ type: 'success', text: 'YouTube Music connected successfully!' });
      router.replace('/profile');
    } else if (soundcloud === 'connected') {  
      setMessage({ type: 'success', text: 'SoundCloud connected successfully!' });
      router.replace('/profile');
    } else if (error) {
      let errorMsg = 'Connection failed';
      if (error.startsWith('youtube_')) {
        errorMsg = `YouTube Music: ${error.replace('youtube_', '')}`;
      } else if (error.startsWith('soundcloud_')) {  
        errorMsg = `SoundCloud: ${error.replace('soundcloud_', '')}`;
      } else {
        errorMsg = error;
      }
      setMessage({ type: 'error', text: errorMsg });
      router.replace('/profile');
    }
  }, [authLoading, isAuthenticated, router, searchParams]);

  const loadData = async () => {
    setIsLoading(true);
    // Fetch both auth providers and music platforms concurrently
    const [authRes, platRes] = await Promise.all([
      apiClient.getUserAuthProviders(),
      apiClient.getUserPlatforms()
    ]);
    
    if (authRes.data?.providers) setAuthProviders(authRes.data.providers);
    if (platRes.data?.platforms) setPlatforms(platRes.data.platforms);
    
    setIsLoading(false);
  };

  const handleDisconnect = async (platform: string) => {
    const confirmed = confirm(`Disconnect ${platform}?`);
    if (!confirmed) return;

    const response = await apiClient.disconnectPlatform(platform);
    if (!response.error) {
      setMessage({ type: 'success', text: `${platform} disconnected` });
      loadData();
    } else {
      setMessage({ type: 'error', text: response.error });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-text-secondary">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  const spotifyConnected = platforms.some(p => p.platform === 'spotify');
  const youtubeConnected = platforms.some(p => p.platform === 'youtube');
  const soundcloudConnected = platforms.some(p => p.platform === 'soundcloud'); 
  
  // Check if all platforms are connected
  const allConnected = spotifyConnected && youtubeConnected && soundcloudConnected;

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="text-4xl font-bold text-white mb-10 tracking-tight">Profile Settings</h1>

      {/* Messages */}
      {message && (
        <div className={`mb-8 px-4 py-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Info & Auth side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* User Info */}
        <div className="bg-surface rounded-2xl p-8 border border-white/5 shadow-sm">
          <h2 className="text-xl font-semibold text-white mb-6">Account Information</h2>
          <div className="space-y-6">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">User ID</label>
              <p className="text-white font-mono mt-1">{user.userId}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Display Name</label>
              <p className="text-white mt-1">{user.displayName}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Email</label>
              <p className="text-white mt-1">{user.email}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Primary Auth</label>
              <p className="text-white capitalize mt-1">{user.primaryAuthProvider}</p>
            </div>
          </div>
        </div>

        {/* Linked Auth Providers */}
        <div className="bg-surface rounded-2xl p-8 border border-white/5 shadow-sm">
          <h2 className="text-xl font-semibold text-white mb-6">Linked Accounts</h2>
          <div className="space-y-4">
            {authProviders.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between p-5 bg-surface-hover rounded-xl border border-white/5"
              >
                <div>
                  <p className="text-white font-semibold capitalize">{provider.provider}</p>
                  <p className="text-sm text-text-secondary mt-0.5">{provider.email}</p>
                </div>
                <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-full font-medium">
                  ✓ Linked
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-white/10 mb-12" />

      {/* Connected Platforms */}
      {platforms.length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">Connected Music Platforms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-6">
          {platforms.length === 0 ? 'Connect Your Music' : 'Add More Platforms'}
        </h2>
        
        {allConnected ? (
          <div className="bg-surface rounded-2xl p-8 border border-white/5 shadow-sm text-center">
            <span className="text-4xl mb-3 block">🎉</span>
            <p className="text-white font-medium text-lg">All platforms are connected</p>
            <p className="text-text-secondary text-sm mt-1">You have linked all available music services.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!spotifyConnected && (
              <ConnectButton 
                platform="spotify" 
                connected={false}
                onConnect={loadData}
              />
            )}
            {!youtubeConnected && (
              <ConnectButton 
                platform="youtube" 
                connected={false}
                onConnect={loadData}
              />
            )}
            {!soundcloudConnected && (
              <ConnectButton 
                platform="soundcloud" 
                connected={false}
                onConnect={loadData}
              />
            )}
          </div>
        )}
      </div>

    </div>
  );
}