'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQueue } from '@/hooks/useQueue';
import { apiClient } from '@/lib/api';
import { UnifiedPlaylist } from '@/types/playlist';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/music/SearchBar';
import TrackList from '@/components/music/TrackList';
import UnifiedMusicPlayer, { UnifiedMusicPlayerRef } from '@/components/music/UnifiedMusicPlayer';
import { PlatformState } from '@/components/music/PlatformSelector';
import PlaylistSidebar from '@/components/playlists/PlaylistSidebar';

interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  preview_url: string | null;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

// Helper functions for token management
const getStoredToken = (platform: string): string | null => {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(`${platform}_token`);
  if (!stored) return null;

  try {
    const tokenData: StoredToken = JSON.parse(stored);
    const now = Date.now();

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

  const expiresAt = Date.now() + ((expiresIn - 300) * 1000);

  const tokenData: StoredToken = {
    accessToken,
    expiresAt,
  };

  localStorage.setItem(`${platform}_token`, JSON.stringify(tokenData));
};

// ========== Active tab type ==========
type ContentTab = 'search' | 'playlist';

export default function SearchPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [soundcloudToken, setSoundcloudToken] = useState<string | null>(null);
  const [youtubeToken, setYoutubeToken] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<UnifiedMusicPlayerRef>(null);

  // Queue integration
  const queue = useQueue();
  const currentTrack = queue.getCurrentTrack();
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformState>({
    spotify: true,
    soundcloud: false,
    youtube: true,
  });

  // Playlist state
  const [activeTab, setActiveTab] = useState<ContentTab>('search');
  const [activePlaylist, setActivePlaylist] = useState<UnifiedPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated) {
      const spotifyStored = getStoredToken('spotify');
      const soundcloudStored = getStoredToken('soundcloud');
      const youtubeStored = getStoredToken('youtube');

      if (spotifyStored) setSpotifyToken(spotifyStored);
      if (soundcloudStored) setSoundcloudToken(soundcloudStored);
      if (youtubeStored) setYoutubeToken(youtubeStored);

      loadPlatformTokens();
    }
  }, [authLoading, isAuthenticated, router]);

  const loadPlatformTokens = async () => {
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

  // ========== Search Functions ==========

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
      const response = await apiClient.soundcloudSearch(query);

      if (response.error) {
        console.error('SoundCloud search error:', response.error);
        return [];
      }

      return response.data?.tracks || [];
    } catch (error) {
      console.error('SoundCloud search error:', error);
      return [];
    }
  };

  const searchYouTube = async (query: string): Promise<Track[]> => {
    if (!youtubeToken || !selectedPlatforms.youtube) return [];

    try {
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=20&videoEmbeddable=true&videoSyndicated=true`,
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

      console.log('📹 [YouTube] Total videos from API:', detailsData.items?.length || 0);

      // ===== RAW VIDEO ATTRIBUTE DUMP =====
      (detailsData.items || []).forEach((item: any, index: number) => {
        console.group(`📹 [${index + 1}/${detailsData.items.length}] "${item.snippet?.title?.substring(0, 60)}"`);
        console.log('Video ID:', item.id);
        console.log('Channel:', item.snippet?.channelTitle);
        console.log('--- STATUS ---');
        console.log('  embeddable:', item.status?.embeddable);
        console.log('  license:', item.status?.license);
        console.log('  privacyStatus:', item.status?.privacyStatus);
        console.log('  publicStatsViewable:', item.status?.publicStatsViewable);
        console.log('  madeForKids:', item.status?.madeForKids);
        console.log('  uploadStatus:', item.status?.uploadStatus);
        console.log('  Full status:', JSON.stringify(item.status, null, 2));
        console.log('--- CONTENT DETAILS ---');
        console.log('  duration:', item.contentDetails?.duration);
        console.log('  definition:', item.contentDetails?.definition);
        console.log('  projection:', item.contentDetails?.projection);
        console.log('  licensedContent:', item.contentDetails?.licensedContent);
        console.log('  regionRestriction:', JSON.stringify(item.contentDetails?.regionRestriction));
        console.log('  contentRating:', JSON.stringify(item.contentDetails?.contentRating));
        console.log('  Full contentDetails:', JSON.stringify(item.contentDetails, null, 2));
        console.groupEnd();
      });
      // =====================================

      const embeddableVideos = (detailsData.items || [])
        .filter((item: any) => {
          const embeddable = item.status?.embeddable === true;
          const publicStats = item.status?.publicStatsViewable !== false;
          const notAgeRestricted = !item.contentDetails?.contentRating?.ytRating;
          const noRegionBlock = !item.contentDetails?.regionRestriction?.blocked;

          return embeddable && publicStats && notAgeRestricted && noRegionBlock;
        });

      console.log('✅ [YouTube] Playable videos (after filtering):', embeddableVideos.length);

      return embeddableVideos.map((item: any) => ({
        id: `youtube-${item.id}`,
        platform: 'youtube' as const,
        name: item.snippet.title,
        uri: item.id,
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

    if (!Object.values(selectedPlatforms).some(Boolean)) {
      alert('Please select at least one platform to search');
      return;
    }

    setIsSearching(true);
    setActiveTab('search');
    try {
      const [spotifyTracks, soundcloudTracks, youtubeTracks] = await Promise.all([
        searchSpotify(query),
        searchSoundCloud(query),
        searchYouTube(query),
      ]);

      const allTracks = [...spotifyTracks, ...soundcloudTracks, ...youtubeTracks];
      setTracks(allTracks);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // ========== Playlist Track Loading ==========

  const loadPlaylistTracks = async (playlist: UnifiedPlaylist): Promise<Track[]> => {
    if (playlist.platform === 'spotify') {
      return fetchSpotifyPlaylistTracks(playlist.id, spotifyToken);
    } else if (playlist.platform === 'youtube') {
      return fetchYouTubePlaylistTracks(playlist.uri, youtubeToken);
    } else if (playlist.platform === 'soundcloud') {
      return fetchSoundCloudPlaylistTracks(playlist.id, soundcloudToken);
    }
    return [];
  };

  const handlePlaylistSelect = async (playlist: UnifiedPlaylist) => {
    setActivePlaylist(playlist);
    setActiveTab('playlist');
    setIsLoadingPlaylistTracks(true);
    setPlaylistTracks([]);

    try {
      const loadedTracks = await loadPlaylistTracks(playlist);
      setPlaylistTracks(loadedTracks);
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
    } finally {
      setIsLoadingPlaylistTracks(false);
    }
  };

  const handlePlaylistRefresh = async (playlist: UnifiedPlaylist) => {
    // If this playlist is currently active, reload its tracks
    if (activePlaylist?.id === playlist.id) {
      setIsLoadingPlaylistTracks(true);
      setPlaylistTracks([]);

      try {
        const loadedTracks = await loadPlaylistTracks(playlist);
        setPlaylistTracks(loadedTracks);
      } catch (error) {
        console.error('Error refreshing playlist tracks:', error);
      } finally {
        setIsLoadingPlaylistTracks(false);
      }
    } else {
      // Not currently active — select it and load fresh
      await handlePlaylistSelect(playlist);
    }
  };

  // ========== Queue-aware handlers ==========

  /** Play a track from the currently displayed list — replaces the queue */
  const handlePlayTrack = (track: Track) => {
    const list = activeTab === 'playlist' ? playlistTracks : tracks;
    const index = list.findIndex((t) => t.id === track.id);
    const label =
      activeTab === 'playlist' && activePlaylist
        ? activePlaylist.name
        : 'Search Results';
    queue.playFromList(list, index >= 0 ? index : 0, label);
  };

  /** Append a single track to the end of the queue */
  const handleAddToQueue = (track: Track) => {
    queue.addToQueue([track]);
  };

  /** Insert a track right after the currently playing track */
  const handlePlayNext = (track: Track) => {
    queue.playNext(track);
  };

  /** Called when a track finishes playing — advance the queue */
  const handleTrackEnd = () => {
    queue.next();
  };

  const handleTogglePlay = () => {
    playerRef.current?.togglePlay();
  };

  const handlePlayerStateChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  // Determine which tracks to show based on active tab
  const displayTracks = activeTab === 'playlist' ? playlistTracks : tracks;
  const isLoadingTracks = activeTab === 'playlist' ? isLoadingPlaylistTracks : isSearching;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Playlist Sidebar */}
        <PlaylistSidebar
          spotifyToken={spotifyToken}
          youtubeToken={youtubeToken}
          soundcloudToken={soundcloudToken}
          activePlaylistId={activePlaylist?.id || null}
          onPlaylistSelect={handlePlaylistSelect}
          onPlaylistRefresh={handlePlaylistRefresh}
        />

        {/* Main content */}
        <main className={`flex-1 overflow-y-auto px-4 py-8 transition-all duration-300 ${currentTrack ? 'pb-56' : 'pb-8'}`}>
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-8">Search Music</h1>

            <SearchBar
              onSearch={handleSearch}
              isSearching={isSearching}
              selectedPlatforms={selectedPlatforms}
              onPlatformsChange={setSelectedPlatforms}
            />

            {/* Content Tabs */}
            {activePlaylist && (
              <div className="mt-6 flex items-center gap-1 border-b border-white/10">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'search'
                      ? 'text-white border-white'
                      : 'text-gray-400 border-transparent hover:text-gray-200'
                  }`}
                >
                  Search Results
                  {tracks.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">({tracks.length})</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('playlist')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'playlist'
                      ? 'text-white border-white'
                      : 'text-gray-400 border-transparent hover:text-gray-200'
                  }`}
                >
                  📋 {activePlaylist.name}
                  {playlistTracks.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">({playlistTracks.length})</span>
                  )}
                </button>
              </div>
            )}

            {/* YouTube Warning Banner */}
            {activeTab === 'search' && tracks.length > 0 && tracks.some(t => t.platform === 'youtube') && (
              <div className="mt-4 mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h3 className="text-red-300 font-semibold mb-1">YouTube Playback Notice</h3>
                    <p className="text-red-200 text-sm">
                      Some YouTube videos may not be playable due to licensing restrictions.
                      If a video fails to play, you&apos;ll see a link to open it directly on YouTube.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading state for playlist tracks */}
            {isLoadingTracks && activeTab === 'playlist' && (
              <div className="mt-8 text-center text-gray-400">
                <p className="text-xl">Loading playlist tracks...</p>
              </div>
            )}

            {/* Track list */}
            {displayTracks.length > 0 && !isLoadingTracks && (
              <TrackList
                tracks={displayTracks}
                onPlay={handlePlayTrack}
                onTogglePlay={handleTogglePlay}
                onAddToQueue={handleAddToQueue}
                onPlayNext={handlePlayNext}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
              />
            )}

            {/* Empty states */}
            {displayTracks.length === 0 && !isLoadingTracks && activeTab === 'search' && (
              <div className="text-center text-gray-400 mt-12">
                <p className="text-xl">🎵 Search for your favorite music</p>
              </div>
            )}

            {displayTracks.length === 0 && !isLoadingTracks && activeTab === 'playlist' && (
              <div className="text-center text-gray-400 mt-12">
                <p className="text-xl">This playlist is empty</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Fixed player at bottom */}
      {currentTrack && (
        <UnifiedMusicPlayer
          ref={playerRef}
          track={currentTrack}
          token={
            currentTrack.platform === 'spotify'
              ? spotifyToken || ''
              : currentTrack.platform === 'soundcloud'
              ? soundcloudToken || ''
              : youtubeToken || ''
          }
          onTrackEnd={handleTrackEnd}
          onPlayerStateChange={handlePlayerStateChange}
        />
      )}
    </div>
  );
}

// ========== Playlist Track Fetchers ==========

async function fetchSpotifyPlaylistTracks(playlistId: string, token: string | null): Promise<Track[]> {
  if (!token) return [];

  const allTracks: Track[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) break;

    const data: any = await response.json();

    for (const item of data.items || []) {
      const track = item.track;
      if (!track || !track.id) continue;

      allTracks.push({
        id: `spotify-${track.id}-${allTracks.length}`,
        platform: 'spotify',
        name: track.name,
        uri: track.uri,
        artists: track.artists,
        album: track.album,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
      });
    }

    url = data.next || null;
  }

  return allTracks;
}

async function fetchYouTubePlaylistTracks(playlistId: string, token: string | null): Promise<Track[]> {
  if (!token) return [];

  const allTracks: Track[] = [];
  let pageToken: string | null = null;

  while (true) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: playlistId,
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response: Response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) break;

    const data: any = await response.json();

    for (const item of data.items || []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;

      const snippet = item.snippet || {};
      const thumbnails = snippet.thumbnails || {};
      const imageUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';

      allTracks.push({
        id: `youtube-${videoId}-${allTracks.length}`,
        platform: 'youtube',
        name: snippet.title || 'Unknown',
        uri: videoId,
        artists: [{ name: snippet.videoOwnerChannelTitle || snippet.channelTitle || '' }],
        album: {
          name: snippet.videoOwnerChannelTitle || snippet.channelTitle || '',
          images: imageUrl ? [{ url: imageUrl }] : [],
        },
        duration_ms: 0,
        preview_url: null,
      });
    }

    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }

  return allTracks;
}

async function fetchSoundCloudPlaylistTracks(playlistId: string, token: string | null): Promise<Track[]> {
  if (!token) return [];

  try {
    const response: Response = await fetch(
      `https://api.soundcloud.com/playlists/${playlistId}?representation=compact`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: 'application/json; charset=utf-8',
        },
      }
    );

    if (!response.ok) return [];

    const data: any = await response.json();
    const tracks: Track[] = [];

    for (const item of data.tracks || []) {
      if (!item || !item.id) continue;

      let artworkUrl = item.artwork_url || '';
      if (artworkUrl) {
        artworkUrl = artworkUrl.replace('-large', '-t500x500');
      }

      tracks.push({
        id: `soundcloud-${item.id}-${tracks.length}`,
        platform: 'soundcloud',
        name: item.title || 'Unknown Track',
        uri: item.permalink_url || '',
        artists: [{ name: item.user?.username || 'Unknown Artist' }],
        album: {
          name: item.user?.username || 'Unknown Artist',
          images: artworkUrl ? [{ url: artworkUrl }] : [],
        },
        duration_ms: item.duration || 0,
        preview_url: item.stream_url || null,
      });
    }

    return tracks;
  } catch (error) {
    console.error('SoundCloud playlist tracks error:', error);
    return [];
  }
}