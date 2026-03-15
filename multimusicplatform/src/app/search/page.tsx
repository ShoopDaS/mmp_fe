'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQueue } from '@/hooks/useQueue';
import { useHub } from '@/contexts/HubContext';
import { apiClient } from '@/lib/api';
import { CustomTrackItem } from '@/types/playlist';
import TrackList from '@/components/music/TrackList';
import {
  fetchSpotifyOwnedPlaylists,
  fetchYouTubeOwnedPlaylists,
  addTrackToSpotifyPlaylist,
  addTrackToYouTubePlaylist,
  fetchSpotifyPlaylistTrackUris,
  fetchYouTubePlaylistVideoIds,
} from '@/lib/platformHelpers';

interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
}

export default function SearchPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const queue = useQueue();
  const currentTrack = queue.getCurrentTrack();

  const {
    spotifyToken, youtubeToken,
    loadPlatformTokens,
    customPlaylists, setCustomPlaylists,
    playlistTrackIds, setPlaylistTrackIds,
    triggerTogglePlay, isPlaying,
  } = useHub();

  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState({ spotify: true, soundcloud: false, youtube: true });

  type OwnedPlatformPlaylists = Partial<Record<'spotify' | 'youtube' | 'soundcloud', { id: string; name: string }[] | 'loading'>>;
  const [ownedPlatformPlaylists, setOwnedPlatformPlaylists] = useState<OwnedPlatformPlaylists>({});
  const fetchedPlatforms = useRef<Set<'spotify' | 'youtube' | 'soundcloud'>>(new Set());

  const [platformPlaylistTrackIds, setPlatformPlaylistTrackIds] = useState<Record<string, Set<string>>>({});
  const fetchedPlatformPlaylistTrackIds = useRef<Set<string>>(new Set());

  // Protect route
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/');
  }, [authLoading, isAuthenticated, router]);

  // --- Search functions ---

  const searchSpotify = async (q: string): Promise<Track[]> => {
    if (!spotifyToken || !selectedPlatforms.spotify) return [];
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      const data = await res.json();
      return (data.tracks?.items || []).map((item: any) => ({
        id: `spotify-${item.id}`, platform: 'spotify', name: item.name, uri: item.uri,
        artists: item.artists, album: item.album, duration_ms: item.duration_ms, preview_url: item.preview_url,
      }));
    } catch { return []; }
  };

  const searchSoundCloud = async (q: string): Promise<Track[]> => {
    if (!selectedPlatforms.soundcloud) return [];
    try {
      const res = await apiClient.soundcloudSearch(q);
      return res.data?.tracks || [];
    } catch { return []; }
  };

  const searchYouTube = async (q: string): Promise<Track[]> => {
    if (!youtubeToken || !selectedPlatforms.youtube) return [];
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(q)}&maxResults=20`, { headers: { Authorization: `Bearer ${youtubeToken}` } });
      if (res.status === 401) { await loadPlatformTokens(); return []; }
      const searchData = await res.json();
      const videoIds = (searchData.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
      if (videoIds.length === 0) return [];

      const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoIds.join(',')}&maxResults=20`, { headers: { Authorization: `Bearer ${youtubeToken}` } });
      const detData = await det.json();

      return (detData.items || [])
        .filter((item: any) => item.status?.embeddable === true && !item.contentDetails?.contentRating?.ytRating && !item.contentDetails?.regionRestriction?.blocked)
        .map((item: any) => {
          let duration_ms = 0;
          const durationStr = item.contentDetails?.duration || 'PT0S';
          const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            duration_ms = (parseInt(match[1] || '0', 10) * 3600 + parseInt(match[2] || '0', 10) * 60 + parseInt(match[3] || '0', 10)) * 1000;
          }
          return {
            id: `youtube-${item.id}`, platform: 'youtube', name: item.snippet.title, uri: item.id,
            artists: [{ name: item.snippet.channelTitle }],
            album: { name: item.snippet.channelTitle, images: item.snippet.thumbnails?.high ? [{ url: item.snippet.thumbnails.high.url }] : [] },
            duration_ms, preview_url: null,
          };
        });
    } catch { return []; }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || !Object.values(selectedPlatforms).some(Boolean)) return;
    setIsSearching(true);
    try {
      const [sp, sc, yt] = await Promise.all([searchSpotify(searchQuery), searchSoundCloud(searchQuery), searchYouTube(searchQuery)]);
      setTracks([...sp, ...sc, ...yt]);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  // --- Playback ---

  const handlePlayTrack = (track: Track) => {
    const index = tracks.findIndex((t) => t.id === track.id);
    queue.playFromList(tracks, index >= 0 ? index : 0, 'Search Results');
  };

  // --- Add-to-playlist handlers (for TrackList dropdown) ---

  const handleRequestPlatformPlaylistTrackIds = useCallback(async (platform: 'spotify' | 'youtube', playlistIds: string[]) => {
    const unloaded = playlistIds.filter(id => !fetchedPlatformPlaylistTrackIds.current.has(id));
    if (!unloaded.length) return;
    await Promise.all(unloaded.map(async (id) => {
      fetchedPlatformPlaylistTrackIds.current.add(id);
      try {
        let trackIds: Set<string> = new Set();
        if (platform === 'spotify' && spotifyToken) trackIds = await fetchSpotifyPlaylistTrackUris(id, spotifyToken);
        else if (platform === 'youtube' && youtubeToken) trackIds = await fetchYouTubePlaylistVideoIds(id, youtubeToken);
        setPlatformPlaylistTrackIds(prev => ({ ...prev, [id]: trackIds }));
      } catch { fetchedPlatformPlaylistTrackIds.current.delete(id); }
    }));
  }, [spotifyToken, youtubeToken]);

  const handleRequestPlatformPlaylists = useCallback(async (platform: 'spotify' | 'youtube' | 'soundcloud') => {
    if (platform === 'soundcloud' || fetchedPlatforms.current.has(platform)) return;
    fetchedPlatforms.current.add(platform);
    setOwnedPlatformPlaylists(prev => ({ ...prev, [platform]: 'loading' }));
    try {
      let playlists: { id: string; name: string }[] = [];
      if (platform === 'spotify' && spotifyToken) playlists = await fetchSpotifyOwnedPlaylists(spotifyToken);
      else if (platform === 'youtube' && youtubeToken) playlists = await fetchYouTubeOwnedPlaylists(youtubeToken);
      setOwnedPlatformPlaylists(prev => ({ ...prev, [platform]: playlists }));
      if (playlists.length) handleRequestPlatformPlaylistTrackIds(platform as 'spotify' | 'youtube', playlists.map(pl => pl.id));
    } catch { setOwnedPlatformPlaylists(prev => ({ ...prev, [platform]: [] })); fetchedPlatforms.current.delete(platform); }
  }, [spotifyToken, youtubeToken, handleRequestPlatformPlaylistTrackIds]);

  const handleAddToCustomPlaylist = useCallback(async (track: Track, playlistId: string) => {
    if (playlistTrackIds[playlistId]?.has(track.id)) return;
    await apiClient.addTrackToCustomPlaylist(playlistId, {
      trackId: track.id, platform: track.platform, name: track.name, uri: track.uri,
      artists: track.artists, albumName: track.album.name, albumImageUrl: track.album.images[0]?.url || '',
      duration_ms: track.duration_ms, preview_url: track.preview_url || null,
    });
    setCustomPlaylists(prev => prev.map(p => p.playlistId === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p));
    setPlaylistTrackIds(prev => ({ ...prev, [playlistId]: new Set(prev[playlistId] || []).add(track.id) }));
  }, [playlistTrackIds, setCustomPlaylists, setPlaylistTrackIds]);

  const handleAddToPlatformPlaylist = useCallback(async (track: Track, playlistId: string) => {
    if (platformPlaylistTrackIds[playlistId]?.has(track.uri)) return;
    if (track.platform === 'spotify' && spotifyToken) await addTrackToSpotifyPlaylist(track.uri, playlistId, spotifyToken);
    else if (track.platform === 'youtube' && youtubeToken) await addTrackToYouTubePlaylist(track.uri, playlistId, youtubeToken);
    setPlatformPlaylistTrackIds(prev => ({ ...prev, [playlistId]: new Set(prev[playlistId] || []).add(track.uri) }));
  }, [spotifyToken, youtubeToken, platformPlaylistTrackIds]);

  const handleRequestPlaylistTrackIds = useCallback(async (playlistIds: string[]) => {
    const unloaded = playlistIds.filter(id => !playlistTrackIds[id]);
    if (!unloaded.length) return;
    await Promise.all(unloaded.map(async (id) => {
      try {
        const res = await apiClient.getCustomPlaylistTracks(id);
        if (res.data?.tracks) setPlaylistTrackIds(prev => ({ ...prev, [id]: new Set(res.data!.tracks.map((t: CustomTrackItem) => t.trackId)) }));
      } catch {}
    }));
  }, [playlistTrackIds, setPlaylistTrackIds]);

  // --- Render ---

  if (authLoading) return <div className="flex h-full items-center justify-center text-muted">Loading...</div>;

  return (
    <div className="max-w-[920px] mx-auto px-12 py-10 pb-20">
      <h1 className="font-display text-[42px] text-cream mb-2">Search</h1>
      <p className="text-[15px] text-sub mb-9 leading-relaxed">
        Find tracks across all your connected platforms simultaneously.
      </p>

      {/* Search bar */}
      <div className="flex mb-6">
        <div className="flex-1 flex items-center bg-card border border-warm border-r-0">
          <svg className="mx-3 w-5 h-5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="flex-1 py-3 bg-transparent outline-none font-sans text-sm text-cream caret-amber placeholder:text-muted"
            placeholder="Search across all platforms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          />
        </div>
        <button
          onClick={() => handleSearch(query)}
          disabled={isSearching}
          className="px-5 bg-amber text-bg font-condensed text-xs tracking-widest uppercase font-semibold hover:brightness-110 transition-all disabled:opacity-50"
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </div>

      {/* Platform toggles */}
      <div className="flex gap-2 mb-8">
        {(['spotify', 'youtube', 'soundcloud'] as const).map(p => {
          const on = selectedPlatforms[p];
          const colors: Record<string, string> = {
            spotify: 'border-spotify/40 text-spotify',
            youtube: 'border-youtube/40 text-youtube',
            soundcloud: 'border-soundcloud/40 text-soundcloud',
          };
          const labels: Record<string, string> = { spotify: 'Spotify', youtube: 'YouTube', soundcloud: 'SoundCloud' };
          return (
            <button
              key={p}
              onClick={() => setSelectedPlatforms(prev => ({ ...prev, [p]: !prev[p] }))}
              className={`flex items-center gap-2 px-3 py-1.5 border font-condensed text-[10px] tracking-[0.1em] uppercase transition-colors ${
                on ? colors[p] : 'text-muted border-warm/20'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full border border-current ${on ? 'bg-current' : ''}`} />
              {labels[p]}
            </button>
          );
        })}
      </div>

      {/* YouTube warning */}
      {selectedPlatforms.youtube && tracks.some(t => t.platform === 'youtube') && (
        <div className="mb-6 p-4 bg-youtube/5 border border-youtube/20 flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <h3 className="text-youtube font-condensed text-xs tracking-widest uppercase mb-1">YouTube Playback Notice</h3>
            <p className="text-sub text-sm">Some YouTube videos may not be playable due to licensing restrictions.</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isSearching && (
        <div className="flex flex-col gap-0 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-warm">
              <div className="w-6 h-3 bg-amber-dim animate-pulse" />
              <div className="w-11 h-11 bg-amber-dim animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-48 bg-amber-dim animate-pulse" />
                <div className="h-2.5 w-32 bg-amber-dim animate-pulse" />
              </div>
              <div className="h-3 w-10 bg-amber-dim animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isSearching && tracks.length > 0 && (
        <TrackList
          tracks={tracks}
          mode="search"
          onPlay={handlePlayTrack}
          onTogglePlay={triggerTogglePlay}
          onAddToQueue={(track) => queue.addToQueue([track])}
          onPlayNext={queue.playNext}
          currentTrack={currentTrack as Track | null}
          isPlaying={isPlaying}
          customPlaylists={customPlaylists}
          ownedPlatformPlaylists={ownedPlatformPlaylists}
          onAddToCustomPlaylist={handleAddToCustomPlaylist}
          onAddToPlatformPlaylist={handleAddToPlatformPlaylist}
          onRequestPlatformPlaylists={handleRequestPlatformPlaylists}
          playlistTrackIds={playlistTrackIds}
          onRequestPlaylistTrackIds={handleRequestPlaylistTrackIds}
          platformPlaylistTrackIds={platformPlaylistTrackIds}
          onRequestPlatformPlaylistTrackIds={handleRequestPlatformPlaylistTrackIds}
        />
      )}

      {/* Empty state */}
      {!isSearching && tracks.length === 0 && (
        <div className="text-center mt-24">
          <div className="text-5xl mb-4 opacity-40">🔍</div>
          <p className="text-sub text-lg">Search for your favorite music</p>
        </div>
      )}
    </div>
  );
}