'use client';

import { Suspense, useEffect, useState } from 'react';
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

function ProfileContent() {
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
      <div className="flex h-full items-center justify-center text-muted">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  const spotifyConnected = platforms.some(p => p.platform === 'spotify');
  const youtubeConnected = platforms.some(p => p.platform === 'youtube');
  const soundcloudConnected = platforms.some(p => p.platform === 'soundcloud'); 
  
  const allConnected = spotifyConnected && youtubeConnected && soundcloudConnected;

  return (
    <div className="max-w-[920px] mx-auto px-12 py-10">
      <h1 className="font-display text-[42px] text-cream mb-2">Profile</h1>
      <p className="text-sub text-[15px] mb-10 leading-relaxed">Manage your account and connected platforms.</p>

      {/* Messages */}
      {message && (
        <div className={`mb-8 px-4 py-3 ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Info & Auth side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* User Info */}
        <div className="bg-card border border-warm p-6">
          <h2 className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted mb-5">Account Information</h2>
          <div className="space-y-5">
            <div>
              <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-1 block">User ID</label>
              <p className="text-[14px] text-cream font-mono">{user.userId}</p>
            </div>
            <div>
              <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-1 block">Display Name</label>
              <p className="text-[14px] text-cream">{user.displayName}</p>
            </div>
            <div>
              <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-1 block">Email</label>
              <p className="text-[14px] text-cream">{user.email}</p>
            </div>
            <div>
              <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-1 block">Primary Auth</label>
              <p className="text-[14px] text-cream capitalize">{user.primaryAuthProvider}</p>
            </div>
          </div>
        </div>

        {/* Linked Auth Providers */}
        <div className="bg-card border border-warm p-6">
          <h2 className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted mb-5">Linked Accounts</h2>
          <div className="space-y-3">
            {authProviders.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between p-4 border border-warm"
              >
                <div>
                  <p className="text-cream text-[14px] font-semibold capitalize">{provider.provider}</p>
                  <p className="text-muted text-[12px] mt-0.5">{provider.email}</p>
                </div>
                <span className="font-condensed text-[9px] tracking-[0.1em] uppercase px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400">
                  ✓ Linked
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-warm mb-10" />

      {/* Connected Platforms */}
      {platforms.length > 0 && (
        <div className="mb-10">
          <h2 className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted mb-5">Connected Platforms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="mb-10">
        <h2 className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted mb-5">
          {platforms.length === 0 ? 'Connect Your Music' : 'Add More Platforms'}
        </h2>
        
        {allConnected ? (
          <div className="bg-card border border-warm p-6 text-center">
            <span className="text-3xl mb-2 block">🎉</span>
            <p className="text-cream font-medium">All platforms connected</p>
            <p className="text-muted text-sm mt-1">You have linked all available music services.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-muted">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}