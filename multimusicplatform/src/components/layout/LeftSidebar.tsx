'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useHub } from '@/contexts/HubContext';
import { BRAND } from '@/lib/constants/brand';
import { apiClient } from '@/lib/api';
import { UnifiedPlaylist } from '@/types/playlist';
import CustomPlaylistSection from '@/components/playlists/CustomPlaylistSection';
import PlatformPlaylistSection from '@/components/playlists/PlatformPlaylistSection';
import CreatePlaylistModal from '@/components/playlists/CreatePlaylistModal';
import { fetchSpotifyPlaylistTracks, fetchYouTubePlaylistTracks, fetchSoundCloudPlaylistTracks } from '@/lib/platformHelpers';

export default function LeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  
  // Connect to our global HubContext instead of props
  const { 
    spotifyToken, youtubeToken, soundcloudToken, 
    customPlaylists, setCustomPlaylists, 
    activePlaylist, setActivePlaylist, 
    playlistTrackIds, setPlaylistTrackIds 
  } = useHub();
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const connectedPlatforms: Array<'spotify' | 'youtube' | 'soundcloud'> = [];
  if (spotifyToken) connectedPlatforms.push('spotify');
  if (youtubeToken) connectedPlatforms.push('youtube');
  if (soundcloudToken) connectedPlatforms.push('soundcloud');

  const getToken = (platform: 'spotify' | 'youtube' | 'soundcloud') => {
    switch (platform) {
      case 'spotify': return spotifyToken;
      case 'youtube': return youtubeToken;
      case 'soundcloud': return soundcloudToken;
    }
  };

  const handlePlaylistSelect = (playlist: UnifiedPlaylist) => {
    setActivePlaylist(playlist);
    setIsMobileOpen(false);
    // If user clicks a playlist while on Dashboard, navigate them to Search
    if (pathname !== '/search') {
      router.push('/search');
    }
  };

  const handlePlaylistRefresh = async (playlist: UnifiedPlaylist) => {
    if (playlist.platform !== 'spotify') {
      await apiClient.refreshPlaylist(playlist.platform as any, playlist.id);
    }
    // Re-trigger the active playlist to force SearchPage to fetch tracks
    setActivePlaylist({ ...playlist });
  };

  const handleCreatePlaylist = useCallback(async (name: string, description: string, coverImage: string) => {
    const response = await apiClient.createCustomPlaylist(name, description, coverImage);
    if (response.error) throw new Error(response.error);
    
    const listResponse = await apiClient.getCustomPlaylists();
    if (!listResponse.error && listResponse.data?.playlists) {
      setCustomPlaylists(listResponse.data.playlists);
    }
  }, [setCustomPlaylists]);

  const handleImportToPlaylist = useCallback(async (sourcePlaylist: UnifiedPlaylist, targetPlaylistId: string) => {
    let tracks: any[] = [];
    if (sourcePlaylist.platform === 'spotify') tracks = await fetchSpotifyPlaylistTracks(sourcePlaylist.id, spotifyToken || null);
    else if (sourcePlaylist.platform === 'youtube') tracks = await fetchYouTubePlaylistTracks(sourcePlaylist.uri, youtubeToken || null);
    else if (sourcePlaylist.platform === 'soundcloud') tracks = await fetchSoundCloudPlaylistTracks(sourcePlaylist.id, soundcloudToken || null);

    const existingIds = playlistTrackIds[targetPlaylistId] || new Set<string>();
    const toAdd = tracks.filter(t => !existingIds.has(t.id));
    const importedIds: string[] = [];

    for (const track of toAdd) {
      try {
        await apiClient.addTrackToCustomPlaylist(targetPlaylistId, {
          trackId: track.id, platform: track.platform, name: track.name, uri: track.uri,
          artists: track.artists, albumName: track.album.name, albumImageUrl: track.album.images[0]?.url || '',
          duration_ms: track.duration_ms, preview_url: track.preview_url || null,
        });
        importedIds.push(track.id);
      } catch { /* skip failed tracks */ }
    }

    setPlaylistTrackIds(prev => {
      const s = new Set(prev[targetPlaylistId] || []);
      importedIds.forEach(id => s.add(id));
      return { ...prev, [targetPlaylistId]: s };
    });
    setCustomPlaylists(prev => prev.map(p => p.playlistId === targetPlaylistId ? { ...p, trackCount: p.trackCount + importedIds.length } : p));
  }, [spotifyToken, youtubeToken, soundcloudToken, playlistTrackIds, setCustomPlaylists, setPlaylistTrackIds]);

  const NavItem = ({ href, label, icon }: { href: string, label: string, icon: string }) => {
    const isActive = pathname === href;
    return (
      <Link href={href} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${
        isActive ? 'bg-surface-hover text-white' : 'text-text-secondary hover:text-white hover:bg-surface-hover/50'
      }`}>
        <span className="text-lg">{icon}</span>
        {label}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-r border-white/5">
      <div className="p-6">
        <Link href="/dashboard" className="text-xl font-bold text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-accent to-purple-600 shadow-lg shadow-accent/20">
             {BRAND.logoIcon}
          </div>
          <span className="tracking-wide">{BRAND.name}</span>
        </Link>
      </div>

      <div className="px-3 pb-6 flex flex-col gap-1 border-b border-white/5">
        <NavItem href="/dashboard" label="Home" icon="🏠" />
        <NavItem href="/search" label="Search" icon="🔍" />
        <NavItem href="/profile" label="Profile" icon="👤" />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <CustomPlaylistSection
          activePlaylistId={activePlaylist?.id || null}
          onPlaylistSelect={handlePlaylistSelect}
          onCreateClick={() => setIsCreateModalOpen(true)}
          playlists={customPlaylists}
          onPlaylistsChange={setCustomPlaylists}
        />

        {connectedPlatforms.map((platform) => (
          <PlatformPlaylistSection
            key={platform}
            platform={platform}
            token={getToken(platform) || null}
            activePlaylistId={activePlaylist?.id || null}
            onPlaylistSelect={handlePlaylistSelect}
            onPlaylistRefresh={handlePlaylistRefresh}
            customPlaylists={customPlaylists}
            onImportToPlaylist={handleImportToPlaylist}
          />
        ))}
      </div>

      <div className="p-4 border-t border-white/5">
         <div className="mb-4 px-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">Connections</span>
            <div className="flex gap-1.5">
               {spotifyToken && <div className="w-2.5 h-2.5 rounded-full bg-spotify shadow-[0_0_8px_rgba(29,185,84,0.5)]" title="Spotify Active" />}
               {soundcloudToken && <div className="w-2.5 h-2.5 rounded-full bg-soundcloud shadow-[0_0_8px_rgba(255,85,0,0.5)]" title="SoundCloud Active" />}
               {youtubeToken && <div className="w-2.5 h-2.5 rounded-full bg-youtube shadow-[0_0_8px_rgba(255,0,0,0.5)]" title="YouTube Active" />}
            </div>
         </div>
         <button onClick={() => { logout(); window.location.href = '/'; }} className="w-full px-4 py-2 text-sm font-medium text-text-secondary hover:text-white hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-3">
            <span>🚪</span> Logout
         </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setIsMobileOpen(true)} className="md:hidden fixed left-4 top-4 z-40 p-2 bg-surface rounded-lg border border-white/10">☰</button>
      {isMobileOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileOpen(false)} />}
      <aside className={`md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{sidebarContent}</aside>
      <aside className="hidden md:block w-60 h-full flex-shrink-0">{sidebarContent}</aside>
      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreatePlaylist} />
    </>
  );
}