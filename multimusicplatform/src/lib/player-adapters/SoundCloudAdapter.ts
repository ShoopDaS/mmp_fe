import { IPlayerAdapter, Track, PlayerState } from './IPlayerAdapter';

export class SoundCloudAdapter implements IPlayerAdapter {
  private widget: any = null;
  private token: string = '';
  private isDestroyed: boolean = false;
  private volumeBeforeSuspend: number | null = null;
  
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
    this.isDestroyed = false;

    return new Promise((resolve) => {
      if (!(window as any).SC) {
        // Only inject the script tag once (survives React re-mounts)
        if (!document.querySelector('script[src="https://w.soundcloud.com/player/api.js"]')) {
          const script = document.createElement('script');
          script.src = 'https://w.soundcloud.com/player/api.js';
          script.async = true;

          script.onload = () => {
            if (this.isDestroyed) return resolve(false);
            this.initWidget().then(resolve);
          };
          script.onerror = () => {
            console.error('❌ [SoundCloud] Failed to load SDK script');
            resolve(false);
          };

          document.body.appendChild(script);
        } else {
          // Script tag exists but hasn't loaded yet — poll for it
          const waitForSC = setInterval(() => {
            if ((window as any).SC) {
              clearInterval(waitForSC);
              if (this.isDestroyed) return resolve(false);
              this.initWidget().then(resolve);
            }
          }, 100);
          // Give up after 10s
          setTimeout(() => { clearInterval(waitForSC); resolve(false); }, 10000);
        }
      } else {
        this.initWidget().then(resolve);
      }
    });
  }

  private async initWidget(): Promise<boolean> {
    if (this.isDestroyed) return false;

    // Reuse the existing widget if it's still alive
    if (this.widget && this.state.canPlay) {
      return true;
    }

    const existingIframe = document.getElementById('sc-widget') as HTMLIFrameElement;
    if (existingIframe) {
      existingIframe.src = '';
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'sc-widget';
    // 🚨 FIXED: Prevent browser background throttling by keeping it rendered but off-screen
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.allow = 'autoplay';
    iframe.src = 'https://w.soundcloud.com/player/?url=';
    document.body.appendChild(iframe);

    const SC = (window as any).SC;
    this.widget = SC.Widget(iframe);

    return new Promise<boolean>((resolve) => {
      const onReady = () => {
        if (this.isDestroyed) { resolve(false); return; }
        this.state.canPlay = true;
        this.widget.setVolume(this.state.volume * 100);
        this.notifyStateChange();
        resolve(true);
      };

      this.widget.bind(SC.Widget.Events.READY, onReady);

      setTimeout(() => {
        if (!this.state.canPlay && !this.isDestroyed) {
          this.state.canPlay = true;
          this.notifyStateChange();
          resolve(true);
        }
      }, 5000);
    }).then((ready) => {
      if (!ready || this.isDestroyed) return false;
      const SC = (window as any).SC;

      this.widget.bind(SC.Widget.Events.PLAY, () => {
        if (this.isDestroyed) return;
        this.state.isPlaying = true;
        this.fetchDuration();
        this.notifyStateChange();
      });

      this.widget.bind(SC.Widget.Events.PAUSE, () => {
        if (this.isDestroyed) return;
        this.state.isPlaying = false;
        this.notifyStateChange();
      });

      this.widget.bind(SC.Widget.Events.FINISH, () => {
        if (this.isDestroyed) return;
        this.handleTrackEnd();
      });

      this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
        if (this.isDestroyed) return;
        this.state.currentTime = data.currentPosition;
        if (!this.state.duration || this.state.duration === 0) this.fetchDuration();
        this.notifyStateChange();
      });

      return true;
    });
  }

  private fetchDuration(): void {
    if (this.isDestroyed || !this.widget) return;
    this.widget.getDuration((duration: number) => {
      if (!this.isDestroyed && duration && duration > 0) {
        this.state.duration = duration;
        this.notifyStateChange();
      }
    });
  }

  async play(track: Track): Promise<void> {
    if (this.isDestroyed || !this.widget) return;
    this.state.duration = 0;
    this.state.currentTime = 0;
    await this.widget.load(track.uri, { auto_play: true, show_artwork: false });
  }

  async pause(): Promise<void> { if(this.widget && !this.isDestroyed) await this.widget.pause(); }
  async resume(): Promise<void> { if(this.widget && !this.isDestroyed) await this.widget.play(); }
  async togglePlay(): Promise<void> { if(this.widget && !this.isDestroyed) await this.widget.toggle(); }

  async seek(positionMs: number): Promise<void> {
    if(this.widget && !this.isDestroyed) await this.widget.seekTo(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    if (this.isDestroyed) return;
    this.state.volume = Math.max(0, Math.min(1, volume));
    if(this.widget) await this.widget.setVolume(this.state.volume * 100);
    this.notifyStateChange();
  }

  async setLoop(enabled: boolean): Promise<void> {
    if (this.isDestroyed) return;
    this.state.isLooping = enabled;
    this.notifyStateChange();
  }

  getState(): PlayerState { return { ...this.state }; }

  async suspend(): Promise<void> {
    await this.pause();
    if (this.widget && !this.isDestroyed) {
      this.volumeBeforeSuspend = this.state.volume;
      this.widget.setVolume(0);
    }
  }

  async restore(): Promise<boolean> {
    if (this.volumeBeforeSuspend !== null && this.widget && !this.isDestroyed) {
      this.widget.setVolume(this.volumeBeforeSuspend * 100);
      this.volumeBeforeSuspend = null;
    }
    return true;
  }

  cleanup(): void {
    this.isDestroyed = true; 
    if (this.widget) {
      const SC = (window as any).SC;
      if (SC) {
        this.widget.unbind(SC.Widget.Events.READY);
        this.widget.unbind(SC.Widget.Events.PLAY);
        this.widget.unbind(SC.Widget.Events.PAUSE);
        this.widget.unbind(SC.Widget.Events.FINISH);
        this.widget.unbind(SC.Widget.Events.PLAY_PROGRESS);
      }
      this.widget = null;
    }

    const iframe = document.getElementById('sc-widget') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = '';
      iframe.remove();
    }
  }

  onStateChange(callback: (state: PlayerState) => void): void { this.stateChangeCallback = callback; }
  onTrackEnd(callback: () => void): void { this.trackEndCallback = callback; }
  onError(callback: (error: Error) => void): void { this.errorCallback = callback; }

  private notifyStateChange(): void {
    if (!this.isDestroyed && this.stateChangeCallback) this.stateChangeCallback(this.getState());
  }

  private handleTrackEnd(): void {
    this.state.isPlaying = false;
    if (this.trackEndCallback) this.trackEndCallback();
    this.notifyStateChange();
  }

  private notifyError(error: Error): void {
    if (!this.isDestroyed && this.errorCallback) this.errorCallback(error);
  }
}