'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';

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
      <div className="min-h-screen flex items-center justify-center bg-base text-text-primary">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <h1 className="text-4xl font-bold text-white mb-10 tracking-tight">Profile Settings</h1>

        {/* User Info */}
        <div className="bg-surface rounded-2xl p-8 mb-8 border border-white/5 shadow-sm">
          <h2 className="text-xl font-semibold text-white mb-6">Account Information</h2>
          <div className="space-y-6">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">User ID</label>
              <p className="text-white font-mono mt-1">{user.userId}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Display Name</label>
              <p className="text-white mt-1">{user.displayName}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Email</label>
              <p className="text-white mt-1">{user.email}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Primary Auth Provider</label>
              <p className="text-white capitalize mt-1">{user.primaryAuthProvider}</p>
            </div>
          </div>
        </div>

        {/* Linked Auth Providers */}
        <div className="bg-surface rounded-2xl p-8 border border-white/5 shadow-sm">
          <h2 className="text-xl font-semibold text-white mb-6">Linked Accounts</h2>
          <div className="space-y-4">
            {authProviders.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between p-5 bg-surface-hover rounded-xl border border-white/5"
              >
                <div>
                  <p className="text-white font-semibold capitalize">{provider.provider}</p>
                  <p className="text-sm text-text-secondary mt-0.5">{provider.email}</p>
                </div>
                <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-full font-medium">
                  ✓ Linked
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}