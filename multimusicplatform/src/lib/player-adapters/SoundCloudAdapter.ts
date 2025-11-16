import { IPlayerAdapter, Track, PlayerState } from './IPlayerAdapter';

/**
 * SoundCloud Widget API Adapter
 * Documentation: https://developers.soundcloud.com/docs/api/html5-widget
 */
export class SoundCloudAdapter implements IPlayerAdapter {
  private widget: any = null;
  private token: string = '';
  
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
    console.log('🎵 [SoundCloud] Initializing...');

    return new Promise((resolve) => {
      // Load SoundCloud Widget API
      if (!(window as any).SC) {
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.async = true;
        script.onload = () => {
          console.log('✅ [SoundCloud] SDK Ready');
          this.initWidget().then(resolve);
        };
        document.body.appendChild(script);
      } else {
        this.initWidget().then(resolve);
      }
    });
  }

  private async initWidget(): Promise<boolean> {
    console.log('🎮 [SoundCloud] Initializing Widget...');
    
    // Create iframe widget
    const iframe = document.createElement('iframe');
    iframe.id = 'sc-widget';
    iframe.width = '100%';
    iframe.height = '166';
    iframe.allow = 'autoplay';
    iframe.style.display = 'none'; // Hidden, we'll use custom UI
    document.body.appendChild(iframe);

    const SC = (window as any).SC;
    this.widget = SC.Widget(iframe);

    // Bind events
    this.widget.bind(SC.Widget.Events.READY, () => {
      console.log('✅ [SoundCloud] Widget Ready');
      this.state.canPlay = true;
      this.widget.setVolume(this.state.volume * 100);
      this.notifyStateChange();
    });

    this.widget.bind(SC.Widget.Events.PLAY, () => {
      this.state.isPlaying = true;
      this.notifyStateChange();
    });

    this.widget.bind(SC.Widget.Events.PAUSE, () => {
      this.state.isPlaying = false;
      this.notifyStateChange();
    });

    this.widget.bind(SC.Widget.Events.FINISH, () => {
      this.handleTrackEnd();
    });

    this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
      this.state.currentTime = data.currentPosition;
      this.state.duration = data.soundDuration;
      this.notifyStateChange();
    });

    return true;
  }

  async play(track: Track): Promise<void> {
    console.log('🎵 [SoundCloud] Playing:', track.name);
    
    // Load track by URL
    await this.widget.load(track.uri, {
      auto_play: true,
      show_artwork: false,
    });
  }

  async pause(): Promise<void> {
    await this.widget.pause();
  }

  async resume(): Promise<void> {
    await this.widget.play();
  }

  async togglePlay(): Promise<void> {
    await this.widget.toggle();
  }

  async seek(positionMs: number): Promise<void> {
    console.log('⏩ [SoundCloud] Seeking to:', positionMs);
    await this.widget.seekTo(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    this.state.volume = Math.max(0, Math.min(1, volume));
    await this.widget.setVolume(this.state.volume * 100); // SC uses 0-100
    this.notifyStateChange();
  }

  async setLoop(enabled: boolean): Promise<void> {
    this.state.isLooping = enabled;
    console.log('🔁 [SoundCloud] Loop:', enabled);
    // SoundCloud doesn't have native loop, handle via trackEnd callback
    this.notifyStateChange();
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  cleanup(): void {
    console.log('🧹 [SoundCloud] Cleaning up...');
    if (this.widget) {
      const SC = (window as any).SC;
      if (SC) {
        this.widget.unbind(SC.Widget.Events.READY);
        this.widget.unbind(SC.Widget.Events.PLAY);
        this.widget.unbind(SC.Widget.Events.PAUSE);
        this.widget.unbind(SC.Widget.Events.FINISH);
        this.widget.unbind(SC.Widget.Events.PLAY_PROGRESS);
      }

      const iframe = document.getElementById('sc-widget');
      if (iframe) iframe.remove();

      this.widget = null;
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
    console.log('🏁 [SoundCloud] Track ended');
    this.state.isPlaying = false;

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
}
