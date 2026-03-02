'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import LeftSidebar from './LeftSidebar';
import UnifiedMusicPlayer from '../music/UnifiedMusicPlayer';
import { useQueue } from '@/hooks/useQueue';
import { useHub } from '@/contexts/HubContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queue = useQueue();
  const { globalPlayToggle, spotifyToken, soundcloudToken, youtubeToken, customPlaylists, setIsPlaying } = useHub();
  const currentTrack = queue.getCurrentTrack();
  const playerRef = useRef<any>(null);

  // Listen for global play/pause toggle events (from search page TrackList)
  useEffect(() => {
    if (globalPlayToggle > 0 && playerRef.current) {
      playerRef.current.togglePlay();
    }
  }, [globalPlayToggle]);

  // Don't render the shell on the login page
  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-full flex bg-base text-text-primary overflow-hidden">
      
      {/* PANE 1: Left Sidebar */}
      <LeftSidebar />

      {/* PANE 2: Main Content (Fluid, Scrollable) */}
      <main className="flex-1 overflow-y-auto relative bg-base">
        {children}
      </main>

      {/* PANE 3: Right Panel / Player */}
      <div className="w-80 flex-shrink-0 bg-surface border-l border-white/5 flex flex-col hidden lg:flex relative">
        {currentTrack ? (
          <UnifiedMusicPlayer
            ref={playerRef}
            track={currentTrack}
            token={
              currentTrack.platform === 'spotify' ? spotifyToken || ''
              : currentTrack.platform === 'soundcloud' ? soundcloudToken || ''
              : youtubeToken || ''
            }
            onTrackEnd={() => queue.next()}
            onPlayerStateChange={setIsPlaying}
            customPlaylists={customPlaylists}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-sm gap-3 opacity-60">
            <span className="text-4xl text-white">🎵</span>
            Play a track to view Queue
          </div>
        )}
      </div>

    </div>
  );
}