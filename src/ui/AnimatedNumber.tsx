import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

interface AnimatedNumberProps {
  value: number;
  /** Count-up duration; ignored under Reduce Motion (renders statically). */
  durationMs?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const FRAME_MS = 33; // ~30fps is plenty for a numeral ticker

/**
 * A score numeral that counts up from 0 to `value` with an ease-out curve.
 * Always renders tabular numerals so the digits never jitter horizontally.
 * Under Reduce Motion (or for zero) it renders the final value immediately.
 */
export function AnimatedNumber({
  value,
  durationMs = 700,
  style,
  testID,
  accessibilityLabel,
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reducedMotion || value <= 0 || durationMs <= 0) {
      setDisplay(value);
      return undefined;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(value * eased));
      if (t >= 1) {
        clearInterval(id);
      }
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [value, durationMs, reducedMotion]);

  return (
    <Text
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? String(value)}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
    >
      {display}
    </Text>
  );
}
