import { IPlayerAdapter, Track, PlayerState } from './IPlayerAdapter';

/**
 * YouTube IFrame Player API Adapter
 * Documentation: https://developers.google.com/youtube/iframe_api_reference
 */
export class YouTubeAdapter implements IPlayerAdapter {
  private player: any = null;
  private token: string = '';
  private currentTrack: Track | null = null;
  private progressInterval: NodeJS.Timeout | null = null;

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

  async initialize(token: string): Promise<boolean> {
    this.token = token;
    console.log('🎵 [YouTube] Initializing...');

    return new Promise((resolve) => {
      // Load YouTube IFrame API
      if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        // YouTube API calls this when ready
        (window as any).onYouTubeIframeAPIReady = () => {
          console.log('✅ [YouTube] API Ready');
          this.initPlayer().then(resolve);
        };
      } else {
        this.initPlayer().then(resolve);
      }
    });
  }

  private async initPlayer(): Promise<boolean> {
    console.log('🎮 [YouTube] Initializing Player...');

    // Create container for player
    const container = document.createElement('div');
    container.id = 'yt-player';
    container.style.display = 'none'; // Hidden, we'll use custom UI
    document.body.appendChild(container);

    return new Promise((resolve) => {
      const YT = (window as any).YT;

      this.player = new YT.Player('yt-player', {
        height: '360',
        width: '640',
        playerVars: {
          autoplay: 0,
          controls: 0, // Hide default controls
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            console.log('✅ [YouTube] Player Ready');
            this.state.canPlay = true;
            this.player.setVolume(this.state.volume * 100);
            this.notifyStateChange();
            resolve(true);
          },
          onStateChange: (event: any) => {
            this.handleStateChange(event.data);
          },
          onError: (event: any) => {
            this.handleError(event.data);
          },
        },
      });
    });
  }

  private handleStateChange(state: number): void {
    const YT = (window as any).YT;

    switch (state) {
      case YT.PlayerState.PLAYING:
        console.log('▶️ [YouTube] Playing');
        this.state.isPlaying = true;
        this.startProgressTracking();
        break;
      case YT.PlayerState.PAUSED:
        console.log('⏸️ [YouTube] Paused');
        this.state.isPlaying = false;
        this.stopProgressTracking();
        break;
      case YT.PlayerState.ENDED:
        console.log('🏁 [YouTube] Ended');
        this.state.isPlaying = false;
        this.stopProgressTracking();
        this.handleTrackEnd();
        break;
      case YT.PlayerState.BUFFERING:
        console.log('⏳ [YouTube] Buffering');
        break;
    }

    this.notifyStateChange();
  }

  private handleError(errorCode: number): void {
    let message = 'Unknown YouTube error';

    switch (errorCode) {
      case 2:
        message = 'Invalid video ID';
        break;
      case 5:
        message = 'HTML5 player error';
        break;
      case 100:
        message = 'Video not found or private';
        break;
      case 101:
      case 150:
        message = 'Video cannot be played in embedded player';
        break;
    }

    console.error('❌ [YouTube] Error:', message, errorCode);
    this.notifyError(new Error(message));
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();

    this.progressInterval = setInterval(() => {
      if (this.player && this.state.isPlaying) {
        const currentTime = this.player.getCurrentTime() * 1000; // Convert to ms
        const duration = this.player.getDuration() * 1000; // Convert to ms

        this.state.currentTime = currentTime;
        this.state.duration = duration;
        this.notifyStateChange();
      }
    }, 500); // Update every 500ms
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  async play(track: Track): Promise<void> {
    console.log('🎵 [YouTube] Playing:', track.name);
    this.currentTrack = track;

    // Extract video ID from URI
    // URI could be: video ID directly, or full URL
    const videoId = this.extractVideoId(track.uri);

    if (!videoId) {
      throw new Error('Invalid YouTube video ID');
    }

    // Load and play video
    await this.player.loadVideoById(videoId);
    this.state.currentTime = 0;
    this.notifyStateChange();
  }

  private extractVideoId(uri: string): string {
    // If it's already just an ID
    if (uri.length === 11 && !uri.includes('/') && !uri.includes('?')) {
      return uri;
    }

    // Extract from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = uri.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return uri; // Return as-is if no pattern matches
  }

  async pause(): Promise<void> {
    await this.player.pauseVideo();
  }

  async resume(): Promise<void> {
    await this.player.playVideo();
  }

  async togglePlay(): Promise<void> {
    if (this.state.isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  async seek(positionMs: number): Promise<void> {
    console.log('⏩ [YouTube] Seeking to:', positionMs);
    const positionSeconds = positionMs / 1000;
    await this.player.seekTo(positionSeconds, true);
    this.state.currentTime = positionMs;
    this.notifyStateChange();
  }

  async setVolume(volume: number): Promise<void> {
    this.state.volume = Math.max(0, Math.min(1, volume));
    await this.player.setVolume(this.state.volume * 100); // YouTube uses 0-100
    this.notifyStateChange();
  }

  async setLoop(enabled: boolean): Promise<void> {
    this.state.isLooping = enabled;
    console.log('🔁 [YouTube] Loop:', enabled);
    // YouTube has native loop, but we'll handle via trackEnd callback for consistency
    this.notifyStateChange();
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  cleanup(): void {
    console.log('🧹 [YouTube] Cleaning up...');

    this.stopProgressTracking();

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    const container = document.getElementById('yt-player');
    if (container) {
      container.remove();
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
    console.log('🏁 [YouTube] Track ended');

    if (this.state.isLooping && this.currentTrack) {
      // Replay the same track
      this.play(this.currentTrack);
    } else if (this.trackEndCallback) {
      // Move to next track
      this.trackEndCallback();
    }
  }

  private notifyError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}
