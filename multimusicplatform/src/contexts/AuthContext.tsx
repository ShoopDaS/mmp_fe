'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  primaryAuthProvider: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (sessionToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    const response = await apiClient.getUserProfile();
    if (response.data) {
      setUser(response.data as User);
    } else {
      // Invalid token
      localStorage.removeItem('session_token');
    }
    setIsLoading(false);
  };

  const login = async (sessionToken: string) => {
    localStorage.setItem('session_token', sessionToken);
    await loadUser();
  };

  const logout = () => {
    localStorage.removeItem('session_token');
    setUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
