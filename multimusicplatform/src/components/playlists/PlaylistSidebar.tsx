'use client';

import { useState, useCallback } from 'react';
import { UnifiedPlaylist, CustomPlaylist } from '@/types/playlist';
import { apiClient } from '@/lib/api';
import PlatformPlaylistSection from './PlatformPlaylistSection';
import CustomPlaylistSection from './CustomPlaylistSection';
import CreatePlaylistModal from './CreatePlaylistModal';
import {
  fetchSpotifyPlaylistTracks,
  fetchYouTubePlaylistTracks,
  fetchSoundCloudPlaylistTracks,
} from '@/lib/platformHelpers';

interface PlaylistSidebarProps {
  spotifyToken: string | null;
  youtubeToken: string | null;
  soundcloudToken: string | null;
  activePlaylistId: string | null;
  onPlaylistSelect: (playlist: UnifiedPlaylist) => void;
  onPlaylistRefresh: (playlist: UnifiedPlaylist) => void;
  /** Expose custom playlists so parent (search page / queue) can read them */
  customPlaylists: CustomPlaylist[];
  onCustomPlaylistsChange: (playlists: CustomPlaylist[]) => void;
  /** Maps custom playlistId -> Set of trackIds (for import deduplication) */
  playlistTrackIds: Record<string, Set<string>>;
  /** Called after an import completes */
  onImportComplete: (playlistId: string, importedTrackIds: string[]) => void;
}

export default function PlaylistSidebar({
  spotifyToken,
  youtubeToken,
  soundcloudToken,
  activePlaylistId,
  onPlaylistSelect,
  onPlaylistRefresh,
  customPlaylists,
  onCustomPlaylistsChange,
  playlistTrackIds,
  onImportComplete,
}: PlaylistSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Determine which platforms are connected (have tokens)
  const connectedPlatforms: Array<'spotify' | 'youtube' | 'soundcloud'> = [];
  if (spotifyToken) connectedPlatforms.push('spotify');
  if (youtubeToken) connectedPlatforms.push('youtube');
  if (soundcloudToken) connectedPlatforms.push('soundcloud');

  const getToken = (platform: 'spotify' | 'youtube' | 'soundcloud') => {
    switch (platform) {
      case 'spotify': return spotifyToken;
      case 'youtube': return youtubeToken;
      case 'soundcloud': return soundcloudToken;
    }
  };

  const handleCreatePlaylist = useCallback(async (name: string, description: string, coverImage: string) => {
    const response = await apiClient.createCustomPlaylist(name, description, coverImage);
    if (response.error) {
      throw new Error(response.error);
    }
    // Re-fetch the full list so we always get server-authoritative, correctly-shaped data
    const listResponse = await apiClient.getCustomPlaylists();
    if (!listResponse.error && listResponse.data?.playlists) {
      onCustomPlaylistsChange(listResponse.data.playlists);
    }
  }, [onCustomPlaylistsChange]);

  /**
   * Called when the user picks a source (platform) playlist and a target (custom) playlist.
   * Fetches tracks, skips duplicates, adds each track, then notifies the parent.
   */
  const handleImportToPlaylist = useCallback(async (
    sourcePlaylist: UnifiedPlaylist,
    targetPlaylistId: string
  ) => {
    // Fetch all tracks from the source platform playlist
    let tracks: Awaited<ReturnType<typeof fetchSpotifyPlaylistTracks>> = [];
    if (sourcePlaylist.platform === 'spotify') {
      tracks = await fetchSpotifyPlaylistTracks(sourcePlaylist.id, spotifyToken);
    } else if (sourcePlaylist.platform === 'youtube') {
      tracks = await fetchYouTubePlaylistTracks(sourcePlaylist.uri, youtubeToken);
    } else if (sourcePlaylist.platform === 'soundcloud') {
      tracks = await fetchSoundCloudPlaylistTracks(sourcePlaylist.id, soundcloudToken);
    }

    // Skip tracks already in the target playlist
    const existingIds = playlistTrackIds[targetPlaylistId] || new Set<string>();
    const toAdd = tracks.filter(t => !existingIds.has(t.id));

    // Add each track sequentially
    const importedIds: string[] = [];
    for (const track of toAdd) {
      try {
        await apiClient.addTrackToCustomPlaylist(targetPlaylistId, {
          trackId: track.id,
          platform: track.platform,
          name: track.name,
          uri: track.uri,
          artists: track.artists,
          albumName: track.album.name,
          albumImageUrl: track.album.images[0]?.url || '',
          duration_ms: track.duration_ms,
          preview_url: track.preview_url || null,
        });
        importedIds.push(track.id);
      } catch {
        // Skip failed tracks silently
      }
    }

    onImportComplete(targetPlaylistId, importedIds);
  }, [spotifyToken, youtubeToken, soundcloudToken, playlistTrackIds, onImportComplete]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
          Playlists
        </h2>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>

      {/* Playlist sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Custom (MMP) playlists — always on top */}
        <CustomPlaylistSection
          activePlaylistId={activePlaylistId}
          onPlaylistSelect={(playlist) => {
            onPlaylistSelect(playlist);
            setIsMobileOpen(false);
          }}
          onCreateClick={() => setIsCreateModalOpen(true)}
          playlists={customPlaylists}
          onPlaylistsChange={onCustomPlaylistsChange}
        />

        {/* Platform sections */}
        {connectedPlatforms.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No platforms connected.
            <br />
            Connect a music service from the Dashboard.
          </div>
        ) : (
          connectedPlatforms.map((platform) => (
            <PlatformPlaylistSection
              key={platform}
              platform={platform}
              token={getToken(platform)}
              activePlaylistId={activePlaylistId}
              onPlaylistSelect={(playlist) => {
                onPlaylistSelect(playlist);
                setIsMobileOpen(false);
              }}
              onPlaylistRefresh={onPlaylistRefresh}
              customPlaylists={customPlaylists}
              onImportToPlaylist={handleImportToPlaylist}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed left-4 top-20 z-40 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors"
      >
        📋 Playlists
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          md:hidden fixed left-0 top-0 bottom-0 z-50 w-72
          bg-black/90 backdrop-blur-md border-r border-white/10
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar - always visible */}
      <aside className="hidden md:block w-72 flex-shrink-0 bg-black/20 backdrop-blur-sm border-r border-white/10 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreatePlaylist}
      />
    </>
  );
}
