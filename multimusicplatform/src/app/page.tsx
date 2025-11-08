'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginSection from '@/components/auth/LoginSection';

export default function HomePage() {
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
      // Already logged in, redirect to dashboard
      router.replace('/dashboard');
    }
  }, [searchParams, isAuthenticated, isLoading, router, login]);

  if (isLoading || (searchParams?.get('session') && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated && !searchParams?.get('session')) {
    return null; // Will redirect
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2">MultiMusic</h1>
          <p className="text-xl text-gray-300">One platform, all your music</p>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Login section */}
        <LoginSection />

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 gap-4 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-gray-200">🎵 Connect multiple streaming services</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-gray-200">🔍 Search across all platforms</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-gray-200">🎧 Play music from anywhere</p>
          </div>
        </div>
      </div>
    </main>
  );
}
