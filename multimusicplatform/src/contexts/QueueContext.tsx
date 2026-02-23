'use client';

import { createContext, useCallback, useMemo, useState, ReactNode } from 'react';
import { Track } from '@/lib/player-adapters/IPlayerAdapter';
import { LoopMode, QueueContextType, QueueState } from '@/types/queue';

const initialState: QueueState = {
  tracks: [],
  currentIndex: -1,
  loopMode: 'none',
  sourceLabel: null,
};

export const QueueContext = createContext<QueueContextType | null>(null);

export function QueueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QueueState>(initialState);

  const playFromList = useCallback(
    (tracks: Track[], startIndex: number, sourceLabel?: string) => {
      setState({
        tracks,
        currentIndex: Math.min(startIndex, tracks.length - 1),
        loopMode: state.loopMode, // preserve current loop preference
        sourceLabel: sourceLabel ?? null,
      });
    },
    [state.loopMode],
  );

  const addToQueue = useCallback((newTracks: Track[]) => {
    setState((prev) => ({
      ...prev,
      tracks: [...prev.tracks, ...newTracks],
      // If nothing was playing, start from the first added track
      currentIndex: prev.currentIndex === -1 ? prev.tracks.length : prev.currentIndex,
    }));
  }, []);

  const playNext = useCallback((track: Track) => {
    setState((prev) => {
      if (prev.currentIndex === -1 || prev.tracks.length === 0) {
        // Nothing playing — just start playing this track
        return { ...prev, tracks: [track], currentIndex: 0 };
      }
      const insertAt = prev.currentIndex + 1;
      const newTracks = [...prev.tracks];
      newTracks.splice(insertAt, 0, track);
      return { ...prev, tracks: newTracks };
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.tracks.length) return prev;

      const newTracks = prev.tracks.filter((_, i) => i !== index);
      let newIndex = prev.currentIndex;

      if (newTracks.length === 0) {
        newIndex = -1;
      } else if (index < prev.currentIndex) {
        newIndex = prev.currentIndex - 1;
      } else if (index === prev.currentIndex) {
        // Removing the currently playing track — stay at same index (plays next song)
        // but clamp if we removed the last item
        newIndex = Math.min(prev.currentIndex, newTracks.length - 1);
      }

      return { ...prev, tracks: newTracks, currentIndex: newIndex };
    });
  }, []);

  const moveTrack = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.tracks.length ||
        toIndex < 0 ||
        toIndex >= prev.tracks.length ||
        fromIndex === toIndex
      )
        return prev;

      const newTracks = [...prev.tracks];
      const [moved] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, moved);

      // Recalculate currentIndex to follow the currently playing track
      let newIndex = prev.currentIndex;
      if (prev.currentIndex === fromIndex) {
        newIndex = toIndex;
      } else {
        if (fromIndex < prev.currentIndex && toIndex >= prev.currentIndex) {
          newIndex = prev.currentIndex - 1;
        } else if (fromIndex > prev.currentIndex && toIndex <= prev.currentIndex) {
          newIndex = prev.currentIndex + 1;
        }
      }

      return { ...prev, tracks: newTracks, currentIndex: newIndex };
    });
  }, []);

  const next = useCallback((): boolean => {
    let advanced = false;
    setState((prev) => {
      if (prev.tracks.length === 0 || prev.currentIndex === -1) return prev;

      if (prev.loopMode === 'one') {
        // "repeat one" stays on the same track — the player will restart it
        return prev;
      }

      const nextIndex = prev.currentIndex + 1;

      if (nextIndex < prev.tracks.length) {
        advanced = true;
        return { ...prev, currentIndex: nextIndex };
      }

      if (prev.loopMode === 'all') {
        advanced = true;
        return { ...prev, currentIndex: 0 };
      }

      // No loop, end of queue — stop
      return prev;
    });
    return advanced;
  }, []);

  const previous = useCallback((): boolean => {
    let moved = false;
    setState((prev) => {
      if (prev.tracks.length === 0 || prev.currentIndex === -1) return prev;

      if (prev.currentIndex > 0) {
        moved = true;
        return { ...prev, currentIndex: prev.currentIndex - 1 };
      }

      if (prev.loopMode === 'all') {
        moved = true;
        return { ...prev, currentIndex: prev.tracks.length - 1 };
      }

      return prev;
    });
    return moved;
  }, []);

  const jumpTo = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.tracks.length) return prev;
      return { ...prev, currentIndex: index };
    });
  }, []);

  const cycleLoopMode = useCallback(() => {
    setState((prev) => {
      const order: LoopMode[] = ['none', 'all', 'one'];
      const currentIdx = order.indexOf(prev.loopMode);
      const nextMode = order[(currentIdx + 1) % order.length];
      return { ...prev, loopMode: nextMode };
    });
  }, []);

  const setLoopMode = useCallback((mode: LoopMode) => {
    setState((prev) => ({ ...prev, loopMode: mode }));
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => ({ ...prev, tracks: [], currentIndex: -1, sourceLabel: null }));
  }, []);

  const getCurrentTrack = useCallback((): Track | null => {
    if (state.currentIndex === -1 || state.currentIndex >= state.tracks.length) return null;
    return state.tracks[state.currentIndex];
  }, [state.currentIndex, state.tracks]);

  const value = useMemo<QueueContextType>(
    () => ({
      ...state,
      playFromList,
      addToQueue,
      playNext,
      removeFromQueue,
      moveTrack,
      next,
      previous,
      jumpTo,
      cycleLoopMode,
      setLoopMode,
      clearQueue,
      getCurrentTrack,
    }),
    [
      state,
      playFromList,
      addToQueue,
      playNext,
      removeFromQueue,
      moveTrack,
      next,
      previous,
      jumpTo,
      cycleLoopMode,
      setLoopMode,
      clearQueue,
      getCurrentTrack,
    ],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
