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
import { SpotifyIcon, SoundCloudIcon, YouTubeIcon } from '@/components/icons/BrandIcons';

export default function LeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  
  const { 
    spotifyToken, youtubeToken, soundcloudToken, 
    customPlaylists, setCustomPlaylists, 
    activePlaylist, setActivePlaylist, 
    playlistTrackIds, setPlaylistTrackIds 
  } = useHub();
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [importingPlaylistId, setImportingPlaylistId] = useState<string | null>(null);

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
    if (pathname !== '/search') {
      router.push('/search');
    }
  };

  const handlePlaylistRefresh = async (playlist: UnifiedPlaylist) => {
    if (playlist.platform !== 'spotify') {
      await apiClient.refreshPlaylist(playlist.platform as any, playlist.id);
    }
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
    setImportingPlaylistId(targetPlaylistId);
    try {
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
    } finally {
      setImportingPlaylistId(null);
    }
  }, [spotifyToken, youtubeToken, soundcloudToken, playlistTrackIds, setCustomPlaylists, setPlaylistTrackIds]);

  const NavItem = ({ href, label, icon }: { href: string, label: string, icon: React.ReactNode }) => {
    const isActive = pathname === href;
    return (
      <Link href={href} className={`flex items-center gap-4 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
        isActive 
          ? 'bg-gradient-to-r from-accent/10 to-transparent text-white border-l-2 border-accent' 
          : 'text-text-secondary hover:text-white hover:bg-surface-hover border-l-2 border-transparent'
      }`}>
        <span className={`w-5 h-5 flex items-center justify-center ${isActive ? 'text-accent' : 'text-text-secondary'}`}>
          {icon}
        </span>
        {label}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-r border-white/5">
      {/* Brand Header */}
      <div className="p-6 shrink-0">
        <Link href="/dashboard" className="text-xl font-bold text-white flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-accent to-purple-600 shadow-lg shadow-accent/20 group-hover:shadow-accent/40 transition-all">
             {BRAND.logoIcon}
          </div>
          <span className="tracking-wide group-hover:text-accent transition-colors">{BRAND.name}</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="px-3 pb-6 flex flex-col gap-1 border-b border-white/5 shrink-0">
        <NavItem 
          href="/dashboard" 
          label="Home" 
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} 
        />
        <NavItem 
          href="/search" 
          label="Search" 
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>} 
        />
        <NavItem 
          href="/profile" 
          label="Profile" 
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} 
        />
      </div>

      {/* Playlists Area */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        <div className="px-5 mb-2">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">Your Library</h3>
        </div>

        <CustomPlaylistSection
          activePlaylistId={activePlaylist?.id || null}
          onPlaylistSelect={handlePlaylistSelect}
          onCreateClick={() => setIsCreateModalOpen(true)}
          playlists={customPlaylists}
          onPlaylistsChange={setCustomPlaylists}
        />

        <div className="px-5 mt-6 mb-2">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">Connected Services</h3>
        </div>

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

      {/* Footer / Connections */}
      <div className="p-4 border-t border-white/5 shrink-0 bg-surface">
         <div className="mb-4 px-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">Connections</span>
            <div className="flex items-center gap-2">
               {/* Wrapped in spans with titles to avoid TS SVGProps mismatch */}
               {spotifyToken && (
                 <span title="Spotify Active" className="flex items-center">
                   <SpotifyIcon className="w-3.5 h-3.5 text-spotify drop-shadow-[0_0_8px_rgba(29,185,84,0.5)]" />
                 </span>
               )}
               {soundcloudToken && (
                 <span title="SoundCloud Active" className="flex items-center">
                   <SoundCloudIcon className="w-3.5 h-3.5 text-soundcloud drop-shadow-[0_0_8px_rgba(255,85,0,0.5)]" />
                 </span>
               )}
               {youtubeToken && (
                 <span title="YouTube Active" className="flex items-center">
                   <YouTubeIcon className="w-3.5 h-3.5 text-youtube drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]" />
                 </span>
               )}
            </div>
         </div>
         <button onClick={() => { logout(); router.push('/'); }} className="w-full px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Logout
         </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button onClick={() => setIsMobileOpen(true)} className="md:hidden fixed left-4 top-4 z-40 p-2 bg-surface rounded-lg border border-white/10 text-white flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsMobileOpen(false)} />}
      
      {/* Drawer */}
      <aside className={`md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 transform transition-transform duration-300 ease-in-out shadow-2xl ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 h-full flex-shrink-0 z-10 shadow-xl">
        {sidebarContent}
      </aside>
      
      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreatePlaylist} />
    </>
  );
}