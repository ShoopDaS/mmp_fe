'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="bg-black/30 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-2xl font-bold text-white">
          MultiMusic
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/search"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Search
          </Link>
          <Link
            href="/profile"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
