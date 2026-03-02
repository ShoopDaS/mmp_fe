'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQueue } from '@/hooks/useQueue';
import { useHub } from '@/contexts/HubContext';
import { apiClient } from '@/lib/api';
import { CustomPlaylist, CustomTrackItem, UnifiedPlaylist } from '@/types/playlist';
import AppLayout from '@/components/layout/AppLayout';
import SearchBar from '@/components/music/SearchBar';
import TrackList from '@/components/music/TrackList';
import { PlatformState } from '@/components/music/PlatformSelector';
import {
  fetchSpotifyOwnedPlaylists,
  fetchYouTubeOwnedPlaylists,
  addTrackToSpotifyPlaylist,
  addTrackToYouTubePlaylist,
  fetchSpotifyPlaylistTracks,
  fetchYouTubePlaylistTracks,
  fetchSoundCloudPlaylistTracks,
  fetchSpotifyPlaylistTrackUris,
  fetchYouTubePlaylistVideoIds,
} from '@/lib/platformHelpers';
import PlaylistEditSidebar from '@/components/playlists/PlaylistEditSidebar';
import PlaylistCover from '@/components/music/PlaylistCover';

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

type ContentTab = 'search' | 'playlist';

export default function SearchPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const queue = useQueue();
  const currentTrack = queue.getCurrentTrack();
  
  const {
    spotifyToken, youtubeToken, soundcloudToken,
    loadPlatformTokens,
    customPlaylists, setCustomPlaylists,
    activePlaylist, setActivePlaylist,
    playlistTrackIds, setPlaylistTrackIds,
    triggerTogglePlay, isPlaying
  } = useHub();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformState>({ spotify: true, soundcloud: false, youtube: true });
  
  const [activeTab, setActiveTab] = useState<ContentTab>('search');
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);
  const [duplicateToast, setDuplicateToast] = useState<string | null>(null);
  const [isEditSidebarOpen, setIsEditSidebarOpen] = useState(false);

  type OwnedPlatformPlaylists = Partial<Record<'spotify' | 'youtube' | 'soundcloud', { id: string; name: string }[] | 'loading'>>;
  const [ownedPlatformPlaylists, setOwnedPlatformPlaylists] = useState<OwnedPlatformPlaylists>({});
  const fetchedPlatforms = useRef<Set<'spotify' | 'youtube' | 'soundcloud'>>(new Set());

  const [platformPlaylistTrackIds, setPlatformPlaylistTrackIds] = useState<Record<string, Set<string>>>({});
  const fetchedPlatformPlaylistTrackIds = useRef<Set<string>>(new Set());

  // Protect route
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle activePlaylist changes (from the LeftSidebar)
  useEffect(() => {
    if (!activePlaylist) return;

    const loadPlaylist = async () => {
      setIsLoadingPlaylistTracks(true);
      try {
        let loadedTracks: Track[] = [];
        if (activePlaylist.platform === 'mmp') {
          const res = await apiClient.getCustomPlaylistTracks(activePlaylist.id);
          if (!res.error && res.data?.tracks) {
            loadedTracks = res.data.tracks.map((item: CustomTrackItem) => ({
              id: item.trackId, platform: item.platform, name: item.name, uri: item.uri,
              artists: item.artists, album: { name: item.albumName, images: item.albumImageUrl ? [{ url: item.albumImageUrl }] : [] },
              duration_ms: item.duration_ms, preview_url: item.preview_url,
            }));
            setPlaylistTrackIds(prev => ({ ...prev, [activePlaylist.id]: new Set(res.data!.tracks.map((t: CustomTrackItem) => t.trackId)) }));
          }
        } else if (activePlaylist.platform === 'spotify') loadedTracks = await fetchSpotifyPlaylistTracks(activePlaylist.id, spotifyToken);
        else if (activePlaylist.platform === 'youtube') loadedTracks = await fetchYouTubePlaylistTracks(activePlaylist.uri, youtubeToken);
        else if (activePlaylist.platform === 'soundcloud') loadedTracks = await fetchSoundCloudPlaylistTracks(activePlaylist.id, soundcloudToken);
        
        setPlaylistTracks(loadedTracks);
        setActiveTab('playlist'); // Force tab to switch when playlist changes
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingPlaylistTracks(false);
      }
    };
    loadPlaylist();
  }, [activePlaylist, spotifyToken, youtubeToken, soundcloudToken, setPlaylistTrackIds]);

  const searchSpotify = async (query: string): Promise<Track[]> => {
    if (!spotifyToken || !selectedPlatforms.spotify) return [];
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, { headers: { Authorization: `Bearer ${spotifyToken}` } });
      if (res.status === 401) {
        await loadPlatformTokens();
        return [];
      }
      const data = await res.json();
      return (data.tracks?.items || []).map((item: any) => ({
        id: `spotify-${item.id}`, platform: 'spotify', name: item.name, uri: item.uri,
        artists: item.artists, album: item.album, duration_ms: item.duration_ms, preview_url: item.preview_url,
      }));
    } catch { return []; }
  };

  const searchSoundCloud = async (query: string): Promise<Track[]> => {
    if (!selectedPlatforms.soundcloud) return [];
    try {
      const res = await apiClient.soundcloudSearch(query);
      return res.data?.tracks || [];
    } catch { return []; }
  };

  const searchYouTube = async (query: string): Promise<Track[]> => {
    if (!youtubeToken || !selectedPlatforms.youtube) return [];
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=20`, { headers: { Authorization: `Bearer ${youtubeToken}` } });
      if (res.status === 401) {
        await loadPlatformTokens();
        return [];
      }
      const searchData = await res.json();
      const videoIds = (searchData.items || []).map((item: any) => item.id.videoId);
      if (videoIds.length === 0) return [];

      const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoIds.join(',')}&maxResults=20`, { headers: { Authorization: `Bearer ${youtubeToken}` } });
      const detData = await det.json();

      return (detData.items || []).filter((item: any) => item.status?.embeddable === true && !item.contentDetails?.contentRating?.ytRating && !item.contentDetails?.regionRestriction?.blocked).map((item: any) => ({
        id: `youtube-${item.id}`, platform: 'youtube', name: item.snippet.title, uri: item.id,
        artists: [{ name: item.snippet.channelTitle }], album: { name: item.snippet.channelTitle, images: item.snippet.thumbnails?.high ? [{ url: item.snippet.thumbnails.high.url }] : [] },
        duration_ms: (parseInt(item.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)?.[3] || '0') * 1000) || 0, preview_url: null,
      }));
    } catch { return []; }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim() || !Object.values(selectedPlatforms).some(Boolean)) return;
    setIsSearching(true);
    setActiveTab('search');
    try {
      const [sp, sc, yt] = await Promise.all([searchSpotify(query), searchSoundCloud(query), searchYouTube(query)]);
      setTracks([...sp, ...sc, ...yt]);
    } catch (e) { console.error(e); } 
    finally { setIsSearching(false); }
  };

  const handlePlayTrack = (track: Track) => {
    const list = activeTab === 'playlist' ? playlistTracks : tracks;
    const index = list.findIndex((t) => t.id === track.id);
    queue.playFromList(list, index >= 0 ? index : 0, activeTab === 'playlist' && activePlaylist ? activePlaylist.name : 'Search Results');
  };

  const handleReorderTracks = async (fromIndex: number, toIndex: number) => {
    if (!activePlaylist || activePlaylist.platform !== 'mmp') return;
    const updated = [...playlistTracks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setPlaylistTracks(updated);

    try { await apiClient.reorderCustomPlaylistTracks(activePlaylist.id, updated.map((t, i) => ({ trackId: t.id, order: (i + 1) * 1000 }))); } 
    catch { /* revert skipped for brevity */ }
  };

  const handleRemoveFromPlaylist = (track: Track) => {
    if (!activePlaylist || activePlaylist.platform !== 'mmp') return;
    setPlaylistTracks(prev => prev.filter(t => t.id !== track.id));
    setCustomPlaylists(prev => prev.map(p => p.playlistId === activePlaylist.id ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p));
    apiClient.removeTrackFromCustomPlaylist(activePlaylist.id, track.id);
  };

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
    if (playlistTrackIds[playlistId]?.has(track.id)) { setDuplicateToast(`Already in playlist`); setTimeout(() => setDuplicateToast(null), 3000); return; }
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

  if (authLoading) return <AppLayout><div className="flex h-full items-center justify-center text-text-secondary">Loading...</div></AppLayout>;

  const activeCustomPlaylist = activePlaylist?.platform === 'mmp' ? customPlaylists.find(p => p.playlistId === activePlaylist.id) ?? null : null;
  const displayTracks = activeTab === 'playlist' ? playlistTracks : tracks;
  const isLoading = activeTab === 'playlist' ? isLoadingPlaylistTracks : isSearching;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">Search Music</h1>

        <SearchBar onSearch={handleSearch} isSearching={isSearching} selectedPlatforms={selectedPlatforms} onPlatformsChange={setSelectedPlatforms} />

        {activeTab === 'playlist' && activeCustomPlaylist && (
          <div className="mt-6 mb-8 flex items-center gap-5 p-6 bg-surface border border-white/5 rounded-2xl shadow-xl">
            <PlaylistCover coverImage={activeCustomPlaylist.coverImage} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-white truncate tracking-tight">{activeCustomPlaylist.name}</h2>
                <button onClick={() => setIsEditSidebarOpen(true)} className="p-2 text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">✏️</button>
              </div>
              {activeCustomPlaylist.description && <p className="text-sm text-text-secondary mt-2 line-clamp-2">{activeCustomPlaylist.description}</p>}
            </div>
          </div>
        )}

        {activePlaylist && (
          <div className="mt-6 flex items-center gap-2 border-b border-white/5 mb-6">
            <button onClick={() => setActiveTab('search')} className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'search' ? 'text-white border-accent' : 'text-text-secondary border-transparent hover:text-white'}`}>
              Search Results {tracks.length > 0 && <span className="ml-2 px-2 py-0.5 bg-surface-hover rounded-full text-xs text-text-secondary">{tracks.length}</span>}
            </button>
            <button onClick={() => setActiveTab('playlist')} className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'playlist' ? 'text-white border-accent' : 'text-text-secondary border-transparent hover:text-white'}`}>
              📋 {activePlaylist.name} {playlistTracks.length > 0 && <span className="ml-2 px-2 py-0.5 bg-surface-hover rounded-full text-xs text-text-secondary">{playlistTracks.length}</span>}
            </button>
          </div>
        )}

        {activeTab === 'search' && tracks.some(t => t.platform === 'youtube') && (
          <div className="mt-4 mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <span className="text-xl mt-0.5">⚠️</span>
            <div><h3 className="text-red-400 font-semibold mb-1">YouTube Playback Notice</h3><p className="text-red-300/80 text-sm">Some YouTube videos may not be playable due to licensing restrictions. A link will appear if playback fails.</p></div>
          </div>
        )}

        {isLoading && activeTab === 'playlist' && (
          <div className="mt-12 flex justify-center text-text-secondary"><span className="animate-pulse">⏳ Loading tracks...</span></div>
        )}

        {displayTracks.length > 0 && !isLoading && (
          <TrackList
            tracks={displayTracks}
            onPlay={handlePlayTrack}
            onTogglePlay={triggerTogglePlay} 
            onAddToQueue={queue.addToQueue}
            onPlayNext={queue.playNext}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            isCustomPlaylist={activeTab === 'playlist' && activePlaylist?.platform === 'mmp'}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
            onReorderTracks={handleReorderTracks}
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

        {displayTracks.length === 0 && !isLoading && (
          <div className="text-center mt-24">
             <div className="text-6xl mb-4 opacity-50">{activeTab === 'search' ? '🔍' : '👻'}</div>
             <p className="text-xl font-medium text-text-secondary">{activeTab === 'search' ? 'Search for your favorite music' : 'This playlist is completely empty'}</p>
          </div>
        )}
      </div>

      {duplicateToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-surface border border-white/10 text-white text-sm px-6 py-3 rounded-full shadow-2xl animate-fade-in-up">
          {duplicateToast}
        </div>
      )}

      {activeCustomPlaylist && (
        <PlaylistEditSidebar
          playlist={activeCustomPlaylist}
          isOpen={isEditSidebarOpen}
          onClose={() => setIsEditSidebarOpen(false)}
          onSave={(u) => {
            setCustomPlaylists(prev => prev.map(p => p.playlistId === u.playlistId ? u : p));
            if (activePlaylist?.id === u.playlistId) setActivePlaylist(prev => prev ? { ...prev, name: u.name } : prev);
            setIsEditSidebarOpen(false);
          }}
        />
      )}
    </AppLayout>
  );
}