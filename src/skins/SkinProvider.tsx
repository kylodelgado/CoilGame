import { createContext, useContext, type ReactNode } from 'react';
import type { Skin } from './Skin';
import { greenOnBlack } from './greenOnBlack';

// Default to the MVP skin so consumers always have a valid set of tokens,
// even when rendered outside an explicit provider.
const SkinContext = createContext<Skin>(greenOnBlack);

interface SkinProviderProps {
  children: ReactNode;
  /** Override the active skin; defaults to greenOnBlack. */
  skin?: Skin;
}

export function SkinProvider({
  children,
  skin = greenOnBlack,
}: SkinProviderProps) {
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}

/** Read the active skin's design tokens. */
export function useSkin(): Skin {
  return useContext(SkinContext);
}
