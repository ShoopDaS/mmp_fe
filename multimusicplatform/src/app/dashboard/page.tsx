'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

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
      <div className="flex h-full items-center justify-center text-text-secondary">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
          Welcome, {user.displayName}!
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl">
          Ready to dive into your music? Use the sidebar to search for tracks, manage your playlists, or head over to your profile to connect your music platforms.
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-text-secondary">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}