'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useHub } from '@/contexts/HubContext';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { spotifyToken, youtubeToken, soundcloudToken } = useHub();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    // IMPORTANT: If your backend OAuth callback still redirects to /dashboard?spotify=connected,
    // this will catch those URL parameters and seamlessly forward the user to the profile page!
    if (searchParams?.has('spotify') || searchParams?.has('youtube') || searchParams?.has('soundcloud') || searchParams?.has('error')) {
      router.replace(`/profile?${searchParams.toString()}`);
    }
  }, [authLoading, isAuthenticated, router, searchParams]);

  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto px-12 py-10">
      {/* Welcome banner */}
      <div className="bg-card border border-warm relative overflow-hidden mb-7 p-7">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber to-transparent" />
        <h1 className="font-display text-[28px] text-cream">
          Good evening, <em className="italic text-amber">{user.displayName}</em>
        </h1>
        <p className="text-muted text-sm mt-1.5 leading-relaxed">
          Your multi-platform music hub is ready.
        </p>
        <div className="flex gap-2.5 mt-5">
          <button onClick={() => router.push('/search')} className="px-4 py-2.5 bg-amber text-bg font-condensed text-[11px] tracking-widest uppercase font-semibold hover:brightness-110 transition-all">
            Search Music
          </button>
          <button onClick={() => router.push('/library')} className="px-4 py-2.5 border border-warm text-muted font-condensed text-[11px] tracking-widest uppercase hover:text-cream hover:border-amber/40 transition-colors">
            Your Library
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label: 'Search', desc: 'Find tracks across platforms', icon: '🔍', href: '/search' },
          { label: 'Library', desc: 'Manage your playlists', icon: '📚', href: '/library' },
          { label: 'Profile', desc: 'Connect your platforms', icon: '⚙️', href: '/profile' },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.href)} className="bg-card border border-warm p-5 text-left hover:bg-raised transition-colors group">
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="font-condensed text-xs tracking-widest uppercase text-cream group-hover:text-amber transition-colors">{item.label}</div>
            <div className="text-muted text-xs mt-1">{item.desc}</div>
          </button>
        ))}
      </div>

      {/* Platform status */}
      <div className="mb-4">
        <h2 className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted mb-4">Platform Status</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'spotify',    label: 'Spotify',    token: spotifyToken,    color: 'text-spotify',    border: 'border-spotify/30' },
            { key: 'youtube',    label: 'YouTube',    token: youtubeToken,    color: 'text-youtube',    border: 'border-youtube/30' },
            { key: 'soundcloud', label: 'SoundCloud', token: soundcloudToken, color: 'text-soundcloud', border: 'border-soundcloud/30' },
          ].map(({ key, label, token, color, border }) => (
            <div key={key} className={`bg-card border p-4 flex items-center gap-3 ${token ? border : 'border-warm'}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${token ? 'bg-current ' + color : 'bg-muted'}`} />
              <div className="min-w-0">
                <p className={`font-condensed text-[10px] tracking-widest uppercase ${token ? color : 'text-muted'}`}>{label}</p>
                <p className="text-muted text-[11px] mt-0.5">{token ? 'Connected' : 'Not connected'}</p>
              </div>
            </div>
          ))}
        </div>
        {(!spotifyToken || !youtubeToken || !soundcloudToken) && (
          <p className="text-muted text-xs mt-3">
            Connect missing platforms from the{' '}
            <button onClick={() => router.push('/profile')} className="text-amber hover:underline">Profile</button> page.
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-muted">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}