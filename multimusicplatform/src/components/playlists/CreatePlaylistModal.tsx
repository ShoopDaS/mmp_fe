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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Create Playlist</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover emoji picker */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Cover</label>
            {/* Current selection preview */}
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 flex items-center justify-center rounded-lg bg-purple-900/50 text-4xl">
                {coverImage}
              </div>
            </div>
            {/* Emoji grid */}
            <div className="grid grid-cols-5 gap-1">
              {COVER_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setCoverImage(emoji)}
                  className={`
                    w-full aspect-square flex items-center justify-center text-xl rounded-lg transition-colors
                    ${coverImage === emoji
                      ? 'bg-purple-600 ring-2 ring-purple-400'
                      : 'bg-white/5 hover:bg-white/10'
                    }
                  `}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Playlist"
              autoFocus
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
              maxLength={PLAYLIST_NAME_MAX_LEN}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this playlist about?"
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm resize-none"
              maxLength={PLAYLIST_DESC_MAX_LEN}
            />
            <p className={`text-xs mt-1 text-right ${descNearLimit ? 'text-red-400' : 'text-gray-500'}`}>
              {description.length} / {PLAYLIST_DESC_MAX_LEN}
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim() || description.length > PLAYLIST_DESC_MAX_LEN}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
