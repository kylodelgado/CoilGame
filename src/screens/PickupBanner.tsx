import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import type { PowerupKind } from '../engine/types';
import { POWERUP_META } from '../render/powerupMeta';

interface PickupBannerProps {
  /** The kind grabbed on the latest tick, or null. Each non-null value flashes. */
  pickup: PowerupKind | null;
}

const SHOW_MS = 1600;

/**
 * A brief, self-dismissing banner that announces what a just-grabbed powerup
 * does ("MAGNET — Food comes to you"). It latches the one-tick pickup signal and
 * fades itself out after SHOW_MS, so the player learns each powerup's effect even
 * for the instant ones that leave no HUD timer. Pure projection of the signal +
 * a local fade. (Phase 2 powerups)
 */
export function PickupBanner({ pickup }: PickupBannerProps) {
  const [shown, setShown] = useState<PowerupKind | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pickup == null) {
      return;
    }
    setShown(pickup);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start(() => setShown(null));
    }, SHOW_MS);
    // pickup is a one-tick signal; re-flash on every fresh non-null value.
  }, [pickup, opacity]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  if (shown == null) {
    return null;
  }
  const meta = POWERUP_META[shown];
  return (
    <Animated.View
      testID="pickup-banner"
      pointerEvents="none"
      style={[styles.banner, { borderColor: meta.color, opacity }]}
    >
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
      <Text style={styles.blurb}>{meta.blurb}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  label: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  blurb: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
});
