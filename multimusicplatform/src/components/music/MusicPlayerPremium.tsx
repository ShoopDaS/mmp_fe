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
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    console.log('🎵 Loading Spotify SDK...');
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('✅ SDK Ready');
      initPlayer();
    };

    document.body.appendChild(script);
  }, []);

  const initPlayer = () => {
    console.log('🎮 Init Player with token:', spotifyToken?.substring(0, 20) + '...');

    const sp = new window.Spotify.Player({
      name: 'MultiMusic Web Player',
      getOAuthToken: (cb: (t: string) => void) => cb(spotifyToken),
      volume: 0.8
    });

    sp.addListener('ready', ({ device_id }: any) => {
      console.log('✅ Ready! Device:', device_id);
      setDeviceId(device_id);
      setIsPremium(true);
    });

    sp.addListener('not_ready', () => console.log('❌ Not ready'));
    sp.addListener('player_state_changed', (state: any) => {
      if (state) setIsPlaying(!state.paused);
    });

    sp.addListener('account_error', (e: any) => {
      console.error('❌ Account error:', e.message);
      setIsPremium(false);
      setError('Premium required');
    });

    sp.addListener('authentication_error', (e: any) => {
      console.error('❌ Auth error:', e.message);
      setIsPremium(false);
    });

    sp.addListener('initialization_error', (e: any) => {
      console.error('❌ Init error:', e.message);
      setIsPremium(false);
    });

    sp.connect().then((ok: boolean) => {
      console.log(ok ? '✅ Connected' : '❌ Connect failed');
      if (!ok) setIsPremium(false);
    });

    setPlayer(sp);
  };

  useEffect(() => {
    if (!deviceId || !track || isPremium === false) return;

    console.log('🎵 Play:', track.name, 'on device:', deviceId);
    playTrack(track.uri);
  }, [track, deviceId, isPremium]);

  useEffect(() => {
    if (isPremium !== false || !track.preview_url || !audioRef.current) return;

    console.log('🎵 Preview:', track.name);
    audioRef.current.src = track.preview_url;
    audioRef.current.play();
    setIsPlaying(true);
  }, [track, isPremium]);

  const playTrack = async (uri: string) => {
    try {
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [uri] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${spotifyToken}`
        },
      });

      if (res.ok) {
        console.log('✅ Playing');
      } else {
        console.error('❌ Play failed:', res.status);
        if (res.status === 403) setIsPremium(false);
      }
    } catch (e) {
      console.error('❌ Error:', e);
    }
  };

  const toggle = () => {
    if (isPremium && player) {
      player.togglePlay();
    } else if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  if (isPremium === false && !track.preview_url) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="max-w-6xl mx-auto text-center text-gray-400">
          ⚠️ No playback available
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
      {isPremium === false && <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />}
      
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <img
          src={track.album.images[0]?.url}
          alt={track.album.name}
          className="w-16 h-16 rounded"
        />

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{track.name}</h3>
          <p className="text-sm text-gray-300 truncate">
            {track.artists.map(a => a.name).join(', ')}
          </p>
          <p className={`text-xs ${isPremium ? 'text-green-400' : 'text-yellow-400'}`}>
            {isPremium === null && 'Loading...'}
            {isPremium === true && '🎵 Premium'}
            {isPremium === false && '⏱️ 30s Preview'}
          </p>
        </div>

        <button
          onClick={toggle}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
        >
          <span className="text-2xl">{isPlaying ? '⏸️' : '▶️'}</span>
        </button>

        <button
          onClick={() => console.log('Debug:', { isPremium, deviceId, hasPlayer: !!player, uri: track.uri })}
          className="px-3 py-1 bg-gray-700 text-white text-xs rounded"
        >
          Debug
        </button>
      </div>
    </div>
  );
}
