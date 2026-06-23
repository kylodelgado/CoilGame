import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { GameController } from './GameController';

/**
 * Auto-pause on focus loss. While the game is RUNNING, a transition to
 * 'background' or 'inactive' pauses it; nothing happens in any other status, so
 * we never pause a game that isn't running. Unsubscribes on unmount. (FR-P2)
 */
export function useAppStatePause(controller: GameController): void {
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (
          (next === 'background' || next === 'inactive') &&
          controller.getState().status === 'RUNNING'
        ) {
          controller.pause();
        }
      },
    );
    return () => subscription.remove();
  }, [controller]);
}
