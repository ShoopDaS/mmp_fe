'use client';

import { useState, FormEvent } from 'react';
import PlatformSelector, { PlatformState } from './PlatformSelector';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  selectedPlatforms: PlatformState;
  onPlatformsChange: (platforms: PlatformState) => void;
}

export default function SearchBar({
  onSearch,
  isSearching,
  selectedPlatforms,
  onPlatformsChange
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 w-full">
      <div className="relative flex items-center bg-surface border border-white/10 rounded-full p-1.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/50 transition-all duration-300 shadow-lg">
        
        {/* Search Icon */}
        <div className="pl-4 pr-2 text-text-secondary">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        {/* Input Field */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs, artists, or albums..."
          className="flex-1 bg-transparent text-white placeholder-text-secondary/70 focus:outline-none py-3 text-[15px] min-w-0"
          disabled={isSearching}
        />

        {/* Integrated Controls Group */}
        <div className="flex items-center gap-2 pr-1 shrink-0">
          
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            onPlatformsChange={onPlatformsChange}
          />
          
          <div className="w-[1px] h-6 bg-white/10 mx-1 hidden sm:block" />

          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className={`
              relative flex items-center justify-center h-10 px-6 rounded-full font-semibold text-sm transition-all duration-200 overflow-hidden
              ${isSearching || !query.trim() 
                ? 'bg-white/5 text-text-secondary cursor-not-allowed' 
                : 'bg-accent hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] hover:scale-[1.02]'
              }
            `}
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}