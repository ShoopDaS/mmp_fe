'use client';

import { GoogleIcon, MicrosoftIcon } from '@/components/icons/ProviderIcons';
import { SpotifyIcon } from '@/components/icons/BrandIcons';

interface ProviderButtonProps {
  provider: 'google' | 'microsoft' | 'spotify';
  onClick: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

const providerConfig = {
  google: {
    name: 'Google',
    Icon: GoogleIcon,
  },
  microsoft: {
    name: 'Microsoft',
    Icon: MicrosoftIcon,
  },
  spotify: {
    name: 'Spotify',
    Icon: SpotifyIcon,
  },
};

export default function ProviderButton({
  provider,
  onClick,
  disabled = false,
  comingSoon = false,
}: ProviderButtonProps) {
  const config = providerConfig[provider];

  return (
    <button
      onClick={onClick}
      disabled={disabled || comingSoon}
      className={`
        w-full px-5 py-3.5 mb-3 border border-warm bg-card text-cream
        font-condensed text-[13px] tracking-[0.08em]
        hover:bg-raised transition-colors flex items-center gap-3.5
        ${disabled || comingSoon ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      <config.Icon className="w-5 h-5" />
      <span className="flex-1 text-left">{config.name}</span>
      {comingSoon ? (
        <span className="font-condensed text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 bg-warm text-muted">Soon</span>
      ) : (
        <span className="font-condensed text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 bg-amber-dim text-amber">Active</span>
      )}
    </button>
  );
}
