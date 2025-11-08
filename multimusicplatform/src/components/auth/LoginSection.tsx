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
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
      <h2 className="text-2xl font-semibold text-white mb-6 text-center">
        Sign in to continue
      </h2>

      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <ProviderButton
          provider="google"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        />
        
        {/* Future providers */}
        <ProviderButton
          provider="microsoft"
          onClick={() => {}}
          disabled={true}
          comingSoon
        />
        <ProviderButton
          provider="github"
          onClick={() => {}}
          disabled={true}
          comingSoon
        />
      </div>

      <p className="mt-6 text-center text-sm text-gray-400">
        By signing in, you agree to our Terms of Service
      </p>
    </div>
  );
}
