'use client';

import { useState } from 'react';
import {
  COVER_EMOJI_OPTIONS,
  DEFAULT_COVER,
  PLAYLIST_DESC_MAX_LEN,
  PLAYLIST_NAME_MAX_LEN,
} from '@/lib/constants/playlist';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, coverImage: string) => Promise<void>;
}

export default function CreatePlaylistModal({ isOpen, onClose, onCreate }: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(DEFAULT_COVER);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const descNearLimit = description.length > 480;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (trimmedName.length > PLAYLIST_NAME_MAX_LEN) {
      setError(`Name must be ${PLAYLIST_NAME_MAX_LEN} characters or fewer`);
      return;
    }
    if (trimmedDesc.length > PLAYLIST_DESC_MAX_LEN) {
      setError(`Description must be ${PLAYLIST_DESC_MAX_LEN} characters or fewer`);
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await onCreate(trimmedName, trimmedDesc, coverImage);
      setName('');
      setDescription('');
      setCoverImage(DEFAULT_COVER);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#130d07]/85 flex items-center justify-center">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-warm w-full max-w-[460px] p-8">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber to-transparent" />
        <h2 className="font-display text-2xl text-cream mb-6">Create Playlist</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover emoji picker */}
          <div>
            <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-2 block">Cover</label>
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 flex items-center justify-center bg-raised border border-warm text-4xl">
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
              placeholder="My Playlist"
              autoFocus
              className="w-full bg-raised border border-warm text-cream font-sans text-sm p-3 outline-none focus:border-amber transition-colors placeholder:text-muted"
              maxLength={PLAYLIST_NAME_MAX_LEN}
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-condensed text-[9px] tracking-[0.2em] uppercase text-muted mb-2 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this playlist about?"
              rows={2}
              className="w-full bg-raised border border-warm text-cream font-sans text-sm p-3 outline-none focus:border-amber transition-colors placeholder:text-muted resize-none"
              maxLength={PLAYLIST_DESC_MAX_LEN}
            />
            <p className={`text-xs mt-1 text-right ${descNearLimit ? 'text-red-400' : 'text-muted'}`}>
              {description.length} / {PLAYLIST_DESC_MAX_LEN}
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-warm text-muted font-condensed text-[11px] tracking-widest uppercase hover:text-cream transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim() || description.length > PLAYLIST_DESC_MAX_LEN}
              className="px-4 py-2.5 bg-amber text-bg font-condensed text-[11px] tracking-widest uppercase font-semibold hover:brightness-110 transition-all disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
