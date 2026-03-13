'use client';

import { useState, useRef, useEffect } from 'react';
import { SpotifyIcon, SoundCloudIcon, YouTubeIcon } from '@/components/icons/BrandIcons';

export type Platform = 'spotify' | 'soundcloud' | 'youtube';

export interface PlatformState {
  spotify: boolean;
  soundcloud: boolean;
  youtube: boolean;
}

interface PlatformSelectorProps {
  selectedPlatforms: PlatformState;
  onPlatformsChange: (platforms: PlatformState) => void;
}

const platformIcons = {
  spotify: <SpotifyIcon className="w-4 h-4" />,
  soundcloud: <SoundCloudIcon className="w-4 h-4" />,
  youtube: <YouTubeIcon className="w-4 h-4" />,
};

const platformNames = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
};

const platformColors = {
  spotify: 'text-spotify drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]',
  soundcloud: 'text-soundcloud drop-shadow-[0_0_8px_rgba(255,85,0,0.4)]',
  youtube: 'text-youtube drop-shadow-[0_0_8px_rgba(255,0,0,0.4)]',
};

export default function PlatformSelector({
  selectedPlatforms,
  onPlatformsChange,
}: PlatformSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTogglePlatform = (platform: Platform) => {
    onPlatformsChange({
      ...selectedPlatforms,
      [platform]: !selectedPlatforms[platform],
    });
  };

  const selectedCount = Object.values(selectedPlatforms).filter(Boolean).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
          ${isOpen 
            ? 'bg-white/10 border-white/20 text-white' 
            : 'bg-white/5 border-white/5 text-text-secondary hover:text-white hover:bg-white/10 hover:border-white/10'
          }
        `}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        <span>Platforms ({selectedCount})</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 opacity-70 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-56 bg-surface-hover border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-fade-in-up">
          <div className="px-3 py-2 text-[10px] text-text-secondary uppercase tracking-wider font-bold border-b border-white/5 mb-1">
            Search Across
          </div>
          <div className="flex flex-col px-1.5 pb-1">
            {(Object.keys(selectedPlatforms) as Platform[]).map((platform) => (
              <label
                key={platform}
                className="flex items-center gap-3 cursor-pointer hover:bg-white/5 px-2.5 py-2.5 rounded-lg transition-colors group"
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms[platform]}
                    onChange={() => handleTogglePlatform(platform)}
                    className="peer appearance-none w-4 h-4 rounded border border-white/20 bg-black/20 checked:bg-accent checked:border-accent transition-all cursor-pointer"
                  />
                  <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className={`${platformColors[platform]} shrink-0 transition-transform group-hover:scale-110`}>
                  {platformIcons[platform]}
                </div>
                <span className={`text-[13px] font-medium flex-1 transition-colors ${selectedPlatforms[platform] ? 'text-white' : 'text-text-secondary group-hover:text-white'}`}>
                  {platformNames[platform]}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}