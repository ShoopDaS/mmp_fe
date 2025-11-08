'use client';

interface ProviderButtonProps {
  provider: 'google' | 'microsoft' | 'github';
  onClick: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

const providerConfig = {
  google: {
    name: 'Google',
    icon: '🔍',
    bg: 'bg-white hover:bg-gray-100',
    text: 'text-gray-900',
  },
  microsoft: {
    name: 'Microsoft',
    icon: '🪟',
    bg: 'bg-blue-600 hover:bg-blue-700',
    text: 'text-white',
  },
  github: {
    name: 'GitHub',
    icon: '🐙',
    bg: 'bg-gray-800 hover:bg-gray-900',
    text: 'text-white',
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
        ${disabled || comingSoon ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        shadow-lg
      `}
    >
      <span className="text-2xl">{config.icon}</span>
      <span>
        Continue with {config.name}
        {comingSoon && ' (Coming Soon)'}
      </span>
    </button>
  );
}
