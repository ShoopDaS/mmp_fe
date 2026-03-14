'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginSection from '@/components/auth/LoginSection';
import { BRAND } from '@/lib/constants/brand';
import { SpotifyIcon, SoundCloudIcon, YouTubeIcon } from '@/components/icons/BrandIcons';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedSession = useRef(false);

  useEffect(() => {
    // Handle OAuth callback with session token
    const sessionToken = searchParams?.get('session');
    const errorParam = searchParams?.get('error');

    if (sessionToken && !hasProcessedSession.current) {
      hasProcessedSession.current = true;
      login(sessionToken)
        .then(() => {
          router.replace('/dashboard');
        })
        .catch((err) => {
          setError('Login failed. Please try again.');
          hasProcessedSession.current = false;
        });
      return;
    }

    if (errorParam) {
      setError(`Login failed: ${errorParam}`);
      return;
    }

    if (isAuthenticated && !isLoading && !sessionToken) {
      router.replace('/dashboard');
    }
  }, [searchParams, isAuthenticated, isLoading, router, login]);

  if (isLoading || (searchParams?.get('session') && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-xl text-text-secondary animate-pulse">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated && !searchParams?.get('session')) {
    return null;
  }

  return (
    <main className="min-h-screen bg-base relative overflow-hidden">
      {/* Subtle radial glow for atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Split layout */}
      <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-2 gap-0">

        {/* Left panel — branding */}
        <div className="flex flex-col items-center justify-center px-8 py-16 md:py-0">
          <div className="max-w-sm w-full space-y-6">
            <div>
              <h1 className="text-5xl font-bold text-white tracking-tight flex items-center gap-3">
                <span className="text-accent text-4xl">{BRAND.logoIcon}</span>
                {BRAND.name}
              </h1>
              <p className="text-xl text-text-secondary mt-3">Your music, unified.</p>
            </div>

            {/* Platform pills */}
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-3">Works with</p>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-white/5 rounded-full text-sm text-text-secondary">
                  <SpotifyIcon className="w-4 h-4 text-spotify" /> Spotify
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-white/5 rounded-full text-sm text-text-secondary">
                  <YouTubeIcon className="w-4 h-4 text-youtube" /> YouTube
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-white/5 rounded-full text-sm text-text-secondary">
                  <SoundCloudIcon className="w-4 h-4 text-soundcloud" /> SoundCloud
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — login */}
        <div className="flex flex-col items-center justify-center px-8 pb-16 md:py-0">
          <div className="max-w-sm w-full space-y-6">
            {/* Error display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <LoginSection />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-xl text-text-secondary animate-pulse">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
