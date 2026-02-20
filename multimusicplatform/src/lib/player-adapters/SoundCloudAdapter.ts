import { IPlayerAdapter, Track, PlayerState } from './IPlayerAdapter';

export class SoundCloudAdapter implements IPlayerAdapter {
  private widget: any = null;
  private token: string = '';
  private isDestroyed: boolean = false; // 🚨 THE KILL SWITCH
  
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
    this.isDestroyed = false; // Reset on init
    console.log('🎵 [SoundCloud] Initializing...');

    return new Promise((resolve) => {
      if (!(window as any).SC) {
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.async = true;
        
        script.onload = () => {
          // 🚨 GUARD: Did the user switch songs while we were downloading the script?
          if (this.isDestroyed) {
            console.log('🛑 [SoundCloud] Aborting init: Adapter destroyed during script load.');
            return resolve(false);
          }
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
    // 🚨 GUARD: Double check before building the iframe
    if (this.isDestroyed) return false;

    console.log('🎮 [SoundCloud] Initializing Widget...');

    // Purge any existing iframe forcefully
    const existingIframe = document.getElementById('sc-widget') as HTMLIFrameElement;
    if (existingIframe) {
      existingIframe.src = '';
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'sc-widget';
    iframe.width = '100%';
    iframe.height = '166';
    iframe.allow = 'autoplay';
    iframe.style.display = 'none'; 
    iframe.src = 'https://w.soundcloud.com/player/?url=';
    document.body.appendChild(iframe);

    const SC = (window as any).SC;
    this.widget = SC.Widget(iframe);

    this.widget.bind(SC.Widget.Events.READY, () => {
      if (this.isDestroyed) return; // 🚨 GUARD
      console.log('✅ [SoundCloud] Widget Ready');
      this.state.canPlay = true;
      this.widget.setVolume(this.state.volume * 100);
      this.notifyStateChange();
    });

    this.widget.bind(SC.Widget.Events.PLAY, () => {
      if (this.isDestroyed) return;
      this.state.isPlaying = true;
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
      this.state.duration = data.soundDuration;
      this.notifyStateChange();
    });

    return true;
  }

  async play(track: Track): Promise<void> {
    if (this.isDestroyed || !this.widget) return;
    console.log('🎵 [SoundCloud] Playing:', track.name);
    
    await this.widget.load(track.uri, {
      auto_play: true,
      show_artwork: false,
    });
  }

  async pause(): Promise<void> {
    if(this.widget && !this.isDestroyed) await this.widget.pause();
  }

  async resume(): Promise<void> {
    if(this.widget && !this.isDestroyed) await this.widget.play();
  }

  async togglePlay(): Promise<void> {
    if(this.widget && !this.isDestroyed) await this.widget.toggle();
  }

  async seek(positionMs: number): Promise<void> {
    if(this.widget && !this.isDestroyed) {
      console.log('⏩ [SoundCloud] Seeking to:', positionMs);
      await this.widget.seekTo(positionMs);
    }
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
    console.log('🔁 [SoundCloud] Loop:', enabled);
    this.notifyStateChange();
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  cleanup(): void {
    console.log('🧹 [SoundCloud] Cleaning up...');
    
    // 🚨 1. Trigger the Kill Switch immediately so pending callbacks abort
    this.isDestroyed = true; 

    // 2. Unbind widget events if it was created
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

    // 🚨 3. The Audio Guillotine: Hunt down the iframe regardless of widget state
    const iframe = document.getElementById('sc-widget') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = ''; // Force the browser to instantly sever the audio stream
      iframe.remove(); // Destroy the element
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
    if (!this.isDestroyed && this.stateChangeCallback) {
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
    if (!this.isDestroyed && this.errorCallback) {
      this.errorCallback(error);
    }
  }
}