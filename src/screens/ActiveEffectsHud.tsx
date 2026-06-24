import { StyleSheet, Text, View } from 'react-native';
import type { ActiveEffect } from '../engine/types';
import { POWERUP_META } from '../render/powerupMeta';

interface ActiveEffectsHudProps {
  effects: ActiveEffect[];
}

/**
 * A compact row of chips, one per active timed powerup, each showing the kind's
 * accent color + label and a countdown bar that drains as the effect's remaining
 * ticks fall toward zero. This is the "how much time is left" surface; the bar is
 * a pure projection of remainingTicks/totalTicks. Renders nothing when idle.
 * (Phase 2 powerups)
 */
export function ActiveEffectsHud({ effects }: ActiveEffectsHudProps) {
  if (effects.length === 0) {
    return null;
  }
  return (
    <View style={styles.row} testID="active-effects">
      {effects.map((e) => {
        const meta = POWERUP_META[e.kind];
        const fraction = Math.max(
          0,
          Math.min(1, e.remainingTicks / e.totalTicks),
        );
        return (
          <View
            key={e.kind}
            testID={`effect-${e.kind}`}
            style={[styles.chip, { borderColor: meta.color }]}
          >
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.label, { color: meta.color }]} numberOfLines={1}>
              {meta.label}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: meta.color, width: `${fraction * 100}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  track: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2 },
});
