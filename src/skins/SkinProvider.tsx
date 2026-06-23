import { createContext, useContext, type ReactNode } from 'react';
import type { Skin } from './Skin';
import { greenOnBlack } from './greenOnBlack';
import { getSkin } from './registry';
import { useSettingsStore } from '../state/useSettingsStore';

// Default to the MVP skin so consumers always have a valid set of tokens,
// even when rendered outside an explicit provider.
const SkinContext = createContext<Skin>(greenOnBlack);

interface SkinProviderProps {
  children: ReactNode;
  /**
   * Force a specific skin (e.g. a Settings swatch previewing one skin's
   * colors). When omitted, the active skin follows the settings store's
   * skinId, defaulting to greenOnBlack before hydration.
   */
  skin?: Skin;
}

export function SkinProvider({ children, skin }: SkinProviderProps) {
  // Subscribe so a skinId change in the store re-renders every consumer.
  const skinId = useSettingsStore((s) => s.skinId);
  const resolved = skin ?? getSkin(skinId);
  return (
    <SkinContext.Provider value={resolved}>{children}</SkinContext.Provider>
  );
}

/** Read the active skin's design tokens. */
export function useSkin(): Skin {
  return useContext(SkinContext);
}
