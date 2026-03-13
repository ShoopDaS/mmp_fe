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
      <main className={`flex-1 overflow-y-auto relative bg-base ${currentTrack ? 'pb-16 lg:pb-0' : ''}`}>
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

      {/* Mobile Mini-Player Bar (visible below lg when a track is playing) */}
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-white/5 flex items-center px-4 gap-3 z-50 lg:hidden">
          {currentTrack.album.images[0]?.url && (
            <img src={currentTrack.album.images[0].url} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{currentTrack.name}</p>
            <p className="text-text-secondary text-xs truncate">{currentTrack.artists.map(a => a.name).join(', ')}</p>
          </div>
          <button
            onClick={() => queue.previous()}
            className="p-2 text-text-secondary hover:text-white transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg>
          </button>
          <button
            onClick={() => playerRef.current?.togglePlay()}
            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0"
          >
            <span className="text-lg text-white">{isPlaying ? '⏸️' : '▶️'}</span>
          </button>
          <button
            onClick={() => queue.next()}
            className="p-2 text-text-secondary hover:text-white transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" /></svg>
          </button>
        </div>
      )}

    </div>
  );
}