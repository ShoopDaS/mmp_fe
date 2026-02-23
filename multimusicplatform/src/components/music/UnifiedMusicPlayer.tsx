'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { IPlayerAdapter, Track, PlayerState } from '@/lib/player-adapters/IPlayerAdapter';
import { SpotifyAdapter } from '@/lib/player-adapters/SpotifyAdapter';
import { SoundCloudAdapter } from '@/lib/player-adapters/SoundCloudAdapter';
import { YouTubeAdapter } from '@/lib/player-adapters/YouTubeAdapter';

interface UnifiedMusicPlayerProps {
  track: Track;
  token: string;
  onTrackEnd?: () => void;
  onPlayerStateChange?: (isPlaying: boolean) => void;
}

export interface UnifiedMusicPlayerRef {
  togglePlay: () => void;
}

// ===== YouTube Debug Error Toast =====
interface YTDebugError {
  errorCode: number;
  debugCategory: string;
  videoId: string;
  videoUrl: string;
  trackName: string;
  trackArtist: string;
  message: string;
  timestamp: string;
}

function YouTubeDebugOverlay() {
  const [errors, setErrors] = useState<YTDebugError[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as YTDebugError;
      setErrors(prev => [detail, ...prev].slice(0, 10)); // Keep last 10
      setIsExpanded(true); // Auto-expand on new error
    };

    window.addEventListener('yt-playback-error', handler);
    return () => window.removeEventListener('yt-playback-error', handler);
  }, []);

  if (errors.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] max-w-md">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-1 ml-auto flex items-center gap-2 px-3 py-1.5 bg-red-900/90 text-red-200 text-xs rounded-lg border border-red-500/50 backdrop-blur-sm hover:bg-red-800/90 transition-colors"
      >
        <span>🐛</span>
        <span>YT Errors ({errors.length})</span>
        <span>{isExpanded ? '▼' : '▲'}</span>
      </button>

      {/* Error list */}
      {isExpanded && (
        <div className="bg-gray-900/95 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-red-900/50 border-b border-red-500/30">
            <span className="text-xs text-red-300 font-semibold">YouTube Playback Debug</span>
            <button
              onClick={() => setErrors([])}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {errors.map((err, i) => (
              <div key={`${err.videoId}-${err.timestamp}-${i}`} className="px-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 bg-red-800 text-red-200 text-[10px] rounded font-mono">
                    {err.errorCode}
                  </span>
                  <span className="px-1.5 py-0.5 bg-yellow-800/50 text-yellow-200 text-[10px] rounded font-mono">
                    {err.debugCategory}
                  </span>
                  <span className="text-[10px] text-gray-500 ml-auto">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-white truncate" title={err.trackName}>
                  {err.trackName}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {err.trackArtist}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500 font-mono">{err.videoId}</span>
                  <a
                    href={err.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-400 hover:text-red-300 underline"
                  >
                    Open ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  
  const isLoopingRef = useRef(false);
  const currentTrackRef = useRef<Track>(track); // Ensures callbacks always see the latest track

  // Keep track ref updated for closures
  useEffect(() => {
    currentTrackRef.current = track;
  }, [track]);

  // 🚨 FIX: Clear error whenever the track changes, not just on platform switch.
  useEffect(() => {
    setError('');
  }, [track.id]);

  // 1. Manage Platform Switching & Initialization
  useEffect(() => {
    const platform = track.platform;
    let isCancelled = false;

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
      if (adaptersMap.current[platform]) {
        console.log(`♻️ Reusing cached adapter for: ${platform}`);
        const existingAdapter = adaptersMap.current[platform];
        if (isCancelled) return;
        setPlayerState(existingAdapter.getState());
        setReadyPlatform(platform);
        return;
      }

      console.log(`🎵 Creating new adapter for: ${platform}`);
      
      setPlayerState(prev => ({ ...prev, canPlay: false, isPlaying: false }));
      
      let newAdapter: IPlayerAdapter;
      switch (platform) {
        case 'spotify': newAdapter = new SpotifyAdapter(); break;
        case 'soundcloud': newAdapter = new SoundCloudAdapter(); break;
        case 'youtube': newAdapter = new YouTubeAdapter(); break;
        default: throw new Error(`Unsupported platform: ${platform}`);
      }

      adaptersMap.current[platform] = newAdapter;

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
        if (isLoopingRef.current) {
          newAdapter.play(currentTrackRef.current);
        } else if (onTrackEnd) {
          onTrackEnd();
        }
      });

      const success = await newAdapter.initialize(token);

      if (isCancelled || activePlatformRef.current !== platform) return;

      if (success) {
        setReadyPlatform(platform);
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
  useEffect(() => { isLoopingRef.current = playerState.isLooping; }, [playerState.isLooping]);
  
  const togglePlay = () => adaptersMap.current[track.platform]?.togglePlay();
  useImperativeHandle(ref, () => ({ togglePlay }));

  useEffect(() => {
    if (onPlayerStateChange) onPlayerStateChange(playerState.isPlaying);
  }, [playerState.isPlaying, onPlayerStateChange]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => adaptersMap.current[track.platform]?.seek(Number(e.target.value));
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => adaptersMap.current[track.platform]?.setVolume(Number(e.target.value));
  const toggleLoop = () => adaptersMap.current[track.platform]?.setLoop(!playerState.isLooping);

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
      <>
        <YouTubeDebugOverlay />
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
          <div className="max-w-6xl mx-auto text-center text-gray-400">
            ⏳ Initializing player...
          </div>
        </div>
      </>
    );
  }

  if (error) {
    const youtubeUrlMatch = error.match(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    const youtubeUrl = youtubeUrlMatch ? youtubeUrlMatch[0] : null;
    const errorMessage = youtubeUrl ? error.split('Open on YouTube:')[0].trim() : error;

    return (
      <>
        <YouTubeDebugOverlay />
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
      </>
    );
  }

  return (
    <>
      <YouTubeDebugOverlay />
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
              <button onClick={toggleLoop} className={`p-2 rounded-full transition-all ${playerState.isLooping ? 'bg-white text-black' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" /></svg>
              </button>
              <button onClick={togglePlay} className={`w-12 h-12 ${getPlatformColor()} rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg`}>
                <span className="text-2xl text-white">{playerState.isPlaying ? '⏸️' : '▶️'}</span>
              </button>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

UnifiedMusicPlayer.displayName = 'UnifiedMusicPlayer';
export default UnifiedMusicPlayer;