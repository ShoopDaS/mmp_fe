'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import ProviderButton from './ProviderButton';

export default function LoginSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    const response = await apiClient.googleLogin();

    if (response.error) {
      setError(response.error);
      setIsLoading(false);
      return;
    }

    if (response.data?.authUrl) {
      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    }
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
