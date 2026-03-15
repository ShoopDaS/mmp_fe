'use client';

import { useCallback } from 'react';
import { useHub } from '@/contexts/HubContext';
import { useQueue } from '@/hooks/useQueue';
import { CustomPlaylist } from '@/types/playlist';
import TrackList from '@/components/music/TrackList';
import { apiClient } from '@/lib/api';

/* ── Cassette SVG Icon ─────────────────────────────────────── */

function CassetteIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="4" width="60" height="40" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="10" width="48" height="22" rx="1" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="22" cy="21" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="42" cy="21" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="21" r="2" fill="currentColor" />
      <circle cx="42" cy="21" r="2" fill="currentColor" />
      <line x1="28" y1="21" x2="36" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M16 44 L24 36 H40 L48 44" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Empty Library State (no playlist selected) ────────────── */

function EmptyLibraryState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <CassetteIcon className="w-16 h-16 text-amber" />
      <p className="text-sub text-sm">Select a playlist</p>
    </div>
  );
}

/* ── Empty Track State (playlist has 0 tracks) ─────────────── */

function EmptyTrackState({ isStave }: { isStave: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <CassetteIcon className="w-12 h-12 text-muted" />
      <p className="text-sub text-sm">No tracks yet</p>
      {isStave && (
        <p className="text-muted text-xs">Import tracks from a platform or add them manually.</p>
      )}
    </div>
  );
}

/* ── Loading Skeleton ──────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-warm"
        >
          <div className="w-8 h-4 bg-amber-dim animate-pulse" />
          <div className="w-10 h-10 bg-amber-dim animate-pulse" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 w-48 bg-amber-dim animate-pulse" />
            <div className="h-2 w-32 bg-amber-dim animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Platform Badge Helper ─────────────────────────────────── */

function platformLabel(platform: string): string {
  switch (platform) {
    case 'mmp': return 'STAVE';
    case 'spotify': return 'SPOTIFY';
    case 'youtube': return 'YOUTUBE';
    case 'soundcloud': return 'SOUNDCLOUD';
    default: return platform.toUpperCase();
  }
}

/* ── Playlist Header Card ──────────────────────────────────── */

function PlaylistHeaderCard({
  name,
  description,
  coverEmoji,
  imageUrl,
  trackCount,
  platform,
  onPlayAll,
}: {
  name: string;
  description?: string;
  coverEmoji?: string;
  imageUrl?: string | null;
  trackCount: number;
  platform: string;
  onPlayAll?: () => void;
}) {
  const isStave = platform === 'mmp';

  return (
    <div className="bg-warm border-b border-warm p-6">
      <div className="flex items-start gap-5">
        {/* Cover */}
        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-raised border border-warm">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">{coverEmoji || '🎵'}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-cream leading-tight truncate">{name}</h1>
          {description && (
            <p className="text-sub italic text-sm mt-1 truncate">{description}</p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 mt-3">
            <span className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted border border-warm px-2 py-0.5">
              {trackCount} {trackCount === 1 ? 'TRACK' : 'TRACKS'}
            </span>
            <span className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted border border-warm px-2 py-0.5">
              {platformLabel(platform)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onPlayAll} className="bg-amber text-bg font-condensed text-xs tracking-wider uppercase px-4 py-2 hover:opacity-90 transition-opacity">
            ▶ Play All
          </button>
          {isStave ? (
            <button className="border border-amber text-amber font-condensed text-xs tracking-wider uppercase px-4 py-2 hover:bg-amber/10 transition-colors">
              Edit
            </button>
          ) : (
            <button className="border border-warm text-muted font-condensed text-xs tracking-wider uppercase px-4 py-2 hover:text-cream transition-colors">
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Library Page ─────────────────────────────────────── */

export default function LibraryPage() {
  const {
    activePlaylist, playlistTracks, isLoadingPlaylistTracks,
    customPlaylists, setCustomPlaylists,
    playlistTrackIds, setPlaylistTrackIds,
    triggerTogglePlay, isPlaying,
  } = useHub();
  const queue = useQueue();
  const currentTrack = queue.getCurrentTrack();

  const isStave = activePlaylist?.platform === 'mmp';
  const mode = isStave ? 'library' : 'library-platform';

  // Map CustomTrackItem[] → Track[] for TrackList
  const tracks = playlistTracks.map((t: any) => ({
    id: t.trackId || t.id,
    platform: t.platform,
    name: t.name,
    uri: t.uri,
    artists: t.artists || [],
    album: {
      name: t.albumName || t.album?.name || '',
      images: t.albumImageUrl ? [{ url: t.albumImageUrl }] : (t.album?.images || []),
    },
    duration_ms: t.duration_ms,
    preview_url: t.preview_url || null,
  }));

  const handlePlayTrack = (track: any) => {
    const index = tracks.findIndex((t: any) => t.id === track.id);
    queue.playFromList(tracks, index >= 0 ? index : 0, activePlaylist?.name || 'Library');
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      queue.playFromList(tracks, 0, activePlaylist?.name || 'Library');
    }
  };

  const handleReorderTracks = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!activePlaylist || !isStave) return;
    const updated = [...playlistTracks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    try {
      await apiClient.reorderCustomPlaylistTracks(
        activePlaylist.id,
        updated.map((t: any, i: number) => ({ trackId: t.trackId || t.id, order: (i + 1) * 1000 }))
      );
    } catch { /* ignore */ }
  }, [activePlaylist, isStave, playlistTracks]);

  const handleRemoveFromPlaylist = useCallback((track: any) => {
    if (!activePlaylist || !isStave) return;
    const trackId = track.id || track.trackId;
    setCustomPlaylists((prev: CustomPlaylist[]) =>
      prev.map(p => p.playlistId === activePlaylist.id ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p)
    );
    apiClient.removeTrackFromCustomPlaylist(activePlaylist.id, trackId);
  }, [activePlaylist, isStave, setCustomPlaylists]);

  const handleAddToCustomPlaylist = useCallback(async (track: any, playlistId: string) => {
    if (playlistTrackIds[playlistId]?.has(track.id)) return;
    await apiClient.addTrackToCustomPlaylist(playlistId, {
      trackId: track.id, platform: track.platform, name: track.name, uri: track.uri,
      artists: track.artists, albumName: track.album.name, albumImageUrl: track.album.images[0]?.url || '',
      duration_ms: track.duration_ms, preview_url: track.preview_url || null,
    });
    setCustomPlaylists((prev: CustomPlaylist[]) => prev.map(p => p.playlistId === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p));
    setPlaylistTrackIds((prev: any) => ({ ...prev, [playlistId]: new Set(prev[playlistId] || []).add(track.id) }));
  }, [playlistTrackIds, setCustomPlaylists, setPlaylistTrackIds]);

  if (!activePlaylist) {
    return <EmptyLibraryState />;
  }

  // For Stave playlists, pull description & coverImage from customPlaylists
  let description: string | undefined;
  let coverEmoji: string | undefined;
  if (isStave) {
    const match: CustomPlaylist | undefined = customPlaylists.find(
      (cp) => cp.playlistId === activePlaylist.id
    );
    if (match) {
      description = match.description || undefined;
      coverEmoji = match.coverImage || undefined;
    }
  }

  return (
    <div className="h-full">
      <PlaylistHeaderCard
        name={activePlaylist.name}
        description={description}
        coverEmoji={coverEmoji}
        imageUrl={activePlaylist.imageUrl}
        trackCount={activePlaylist.trackCount}
        platform={activePlaylist.platform}
        onPlayAll={handlePlayAll}
      />

      {isLoadingPlaylistTracks ? (
        <LoadingSkeleton />
      ) : playlistTracks.length === 0 ? (
        <EmptyTrackState isStave={isStave} />
      ) : (
        <div className="px-2 py-4">
          <TrackList
            tracks={tracks}
            mode={mode}
            onPlay={handlePlayTrack}
            onTogglePlay={triggerTogglePlay}
            onAddToQueue={(track: any) => queue.addToQueue([track])}
            onPlayNext={queue.playNext}
            currentTrack={currentTrack as any}
            isPlaying={isPlaying}
            isCustomPlaylist={isStave}
            onRemoveFromPlaylist={isStave ? handleRemoveFromPlaylist : undefined}
            onReorderTracks={isStave ? handleReorderTracks : undefined}
            customPlaylists={customPlaylists}
            onAddToCustomPlaylist={handleAddToCustomPlaylist}
            playlistTrackIds={playlistTrackIds}
          />
        </div>
      )}
    </div>
  );
}
