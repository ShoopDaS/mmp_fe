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
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs, artists, or albums..."
          className="flex-1 px-6 py-4 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isSearching}
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
        <PlatformSelector
          selectedPlatforms={selectedPlatforms}
          onPlatformsChange={onPlatformsChange}
        />
      </div>
    </form>
  );
}
