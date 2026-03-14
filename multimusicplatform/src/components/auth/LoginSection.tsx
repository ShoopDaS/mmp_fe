'use client';

import { useState } from 'react';
import { apiClient, type ApiResponse } from '@/lib/api';
import ProviderButton from './ProviderButton';

export default function LoginSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthLogin = async (
    loginRequest: () => Promise<ApiResponse<{ authUrl: string; state: string }>>
  ) => {
    setIsLoading(true);
    setError(null);

    const response = await loginRequest();

    if (response.error) {
      setError(response.error);
      setIsLoading(false);
      return;
    }

    if (response.data?.authUrl) {
      window.location.href = response.data.authUrl;
      return;
    }

    setError('Unable to start sign-in. Please try again.');
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    await handleAuthLogin(() => apiClient.googleLogin());
  };

  const handleSpotifyLogin = async () => {
    await handleAuthLogin(() => apiClient.spotifyLogin());
  };

  return (
    <div className="bg-surface rounded-2xl p-8 border border-white/5">
      <h2 className="text-2xl font-semibold text-white mb-6 text-center tracking-tight">
        Sign in to continue
      </h2>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <ProviderButton
          provider="google"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        />

        <ProviderButton
          provider="spotify"
          onClick={handleSpotifyLogin}
          disabled={isLoading}
        />

        <ProviderButton
          provider="microsoft"
          onClick={() => {}}
          disabled={true}
          comingSoon
        />
      </div>

      <p className="mt-6 text-center text-sm text-text-secondary">
        By signing in, you agree to our Terms of Service
      </p>
    </div>
  );
}
