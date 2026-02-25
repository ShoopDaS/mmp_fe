'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { IPlayerAdapter, Track, PlayerState } from '@/lib/player-adapters/IPlayerAdapter';
import { SpotifyAdapter } from '@/lib/player-adapters/SpotifyAdapter';
import { SoundCloudAdapter } from '@/lib/player-adapters/SoundCloudAdapter';
import { YouTubeAdapter } from '@/lib/player-adapters/YouTubeAdapter';
import { useQueue } from '@/hooks/useQueue';
import { LoopMode } from '@/types/queue';
import QueueManager from '@/components/queue/QueueManager';

interface UnifiedMusicPlayerProps {
  track: Track;
  token: string;
  onTrackEnd?: () => void;
  onPlayerStateChange?: (isPlaying: boolean) => void;
}

export interface UnifiedMusicPlayerRef {
  togglePlay: () => void;
}

const UnifiedMusicPlayer = forwardRef<UnifiedMusicPlayerRef, UnifiedMusicPlayerProps>(({
  track,
  token,
  onTrackEnd,
  onPlayerStateChange
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

  // 1. Manage Platform Switching & Initialization
  useEffect(() => {
    const platform = track.platform;
    let isCancelled = false; // 🚨 FIX: Per-invocation cancellation flag

    // Pause the previously active platform if we are switching
    if (activePlatformRef.current && activePlatformRef.current !== platform) {
      const oldAdapter = adaptersMap.current[activePlatformRef.current];
      if (oldAdapter) {
        console.log(`⏸️ Pausing background platform: ${activePlatformRef.current}`);
        oldAdapter.pause().catch(() => {});
      }
    }

    activePlatformRef.current = platform;
    setError('');

    const setupAdapter = async () => {
      // 🚨 FAST PATH: If adapter is already cached, just reuse it!
      if (adaptersMap.current[platform]) {
        console.log(`♻️ Reusing cached adapter for: ${platform}`);
        const existingAdapter = adaptersMap.current[platform];
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
        adapter.pause().catch(() => {});
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
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="max-w-6xl mx-auto text-center text-gray-400">
          ⏳ Initializing player...
        </div>
      </div>
    );
  }

  if (error) {
    const youtubeUrlMatch = error.match(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    const youtubeUrl = youtubeUrlMatch ? youtubeUrlMatch[0] : null;
    const errorMessage = youtubeUrl ? error.split('Open on YouTube:')[0].trim() : error;

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-red-500/30 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <img src={track.album.images[0]?.url} alt={track.album.name} className="w-16 h-16 rounded shadow-lg opacity-50" />
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{track.name}</h3>
                  <p className="text-red-300 text-sm">{errorMessage}</p>
                </div>
              </div>
            </div>
            {youtubeUrl && (
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2">
                <span>▶️</span> Open on YouTube
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4 z-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-3">
          <input
            type="range" min="0" max={playerState.duration || 1} value={playerState.currentTime} onChange={handleSeek}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
            style={{ background: `linear-gradient(to right, white 0%, white ${(playerState.currentTime / playerState.duration) * 100}%, rgb(55, 65, 81) ${(playerState.currentTime / playerState.duration) * 100}%, rgb(55, 65, 81) 100%)` }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(playerState.currentTime)}</span>
            <span>{formatTime(playerState.duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <img src={track.album.images[0]?.url} alt={track.album.name} className="w-16 h-16 rounded shadow-lg" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{track.name}</h3>
            <p className="text-sm text-gray-300 truncate">{track.artists.map(a => a.name).join(', ')}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded ${getPlatformColor()} text-white`}>{track.platform.toUpperCase()}</span>
              {track.platform === 'spotify' && (
                <span className="text-xs text-gray-400">{playerState.duration > 30000 ? '🎵 Premium' : '⏱️ Preview'}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shuffle button */}
            <button
              onClick={queue.toggleShuffle}
              className={`p-2 rounded-full transition-all ${queue.shuffle ? 'bg-white text-black' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
              title={`Shuffle: ${queue.shuffle ? 'On' : 'Off'}`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
            </button>

            {/* Loop mode button */}
            <button
              onClick={queue.cycleLoopMode}
              className={`p-2 rounded-full transition-all relative ${queue.loopMode !== 'none' ? 'bg-white text-black' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
              title={`Loop: ${queue.loopMode === 'none' ? 'Off' : queue.loopMode === 'one' ? 'One' : 'All'}`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" /></svg>
              {getLoopModeLabel() && (
                <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-purple-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {getLoopModeLabel()}
                </span>
              )}
            </button>

            {/* Previous */}
            <button onClick={handlePrevious} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors" title="Previous">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg>
            </button>

            {/* Play/Pause */}
            <button onClick={togglePlay} className={`w-12 h-12 ${getPlatformColor()} rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg`}>
              <span className="text-2xl text-white">{playerState.isPlaying ? '⏸️' : '▶️'}</span>
            </button>

            {/* Next */}
            <button onClick={handleNext} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors" title="Next">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" /></svg>
            </button>

            {/* Volume */}
            <div className="relative">
              <button onClick={() => setShowVolume(!showVolume)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
              </button>
              {showVolume && (
                <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-800 rounded-lg shadow-xl">
                  <input type="range" min="0" max="1" step="0.01" value={playerState.volume} onChange={handleVolumeChange} className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"/>
                  <div className="text-xs text-center text-gray-300 mt-1">{Math.round(playerState.volume * 100)}%</div>
                </div>
              )}
            </div>

            {/* Queue Manager */}
            <div className="relative">
              <QueueManager />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

UnifiedMusicPlayer.displayName = 'UnifiedMusicPlayer';
export default UnifiedMusicPlayer;