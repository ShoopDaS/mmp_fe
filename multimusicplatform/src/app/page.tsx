'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginSection from '@/components/auth/LoginSection';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedSession = useRef(false);

  useEffect(() => {
    const sessionToken = searchParams?.get('session');
    const errorParam = searchParams?.get('error');

    if (sessionToken && !hasProcessedSession.current) {
      hasProcessedSession.current = true;
      login(sessionToken)
        .then(() => {
          router.replace('/dashboard');
        })
        .catch(() => {
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
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-xl text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated && !searchParams?.get('session')) {
    return null;
  }

  return (
    <div className="h-screen flex bg-bg">
      {/* Left: Branding */}
      <div className="flex-1 flex flex-col justify-between p-14 border-r border-warm">
        {/* Top: Brand */}
        <div className="flex items-center gap-3.5">
          <svg width="48" height="34" viewBox="0 0 48 34" fill="none" className="text-amber">
            <rect x="1" y="1" width="46" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
            <line x1="7" y1="33" x2="41" y2="33" stroke="currentColor" strokeWidth="2" />
            <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
            <circle cx="32" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
            <circle cx="32" cy="16" r="1.5" fill="currentColor" />
          </svg>
          <span className="font-display text-[28px] text-amber tracking-wide">Stave</span>
        </div>

        {/* Center: Hero */}
        <div className="py-10">
          <div className="font-condensed text-[11px] tracking-[0.3em] uppercase text-red-400 mb-6 flex items-center gap-2.5">
            Multi-platform music
            <span className="block w-10 h-px bg-red-400 opacity-70" />
          </div>
          <h1 className="font-display text-[68px] leading-none text-cream tracking-tight">
            All your<br/>
            <em className="italic text-amber">music,</em><br/>
            <span style={{color:'transparent', WebkitTextStroke:'1.5px var(--amber)'}}>one side.</span>
          </h1>
          <p className="text-muted text-[15px] leading-[1.85] mt-7 max-w-[400px]">
            Stave connects Spotify, YouTube, and SoundCloud into a single seamless listening experience. Search everything. Build playlists without borders.
          </p>
          <div className="flex gap-2.5 mt-10 flex-wrap">
            {['Spotify', 'YouTube', 'SoundCloud'].map(name => (
              <span key={name} className="font-condensed text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 border border-warm text-muted">
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom: Quote */}
        <p className="font-display italic text-[15px] text-muted leading-relaxed pt-8 border-t border-warm max-w-[360px]">
          &ldquo;The music is not in the platform.<br/>It never was.&rdquo;
        </p>
      </div>

      {/* Right: Login */}
      <div className="flex-1 flex flex-col items-center justify-center p-14">
        {error && (
          <div className="w-full max-w-[360px] mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        <LoginSection />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-xl text-muted animate-pulse">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
