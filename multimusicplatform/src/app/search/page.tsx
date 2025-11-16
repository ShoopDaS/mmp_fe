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

interface StoredToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

// Helper functions for token management
const getStoredToken = (platform: string): string | null => {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(`${platform}_token`);
  if (!stored) return null;

  try {
    const tokenData: StoredToken = JSON.parse(stored);
    const now = Date.now();

    // Check if token is expired (with 5-minute buffer for safety)
    if (tokenData.expiresAt <= now) {
      localStorage.removeItem(`${platform}_token`);
      return null;
    }

    return tokenData.accessToken;
  } catch {
    localStorage.removeItem(`${platform}_token`);
    return null;
  }
};

const storeToken = (platform: string, accessToken: string, expiresIn: number): void => {
  if (typeof window === 'undefined') return;

  // Convert expiresIn (seconds) to expiration timestamp (milliseconds)
  // Subtract 5 minutes (300 seconds) as a safety buffer
  const expiresAt = Date.now() + ((expiresIn - 300) * 1000);

  const tokenData: StoredToken = {
    accessToken,
    expiresAt,
  };

  localStorage.setItem(`${platform}_token`, JSON.stringify(tokenData));
};
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
      // First, try to load tokens from localStorage
      const spotifyStored = getStoredToken('spotify');
      const soundcloudStored = getStoredToken('soundcloud');
      const youtubeStored = getStoredToken('youtube');

      if (spotifyStored) setSpotifyToken(spotifyStored);
      if (soundcloudStored) setSoundcloudToken(soundcloudStored);
      if (youtubeStored) setYoutubeToken(youtubeStored);

      // Then refresh only if tokens are missing or expired
      loadPlatformTokens();
    }
  }, [authLoading, isAuthenticated, router]);

  const loadPlatformTokens = async () => {
    // Load tokens for all platforms (only refresh if expired or missing)

    // Spotify
    const spotifyStored = getStoredToken('spotify');
    if (!spotifyStored) {
      try {
        console.log('Refreshing Spotify token...');
        const spotifyResponse = await apiClient.spotifyRefresh();
        if (spotifyResponse.data?.accessToken && spotifyResponse.data?.expiresIn) {
          setSpotifyToken(spotifyResponse.data.accessToken);
          storeToken('spotify', spotifyResponse.data.accessToken, spotifyResponse.data.expiresIn);
        }
      } catch (error) {
        console.log('Spotify not connected');
      }
    }

    // SoundCloud
    const soundcloudStored = getStoredToken('soundcloud');
    if (!soundcloudStored) {
      try {
        console.log('Refreshing SoundCloud token...');
        const soundcloudResponse = await apiClient.soundcloudRefresh();
        if (soundcloudResponse.data?.accessToken && soundcloudResponse.data?.expiresIn) {
          setSoundcloudToken(soundcloudResponse.data.accessToken);
          storeToken('soundcloud', soundcloudResponse.data.accessToken, soundcloudResponse.data.expiresIn);
        }
      } catch (error) {
        console.log('SoundCloud not connected');
      }
    }

    // YouTube
    const youtubeStored = getStoredToken('youtube');
    if (!youtubeStored) {
      try {
        console.log('Refreshing YouTube token...');
        const youtubeResponse = await apiClient.youtubeRefresh();
        if (youtubeResponse.data?.accessToken && youtubeResponse.data?.expiresIn) {
          setYoutubeToken(youtubeResponse.data.accessToken);
          storeToken('youtube', youtubeResponse.data.accessToken, youtubeResponse.data.expiresIn);
        }
      } catch (error) {
        console.log('YouTube not connected');
      }
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
    if (!selectedPlatforms.soundcloud) return [];

    try {
      // Use backend proxy to avoid CORS issues
      const response = await apiClient.soundcloudSearch(query);

      if (response.error) {
        console.error('SoundCloud search error:', response.error);
        return [];
      }

      // Backend returns normalized tracks
      return response.data?.tracks || [];
    } catch (error) {
      console.error('SoundCloud search error:', error);
      return [];
    }
  };

  const searchYouTube = async (query: string): Promise<Track[]> => {
    if (!youtubeToken || !selectedPlatforms.youtube) return [];

    try {
      // First, search for videos
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=20`,
        {
          headers: {
            Authorization: `Bearer ${youtubeToken}`,
          },
        }
      );

      if (!searchResponse.ok) return [];

      const searchData = await searchResponse.json();
      const videoIds = (searchData.items || []).map((item: any) => item.id.videoId);

      if (videoIds.length === 0) return [];

      // Fetch video details to check embeddable status
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoIds.join(',')}&maxResults=20`,
        {
          headers: {
            Authorization: `Bearer ${youtubeToken}`,
          },
        }
      );

      if (!detailsResponse.ok) return [];

      const detailsData = await detailsResponse.json();

      // Debug logging - show full status for debugging
      console.log('📹 [YouTube] Total videos from API:', detailsData.items?.length || 0);
      detailsData.items?.forEach((item: any, index: number) => {
        console.log(`📹 [${index + 1}] "${item.snippet.title.substring(0, 40)}..."`, {
          id: item.id,
          embeddable: item.status?.embeddable,
          publicStatsViewable: item.status?.publicStatsViewable,
          license: item.status?.license,
          regionRestriction: item.contentDetails?.regionRestriction,
          contentRating: item.contentDetails?.contentRating
        });
      });

      // Filter videos that can actually be embedded
      // Unfortunately, YouTube's embeddable flag is unreliable for music videos
      // Many report as embeddable but fail with error 150 due to undisclosed restrictions
      const embeddableVideos = (detailsData.items || [])
        .filter((item: any) => {
          const embeddable = item.status?.embeddable === true;
          const publicStats = item.status?.publicStatsViewable !== false;
          const notAgeRestricted = !item.contentDetails?.contentRating?.ytRating;
          const noRegionBlock = !item.contentDetails?.regionRestriction?.blocked;

          const passes = embeddable && publicStats && notAgeRestricted && noRegionBlock;

          if (!passes) {
            console.log(`❌ Filtered out: "${item.snippet.title.substring(0, 40)}..." - embeddable:${embeddable}, publicStats:${publicStats}, notAge:${notAgeRestricted}, noRegion:${noRegionBlock}`);
          }

          return passes;
        });

      console.log('✅ [YouTube] Playable videos (after filtering):', embeddableVideos.length, 'out of', detailsData.items?.length);

      return embeddableVideos.map((item: any) => ({
        id: `youtube-${item.id}`,
        platform: 'youtube' as const,
        name: item.snippet.title,
        uri: item.id, // Just use video ID for cleaner URI
        artists: [{ name: item.snippet.channelTitle }],
        album: {
          name: item.snippet.channelTitle,
          images: item.snippet.thumbnails?.high ? [{ url: item.snippet.thumbnails.high.url }] : [],
        },
        duration_ms: parseDuration(item.contentDetails?.duration || 'PT0S'),
        preview_url: null,
      }));
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  };

  // Helper function to parse ISO 8601 duration to milliseconds
  const parseDuration = (isoDuration: string): number => {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return (hours * 3600 + minutes * 60 + seconds) * 1000;
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
