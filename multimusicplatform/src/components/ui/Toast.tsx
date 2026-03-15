'use client';
import { useToast } from '@/contexts/ToastContext';

export default function Toast() {
  const { message } = useToast();

  return (
    <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 z-[10001] transition-opacity duration-300 ${message ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="bg-card border border-warm text-amber font-condensed text-xs tracking-[0.1em] px-5 py-2.5 whitespace-nowrap shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {message}
      </div>
    </div>
  );
}
