import { Track } from '@/lib/player-adapters/IPlayerAdapter';

export type LoopMode = 'none' | 'one' | 'all';

export interface QueueState {
  /** Ordered list of tracks in the queue */
  tracks: Track[];
  /** Index of the currently playing track (-1 if nothing playing) */
  currentIndex: number;
  /** Loop mode: none, repeat one, repeat all */
  loopMode: LoopMode;
  /** Label describing the source (e.g. "Search Results", playlist name) */
  sourceLabel: string | null;
}

export interface QueueActions {
  /** Replace the entire queue and start playing from a given index */
  playFromList: (tracks: Track[], startIndex: number, sourceLabel?: string) => void;
  /** Append one or more tracks to the end of the queue */
  addToQueue: (tracks: Track[]) => void;
  /** Insert a track right after the currently playing track */
  playNext: (track: Track) => void;
  /** Remove a track at a specific queue index */
  removeFromQueue: (index: number) => void;
  /** Move a track from one position to another */
  moveTrack: (fromIndex: number, toIndex: number) => void;
  /** Skip to the next track. Returns true if there was a next track. */
  next: () => boolean;
  /** Go back to the previous track. Returns true if there was a previous track. */
  previous: () => boolean;
  /** Jump to a specific index in the queue */
  jumpTo: (index: number) => void;
  /** Cycle through loop modes: none -> all -> one -> none */
  cycleLoopMode: () => void;
  /** Set a specific loop mode */
  setLoopMode: (mode: LoopMode) => void;
  /** Clear the queue entirely */
  clearQueue: () => void;
  /** Get the currently playing track, or null */
  getCurrentTrack: () => Track | null;
}

export type QueueContextType = QueueState & QueueActions;
