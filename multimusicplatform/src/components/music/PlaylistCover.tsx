'use client';

import { DEFAULT_COVER } from '@/lib/constants/playlist';

interface PlaylistCoverProps {
  coverImage?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: { container: 'w-10 h-10', text: 'text-lg' },
  md: { container: 'w-20 h-20', text: 'text-4xl' },
  lg: { container: 'w-40 h-40', text: 'text-7xl' },
};

export default function PlaylistCover({ coverImage, size = 'sm' }: PlaylistCoverProps) {
  const emoji = coverImage || DEFAULT_COVER;
  const { container, text } = sizeClasses[size];

  return (
    <div
      className={`${container} flex-shrink-0 flex items-center justify-center rounded bg-purple-900/50`}
    >
      <span className={text}>{emoji}</span>
    </div>
  );
}
