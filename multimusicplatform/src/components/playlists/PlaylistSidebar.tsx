'use client';

import { useState } from 'react';
import { UnifiedPlaylist } from '@/types/playlist';
import PlatformPlaylistSection from './PlatformPlaylistSection';

interface PlaylistSidebarProps {
  spotifyToken: string | null;
  youtubeToken: string | null;
  soundcloudToken: string | null;
  activePlaylistId: string | null;
  onPlaylistSelect: (playlist: UnifiedPlaylist) => void;
  onPlaylistRefresh: (playlist: UnifiedPlaylist) => void;
}

export default function PlaylistSidebar({
  spotifyToken,
  youtubeToken,
  soundcloudToken,
  activePlaylistId,
  onPlaylistSelect,
  onPlaylistRefresh,
}: PlaylistSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Determine which platforms are connected (have tokens)
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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
          Playlists
        </h2>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>

      {/* Platform sections */}
      <div className="flex-1 overflow-y-auto">
        {connectedPlatforms.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No platforms connected.
            <br />
            Connect a music service from the Dashboard.
          </div>
        ) : (
          connectedPlatforms.map((platform) => (
            <PlatformPlaylistSection
              key={platform}
              platform={platform}
              token={getToken(platform)}
              activePlaylistId={activePlaylistId}
              onPlaylistSelect={(playlist) => {
                onPlaylistSelect(playlist);
                setIsMobileOpen(false); // Close drawer on mobile after selection
              }}
              onPlaylistRefresh={onPlaylistRefresh}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed left-4 top-20 z-40 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors"
      >
        📋 Playlists
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          md:hidden fixed left-0 top-0 bottom-0 z-50 w-72
          bg-black/90 backdrop-blur-md border-r border-white/10
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar - always visible */}
      <aside className="hidden md:block w-72 flex-shrink-0 bg-black/20 backdrop-blur-sm border-r border-white/10 overflow-hidden">
        {sidebarContent}
      </aside>
    </>
  );
}