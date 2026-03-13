'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CustomPlaylist } from '@/types/playlist';
import { SpotifyIcon, SoundCloudIcon, YouTubeIcon, DefaultMusicIcon } from '@/components/icons/BrandIcons';

interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  platform: 'spotify' | 'soundcloud' | 'youtube';
}

interface OwnedPlaylist {
  id: string;
  name: string;
}

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onTogglePlay?: () => void;
  onAddToQueue?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  isCustomPlaylist?: boolean;
  onRemoveFromPlaylist?: (track: Track) => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  customPlaylists?: CustomPlaylist[];
  ownedPlatformPlaylists?: Partial<Record<'spotify' | 'youtube' | 'soundcloud', OwnedPlaylist[] | 'loading'>>;
  onAddToCustomPlaylist?: (track: Track, playlistId: string) => Promise<void>;
  onAddToPlatformPlaylist?: (track: Track, playlistId: string) => Promise<void>;
  onRequestPlatformPlaylists?: (platform: 'spotify' | 'youtube' | 'soundcloud') => void;
  playlistTrackIds?: Record<string, Set<string>>;
  onRequestPlaylistTrackIds?: (playlistIds: string[]) => void;
  platformPlaylistTrackIds?: Record<string, Set<string>>;
  onRequestPlatformPlaylistTrackIds?: (platform: 'spotify' | 'youtube', playlistIds: string[]) => void;
}

export default function TrackList({
  tracks, onPlay, onTogglePlay, onAddToQueue, onPlayNext, currentTrack, isPlaying = false,
  isCustomPlaylist = false, onRemoveFromPlaylist, onReorderTracks, customPlaylists,
  ownedPlatformPlaylists, onAddToCustomPlaylist, onAddToPlatformPlaylist,
  onRequestPlatformPlaylists, playlistTrackIds, onRequestPlaylistTrackIds,
  platformPlaylistTrackIds, onRequestPlatformPlaylistTrackIds,
}: TrackListProps) {
  const [feedbackId, setFeedbackId] = useState<{ trackId: string; action: 'queued' | 'next' } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [addToPlaylistOpenId, setAddToPlaylistOpenId] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<{ trackId: string; playlistId: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setAddToPlaylistOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const getActiveStyles = (isCurrentTrack: boolean) => {
    return isCurrentTrack 
      ? 'bg-gradient-to-r from-accent/10 to-transparent border-l-2 border-accent' 
      : 'hover:bg-white/5 border-l-2 border-transparent';
  };

  const platformMeta = (platform: 'spotify' | 'youtube' | 'soundcloud') => {
    switch (platform) {
      case 'spotify': return { label: 'Spotify', icon: <SpotifyIcon className="w-3.5 h-3.5" />, color: 'text-spotify', bg: 'bg-spotify/20 border-spotify/30' };
      case 'youtube': return { label: 'YouTube Music', icon: <YouTubeIcon className="w-3.5 h-3.5" />, color: 'text-youtube', bg: 'bg-youtube/20 border-youtube/30' };
      case 'soundcloud': return { label: 'SoundCloud', icon: <SoundCloudIcon className="w-3.5 h-3.5" />, color: 'text-soundcloud', bg: 'bg-soundcloud/20 border-soundcloud/30' };
    }
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id && onTogglePlay) onTogglePlay();
    else onPlay(track);
  };

  const showFeedback = (trackId: string, action: 'queued' | 'next') => {
    setFeedbackId({ trackId, action });
    setTimeout(() => setFeedbackId(null), 1500);
  };

  const handleAddToQueue = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (onAddToQueue) { onAddToQueue(track); showFeedback(track.id, 'queued'); }
  };

  const handlePlayNext = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (onPlayNext) { onPlayNext(track); showFeedback(track.id, 'next'); }
  };

  const handleAddToPlaylist = (track: Track, playlistId: string, addFn: (track: Track, playlistId: string) => Promise<void>) => {
    addFn(track, playlistId)
      .then(() => { setAddFeedback({ trackId: track.id, playlistId }); setTimeout(() => setAddFeedback(null), 1500); })
      .catch(err => console.error('Failed to add to playlist:', err));
  };

  const toggleAddToPlaylistPanel = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const isOpen = addToPlaylistOpenId === track.id;
    if (!isOpen) {
      if (onRequestPlatformPlaylists && track.platform !== 'soundcloud') onRequestPlatformPlaylists(track.platform);
      if (onRequestPlaylistTrackIds && customPlaylists?.length) {
        const unloaded = customPlaylists.map(pl => pl.playlistId).filter(id => !playlistTrackIds?.[id]);
        if (unloaded.length) onRequestPlaylistTrackIds(unloaded);
      }
      if (onRequestPlatformPlaylistTrackIds && track.platform !== 'soundcloud') {
        const playlists = ownedPlatformPlaylists?.[track.platform];
        if (Array.isArray(playlists) && playlists.length) {
          const unloaded = playlists.map(pl => pl.id).filter(id => !platformPlaylistTrackIds?.[id]);
          if (unloaded.length) onRequestPlatformPlaylistTrackIds(track.platform as 'spotify' | 'youtube', unloaded);
        }
      }
    }
    setAddToPlaylistOpenId(isOpen ? null : track.id);
  };

  const handleRemoveClick = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (removingId || !onRemoveFromPlaylist) return;
    setRemovingId(track.id);
    setTimeout(() => { onRemoveFromPlaylist(track); setRemovingId(null); }, 300);
  };

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    requestAnimationFrame(() => { if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4'; });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex && onReorderTracks) onReorderTracks(dragIndex, toIndex);
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, onReorderTracks]);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, []);

  const canDrag = isCustomPlaylist && !!onReorderTracks;
  const showAddToPlaylist = !!(onAddToCustomPlaylist || onAddToPlatformPlaylist);

  return (
    <div className="space-y-1.5">
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const albumImage = track.album.images[0]?.url || '';
        const feedback = feedbackId?.trackId === track.id ? feedbackId.action : null;
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index && dragIndex !== index;
        const isAddToPlaylistOpen = addToPlaylistOpenId === track.id;
        const meta = platformMeta(track.platform);
        const platformPlaylists = ownedPlatformPlaylists?.[track.platform];

        return (
          <div
            key={track.id}
            draggable={canDrag}
            onDragStart={canDrag ? (e) => handleDragStart(e, index) : undefined}
            onDragOver={canDrag ? (e) => handleDragOver(e, index) : undefined}
            onDragEnter={canDrag ? (e) => handleDragEnter(e, index) : undefined}
            onDragLeave={canDrag ? handleDragLeave : undefined}
            onDrop={canDrag ? (e) => handleDrop(e, index) : undefined}
            onDragEnd={canDrag ? handleDragEnd : undefined}
            className={`
              flex items-center gap-4 p-2.5 rounded-lg transition-all duration-200 cursor-pointer relative group
              ${getActiveStyles(isCurrentTrack)}
              ${openMenuId === track.id ? 'z-20 bg-white/5' : 'z-0'}
              ${removingId === track.id ? 'opacity-0 translate-x-8 scale-95 pointer-events-none' : ''}
              ${isDragging && removingId !== track.id ? 'opacity-40' : ''}
              ${isDragOver ? 'ring-1 ring-accent bg-surface-hover' : ''}
            `}
            onClick={() => handleTrackClick(track)}
          >
            {canDrag && (
              <span className="text-text-secondary group-hover:text-white cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder" onMouseDown={(e) => e.stopPropagation()}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" /></svg>
              </span>
            )}

            {/* Play/Pause indicator */}
            <div className={`w-6 flex justify-center shrink-0 transition-colors ${isCurrentTrack ? 'text-accent' : 'text-text-secondary group-hover:text-white'}`}>
              {isCurrentTrack ? (
                isPlaying ? (
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                ) : (
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )
              ) : (
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </div>

            {/* Album art with Platform Badge */}
            <div className="relative shrink-0">
              {albumImage ? (
                <img src={albumImage} alt={track.album.name} className="w-10 h-10 rounded-md object-cover shadow-sm border border-white/5" />
              ) : (
                <div className="w-10 h-10 rounded-md bg-surface-hover flex items-center justify-center border border-white/5 shadow-sm">
                  <DefaultMusicIcon className="w-5 h-5 text-white/20" />
                </div>
              )}
              {/* Brand Floating Badge */}
              <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-[1.5px] border-surface backdrop-blur-md ${meta.bg} ${meta.color}`}>
                 {meta.icon}
              </div>
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className={`text-[14px] font-medium truncate ${isCurrentTrack ? 'text-accent' : 'text-white'}`}>{track.name}</h3>
              <p className="text-[12px] text-text-secondary truncate mt-0.5">
                {track.artists.map(a => a.name).join(', ')} <span className="mx-1 opacity-50">•</span> {track.album.name}
              </p>
            </div>

            <div className="relative flex items-center gap-1 shrink-0" ref={openMenuId === track.id ? menuRef : undefined}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const closing = openMenuId === track.id;
                  setOpenMenuId(closing ? null : track.id);
                  if (closing) setAddToPlaylistOpenId(null);
                }}
                className="p-1.5 rounded-md text-text-secondary hover:bg-white/10 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
              </button>

              {isCustomPlaylist && onRemoveFromPlaylist && (
                <button onClick={(e) => handleRemoveClick(e, track)} className="p-1.5 rounded-md text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center" title="Remove from playlist">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}

              {openMenuId === track.id && (
                <div className={`absolute right-0 top-full mt-1 bg-surface-hover border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden transition-all ${isAddToPlaylistOpen ? 'w-60' : 'w-48'}`}>
                  {onPlayNext && (
                    <button onClick={(e) => { handlePlayNext(e, track); setOpenMenuId(null); setAddToPlaylistOpenId(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-gray-200 hover:bg-white/10 transition-colors">
                      {feedback === 'next' ? (
                        <><svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Up next!</span></>
                      ) : (
                        <><svg className="w-4 h-4 text-text-secondary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>Add next in queue</>
                      )}
                    </button>
                  )}
                  {onAddToQueue && (
                    <button onClick={(e) => { handleAddToQueue(e, track); setOpenMenuId(null); setAddToPlaylistOpenId(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-gray-200 hover:bg-white/10 transition-colors">
                      {feedback === 'queued' ? (
                        <><svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Added!</span></>
                      ) : (
                        <><svg className="w-4 h-4 text-text-secondary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>Add to queue</>
                      )}
                    </button>
                  )}

                  {showAddToPlaylist && (
                    <>
                      <div className="border-t border-white/10 my-1" />
                      <button onClick={(e) => toggleAddToPlaylistPanel(e, track)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-gray-200 hover:bg-white/10 transition-colors">
                        <span className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-text-secondary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                          Add to playlist
                        </span>
                        <svg className="w-3.5 h-3.5 text-text-secondary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d={isAddToPlaylistOpen ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"} clipRule="evenodd" />
                        </svg>
                      </button>

                      {isAddToPlaylistOpen && (
                        <div className="max-h-56 overflow-y-auto border-t border-white/10 bg-black/20 scrollbar-thin scrollbar-thumb-white/10">
                          {onAddToCustomPlaylist && (
                            <div>
                              <p
                                className="sticky top-0 bg-surface-hover/95 backdrop-blur px-3 py-1.5 text-[10px] text-text-secondary uppercase tracking-wider font-bold z-20 cursor-pointer hover:text-white transition-colors"
                                onClick={(e) => { e.stopPropagation(); e.currentTarget.closest('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              >My Playlists</p>
                              {!customPlaylists || customPlaylists.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-text-secondary italic">No playlists yet</p>
                              ) : (
                                customPlaylists.map(pl => {
                                  const justAdded = addFeedback?.trackId === track.id && addFeedback.playlistId === pl.playlistId;
                                  const alreadyIn = playlistTrackIds?.[pl.playlistId]?.has(track.id) ?? false;
                                  return (
                                    <button key={pl.playlistId} onClick={(e) => { e.stopPropagation(); if (!alreadyIn) handleAddToPlaylist(track, pl.playlistId, onAddToCustomPlaylist!); }} disabled={alreadyIn} className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${alreadyIn ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 hover:bg-white/10'}`}>
                                      <DefaultMusicIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                                      <span className="truncate flex-1 text-left">{pl.name}</span>
                                      {(alreadyIn || justAdded) && <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                          {onAddToPlatformPlaylist && track.platform !== 'soundcloud' && (
                            <div>
                              <p
                                className="sticky top-6 bg-surface-hover/95 backdrop-blur px-3 py-1.5 text-[10px] text-text-secondary uppercase tracking-wider font-bold border-t border-white/10 z-10 cursor-pointer hover:text-white transition-colors"
                                onClick={(e) => { e.stopPropagation(); (e.currentTarget.parentElement as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                              >{meta.label}</p>
                              {!platformPlaylists || platformPlaylists === 'loading' ? (
                                <p className="px-3 py-2 text-xs text-text-secondary italic animate-pulse">Loading...</p>
                              ) : platformPlaylists.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-text-secondary italic">No playlists found</p>
                              ) : (
                                platformPlaylists.map(pl => {
                                  const justAdded = addFeedback?.trackId === track.id && addFeedback.playlistId === pl.id;
                                  const alreadyIn = platformPlaylistTrackIds?.[pl.id]?.has(track.uri) ?? false;
                                  return (
                                    <button key={pl.id} onClick={(e) => { e.stopPropagation(); if (!alreadyIn) handleAddToPlaylist(track, pl.id, onAddToPlatformPlaylist); }} disabled={alreadyIn} className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${alreadyIn ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 hover:bg-white/10'}`}>
                                      <div className={`${meta.color} shrink-0`}>{meta.icon}</div>
                                      <span className="truncate flex-1 text-left">{pl.name}</span>
                                      {(alreadyIn || justAdded) && <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}