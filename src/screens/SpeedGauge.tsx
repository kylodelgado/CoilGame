import { StyleSheet, View } from 'react-native';
import { mix } from '../render/color';
import { useTheme } from '../ui';

interface SpeedGaugeProps {
  /** 0 at starting pace, 1 at top speed. */
  fraction: number;
  /** The "cool" (low-speed) fill color; it heats toward danger as speed climbs. */
  coolColor: string;
}

/**
 * A compact HUD speed bar: fills left→right from the starting pace (empty) to
 * top speed (full), shifting from the skin's cool color toward the skin's hot
 * danger color as it climbs. Track and border come from the ui tokens so the
 * gauge reads on light skins too. A pure projection of the speed fraction.
 * (dynamic speed marker)
 */
export function SpeedGauge({ fraction, coolColor }: SpeedGaugeProps) {
  const { ui } = useTheme();
  const f = Math.max(0, Math.min(1, fraction));
  const color = mix(coolColor, ui.danger, f);
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: ui.surfaceRaised, borderColor: ui.border },
      ]}
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
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: { height: 9, borderRadius: 5 },
});
