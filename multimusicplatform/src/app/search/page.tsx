'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/music/SearchBar';
import TrackList from '@/components/music/TrackList';
import MusicPlayer from '@/components/music/MusicPlayer';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url: string | null;
  uri: string;
}

export default function SearchPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated) {
      loadSpotifyToken();
    }
  }, [authLoading, isAuthenticated, router]);

  const loadSpotifyToken = async () => {
    // Get fresh token
    const response = await apiClient.spotifyRefresh();
    if (response.data?.accessToken) {
      setSpotifyToken(response.data.accessToken);
    } else {
      alert('Spotify not connected. Please connect Spotify from the dashboard.');
      router.push('/dashboard');
    }
  };

  const handleSearch = async (query: string) => {
    if (!spotifyToken || !query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
          },
        }
      );

      if (response.status === 401) {
        // Token expired, refresh
        await loadSpotifyToken();
        return;
      }

      const data = await response.json();
      setTracks(data.tracks?.items || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (authLoading || !spotifyToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8 pb-32">
        <h1 className="text-4xl font-bold text-white mb-8">Search Music</h1>

        <SearchBar onSearch={handleSearch} isSearching={isSearching} />

        {tracks.length > 0 && (
          <TrackList 
            tracks={tracks} 
            onPlay={setCurrentTrack}
            currentTrack={currentTrack}
          />
        )}

        {tracks.length === 0 && !isSearching && (
          <div className="text-center text-gray-400 mt-12">
            <p className="text-xl">🎵 Search for your favorite music</p>
          </div>
        )}
      </main>

      {/* Fixed player at bottom */}
      {currentTrack && <MusicPlayer track={currentTrack} />}
    </div>
  );
}
