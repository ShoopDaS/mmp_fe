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
    bg: 'bg-white hover:bg-gray-100',
    text: 'text-gray-900',
  },
  microsoft: {
    name: 'Microsoft',
    Icon: MicrosoftIcon,
    bg: 'bg-blue-600 hover:bg-blue-700',
    text: 'text-white',
  },
  spotify: {
    name: 'Spotify',
    Icon: SpotifyIcon,
    bg: 'bg-spotify',
    text: 'text-black',
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
        w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg
        font-medium transition-all
        ${config.bg} ${config.text}
        ${disabled || comingSoon ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}
        shadow-lg
      `}
    >
      <config.Icon className="w-5 h-5" />
      <span>
        Continue with {config.name}
        {comingSoon && ' (Coming Soon)'}
      </span>
    </button>
  );
}
