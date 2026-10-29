import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { initialConfig, type RoomConfig } from '../config';

export type StreamDraft = { title: string; connection: RoomConfig };
const StudioContext = createContext<{
  draft: StreamDraft;
  saveDraft: (draft: StreamDraft) => void;
} | null>(null);

export function StudioProvider({ children }: PropsWithChildren) {
  const [draft, saveDraft] = useState<StreamDraft>({
    title: 'Live product showcase',
    connection: initialConfig,
  });
  return <StudioContext value={{ draft, saveDraft }}>{children}</StudioContext>;
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error('StudioProvider is missing.');
  return context;
}
