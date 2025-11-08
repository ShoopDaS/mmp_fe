'use client';

import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url: string | null;
}

interface MusicPlayerProps {
  track: Track;
  spotifyToken: string;
}

// Extend Window interface for Spotify SDK
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

export default function MusicPlayer({ track, spotifyToken }: MusicPlayerProps) {
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [usePreview, setUsePreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load Spotify Web Playback SDK
  useEffect(() => {
    // Check if already loaded
    if (window.Spotify) {
      setIsSDKReady(true);
      return;
    }

    // Load SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      setIsSDKReady(true);
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize Spotify Player
  useEffect(() => {
    if (!isSDKReady || !spotifyToken) return;

    const spotifyPlayer = new window.Spotify.Player({
      name: 'MultiMusic Web Player',
      getOAuthToken: (cb: (token: string) => void) => {
        cb(spotifyToken);
      },
      volume: 0.8
    });

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('Spotify Player Ready with Device ID', device_id);
      setDeviceId(device_id);
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device ID has gone offline', device_id);
    });

    // Player state changed
    spotifyPlayer.addListener('player_state_changed', (state: any) => {
      if (!state) return;
      setIsPlaying(!state.paused);
    });

    // Errors
    spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Initialization Error:', message);
      setUsePreview(true); // Fall back to preview
    });

    spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Authentication Error:', message);
      setUsePreview(true);
    });

    spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Account Error:', message);
      setUsePreview(true); // Premium required
    });

    spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Playback Error:', message);
    });

    // Connect to the player
    spotifyPlayer.connect();

    setPlayer(spotifyPlayer);

    return () => {
      spotifyPlayer.disconnect();
    };
  }, [isSDKReady, spotifyToken]);

  // Play track when device is ready and track changes
  useEffect(() => {
    if (!deviceId || !track || usePreview) return;

    playTrackOnDevice(track.uri, deviceId, spotifyToken);
  }, [track, deviceId, spotifyToken, usePreview]);

  // Preview fallback
  useEffect(() => {
    if (!usePreview || !track.preview_url) return;

    if (audioRef.current) {
      audioRef.current.src = track.preview_url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [track, usePreview]);

  const playTrackOnDevice = async (trackUri: string, deviceId: string, token: string) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        console.error('Failed to play track:', response.status);
        if (response.status === 403) {
          // Premium required
          console.log('Premium required, falling back to preview');
          setUsePreview(true);
        }
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const togglePlay = () => {
    if (usePreview && audioRef.current) {
      // Preview playback
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (player) {
      // Full playback
      player.togglePlay();
    }
  };

  // Show loading while SDK initializes
  if (!isSDKReady && !usePreview) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 text-center text-gray-400">
            Loading Spotify Player...
          </div>
        </div>
      </div>
    );
  }

  // Show message if no preview and SDK failed
  if (usePreview && !track.preview_url) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 text-center text-gray-400">
            ⚠️ Playback not available for this track
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
      {usePreview && <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />}
      
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        {/* Album art */}
        <img
          src={track.album.images[0]?.url || ''}
          alt={track.album.name}
          className="w-16 h-16 rounded"
        />

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{track.name}</h3>
          <p className="text-sm text-gray-300 truncate">
            {track.artists.map(a => a.name).join(', ')}
          </p>
          {usePreview && (
            <p className="text-xs text-yellow-400">30s Preview (Premium required for full playback)</p>
          )}
          {!usePreview && deviceId && (
            <p className="text-xs text-green-400">Premium Playback Active</p>
          )}
        </div>

        {/* Controls */}
        <button
          onClick={togglePlay}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
        >
          <span className="text-2xl">{isPlaying ? '⏸️' : '▶️'}</span>
        </button>
      </div>
    </div>
  );
}
