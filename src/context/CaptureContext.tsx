import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { GeminiCaptureResponse } from '@/lib/db';

export type LatestCapture = GeminiCaptureResponse & {
  topic: string;
  captureId?: number;
  /** Data URLs for showing captured photos in Social Media Kit (and when loading from DB). */
  photoPreviews?: string[];
};

interface CaptureContextValue {
  latestCapture: LatestCapture | null;
  setLatestCapture: (capture: LatestCapture | null) => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [latestCapture, setLatestCapture] = useState<LatestCapture | null>(null);
  const value: CaptureContextValue = {
    latestCapture,
    setLatestCapture: useCallback((c) => setLatestCapture(c), []),
  };
  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCapture must be used within CaptureProvider');
  return ctx;
}
