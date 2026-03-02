'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { IPlayerAdapter, Track, PlayerState } from '@/lib/player-adapters/IPlayerAdapter';
import { SpotifyAdapter } from '@/lib/player-adapters/SpotifyAdapter';
import { SoundCloudAdapter } from '@/lib/player-adapters/SoundCloudAdapter';
import { YouTubeAdapter } from '@/lib/player-adapters/YouTubeAdapter';
import { useQueue } from '@/hooks/useQueue';
import { LoopMode } from '@/types/queue';
import { CustomPlaylist } from '@/types/playlist';
import QueueManager from '@/components/queue/QueueManager';

interface UnifiedMusicPlayerProps {
  track: Track;
  token: string;
  onTrackEnd?: () => void;
  onPlayerStateChange?: (isPlaying: boolean) => void;
  customPlaylists?: CustomPlaylist[];
}

export interface UnifiedMusicPlayerRef {
  togglePlay: () => void;
}

const UnifiedMusicPlayer = forwardRef<UnifiedMusicPlayerRef, UnifiedMusicPlayerProps>(({
  track,
  token,
  onTrackEnd,
  onPlayerStateChange,
  customPlaylists = [],
}, ref) => {
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isLooping: false,
    isShuffle: false,
    canPlay: false,
  });
  
  const [error, setError] = useState<string>('');
  const [showVolume, setShowVolume] = useState(false);
  const [readyPlatform, setReadyPlatform] = useState<string | null>(null);

  // 🚨 THE CACHE: Store all initialized adapters here so we never destroy them prematurely
  const adaptersMap = useRef<Record<string, IPlayerAdapter>>({});
  const activePlatformRef = useRef<string | null>(null);
  
  const loopModeRef = useRef<LoopMode>('none');
  const currentTrackRef = useRef<Track>(track); // Ensures callbacks always see the latest track

  // Queue integration
  const queue = useQueue();

  // Keep track ref updated for closures
  useEffect(() => {
    currentTrackRef.current = track;
  }, [track]);

  // 🚨 FIX: Clear error whenever the track changes, not just on platform switch.
  // Without this, switching from one broken SoundCloud track to another SoundCloud
  // track would keep the old error displayed because effect #1 only runs on
  // platform change, not track change.
  useEffect(() => {
    setError('');
  }, [track.id]);

  // Auto-advance: when a track errors (e.g. removed from Spotify), skip to the
  // next queue item after 5 seconds so the user doesn't have to do it manually.
  const [autoSkipCountdown, setAutoSkipCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!error) {
      setAutoSkipCountdown(null);
      return;
    }
    setAutoSkipCountdown(10);
    const tick = setInterval(() => {
      setAutoSkipCountdown(prev => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    const skip = setTimeout(() => {
      queue.next();
    }, 10000);
    return () => {
      clearInterval(tick);
      clearTimeout(skip);
      setAutoSkipCountdown(null);
    };
  }, [error]);

  // 1. Manage Platform Switching & Initialization
  useEffect(() => {
    const platform = track.platform;
    let isCancelled = false; // 🚨 FIX: Per-invocation cancellation flag

    // Suspend the previously active platform if we are switching.
    // suspend() pauses playback AND silences audio (so nothing leaks through),
    // and for Spotify premium it also disconnects from Spotify Connect so the
    // device is invisible to external Spotify clients while not in use.
    if (activePlatformRef.current && activePlatformRef.current !== platform) {
      const oldAdapter = adaptersMap.current[activePlatformRef.current];
      if (oldAdapter) {
        console.log(`💤 Suspending background platform: ${activePlatformRef.current}`);
        (oldAdapter.suspend ? oldAdapter.suspend() : oldAdapter.pause()).catch(() => {});
      }
    }

    activePlatformRef.current = platform;
    setError('');

    const setupAdapter = async () => {
      // 🚨 FAST PATH: If adapter is already cached, restore it and reuse it.
      // restore() reverses the effects of suspend() — for Spotify premium it
      // reconnects to Spotify Connect; for YouTube/SoundCloud it un-mutes.
      if (adaptersMap.current[platform]) {
        console.log(`♻️ Restoring cached adapter for: ${platform}`);
        const existingAdapter = adaptersMap.current[platform];

        if (existingAdapter.restore) {
          const ok = await existingAdapter.restore();
          if (isCancelled) return; // 🚨 GUARD
          if (!ok) {
            setError(`Failed to reconnect ${platform} player`);
            return;
          }
        }

        if (isCancelled) return; // 🚨 GUARD
        setPlayerState(existingAdapter.getState());
        setReadyPlatform(platform); // Trigger the play effect
        return;
      }

      // 🚨 SLOW PATH: First time using this platform, initialize it.
      console.log(`🎵 Creating new adapter for: ${platform}`);
      
      // Reset UI for initial load
      setPlayerState(prev => ({ ...prev, canPlay: false, isPlaying: false }));
      
      let newAdapter: IPlayerAdapter;
      switch (platform) {
        case 'spotify': newAdapter = new SpotifyAdapter(); break;
        case 'soundcloud': newAdapter = new SoundCloudAdapter(); break;
        case 'youtube': newAdapter = new YouTubeAdapter(); break;
        default: throw new Error(`Unsupported platform: ${platform}`);
      }

      // Store in cache immediately
      adaptersMap.current[platform] = newAdapter;

      // Setup Listeners (Gatekept by activePlatformRef to prevent background UI updates)
      newAdapter.onStateChange((state) => {
        if (activePlatformRef.current === platform) setPlayerState(state);
      });

      newAdapter.onError((err) => {
        if (activePlatformRef.current === platform) {
          console.error(`❌ [${platform}] error:`, err);
          setError(err.message);
        }
      });

      newAdapter.onTrackEnd(() => {
        if (activePlatformRef.current !== platform) return;
        if (loopModeRef.current === 'one') {
          newAdapter.play(currentTrackRef.current);
        } else if (onTrackEnd) {
          onTrackEnd();
        }
      });

      const success = await newAdapter.initialize(token);

      // 🚨 FIX: Check BOTH the platform guard AND the cancellation flag.
      // The platform guard alone fails when Strict Mode re-mounts the same platform:
      // mount #1's stale async closure sees platform === activePlatformRef.current
      // (both are 'soundcloud') and proceeds to call setError(), corrupting mount #2.
      if (isCancelled || activePlatformRef.current !== platform) return;

      if (success) {
        setReadyPlatform(platform); // Triggers play effect
      } else {
        setError(`Failed to initialize ${platform} player`);
      }
    };

    setupAdapter();

    return () => {
      isCancelled = true; // 🚨 FIX: Cancel this invocation's async work on cleanup
    };
  }, [track.platform, token]);

  // 2. The Play Effect (Waits for platform to be officially "ready")
  useEffect(() => {
    let isPlayCancelled = false;
    const adapter = adaptersMap.current[track.platform];

    if (readyPlatform === track.platform && adapter && playerState.canPlay) {
      adapter.play(track).catch((err) => {
        if (!isPlayCancelled && activePlatformRef.current === track.platform) {
          // Stop whatever was playing before — the new track failed so nothing
          // should continue playing in the background.
          adapter.pause().catch(() => {});
          setError(err.message);
        }
      });
    }

    return () => { isPlayCancelled = true; };
  }, [track.id, readyPlatform, playerState.canPlay]);


  // 3. True Cleanup (Only runs when the music player UI is completely closed/unmounted)
  useEffect(() => {
    return () => {
      console.log('🧹 Music Player unmounting, destroying all cached adapters...');
      Object.values(adaptersMap.current).forEach(adapter => {
        // suspend() silences and disconnects cleanly before cleanup()
        (adapter.suspend ? adapter.suspend() : adapter.pause()).catch(() => {});
        adapter.cleanup();
      });
      adaptersMap.current = {};
    };
  }, []);

  // --- Controls & UI ---
  // Keep loopModeRef in sync with queue context
  useEffect(() => { loopModeRef.current = queue.loopMode; }, [queue.loopMode]);

  const togglePlay = () => adaptersMap.current[track.platform]?.togglePlay();
  useImperativeHandle(ref, () => ({ togglePlay }));

  useEffect(() => {
    if (onPlayerStateChange) onPlayerStateChange(playerState.isPlaying);
  }, [playerState.isPlaying, onPlayerStateChange]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => adaptersMap.current[track.platform]?.seek(Number(e.target.value));
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => adaptersMap.current[track.platform]?.setVolume(Number(e.target.value));
  const handlePrevious = () => queue.previous();
  const handleNext = () => queue.next();

  const getLoopModeLabel = () => {
    switch (queue.loopMode) {
      case 'none': return null;
      case 'one': return '1';
      case 'all': return 'All';
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPlatformColor = () => {
    switch (track.platform) {
      case 'spotify': return 'bg-green-500 hover:bg-green-600';
      case 'soundcloud': return 'bg-orange-500 hover:bg-orange-600';
      case 'youtube': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  if (readyPlatform !== track.platform && !error) {
    return (
      <aside className="fixed right-0 top-0 bottom-0 w-80 bg-surface border-l border-white/5 flex flex-col items-center justify-center z-50">
        <div className="text-center text-text-secondary animate-pulse">
          ⏳ Initializing {track.platform}...
        </div>
      </aside>
    );
  }

  const youtubeUrlMatch = error?.match(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  const youtubeUrl = youtubeUrlMatch ? youtubeUrlMatch[0] : null;
  const errorMessage = error ? (youtubeUrl ? error.split('Open on YouTube:')[0].trim() : error) : null;

  return (
    <aside className={`fixed right-0 top-0 bottom-0 w-80 bg-surface border-l ${error ? 'border-red-500/30' : 'border-white/5'} flex flex-col z-50 shadow-2xl`}>
      
      {/* 1. Album Art & Glassmorphism Header */}
      <div className="relative w-full aspect-square shrink-0 overflow-hidden">
         {/* Background blurred image */}
         <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl scale-110" style={{ backgroundImage: `url(${track.album.images[0]?.url})` }} />
         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/50 to-surface" />
         
         {/* Actual Image */}
         <div className="absolute inset-8 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
           <img src={track.album.images[0]?.url} alt={track.album.name} className={`w-full h-full object-cover ${error ? 'opacity-50 grayscale' : ''}`} />
           {/* Platform Badge Overlay */}
           <div className={`absolute bottom-2 right-2 px-2 py-1 rounded-md text-[10px] font-bold text-white shadow-lg uppercase tracking-wider ${getPlatformColor()}`}>
             {track.platform}
           </div>
         </div>
      </div>

      {/* 2. Track Info */}
      <div className="px-6 mt-2 text-center shrink-0 relative z-10">
         <h3 className="font-bold text-white text-xl truncate">{track.name}</h3>
         {errorMessage ? (
           <div className="flex flex-col items-center gap-1 mt-1">
             <p className="text-xs text-red-400 line-clamp-2">⚠️ {errorMessage}</p>
             {autoSkipCountdown !== null && <span className="text-[10px] text-text-secondary">Skipping in {autoSkipCountdown}s</span>}
             {youtubeUrl && <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 underline mt-1">Open on YouTube</a>}
           </div>
         ) : (
           <p className="text-sm text-text-secondary truncate mt-1">
             {track.artists.map(a => a.name).join(', ')}
           </p>
         )}
      </div>

      {/* 3. Progress Bar */}
      <div className="px-8 mt-6 shrink-0 relative z-10">
        <input
          type="range" min="0" max={playerState.duration || 1} value={playerState.currentTime} onChange={handleSeek}
          className="w-full h-1 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-white hover:h-1.5 transition-all"
          style={{ background: `linear-gradient(to right, white 0%, white ${(playerState.currentTime / playerState.duration) * 100}%, var(--surface-hover) ${(playerState.currentTime / playerState.duration) * 100}%, var(--surface-hover) 100%)` }}
        />
        <div className="flex justify-between text-[10px] text-text-secondary font-medium mt-2">
          <span>{formatTime(playerState.currentTime)}</span>
          <span>{formatTime(playerState.duration)}</span>
        </div>
      </div>

      {/* 4. Playback Controls */}
      <div className="px-6 mt-4 mb-2 flex items-center justify-between shrink-0 relative z-10">
        <button onClick={queue.toggleShuffle} className={`p-2 rounded-full transition-all ${queue.shuffle ? 'text-accent' : 'text-text-secondary hover:text-white'}`}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
        </button>

        <button onClick={handlePrevious} className="p-2 text-white hover:text-accent transition-colors">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg>
        </button>

        <button onClick={error ? undefined : togglePlay} disabled={!!error} className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform shadow-lg ${error ? 'bg-surface-hover cursor-not-allowed opacity-50' : `${getPlatformColor().split(' ')[0]} hover:scale-105`}`}>
          <span className="text-2xl text-white ml-1">{playerState.isPlaying ? '⏸️' : '▶️'}</span>
        </button>

        <button onClick={handleNext} className="p-2 text-white hover:text-accent transition-colors">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" /></svg>
        </button>

        <button onClick={queue.cycleLoopMode} className={`p-2 rounded-full transition-all relative ${queue.loopMode !== 'none' ? 'text-accent' : 'text-text-secondary hover:text-white'}`}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" /></svg>
          {getLoopModeLabel() && <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-accent text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">{getLoopModeLabel()}</span>}
        </button>
      </div>

      {/* 5. Inline Seamless Queue */}
      <QueueManager customPlaylists={customPlaylists} />
      
    </aside>
  );
});

UnifiedMusicPlayer.displayName = 'UnifiedMusicPlayer';
export default UnifiedMusicPlayer;