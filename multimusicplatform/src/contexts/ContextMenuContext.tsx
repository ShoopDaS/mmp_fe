'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  mode: 'search' | 'library' | 'library-platform';
  track: Track | null;
}

interface ContextMenuContextType {
  state: ContextMenuState;
  openMenu: (event: React.MouseEvent, mode: ContextMenuState['mode'], track: Track) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false, x: 0, y: 0, mode: 'search', track: null,
  });

  const openMenu = useCallback((event: React.MouseEvent, mode: ContextMenuState['mode'], track: Track) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    // Position below-right of button, flip if near viewport edge
    let x = rect.right;
    let y = rect.bottom + 4;
    if (x + 220 > window.innerWidth) x = rect.left - 220;
    if (y + 300 > window.innerHeight) y = rect.top - 300;
    setState({ isOpen: true, x, y, mode, track });
  }, []);

  const closeMenu = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, track: null }));
  }, []);

  // Close on outside click and Escape
  useEffect(() => {
    if (!state.isOpen) return;
    const handleClick = () => closeMenu();
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state.isOpen, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ state, openMenu, closeMenu }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider');
  return ctx;
}
