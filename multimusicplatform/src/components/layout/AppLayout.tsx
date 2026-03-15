'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import LeftSidebar from './LeftSidebar';
import UnifiedMusicPlayer, { UnifiedMusicPlayerRef } from '../music/UnifiedMusicPlayer';
import { useQueue } from '@/hooks/useQueue';
import { useHub } from '@/contexts/HubContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queue = useQueue();
  const { globalPlayToggle, spotifyToken, soundcloudToken, youtubeToken, customPlaylists, setIsPlaying, isPlaying } = useHub();
  const currentTrack = queue.getCurrentTrack();
  const playerRef = useRef<UnifiedMusicPlayerRef>(null);

  useEffect(() => {
    if (globalPlayToggle > 0 && playerRef.current) {
      playerRef.current.togglePlay();
    }
  }, [globalPlayToggle]);

  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="bg-bg h-screen flex overflow-hidden">

      {/* PANE 1: Left Sidebar — 280px fixed */}
      <LeftSidebar />

      {/* PANE 2: Main Content — fluid, scrollable */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* PANE 3: Player Panel — 390px fixed */}
      <div className="w-[390px] flex-shrink-0 border-l border-warm bg-warm flex flex-col h-screen">
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
          <div className="flex-1 flex flex-col items-center justify-center text-sub text-sm gap-3 opacity-60">
            <span className="text-4xl">📼</span>
            Play a track to view Queue
          </div>
        )}
      </div>

      {/* Global UI overlays (WP-2: ContextMenu, ImportDropdown will go here) */}

    </div>
  );
}