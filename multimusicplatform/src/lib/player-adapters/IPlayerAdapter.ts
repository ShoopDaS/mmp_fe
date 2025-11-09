/**
 * Platform-agnostic music player adapter interface
 * All platform implementations (Spotify, SoundCloud, YouTube) must implement this
 */

export interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';
  name: string;
  uri: string; // Platform-specific URI
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  preview_url?: string | null;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number; // Current position in milliseconds
  duration: number; // Total duration in milliseconds
  volume: number; // 0-1
  isLooping: boolean;
  isShuffle: boolean;
  canPlay: boolean; // Whether playback is available (Premium, token valid, etc.)
}

export interface IPlayerAdapter {
  /**
   * Initialize the player
   * @param token - Platform-specific auth token
   * @returns Promise resolving to true if initialization succeeded
   */
  initialize(token: string): Promise<boolean>;

  /**
   * Play a track
   * @param track - Track to play
   */
  play(track: Track): Promise<void>;

  /**
   * Pause playback
   */
  pause(): Promise<void>;

  /**
   * Resume playback
   */
  resume(): Promise<void>;

  /**
   * Toggle play/pause
   */
  togglePlay(): Promise<void>;

  /**
   * Seek to a specific position
   * @param positionMs - Position in milliseconds
   */
  seek(positionMs: number): Promise<void>;

  /**
   * Set volume
   * @param volume - Volume level (0-1)
   */
  setVolume(volume: number): Promise<void>;

  /**
   * Enable/disable loop
   * @param enabled - Whether to loop the current track
   */
  setLoop(enabled: boolean): Promise<void>;

  /**
   * Get current player state
   */
  getState(): PlayerState;

  /**
   * Clean up resources
   */
  cleanup(): void;

  /**
   * Register callback for state changes
   * @param callback - Function to call when state changes
   */
  onStateChange(callback: (state: PlayerState) => void): void;

  /**
   * Register callback for track end
   * @param callback - Function to call when track ends
   */
  onTrackEnd(callback: () => void): void;

  /**
   * Register callback for errors
   * @param callback - Function to call on error
   */
  onError(callback: (error: Error) => void): void;
}
