import { StyleSheet, View } from 'react-native';
import { mix } from '../render/color';

interface SpeedGaugeProps {
  /** 0 at starting pace, 1 at top speed. */
  fraction: number;
  /** The "cool" (low-speed) fill color; it heats toward red as speed climbs. */
  coolColor: string;
}

/**
 * A compact HUD speed bar: fills left→right from the starting pace (empty) to top
 * speed (full), shifting from the skin's cool color toward hot red as it climbs.
 * A pure projection of the speed fraction. (dynamic speed marker)
 */
export function SpeedGauge({ fraction, coolColor }: SpeedGaugeProps) {
  const f = Math.max(0, Math.min(1, fraction));
  const color = mix(coolColor, '#FF3B30', f);
  return (
    <View
      style={styles.track}
      testID="speed-gauge"
      accessibilityLabel={`Speed ${Math.round(f * 100)} percent`}
    >
      <View
        style={[styles.fill, { width: `${f * 100}%`, backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 110,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  fill: { height: 9, borderRadius: 5 },
});
