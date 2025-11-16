'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/music/SearchBar';
import TrackList from '@/components/music/TrackList';
import UnifiedMusicPlayer from '@/components/music/UnifiedMusicPlayer';
import { PlatformState } from '@/components/music/PlatformSelector';

interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';  // 👈 ADD THIS
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;  // 👈 ADD THIS (needed for progress bar)
  preview_url: string | null;
}
export default function SearchPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [soundcloudToken, setSoundcloudToken] = useState<string | null>(null);
  const [youtubeToken, setYoutubeToken] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformState>({
    spotify: true,
    soundcloud: false, // Default OFF as requested
    youtube: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated) {
      loadPlatformTokens();
    }
  }, [authLoading, isAuthenticated, router]);

  const loadPlatformTokens = async () => {
    // Load tokens for all platforms (silently fail if not connected)
    try {
      const spotifyResponse = await apiClient.spotifyRefresh();
      if (spotifyResponse.data?.accessToken) {
        setSpotifyToken(spotifyResponse.data.accessToken);
      }
    } catch (error) {
      console.log('Spotify not connected');
    }

    try {
      const soundcloudResponse = await apiClient.soundcloudRefresh();
      if (soundcloudResponse.data?.accessToken) {
        setSoundcloudToken(soundcloudResponse.data.accessToken);
      }
    } catch (error) {
      console.log('SoundCloud not connected');
    }

    try {
      const youtubeResponse = await apiClient.youtubeRefresh();
      if (youtubeResponse.data?.accessToken) {
        setYoutubeToken(youtubeResponse.data.accessToken);
      }
    } catch (error) {
      console.log('YouTube not connected');
    }
  };

  const searchSpotify = async (query: string): Promise<Track[]> => {
    if (!spotifyToken || !selectedPlatforms.spotify) return [];

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
        await loadPlatformTokens();
        return [];
      }

      const data = await response.json();
      return (data.tracks?.items || []).map((item: any) => ({
        id: `spotify-${item.id}`,
        platform: 'spotify' as const,
        name: item.name,
        uri: item.uri,
        artists: item.artists,
        album: item.album,
        duration_ms: item.duration_ms,
        preview_url: item.preview_url,
      }));
    } catch (error) {
      console.error('Spotify search error:', error);
      return [];
    }
  };

  const searchSoundCloud = async (query: string): Promise<Track[]> => {
    if (!soundcloudToken || !selectedPlatforms.soundcloud) return [];

    try {
      const response = await fetch(
        `https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&limit=20`,
        {
          headers: {
            Authorization: `OAuth ${soundcloudToken}`,
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.map((item: any) => ({
        id: `soundcloud-${item.id}`,
        platform: 'soundcloud' as const,
        name: item.title,
        uri: item.permalink_url,
        artists: [{ name: item.user.username }],
        album: {
          name: item.user.username,
          images: item.artwork_url ? [{ url: item.artwork_url }] : [],
        },
        duration_ms: item.duration,
        preview_url: item.stream_url,
      }));
    } catch (error) {
      console.error('SoundCloud search error:', error);
      return [];
    }
  };

  const searchYouTube = async (query: string): Promise<Track[]> => {
    if (!youtubeToken || !selectedPlatforms.youtube) return [];

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=20`,
        {
          headers: {
            Authorization: `Bearer ${youtubeToken}`,
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.items || []).map((item: any) => ({
        id: `youtube-${item.id.videoId}`,
        platform: 'youtube' as const,
        name: item.snippet.title,
        uri: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        artists: [{ name: item.snippet.channelTitle }],
        album: {
          name: item.snippet.channelTitle,
          images: item.snippet.thumbnails?.high ? [{ url: item.snippet.thumbnails.high.url }] : [],
        },
        duration_ms: 0, // YouTube API doesn't provide duration in search, would need separate call
        preview_url: null,
      }));
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    // Check if at least one platform is selected
    if (!Object.values(selectedPlatforms).some(Boolean)) {
      alert('Please select at least one platform to search');
      return;
    }

    setIsSearching(true);
    try {
      // Search all selected platforms in parallel
      const [spotifyTracks, soundcloudTracks, youtubeTracks] = await Promise.all([
        searchSpotify(query),
        searchSoundCloud(query),
        searchYouTube(query),
      ]);

      // Combine and set results
      const allTracks = [...spotifyTracks, ...soundcloudTracks, ...youtubeTracks];
      setTracks(allTracks);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (authLoading) {
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

        <SearchBar
          onSearch={handleSearch}
          isSearching={isSearching}
          selectedPlatforms={selectedPlatforms}
          onPlatformsChange={setSelectedPlatforms}
        />

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
      {currentTrack && (
        <UnifiedMusicPlayer
          track={currentTrack}
          token={
            currentTrack.platform === 'spotify'
              ? spotifyToken || ''
              : currentTrack.platform === 'soundcloud'
              ? soundcloudToken || ''
              : youtubeToken || ''
          }
        />
      )}
    </div>
  );
}
