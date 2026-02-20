import { IPlayerAdapter, Track, PlayerState } from './IPlayerAdapter';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

// --- SINGLETON STATE ---
// The Spotify SDK throws an "initialization_error" if created multiple times.
// We keep a single global instance alive and route its events to the active adapter.
let globalSpotifyPlayer: any = null;
let globalDeviceId: string = '';
let globalIsPremium: boolean | null = null;
let currentSpotifyAdapter: SpotifyAdapter | null = null;
let globalCurrentToken: string = '';

export class SpotifyAdapter implements IPlayerAdapter {
  private player: any = null;
  private deviceId: string = '';
  private isPremium: boolean | null = null;
  private audioElement: HTMLAudioElement | null = null;
  
  private state: PlayerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isLooping: false,
    isShuffle: false,
    canPlay: false,
  };

  private stateChangeCallback?: (state: PlayerState) => void;
  private trackEndCallback?: () => void;
  private errorCallback?: (error: Error) => void;
  private progressInterval?: NodeJS.Timeout;

  async initialize(token: string): Promise<boolean> {
    globalCurrentToken = token;
    currentSpotifyAdapter = this; // Route global events to this active instance
    
    console.log('🎵 [Spotify] Initializing...');

    return new Promise((resolve) => {
      // 🚨 FIX 1: Check for the Singleton to prevent initialization_error
      if (globalSpotifyPlayer) {
        console.log('🎮 [Spotify] Reusing global player instance...');
        this.player = globalSpotifyPlayer;
        this.deviceId = globalDeviceId;
        this.isPremium = globalIsPremium;
        this.state.canPlay = true;
        
        // If we previously fell back to preview mode, ensure we init it locally
        if (this.isPremium === false) {
           this.initPreviewMode();
        }
        
        resolve(true);
        return;
      }

      if (!window.Spotify) {
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;

        window.onSpotifyWebPlaybackSDKReady = () => {
          console.log('✅ [Spotify] SDK Ready');
          this.initPlayer().then(resolve);
        };

        document.body.appendChild(script);
      } else {
        this.initPlayer().then(resolve);
      }
    });
  }

  private async initPlayer(): Promise<boolean> {
    console.log('🎮 [Spotify] Creating new global Player...');

    const player = new window.Spotify.Player({
      name: 'MultiMusic Web Player',
      getOAuthToken: (cb: (t: string) => void) => cb(globalCurrentToken),
      volume: this.state.volume,
    });

    // Save to the global module scope so it survives component unmounts
    globalSpotifyPlayer = player;
    this.player = player;

    player.addListener('ready', ({ device_id }: any) => {
      console.log('✅ [Spotify] Premium Ready! Device:', device_id);
      globalDeviceId = device_id;
      globalIsPremium = true;
      
      if (currentSpotifyAdapter) {
        currentSpotifyAdapter.deviceId = device_id;
        currentSpotifyAdapter.isPremium = true;
        currentSpotifyAdapter.state.canPlay = true;
        currentSpotifyAdapter.notifyStateChange();
      }
    });

    player.addListener('not_ready', () => {
      console.log('❌ [Spotify] Not ready');
    });

    player.addListener('player_state_changed', (spotifyState: any) => {
      if (!spotifyState || !currentSpotifyAdapter) return;
      currentSpotifyAdapter.handleSpotifyState(spotifyState);
    });

    player.addListener('account_error', (e: any) => {
      console.error('❌ [Spotify] Account error:', e.message);
      globalIsPremium = false;
      if (currentSpotifyAdapter) {
        currentSpotifyAdapter.isPremium = false;
        currentSpotifyAdapter.initPreviewMode();
      }
    });

    player.addListener('authentication_error', (e: any) => {
      console.error('❌ [Spotify] Auth error:', e.message);
      globalIsPremium = false;
      if (currentSpotifyAdapter) {
         currentSpotifyAdapter.isPremium = false;
         currentSpotifyAdapter.notifyError(new Error(`Authentication failed: ${e.message}`));
      }
    });

    player.addListener('initialization_error', (e: any) => {
      console.error('❌ [Spotify] Init error:', e.message);
      globalIsPremium = false;
      if (currentSpotifyAdapter) {
        currentSpotifyAdapter.isPremium = false;
        currentSpotifyAdapter.initPreviewMode();
      }
    });

    const connected = await player.connect();
    console.log(connected ? '✅ [Spotify] Connected' : '❌ [Spotify] Connect failed');
    
    if (!connected) {
      globalIsPremium = false;
      this.isPremium = false;
      this.initPreviewMode();
    }

    return true;
  }

  // Public helper so the global listener can pass state to the current instance
  public handleSpotifyState(spotifyState: any) {
    this.state.isPlaying = !spotifyState.paused;
    this.state.currentTime = spotifyState.position;
    this.state.duration = spotifyState.duration;
    
    if (spotifyState.position === 0 && spotifyState.paused && this.state.duration > 0) {
      this.handleTrackEnd();
    }
    this.notifyStateChange();
  }

  private initPreviewMode() {
    console.log('🎵 [Spotify] Using Preview Mode (Free account)');
    
    if (this.audioElement) {
      this.audioElement.pause();
    }
    
    this.audioElement = new Audio();
    this.audioElement.volume = this.state.volume;
    this.audioElement.loop = this.state.isLooping;

    this.audioElement.addEventListener('timeupdate', () => {
      if (this.audioElement) {
        this.state.currentTime = this.audioElement.currentTime * 1000;
        this.state.duration = this.audioElement.duration * 1000;
        this.notifyStateChange();
      }
    });

    this.audioElement.addEventListener('ended', () => {
      this.handleTrackEnd();
    });

    this.audioElement.addEventListener('error', () => {
      this.notifyError(new Error('Playback error'));
    });

    this.state.canPlay = true;
    this.notifyStateChange();
  }

  async play(track: Track): Promise<void> {
    console.log('🎵 [Spotify] Playing:', track.name);

    if (this.isPremium && this.deviceId) {
      await this.playPremium(track);
    } else if (track.preview_url) {
      this.playPreview(track);
    } else {
      throw new Error('No playback available for this track');
    }
  }

  private async playPremium(track: Track): Promise<void> {
    try {
      // 🚨 FIX 2: Restored the actual official Spotify Web API endpoint
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ uris: [track.uri] }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${globalCurrentToken}`,
          },
        }
      );

      if (res.ok) {
        console.log('✅ [Spotify] Playing Premium');
        this.startProgressTracking();
      } else {
        console.error('❌ [Spotify] Play failed:', res.status);
        if (res.status === 403 || res.status === 404) {
          this.isPremium = false;
          this.initPreviewMode();
          if (track.preview_url) {
             this.playPreview(track);
          } else {
             throw new Error("Premium account required for this track.");
          }
        }
      }
    } catch (e) {
      console.error('❌ [Spotify] Error:', e);
      this.notifyError(e as Error);
      throw e;
    }
  }

  private playPreview(track: Track): void {
    if (!this.audioElement || !track.preview_url) return;

    console.log('🎵 [Spotify] Playing Preview (30s)');
    this.audioElement.src = track.preview_url;
    this.audioElement.play();
    this.state.isPlaying = true;
    this.notifyStateChange();
  }

  async pause(): Promise<void> {
    if (this.isPremium && this.player) {
      await this.player.pause();
    } else if (this.audioElement) {
      this.audioElement.pause();
      this.state.isPlaying = false;
      this.notifyStateChange();
    }
    this.stopProgressTracking();
  }

  async resume(): Promise<void> {
    if (this.isPremium && this.player) {
      await this.player.resume();
      this.startProgressTracking();
    } else if (this.audioElement) {
      await this.audioElement.play();
      this.state.isPlaying = true;
      this.notifyStateChange();
    }
  }

  async togglePlay(): Promise<void> {
    if (this.state.isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  async seek(positionMs: number): Promise<void> {
    console.log('⏩ [Spotify] Seeking to:', positionMs);

    if (this.isPremium && this.player) {
      await this.player.seek(positionMs);
    } else if (this.audioElement) {
      this.audioElement.currentTime = positionMs / 1000;
    }

    this.state.currentTime = positionMs;
    this.notifyStateChange();
  }

  async setVolume(volume: number): Promise<void> {
    this.state.volume = Math.max(0, Math.min(1, volume));

    if (this.isPremium && this.player) {
      await this.player.setVolume(this.state.volume);
    } else if (this.audioElement) {
      this.audioElement.volume = this.state.volume;
    }

    this.notifyStateChange();
  }

  async setLoop(enabled: boolean): Promise<void> {
    this.state.isLooping = enabled;
    console.log('🔁 [Spotify] Loop:', enabled);

    if (this.audioElement) {
      this.audioElement.loop = enabled;
    }

    this.notifyStateChange();
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  cleanup(): void {
    console.log('🧹 [Spotify] Cleaning up local adapter...');
    this.stopProgressTracking();

    if (this.player) {
      this.player.pause(); 
      // 🚨 FIX 3: Do NOT call disconnect(). We leave the global player alive in the background.
      this.player = null; 
    }

    // Unhook global events from this specific adapter
    if (currentSpotifyAdapter === this) {
      currentSpotifyAdapter = null; 
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }

  onStateChange(callback: (state: PlayerState) => void): void {
    this.stateChangeCallback = callback;
  }

  onTrackEnd(callback: () => void): void {
    this.trackEndCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.getState());
    }
  }

  private handleTrackEnd(): void {
    console.log('🏁 [Spotify] Track ended');
    this.state.isPlaying = false;
    this.stopProgressTracking();

    if (this.state.isLooping && this.trackEndCallback) {
      this.trackEndCallback();
    } else if (this.trackEndCallback) {
      this.trackEndCallback();
    }

    this.notifyStateChange();
  }

  private notifyError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    this.progressInterval = setInterval(async () => {
      if (this.isPremium && this.player) {
        const state = await this.player.getCurrentState();
        if (state) {
          this.state.currentTime = state.position;
          this.state.duration = state.duration;
          this.notifyStateChange();
        }
      }
    }, 500); 
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
  }
}