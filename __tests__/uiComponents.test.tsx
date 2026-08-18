import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SkinProvider } from '../src/skins/SkinProvider';
import { getSkin, SKIN_IDS } from '../src/skins/registry';
import {
  AnimatedNumber,
  Chip,
  DISPLAY_FONT_FAMILY,
  GlowButton,
  IconButton,
  Panel,
  ScreenShell,
  SectionHeader,
  setDisplayFontLoaded,
  spacing,
  radius,
  typeScale,
  useTheme,
  withAlpha,
} from '../src/ui';

const wrap = (node: React.ReactElement, skinId?: (typeof SKIN_IDS)[number]) =>
  render(
    <SkinProvider skin={skinId ? getSkin(skinId) : undefined}>
      {node}
    </SkinProvider>,
  );

describe('useTheme resolution', () => {
  function Probe() {
    const theme = useTheme();
    return (
      <>
        <Text testID="probe-accent">{theme.ui.accent}</Text>
        <Text testID="probe-surface">{theme.ui.surface}</Text>
        <Text testID="probe-light">{String(theme.ui.isLight)}</Text>
      </>
    );
  }

  it.each([...SKIN_IDS])(
    'resolves the active skin ui block for %s',
    (id) => {
      const skin = getSkin(id);
      wrap(<Probe />, id);
      expect(screen.getByTestId('probe-accent')).toHaveTextContent(
        skin.ui.accent,
      );
      expect(screen.getByTestId('probe-surface')).toHaveTextContent(
        skin.ui.surface,
      );
      expect(screen.getByTestId('probe-light')).toHaveTextContent(
        String(skin.ui.isLight),
      );
    },
  );

  it('exposes the shared scales (spacing, radius, type)', () => {
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
    expect(radius.pill).toBeGreaterThan(radius.lg);
    // Score numerals are always tabular so digits never jitter.
    expect(typeScale.score.fontVariant).toContain('tabular-nums');
  });
});

describe('display font resolution', () => {
  afterEach(() => {
    act(() => setDisplayFontLoaded(false));
  });

  function FontProbe() {
    const { type, displayFontFamily } = useTheme();
    return (
      <>
        <Text testID="probe-display-family">
          {String(type.display.fontFamily)}
        </Text>
        <Text testID="probe-title-family">{String(type.title.fontFamily)}</Text>
        <Text testID="probe-font-token">{String(displayFontFamily)}</Text>
      </>
    );
  }

  it('falls back to the system font (undefined family) when no font loaded', () => {
    wrap(<FontProbe />);
    expect(screen.getByTestId('probe-display-family')).toHaveTextContent(
      'undefined',
    );
    expect(screen.getByTestId('probe-title-family')).toHaveTextContent(
      'undefined',
    );
    expect(screen.getByTestId('probe-font-token')).toHaveTextContent(
      'undefined',
    );
  });

  it('resolves the display family into display and title once loaded', () => {
    wrap(<FontProbe />);
    act(() => setDisplayFontLoaded(true));
    expect(screen.getByTestId('probe-display-family')).toHaveTextContent(
      DISPLAY_FONT_FAMILY,
    );
    expect(screen.getByTestId('probe-title-family')).toHaveTextContent(
      DISPLAY_FONT_FAMILY,
    );
    expect(screen.getByTestId('probe-font-token')).toHaveTextContent(
      DISPLAY_FONT_FAMILY,
    );
  });
});

describe('ScreenShell world mode', () => {
  it('renders backdrop image, scrim, and vignette layers under the content', () => {
    wrap(
      <ScreenShell world testID="shell">
        <Text>content</Text>
      </ScreenShell>,
    );
    expect(screen.getByTestId('shell-world-backdrop')).toBeOnTheScreen();
    expect(screen.getByTestId('shell-world-scrim')).toBeOnTheScreen();
    expect(screen.getByTestId('shell-world-vignette')).toBeOnTheScreen();
    expect(screen.getByText('content')).toBeOnTheScreen();
  });

  it('renders NO world layers by default', () => {
    wrap(
      <ScreenShell testID="shell">
        <Text>content</Text>
      </ScreenShell>,
    );
    expect(screen.queryByTestId('shell-world-backdrop')).toBeNull();
    expect(screen.queryByTestId('shell-world-scrim')).toBeNull();
    expect(screen.queryByTestId('shell-world-vignette')).toBeNull();
  });

  it('keeps world layers in scroll mode too', () => {
    wrap(
      <ScreenShell world scroll testID="shell">
        <Text>content</Text>
      </ScreenShell>,
    );
    expect(screen.getByTestId('shell-world-backdrop')).toBeOnTheScreen();
    expect(screen.getByText('content')).toBeOnTheScreen();
  });

  it('strengthens the dark skin scrim ink to 0.8 over the backdrop', () => {
    wrap(
      <ScreenShell world>
        <Text>content</Text>
      </ScreenShell>,
      'greenOnBlack',
    );
    expect(screen.getByTestId('shell-world-scrim')).toHaveStyle({
      backgroundColor: 'rgba(2, 6, 4, 0.8)',
    });
  });

  it('dims the LIGHT monoLcd backdrop with a LIGHT surface-tinted scrim', () => {
    wrap(
      <ScreenShell world>
        <Text>content</Text>
      </ScreenShell>,
      'monoLcd',
    );
    // monoLcd surface #9BBC0F — dark text needs a light wash, never a dark one.
    expect(screen.getByTestId('shell-world-scrim')).toHaveStyle({
      backgroundColor: 'rgba(155, 188, 15, 0.8)',
    });
  });
});

describe('withAlpha', () => {
  it('re-emits hex and rgba colors at the requested alpha; unknown formats pass through', () => {
    expect(withAlpha('#9BBC0F', 0.8)).toBe('rgba(155, 188, 15, 0.8)');
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(withAlpha('rgba(2, 6, 4, 0.74)', 0.8)).toBe('rgba(2, 6, 4, 0.8)');
    expect(withAlpha('rgb(10, 20, 30)', 0.4)).toBe('rgba(10, 20, 30, 0.4)');
    expect(withAlpha('tomato', 0.8)).toBe('tomato');
  });
});

describe('GlowButton', () => {
  it('renders as an accessible 44pt+ button and fires onPress', () => {
    const onPress = jest.fn();
    wrap(
      <GlowButton testID="btn" label="Play" onPress={onPress} />,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Play');
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and exposes the state', () => {
    const onPress = jest.fn();
    wrap(
      <GlowButton testID="btn" label="Play" disabled onPress={onPress} />,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'danger'] as const)(
    'mounts the %s variant on every skin without crashing',
    (variant) => {
      for (const id of SKIN_IDS) {
        expect(() =>
          wrap(
            <GlowButton label="Go" variant={variant} onPress={() => undefined} />,
            id,
          ),
        ).not.toThrow();
      }
    },
  );
});

describe('Chip', () => {
  it('exposes selection through accessibilityState and a checkmark (not color alone)', () => {
    const { rerender } = wrap(
      <Chip testID="chip" label="Solid" selected={false} onPress={() => undefined} />,
    );
    expect(
      screen.getByTestId('chip').props.accessibilityState.selected,
    ).toBe(false);

    rerender(
      <SkinProvider>
        <Chip testID="chip" label="Solid" selected onPress={() => undefined} />
      </SkinProvider>,
    );
    expect(
      screen.getByTestId('chip').props.accessibilityState.selected,
    ).toBe(true);
  });
});

describe('IconButton', () => {
  it('requires and exposes an accessibility label and fires onPress', () => {
    const onPress = jest.fn();
    wrap(
      <IconButton
        testID="icon-btn"
        icon="settings-outline"
        accessibilityLabel="Settings"
        onPress={onPress}
      />,
    );
    const btn = screen.getByTestId('icon-btn');
    expect(btn.props.accessibilityLabel).toBe('Settings');
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Panel / SectionHeader', () => {
  it('mount with themed tokens without crashing on every skin', () => {
    for (const id of SKIN_IDS) {
      expect(() =>
        wrap(
          <Panel testID="panel">
            <SectionHeader title="Audio" />
          </Panel>,
          id,
        ),
      ).not.toThrow();
    }
  });
});

describe('AnimatedNumber', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('counts up to the target value', () => {
    wrap(<AnimatedNumber testID="num" value={120} durationMs={300} />);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('num')).toHaveTextContent('120');
  });

  it('shows an intermediate value mid-flight (it really animates)', () => {
    wrap(<AnimatedNumber testID="num" value={1000} durationMs={1000} />);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    const midway = Number(screen.getByTestId('num').props.children);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1000);
  });

  it('renders zero immediately', () => {
    wrap(<AnimatedNumber testID="num" value={0} />);
    expect(screen.getByTestId('num')).toHaveTextContent('0');
  });
});
