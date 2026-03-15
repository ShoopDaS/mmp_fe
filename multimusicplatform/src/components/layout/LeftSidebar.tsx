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

function CassetteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="32" height="24" viewBox="0 0 48 34" fill="none">
      <rect x="1" y="1" width="46" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
      <line x1="7" y1="33" x2="41" y2="33" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="32" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

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
    router.push('/library');
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

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { href: '/search', label: 'Search', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> },
    { href: '/library', label: 'Library', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> },
    { href: '/profile', label: 'Profile', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  const platformPip = (color: string) => (
    <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
  );

  return (
    <>
      <aside className="w-[280px] flex-shrink-0 border-r border-warm bg-warm flex flex-col h-full">

        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-warm shrink-0">
          <CassetteIcon className="text-amber" />
          <span className="font-display text-2xl text-cream">{BRAND.name}</span>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex flex-col gap-0.5 shrink-0">
          {navItems.map(({ href, label, icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 font-condensed text-xs tracking-widest uppercase transition-colors ${
                  isActive
                    ? 'text-amber border-l-2 border-amber bg-amber-dim'
                    : 'text-muted hover:text-amber border-l-2 border-transparent'
                }`}
              >
                <span className={isActive ? 'text-amber' : 'text-muted'}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Playlists Area */}
        <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-warm) transparent' }}>
          <div className="px-5 mb-2 flex items-center justify-between">
            <h3 className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted">Your Library</h3>
          </div>

          <CustomPlaylistSection
            activePlaylistId={activePlaylist?.id || null}
            onPlaylistSelect={handlePlaylistSelect}
            onCreateClick={() => setIsCreateModalOpen(true)}
            playlists={customPlaylists}
            onPlaylistsChange={setCustomPlaylists}
          />

          <div className="px-5 mt-5 mb-2 flex items-center gap-2">
            <h3 className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted">Connected Services</h3>
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

        {/* Footer */}
        <div className="p-4 border-t border-warm shrink-0">
          <div className="mb-3 px-1 flex items-center justify-between">
            <span className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted">Platforms</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${spotifyToken ? 'bg-spotify' : 'bg-muted/30'}`} title="Spotify" />
              <span className={`w-2 h-2 rounded-full ${youtubeToken ? 'bg-youtube' : 'bg-muted/30'}`} title="YouTube" />
              <span className={`w-2 h-2 rounded-full ${soundcloudToken ? 'bg-soundcloud' : 'bg-muted/30'}`} title="SoundCloud" />
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/'); }}
            className="w-full px-4 py-2.5 font-condensed text-[10px] tracking-widest uppercase text-muted hover:text-amber transition-colors flex items-center gap-3"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Logout
          </button>
        </div>

      </aside>

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreatePlaylist} />
    </>
  );
}