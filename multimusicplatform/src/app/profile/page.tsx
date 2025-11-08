'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import Header from '@/components/layout/Header';

interface AuthProvider {
  provider: string;
  email: string;
  linked: boolean;
  linkedAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated) {
      loadAuthProviders();
    }
  }, [authLoading, isAuthenticated, router]);

  const loadAuthProviders = async () => {
    setIsLoading(true);
    const response = await apiClient.getUserAuthProviders();
    if (response.data?.providers) {
      setAuthProviders(response.data.providers);
    }
    setIsLoading(false);
  };

  if (authLoading || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">Profile Settings</h1>

        {/* User Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400">User ID</label>
              <p className="text-white font-mono">{user.userId}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Display Name</label>
              <p className="text-white">{user.displayName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Email</label>
              <p className="text-white">{user.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Primary Auth Provider</label>
              <p className="text-white capitalize">{user.primaryAuthProvider}</p>
            </div>
          </div>
        </div>

        {/* Linked Auth Providers */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Linked Accounts</h2>
          <div className="space-y-3">
            {authProviders.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
              >
                <div>
                  <p className="text-white font-semibold capitalize">{provider.provider}</p>
                  <p className="text-sm text-gray-400">{provider.email}</p>
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-200 text-sm rounded-full">
                  ✓ Linked
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
