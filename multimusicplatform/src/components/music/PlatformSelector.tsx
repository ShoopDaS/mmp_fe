'use client';

import { useState, useRef, useEffect } from 'react';

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
  spotify: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  soundcloud: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.255-2.154c-.009-.057-.049-.1-.099-.1zm1.483.061c-.058 0-.102.046-.107.103l-.208 2.041.208 1.995c.005.057.049.103.107.103.059 0 .104-.046.112-.103l.241-1.995-.241-2.041c-.008-.057-.053-.103-.112-.103zm1.51-.083c-.062 0-.108.05-.115.11l-.186 2.123.186 2.03c.007.06.053.11.115.11.061 0 .11-.05.117-.11l.211-2.03-.211-2.123c-.007-.06-.056-.11-.117-.11zm1.51-.098c-.067 0-.118.054-.126.12l-.164 2.201.164 2.075c.008.066.059.12.126.12.066 0 .12-.054.128-.12l.189-2.075-.189-2.201c-.008-.066-.062-.12-.128-.12zm1.52-.12c-.07 0-.127.058-.136.128l-.146 2.321.146 2.118c.009.07.066.128.136.128.07 0 .128-.058.137-.128l.17-2.118-.17-2.321c-.009-.07-.067-.128-.137-.128zm1.53-.12c-.074 0-.133.062-.142.134l-.127 2.44.127 2.14c.009.072.068.135.142.135.075 0 .134-.063.143-.135l.148-2.14-.148-2.44c-.009-.072-.068-.134-.143-.134zm1.526-.127c-.077 0-.139.066-.148.145l-.109 2.566.109 2.142c.009.079.071.146.148.146.078 0 .14-.067.149-.146l.125-2.142-.125-2.566c-.009-.079-.071-.145-.149-.145zm1.522-.144c-.081 0-.145.07-.154.15l-.093 2.71.093 2.133c.009.08.073.15.154.15.082 0 .147-.07.156-.15l.108-2.133-.108-2.71c-.009-.08-.074-.15-.156-.15zm1.538-.155c-.085 0-.152.074-.162.159l-.075 2.865.075 2.122c.01.085.077.159.162.159.085 0 .153-.074.162-.159l.088-2.122-.088-2.865c-.009-.085-.077-.159-.162-.159zm1.536-.16c-.089 0-.158.078-.168.166l-.058 3.025.058 2.11c.01.088.079.166.168.166.089 0 .159-.078.169-.166l.074-2.11-.074-3.025c-.01-.088-.08-.166-.169-.166zm1.547-.178c-.093 0-.165.082-.175.172l-.041 3.203.041 2.098c.01.09.082.172.175.172.093 0 .166-.082.176-.172l.054-2.098-.054-3.203c-.01-.09-.083-.172-.176-.172zm1.538-.185c-.097 0-.169.086-.179.178l-.024 3.388.024 2.094c.01.092.082.178.179.178.096 0 .169-.086.178-.178l.041-2.094-.041-3.388c-.009-.092-.082-.178-.178-.178zm1.543-.189c-.101 0-.173.09-.183.189l-.008 3.577.008 2.092c.01.099.082.189.183.189.101 0 .174-.09.183-.189l.025-2.092-.025-3.577c-.009-.099-.082-.189-.183-.189zm3.296 0c-.104 0-.177.09-.186.189l-.008 3.577.008 2.092c.009.099.082.189.186.189.104 0 .178-.09.187-.189l.025-2.092-.025-3.577c-.009-.099-.083-.189-.187-.189z"/>
    </svg>
  ),
  youtube: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
};

const platformNames = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
};

const platformColors = {
  spotify: 'text-green-500',
  soundcloud: 'text-orange-500',
  youtube: 'text-red-500',
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
        className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <span>Platforms ({selectedCount})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="p-4 space-y-3">
            {(Object.keys(selectedPlatforms) as Platform[]).map((platform) => (
              <label
                key={platform}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-700/50 p-2 rounded-md transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedPlatforms[platform]}
                  onChange={() => handleTogglePlatform(platform)}
                  className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800"
                />
                <div className={`${platformColors[platform]}`}>
                  {platformIcons[platform]}
                </div>
                <span className="text-white font-medium flex-1">
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
