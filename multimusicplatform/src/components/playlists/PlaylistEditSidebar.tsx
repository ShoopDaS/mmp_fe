'use client';

import { useState, useEffect } from 'react';
import { CustomPlaylist } from '@/types/playlist';
import { apiClient } from '@/lib/api';
import {
  COVER_EMOJI_OPTIONS,
  PLAYLIST_DESC_MAX_LEN,
  PLAYLIST_NAME_MAX_LEN,
} from '@/lib/constants/playlist';

interface PlaylistEditSidebarProps {
  playlist: CustomPlaylist;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: CustomPlaylist) => void;
}

export default function PlaylistEditSidebar({
  playlist,
  isOpen,
  onClose,
  onSave,
}: PlaylistEditSidebarProps) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [coverImage, setCoverImage] = useState(playlist.coverImage ?? '🎵');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when the playlist prop changes (e.g. different playlist opened)
  useEffect(() => {
    setName(playlist.name);
    setDescription(playlist.description ?? '');
    setCoverImage(playlist.coverImage ?? '🎵');
    setError(null);
  }, [playlist.playlistId]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const descNearLimit = description.length > 480;
  const isNameInvalid = !trimmedName || trimmedName.length > PLAYLIST_NAME_MAX_LEN;
  const isDescInvalid = trimmedDesc.length > PLAYLIST_DESC_MAX_LEN;
  const canSave = !isNameInvalid && !isDescInvalid && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    setIsSaving(true);

    const optimistic: CustomPlaylist = {
      ...playlist,
      name: trimmedName,
      description: trimmedDesc,
      coverImage,
    };

    // Optimistic update
    onSave(optimistic);

    try {
      const response = await apiClient.updateCustomPlaylist(playlist.playlistId, {
        name: trimmedName,
        description: trimmedDesc,
        coverImage,
      });

      if (response.error) {
        // Revert
        onSave(playlist);
        setError(response.error);
        setIsSaving(false);
        return;
      }

      // Use server response if available (has updatedAt etc.)
      if (response.data) {
        onSave({ ...optimistic, ...response.data });
      }
    } catch (err) {
      onSave(playlist);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onClose();
  };

  const handleCancel = () => {
    // Reset to current playlist values
    setName(playlist.name);
    setDescription(playlist.description ?? '');
    setCoverImage(playlist.coverImage ?? '🎵');
    setError(null);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#130d07]/85 z-40"
          onClick={handleCancel}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed right-0 top-0 h-full w-80 z-50
          bg-card border-l border-warm
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-warm">
          <h2 className="text-cream font-semibold">Edit Playlist</h2>
          <button
            onClick={handleCancel}
            className="text-muted hover:text-cream transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Cover emoji picker */}
          <div>
            <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-2 block">Cover</label>
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 flex items-center justify-center bg-raised border border-warm text-5xl">
                {coverImage}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {COVER_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setCoverImage(emoji)}
                  className={`w-9 h-9 border bg-raised hover:bg-warm transition-colors flex items-center justify-center cursor-pointer text-xl ${
                    coverImage === emoji ? 'border-amber bg-amber-dim' : 'border-warm'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-2 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-raised border border-warm text-cream font-sans text-sm p-3 outline-none focus:border-amber transition-colors placeholder:text-muted"
              maxLength={PLAYLIST_NAME_MAX_LEN}
            />
            {trimmedName === '' && (
              <p className="text-red-400 text-xs mt-1">Name is required</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-raised border border-warm text-cream font-sans text-sm p-3 outline-none focus:border-amber transition-colors placeholder:text-muted resize-none"
              maxLength={PLAYLIST_DESC_MAX_LEN}
              placeholder="What's this playlist about?"
            />
            <p className={`text-xs mt-1 text-right ${descNearLimit ? 'text-red-400' : 'text-muted'}`}>
              {description.length} / {PLAYLIST_DESC_MAX_LEN}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 border border-red-500/50 bg-raised">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-4 py-4 border-t border-warm flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 border border-warm text-muted font-condensed text-[11px] tracking-widest uppercase hover:text-cream transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 px-4 py-2.5 bg-amber text-bg font-condensed text-[11px] tracking-widest uppercase font-semibold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </aside>
    </>
  );
}
