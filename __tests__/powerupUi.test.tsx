import { render } from '@testing-library/react-native';
import { SkinProvider } from '../src/skins/SkinProvider';
import { PowerupGlyph } from '../src/render/PowerupGlyph';
import { BurstField } from '../src/render/BurstField';
import { ActiveEffectsHud } from '../src/screens/ActiveEffectsHud';
import { PickupBanner } from '../src/screens/PickupBanner';
import { POWERUP_META } from '../src/render/powerupMeta';
import type { ActiveEffect, PowerupKind } from '../src/engine/types';

// Skia + Reanimated are stubbed globally in jest.setup.js.

const ALL_KINDS = Object.keys(POWERUP_META) as PowerupKind[];

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

describe('PowerupGlyph', () => {
  it.each(ALL_KINDS)('renders a glyph for %s without crashing', (kind) => {
    expect(() => wrap(<PowerupGlyph kind={kind} cx={10} cy={10} r={6} />)).not.toThrow();
  });
});

describe('BurstField', () => {
  it('mounts with no spawns and with a batch of spawns without crashing', () => {
    expect(() => render(<BurstField spawns={[]} color="#fff" size={6} />)).not.toThrow();
    expect(() =>
      render(
        <BurstField
          spawns={[
            { x: 10, y: 10 },
            { x: 30, y: 20 },
          ]}
          color="#FF8A3D"
          size={6}
        />,
      ),
    ).not.toThrow();
  });
});

describe('ActiveEffectsHud', () => {
  it('renders nothing when there are no active effects', () => {
    const { queryByTestId } = render(<ActiveEffectsHud effects={[]} />);
    expect(queryByTestId('active-effects')).toBeNull();
  });

  it('renders a chip per active timed effect', () => {
    const effects: ActiveEffect[] = [
      { kind: 'MAGNET', remainingTicks: 20, totalTicks: 40 },
      { kind: 'DOUBLE', remainingTicks: 5, totalTicks: 40 },
    ];
    const { getByTestId } = render(<ActiveEffectsHud effects={effects} />);
    expect(getByTestId('active-effects')).toBeTruthy();
    expect(getByTestId('effect-MAGNET')).toBeTruthy();
    expect(getByTestId('effect-DOUBLE')).toBeTruthy();
  });
});

describe('PickupBanner', () => {
  it('shows the label and blurb when a powerup is grabbed', () => {
    const { getByTestId, getByText } = render(<PickupBanner pickup="MAGNET" />);
    expect(getByTestId('pickup-banner')).toBeTruthy();
    expect(getByText(POWERUP_META.MAGNET.label)).toBeTruthy();
    expect(getByText(POWERUP_META.MAGNET.blurb)).toBeTruthy();
  });

  it('renders nothing when there is no pickup', () => {
    const { queryByTestId } = render(<PickupBanner pickup={null} />);
    expect(queryByTestId('pickup-banner')).toBeNull();
  });
});
