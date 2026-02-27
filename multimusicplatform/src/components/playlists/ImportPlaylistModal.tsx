'use client';

import { useState, useCallback } from 'react';
import { CustomPlaylist } from '@/types/playlist';
import { apiClient } from '@/lib/api';
import {
  fetchSpotifyOwnedPlaylists,
  fetchYouTubeOwnedPlaylists,
  fetchSpotifyPlaylistTracks,
  fetchYouTubePlaylistTracks,
  fetchSoundCloudPlaylistTracks,
} from '@/lib/platformHelpers';

type Platform = 'spotify' | 'youtube' | 'soundcloud';
type Step = 'select-source' | 'select-target' | 'confirm' | 'importing' | 'done';

interface SourcePlaylist {
  id: string;
  name: string;
  trackCount?: number;
  imageUrl?: string | null;
  /** YouTube uses URI (video ID) for track fetching */
  uri?: string;
}

interface ImportTrack {
  id: string;
  platform: Platform;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
}

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  customPlaylists: CustomPlaylist[];
  spotifyToken: string | null;
  youtubeToken: string | null;
  soundcloudToken: string | null;
  /** Maps custom playlistId -> Set of trackIds already in that playlist */
  playlistTrackIds: Record<string, Set<string>>;
  /** Called after import completes with the target playlistId and all imported trackIds */
  onImportComplete: (playlistId: string, importedTrackIds: string[]) => void;
}

const PLATFORM_META = {
  spotify: { label: 'Spotify', icon: '🎵', color: 'text-green-400', borderColor: 'border-green-400' },
  youtube: { label: 'YouTube', icon: '🎬', color: 'text-red-400', borderColor: 'border-red-400' },
  soundcloud: { label: 'SoundCloud', icon: '🔊', color: 'text-orange-400', borderColor: 'border-orange-400' },
} as const;

export default function ImportPlaylistModal({
  isOpen,
  onClose,
  customPlaylists,
  spotifyToken,
  youtubeToken,
  soundcloudToken,
  playlistTrackIds,
  onImportComplete,
}: ImportPlaylistModalProps) {
  const [step, setStep] = useState<Step>('select-source');
  const [activePlatformTab, setActivePlatformTab] = useState<Platform>('spotify');
  const [platformPlaylists, setPlatformPlaylists] = useState<
    Partial<Record<Platform, SourcePlaylist[] | 'loading'>>
  >({});
  const [selectedSource, setSelectedSource] = useState<{ playlist: SourcePlaylist; platform: Platform } | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [sourceTracks, setSourceTracks] = useState<ImportTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getToken = (platform: Platform) => {
    if (platform === 'spotify') return spotifyToken;
    if (platform === 'youtube') return youtubeToken;
    return soundcloudToken;
  };

  const loadPlatformPlaylists = useCallback(async (platform: Platform) => {
    const existing = platformPlaylists[platform];
    if (existing && existing !== 'loading') return;

    setPlatformPlaylists(prev => ({ ...prev, [platform]: 'loading' }));
    try {
      let playlists: SourcePlaylist[] = [];
      if (platform === 'spotify' && spotifyToken) {
        const owned = await fetchSpotifyOwnedPlaylists(spotifyToken);
        playlists = owned.map(p => ({ id: p.id, name: p.name }));
      } else if (platform === 'youtube' && youtubeToken) {
        const owned = await fetchYouTubeOwnedPlaylists(youtubeToken);
        playlists = owned.map(p => ({ id: p.id, name: p.name, uri: p.id }));
      } else if (platform === 'soundcloud' && soundcloudToken) {
        const res = await apiClient.getPlatformPlaylists('soundcloud', false);
        playlists = (res.data?.playlists || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          trackCount: p.trackCount,
          imageUrl: p.imageUrl,
        }));
      }
      setPlatformPlaylists(prev => ({ ...prev, [platform]: playlists }));
    } catch {
      setPlatformPlaylists(prev => ({ ...prev, [platform]: [] }));
    }
  }, [platformPlaylists, spotifyToken, youtubeToken, soundcloudToken]);

  const handleTabClick = (platform: Platform) => {
    setActivePlatformTab(platform);
    loadPlatformPlaylists(platform);
  };

  const handleSelectSource = async (playlist: SourcePlaylist, platform: Platform) => {
    setSelectedSource({ playlist, platform });
    setStep('select-target');
    setError(null);
    setIsLoadingTracks(true);
    setSourceTracks([]);

    try {
      let tracks: ImportTrack[] = [];
      if (platform === 'spotify') {
        tracks = (await fetchSpotifyPlaylistTracks(playlist.id, spotifyToken)) as ImportTrack[];
      } else if (platform === 'youtube') {
        tracks = (await fetchYouTubePlaylistTracks(playlist.uri || playlist.id, youtubeToken)) as ImportTrack[];
      } else if (platform === 'soundcloud') {
        tracks = (await fetchSoundCloudPlaylistTracks(playlist.id, soundcloudToken)) as ImportTrack[];
      }
      setSourceTracks(tracks);
    } catch {
      setError('Failed to load source playlist tracks');
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleSelectTarget = (targetId: string) => {
    setSelectedTargetId(targetId);
    const existing = playlistTrackIds[targetId] || new Set<string>();
    const dupes = sourceTracks.filter(t => existing.has(t.id)).length;
    setDuplicateCount(dupes);
    setStep('confirm');
  };

  const handleImport = async () => {
    if (!selectedSource || !selectedTargetId) return;
    setStep('importing');

    const existingIds = playlistTrackIds[selectedTargetId] || new Set<string>();
    const toAdd = sourceTracks.filter(t => !existingIds.has(t.id));
    const skipped = sourceTracks.length - toAdd.length;

    setProgress({ done: 0, total: toAdd.length });

    let added = 0;
    let failed = 0;
    const importedTrackIds: string[] = [];

    for (const track of toAdd) {
      try {
        await apiClient.addTrackToCustomPlaylist(selectedTargetId, {
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
        added++;
        importedTrackIds.push(track.id);
      } catch {
        failed++;
      }
      setProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
    }

    setImportResult({ added, skipped, failed });
    onImportComplete(selectedTargetId, importedTrackIds);
    setStep('done');
  };

  const handleClose = () => {
    if (step === 'importing') return;
    setStep('select-source');
    setSelectedSource(null);
    setSelectedTargetId(null);
    setSourceTracks([]);
    setDuplicateCount(0);
    setProgress(null);
    setImportResult(null);
    setError(null);
    onClose();
  };

  const handleBack = () => {
    if (step === 'select-target') setStep('select-source');
    else if (step === 'confirm') setStep('select-target');
  };

  if (!isOpen) return null;

  const targetPlaylistName = customPlaylists.find(p => p.playlistId === selectedTargetId)?.name;
  const netToImport = sourceTracks.length - duplicateCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={step !== 'importing' ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0">
          {(step === 'select-target' || step === 'confirm') && (
            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white text-sm transition-colors shrink-0"
            >
              ← Back
            </button>
          )}
          <h2 className="text-white font-semibold text-lg flex-1 truncate">
            {step === 'select-source' && 'Import Playlist'}
            {step === 'select-target' && `Import "${selectedSource?.playlist.name}"`}
            {step === 'confirm' && 'Confirm Import'}
            {step === 'importing' && 'Importing…'}
            {step === 'done' && 'Import Complete'}
          </h2>
          {step !== 'importing' && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white text-xl transition-colors shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Step 1: Select source platform playlist */}
          {step === 'select-source' && (
            <div>
              {/* Platform tabs */}
              <div className="flex gap-0 mb-4 border-b border-white/10">
                {(['spotify', 'youtube', 'soundcloud'] as Platform[]).map(platform => {
                  const meta = PLATFORM_META[platform];
                  const hasToken = !!getToken(platform);
                  const isActive = activePlatformTab === platform;
                  return (
                    <button
                      key={platform}
                      onClick={() => hasToken && handleTabClick(platform)}
                      disabled={!hasToken}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                        ${isActive ? `${meta.color} ${meta.borderColor}` : 'text-gray-400 border-transparent hover:text-gray-200'}
                        ${!hasToken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  );
                })}
              </div>

              {/* Playlist list */}
              {(() => {
                const list = platformPlaylists[activePlatformTab];
                if (!getToken(activePlatformTab)) {
                  return (
                    <p className="text-gray-500 text-sm text-center py-8 italic">
                      {PLATFORM_META[activePlatformTab].label} is not connected.
                    </p>
                  );
                }
                if (!list || list === 'loading') {
                  return <p className="text-gray-400 text-sm text-center py-8">Loading playlists…</p>;
                }
                if (list.length === 0) {
                  return <p className="text-gray-500 text-sm text-center py-8 italic">No playlists found</p>;
                }
                return (
                  <div className="space-y-1">
                    {list.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => handleSelectSource(pl, activePlatformTab)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        {pl.imageUrl && (
                          <img
                            src={pl.imageUrl}
                            className="w-9 h-9 rounded flex-shrink-0 object-cover"
                            alt=""
                          />
                        )}
                        <span className="flex-1 truncate text-sm">{pl.name}</span>
                        {pl.trackCount !== undefined && (
                          <span className="text-xs text-gray-500 shrink-0">{pl.trackCount} tracks</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 2: Select target custom playlist */}
          {step === 'select-target' && (
            <div>
              {isLoadingTracks && (
                <p className="text-gray-400 text-sm text-center py-3 mb-4">
                  Loading source tracks…
                </p>
              )}
              {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
              )}
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-3">
                Choose destination playlist
              </p>
              {customPlaylists.length === 0 ? (
                <p className="text-gray-500 text-sm italic text-center py-6">
                  No custom playlists yet. Create one first.
                </p>
              ) : (
                <div className="space-y-1">
                  {customPlaylists.map(pl => (
                    <button
                      key={pl.playlistId}
                      onClick={() => !isLoadingTracks && handleSelectTarget(pl.playlistId)}
                      disabled={isLoadingTracks}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                        ${isLoadingTracks
                          ? 'text-gray-500 cursor-not-allowed opacity-60'
                          : 'text-gray-200 hover:bg-white/10 cursor-pointer'
                        }`}
                    >
                      <span className="text-purple-400 shrink-0">🎧</span>
                      <span className="flex-1 truncate text-sm">{pl.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{pl.trackCount} tracks</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="bg-white/5 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">Source</span>
                  <span className="text-white text-right truncate">{selectedSource?.playlist.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">Destination</span>
                  <span className="text-white text-right truncate">{targetPlaylistName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tracks in source</span>
                  <span className="text-white">{sourceTracks.length}</span>
                </div>
                {duplicateCount > 0 && (
                  <div className="flex justify-between text-yellow-400">
                    <span>Duplicates (will be skipped)</span>
                    <span>{duplicateCount}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-white/10 pt-3">
                  <span className="text-gray-300">Tracks to import</span>
                  <span className="text-white">{netToImport}</span>
                </div>
              </div>

              {netToImport === 0 && (
                <p className="text-yellow-400 text-sm text-center">
                  All tracks are already in this playlist — nothing to import.
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={netToImport === 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors font-medium"
                >
                  Import {netToImport} track{netToImport !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing with progress */}
          {step === 'importing' && progress && (
            <div className="space-y-4 py-4">
              <p className="text-gray-300 text-sm text-center">
                Importing {progress.done} of {progress.total} tracks…
              </p>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-gray-500 text-xs text-center">
                Please wait, do not close this window
              </p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && importResult && (
            <div className="space-y-4 py-4 text-center">
              <div className="text-5xl mb-2">✓</div>
              <p className="text-white font-semibold text-lg">Import Complete</p>
              <div className="space-y-1.5 text-sm">
                <p className="text-gray-300">{importResult.added} track{importResult.added !== 1 ? 's' : ''} added</p>
                {importResult.skipped > 0 && (
                  <p className="text-yellow-400">{importResult.skipped} duplicate{importResult.skipped !== 1 ? 's' : ''} skipped</p>
                )}
                {importResult.failed > 0 && (
                  <p className="text-red-400">{importResult.failed} track{importResult.failed !== 1 ? 's' : ''} failed</p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors font-medium"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
