'use client';

import { useContext } from 'react';
import { QueueContext } from '@/contexts/QueueContext';
import { QueueContextType } from '@/types/queue';

export function useQueue(): QueueContextType {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a <QueueProvider>');
  }
  return context;
}
