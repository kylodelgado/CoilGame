import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameController } from '../runtime/GameController';
import { useSkin } from '../skins/SkinProvider';

interface PauseOverlayProps {
  controller: GameController;
  /** Navigate Home after forfeiting. */
  onQuitToHome: () => void;
}

/**
 * Shown over the GameScreen while PAUSED (manual or auto-pause); the board stays
 * visible behind it (FR-P5). Resume returns to the countdown, Restart begins a
 * fresh run with the same config, and Quit forfeits — controller.quit() already
 * guarantees no score is recorded — then navigates Home. (FR-P3, FR-P6)
 */
export function PauseOverlay({ controller, onQuitToHome }: PauseOverlayProps) {
  const skin = useSkin();

  return (
    <View testID="pause-overlay" style={styles.overlay}>
      <Text style={[styles.title, { color: skin.snakeHead }]}>Paused</Text>

      <Pressable
        testID="resume-button"
        accessibilityRole="button"
        onPress={() => controller.resume()}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryLabel}>Resume</Text>
      </Pressable>

      <Pressable
        testID="restart-button"
        accessibilityRole="button"
        onPress={() => controller.restart()}
        style={styles.button}
      >
        <Text style={styles.label}>Restart</Text>
      </Pressable>

      <Pressable
        testID="quit-button"
        accessibilityRole="button"
        onPress={() => {
          controller.quit(); // forfeit — never records a score
          onQuitToHome();
        }}
        style={styles.button}
      >
        <Text style={styles.label}>Quit to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  title: { fontSize: 36, fontWeight: '800', marginBottom: 16 },
  primaryButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#1f6f1f',
  },
  primaryLabel: { color: '#fff', fontSize: 22, fontWeight: '700' },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  label: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
