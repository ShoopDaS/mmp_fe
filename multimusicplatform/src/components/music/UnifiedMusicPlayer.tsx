'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
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

  // THE CACHE: Store all initialized adapters here so we never destroy them prematurely
  const adaptersMap = useRef<Record<string, IPlayerAdapter>>({});
  const activePlatformRef = useRef<string | null>(null);
  
  const loopModeRef = useRef<LoopMode>('none');
  const currentTrackRef = useRef<Track>(track); // Ensures callbacks always see the latest track
  const prevVolumeRef = useRef(0.8);
  const vuBarHeights = useRef(Array.from({ length: 28 }, () => Math.random() * 60 + 40));

  // Queue integration
  const queue = useQueue();

  // Keep track ref updated for closures
  useEffect(() => {
    currentTrackRef.current = track;
  }, [track]);

  // Clear error whenever the track changes
  useEffect(() => {
    setError('');
  }, [track.id]);

  // Auto-advance: when a track errors (e.g. removed from Spotify), skip to the next
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
    let isCancelled = false; // Per-invocation cancellation flag

    // Suspend the previously active platform if we are switching.
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
      // FAST PATH: If adapter is already cached, restore it and reuse it.
      if (adaptersMap.current[platform]) {
        console.log(`♻️ Restoring cached adapter for: ${platform}`);
        const existingAdapter = adaptersMap.current[platform];

        if (existingAdapter.restore) {
          const ok = await existingAdapter.restore();
          if (isCancelled) return; 
          if (!ok) {
            setError(`Failed to reconnect ${platform} player`);
            return;
          }
        }

        if (isCancelled) return; 
        setPlayerState(existingAdapter.getState());
        setReadyPlatform(platform); // Trigger the play effect
        return;
      }

      // SLOW PATH: First time using this platform, initialize it.
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

      // Setup Listeners
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

      if (isCancelled || activePlatformRef.current !== platform) return;

      if (success) {
        setReadyPlatform(platform); // Triggers play effect
      } else {
        setError(`Failed to initialize ${platform} player`);
      }
    };

    setupAdapter();

    return () => {
      isCancelled = true;
    };
  }, [track.platform, token]);

  // 2. The Play Effect (Waits for platform to be officially "ready")
  useEffect(() => {
    let isPlayCancelled = false;
    const adapter = adaptersMap.current[track.platform];

    if (readyPlatform === track.platform && adapter && playerState.canPlay) {
      adapter.play(track).catch((err) => {
        if (!isPlayCancelled && activePlatformRef.current === track.platform) {
          adapter.pause().catch(() => {});
          setError(err.message);
        }
      });
    }

    return () => { isPlayCancelled = true; };
  }, [track.id, readyPlatform, playerState.canPlay]);


  // 3. True Cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 Music Player unmounting, destroying all cached adapters...');
      Object.values(adaptersMap.current).forEach(adapter => {
        (adapter.suspend ? adapter.suspend() : adapter.pause()).catch(() => {});
        adapter.cleanup();
      });
      adaptersMap.current = {};
    };
  }, []);

  // --- Controls & UI ---
  useEffect(() => { loopModeRef.current = queue.loopMode; }, [queue.loopMode]);

  const togglePlay = () => {
    adaptersMap.current[track.platform]?.togglePlay()?.catch((e: unknown) => {
      console.warn('togglePlay failed:', e);
    });
  };
  useImperativeHandle(ref, () => ({ togglePlay }));

  useEffect(() => {
    if (onPlayerStateChange) onPlayerStateChange(playerState.isPlaying);
  }, [playerState.isPlaying, onPlayerStateChange]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    adaptersMap.current[track.platform]?.seek(Number(e.target.value))?.catch((e: unknown) => {
      console.warn('seek failed:', e);
    });
  };
  const handlePrevious = () => queue.previous();
  const handleNext = () => queue.next();

  // Volume Handlers
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    adaptersMap.current[track.platform]?.setVolume(Number(e.target.value))?.catch((e: unknown) => {
      console.warn('setVolume failed:', e);
    });
  };

  const handleVolumeWheel = (e: React.WheelEvent) => {
    // Scrolling down (deltaY > 0) decreases volume, scrolling up increases volume
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newVol = Math.max(0, Math.min(1, playerState.volume + delta));
    adaptersMap.current[track.platform]?.setVolume(newVol)?.catch((e: unknown) => {
      console.warn('setVolume failed:', e);
    });
  };

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

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTime = pct * playerState.duration;
    adaptersMap.current[track.platform]?.seek(seekTime)?.catch((err: unknown) => {
      console.warn('seek failed:', err);
    });
  }, [playerState.duration, track.platform]);

  const handleMuteToggle = useCallback(() => {
    if (playerState.volume > 0) {
      prevVolumeRef.current = playerState.volume;
      adaptersMap.current[track.platform]?.setVolume(0)?.catch((err: unknown) => {
        console.warn('mute failed:', err);
      });
    } else {
      adaptersMap.current[track.platform]?.setVolume(prevVolumeRef.current)?.catch((err: unknown) => {
        console.warn('unmute failed:', err);
      });
    }
  }, [playerState.volume, track.platform]);

  const handleVolumeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    adaptersMap.current[track.platform]?.setVolume(pct)?.catch((err: unknown) => {
      console.warn('setVolume failed:', err);
    });
  }, [track.platform]);

  const progressPct = playerState.duration > 0 ? (playerState.currentTime / playerState.duration) * 100 : 0;

  if (readyPlatform !== track.platform && !error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center text-muted animate-pulse font-condensed text-[11px] tracking-[0.15em] uppercase">
          Initializing {track.platform}…
        </div>
      </div>
    );
  }

  const youtubeUrlMatch = error?.match(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  const youtubeUrl = youtubeUrlMatch ? youtubeUrlMatch[0] : null;
  const errorMessage = error ? (youtubeUrl ? error.split('Open on YouTube:')[0].trim() : error) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Player section */}
      <div className="flex-shrink-0 p-5 border-b border-warm">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <span className="font-condensed text-[9px] tracking-[0.22em] uppercase text-muted">Now Playing</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-blink" />
            <span className="font-condensed text-[9px] tracking-[0.15em] uppercase text-red-400">Rec</span>
          </span>
        </div>

        {/* Cassette tape deck */}
        <div className="relative mb-5">
          {/* Accent stripe top edge */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber to-transparent" />

          <div className="bg-card border border-warm p-4 pt-5">
            <div className="flex items-center gap-3">
              {/* Left spool */}
              <div className="flex flex-col items-center gap-1.5">
                <svg className={`w-12 h-12 text-amber ${playerState.isPlaying ? 'animate-spin-slow' : ''}`} viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="1" />
                  <circle cx="24" cy="24" r="3" fill="currentColor" />
                </svg>
                <span className="font-condensed text-[11px] text-amber tabular-nums">
                  {formatTime(playerState.currentTime)}
                </span>
              </div>

              {/* Tape bridge with progress */}
              <div className="flex-1 px-1">
                <div
                  className="h-[3px] bg-warm cursor-pointer relative"
                  onClick={handleProgressClick}
                >
                  <div
                    className="h-full bg-gradient-to-r from-red-800 to-amber relative"
                    style={{ width: `${progressPct}%` }}
                  >
                    {/* Playhead */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1 h-4 bg-amber shadow-[0_0_6px_rgba(224,148,58,0.5)]" />
                  </div>
                </div>
              </div>

              {/* Right spool */}
              <div className="flex flex-col items-center gap-1.5">
                <svg className={`w-12 h-12 text-muted ${playerState.isPlaying ? 'animate-[spin_3s_linear_infinite_reverse]' : ''}`} viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="1" />
                  <circle cx="24" cy="24" r="3" fill="currentColor" />
                </svg>
                <span className="font-condensed text-[11px] text-muted tabular-nums">
                  {formatTime(playerState.duration)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Now playing info */}
        <div className="text-center mb-5">
          {track.album.images[0]?.url && (
            <img src={track.album.images[0].url} alt="" className={`w-16 h-16 mx-auto mb-3 border border-warm object-cover ${error ? 'opacity-50 grayscale' : ''}`} />
          )}
          <h3 className="font-display text-lg text-cream truncate">{track.name}</h3>
          {errorMessage ? (
            <div className="mt-1">
              <p className="text-[11px] text-red-400 line-clamp-2">{errorMessage}</p>
              {autoSkipCountdown !== null && <span className="text-[10px] text-muted mt-1 block">Skipping in {autoSkipCountdown}s</span>}
              {youtubeUrl && <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-red-400 underline mt-1 inline-block">Open on YouTube</a>}
            </div>
          ) : (
            <p className="text-sub italic text-sm truncate mt-0.5">
              {track.artists.map(a => a.name).join(', ')}
            </p>
          )}
          <span className={`inline-block mt-2 font-condensed text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 border ${
            track.platform === 'spotify' ? 'text-spotify border-spotify/30' :
            track.platform === 'youtube' ? 'text-youtube border-youtube/30' :
            'text-soundcloud border-soundcloud/30'
          }`}>{track.platform}</span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-5 mb-5">
          {/* Shuffle */}
          <button onClick={queue.toggleShuffle} className={`transition-colors ${queue.shuffle ? 'text-amber' : 'text-muted hover:text-sub'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
          </button>
          {/* Previous */}
          <button onClick={handlePrevious} className="text-muted hover:text-cream transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          {/* Play/Pause */}
          <button onClick={error ? undefined : togglePlay} disabled={!!error} className={`w-12 h-12 flex items-center justify-center transition-all ${error ? 'bg-warm cursor-not-allowed opacity-50' : 'bg-amber text-bg hover:brightness-110'}`}>
            {playerState.isPlaying ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          {/* Next */}
          <button onClick={handleNext} className="text-muted hover:text-cream transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          {/* Loop */}
          <button onClick={queue.cycleLoopMode} className={`transition-colors relative ${queue.loopMode !== 'none' ? 'text-amber' : 'text-muted hover:text-sub'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            {queue.loopMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] text-amber font-bold">1</span>}
          </button>
        </div>

        {/* VU Meter */}
        <div className="flex items-end justify-center gap-px h-6 mb-4">
          {vuBarHeights.current.map((h, i) => (
            <div
              key={i}
              className={`w-1 origin-bottom ${i < 20 ? 'bg-amber' : i < 24 ? 'bg-amber/70' : 'bg-red-500/70'}`}
              style={{
                height: `${h}%`,
                transform: playerState.isPlaying ? undefined : 'scaleY(0.15)',
                animation: playerState.isPlaying ? `vu ${0.2 + (h / 100) * 0.3}s ease-in-out infinite alternate` : 'none',
                animationDelay: `${i * 0.02}s`,
                opacity: playerState.isPlaying ? 1 : 0.25,
                transition: playerState.isPlaying ? 'none' : 'transform 0.4s ease, opacity 0.4s ease',
              }}
            />
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <button onClick={handleMuteToggle} className="text-muted hover:text-cream transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {playerState.volume === 0 ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
              : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></>}
            </svg>
          </button>
          <div
            className="flex-1 h-3 cursor-pointer relative group flex items-center"
            onClick={handleVolumeClick}
            onWheel={handleVolumeWheel}
          >
            <div className="absolute inset-y-0 left-0 right-0 flex items-center">
              <div className="w-full h-1 bg-warm relative">
                <div className="h-full bg-amber" style={{ width: `${playerState.volume * 100}%` }} />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${playerState.volume * 100}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
            </div>
          </div>
          <span className="font-condensed text-[10px] text-muted w-7 text-right">{Math.round(playerState.volume * 100)}%</span>
        </div>
      </div>

      {/* Queue section */}
      <QueueManager customPlaylists={customPlaylists} />
    </div>
  );
});

UnifiedMusicPlayer.displayName = 'UnifiedMusicPlayer';
export default UnifiedMusicPlayer;