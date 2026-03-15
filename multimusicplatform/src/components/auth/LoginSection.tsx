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
    <div className="w-full max-w-[360px]">
      <h2 className="font-display text-[28px] text-cream mb-2">Sign in</h2>
      <p className="text-muted text-[13px] mb-9 leading-relaxed">
        Connect your accounts to start listening across platforms.
      </p>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <span className="flex-1 h-px bg-warm" />
        <span className="font-condensed text-[10px] tracking-[0.2em] uppercase text-muted">Continue with</span>
        <span className="flex-1 h-px bg-warm" />
      </div>

      <div>
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

      <p className="mt-8 text-[11px] text-muted leading-relaxed text-center">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
