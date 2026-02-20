import { IPlayerAdapter, Track, PlayerState } from './IPlayerAdapter';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

export class SpotifyAdapter implements IPlayerAdapter {
  private player: any = null;
  private deviceId: string = '';
  private token: string = '';
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
    this.token = token;
    console.log('🎵 [Spotify] Initializing...');

    return new Promise((resolve) => {
      // Load Spotify SDK
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
    console.log('🎮 [Spotify] Initializing Player...');

    const player = new window.Spotify.Player({
      name: 'MultiMusic Web Player',
      getOAuthToken: (cb: (t: string) => void) => cb(this.token),
      volume: this.state.volume,
    });

    // Assign early so cleanup can find it if needed
    this.player = player;

    // Premium player ready
    player.addListener('ready', ({ device_id }: any) => {
      console.log('✅ [Spotify] Premium Ready! Device:', device_id);
      this.deviceId = device_id;
      this.isPremium = true;
      this.state.canPlay = true;
      this.notifyStateChange();
    });

    player.addListener('not_ready', () => {
      console.log('❌ [Spotify] Not ready');
    });

    // Track state changes
    player.addListener('player_state_changed', (spotifyState: any) => {
      if (!spotifyState) return;

      this.state.isPlaying = !spotifyState.paused;
      this.state.currentTime = spotifyState.position;
      this.state.duration = spotifyState.duration;
      
      // Check if track ended
      if (spotifyState.position === 0 && spotifyState.paused && this.state.duration > 0) {
        this.handleTrackEnd();
      }

      this.notifyStateChange();
    });

    // Handle Premium requirement errors
    player.addListener('account_error', (e: any) => {
      console.error('❌ [Spotify] Account error:', e.message);
      this.isPremium = false;
      this.initPreviewMode();
    });

    player.addListener('authentication_error', (e: any) => {
      console.error('❌ [Spotify] Auth error:', e.message);
      this.isPremium = false;
      this.notifyError(new Error(`Authentication failed: ${e.message}`));
    });

    player.addListener('initialization_error', (e: any) => {
      console.error('❌ [Spotify] Init error:', e.message);
      this.isPremium = false;
      this.initPreviewMode();
    });

    const connected = await player.connect();
    console.log(connected ? '✅ [Spotify] Connected' : '❌ [Spotify] Connect failed');
    
    if (!connected) {
      this.isPremium = false;
      this.initPreviewMode();
    }

    return true;
  }

  private initPreviewMode() {
    console.log('🎵 [Spotify] Using Preview Mode (Free account)');
    
    if (this.audioElement) {
      this.audioElement.pause();
    }
    
    this.audioElement = new Audio();
    this.audioElement.volume = this.state.volume;
    this.audioElement.loop = this.state.isLooping;

    // Track progress for preview
    this.audioElement.addEventListener('timeupdate', () => {
      if (this.audioElement) {
        this.state.currentTime = this.audioElement.currentTime * 1000;
        this.state.duration = this.audioElement.duration * 1000;
        this.notifyStateChange();
      }
    });

    // Track when preview ends
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
      // 🚨 Corrected to the official Spotify API endpoint
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ uris: [track.uri] }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (res.ok || res.status === 204) {
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
    console.log('🧹 [Spotify] Cleaning up...');
    this.stopProgressTracking();

    if (this.player) {
      this.player.disconnect();
      this.player = null;
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
      // If looping, replay will be handled by the player component
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

  // 🚨 THE SHIELD: Progress tracking wrapped in try/catch to survive SDK streamer crashes
  private startProgressTracking(): void {
    this.stopProgressTracking();
    this.progressInterval = setInterval(async () => {
      if (this.isPremium && this.player) {
        try {
          const state = await this.player.getCurrentState();
          if (state) {
            this.state.currentTime = state.position;
            this.state.duration = state.duration;
            this.notifyStateChange();
          }
        } catch (err) {
          // Swallow the _streamer error silently.
          // The player will catch up automatically when the streamer reconnects.
          console.warn('Spotify SDK internal sync skipped:', err);
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