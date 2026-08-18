import { render } from '@testing-library/react-native';
import * as Skia from '@shopify/react-native-skia';
import {
  getArrowSprite,
  getBonusSprite,
  getFoodSprite,
  getPowerupSprite,
  getWallSprite,
  wallVariant,
} from '../src/render/propSprites';
import { PowerupGlyph } from '../src/render/PowerupGlyph';
import { POWERUP_META } from '../src/render/powerupMeta';
import { SkinProvider } from '../src/skins/SkinProvider';
import type { PowerupKind } from '../src/engine/types';

// Skia + Reanimated are stubbed globally in jest.setup.js. The stubbed
// useImage returns a decoded stand-in, so sprite branches render by default;
// individual tests spy it to null to exercise the vector fallbacks.

const ALL_KINDS = Object.keys(POWERUP_META) as PowerupKind[];

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

afterEach(() => {
  jest.restoreAllMocks();
  (Skia as unknown as { __setImagesDecoded(v: boolean): void }).__setImagesDecoded(true);
});

describe('propSprites mapping', () => {
  it('maps food, bonus and arrow to assets', () => {
    expect(getFoodSprite()).toBeTruthy();
    expect(getBonusSprite()).toBeTruthy();
    expect(getArrowSprite()).toBeTruthy();
  });

  it.each(ALL_KINDS)('maps powerup kind %s to a medallion asset', (kind) => {
    expect(getPowerupSprite(kind)).toBeTruthy();
  });

  it('maps every powerup kind to its OWN asset (WALL_BUSTER → pu_wallbuster)', () => {
    const sources = ALL_KINDS.map((kind) => getPowerupSprite(kind));
    expect(new Set(sources).size).toBe(ALL_KINDS.length);
  });

  it('the POINTS medallion is not the scarab (board bonus vs HUD chip art)', () => {
    expect(getPowerupSprite('POINTS')).not.toBe(getBonusSprite());
  });

  it('maps the three wall variants to three distinct assets', () => {
    const walls = [getWallSprite(0), getWallSprite(1), getWallSprite(2)];
    walls.forEach((w) => expect(w).toBeTruthy());
    expect(new Set(walls).size).toBe(3);
  });
});

describe('wallVariant hash', () => {
  it('is deterministic: the same cell always gets the same variant', () => {
    for (let y = -3; y < 20; y++) {
      for (let x = -3; x < 20; x++) {
        expect(wallVariant(x, y)).toBe(wallVariant(x, y));
      }
    }
  });

  it('always returns a valid variant index (0, 1 or 2)', () => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        expect([0, 1, 2]).toContain(wallVariant(x, y));
      }
    }
  });

  it('uses all three variants across a board-sized sweep', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        seen.add(wallVariant(x, y));
      }
    }
    expect(seen.size).toBe(3);
  });

  it('varies along a straight run of wall (no visible tiling)', () => {
    const row = Array.from({ length: 12 }, (_, x) => wallVariant(x, 5));
    const col = Array.from({ length: 12 }, (_, y) => wallVariant(5, y));
    expect(new Set(row).size).toBeGreaterThan(1);
    expect(new Set(col).size).toBeGreaterThan(1);
  });
});

describe('PowerupGlyph sprite/vector modes', () => {
  it.each(ALL_KINDS)(
    'renders the medallion sprite for %s once decoded',
    (kind) => {
      const { queryByTestId } = wrap(
        <PowerupGlyph kind={kind} cx={10} cy={10} r={6} />,
      );
      const node = queryByTestId(`powerup-sprite-${kind}`);
      expect(node).not.toBeNull();
      // Drawn to (over)fill the glyph's 2r footprint, centered on (cx, cy).
      const width = node!.props['data-width'] as number;
      const x = node!.props['data-x'] as number;
      expect(width).toBeGreaterThanOrEqual(12);
      expect(x).toBeCloseTo(10 - width / 2);
    },
  );

  it('vector prop forces the legacy shape even when the sprite is decoded', () => {
    const { queryByTestId } = wrap(
      <PowerupGlyph kind="POINTS" cx={10} cy={10} r={6} vector />,
    );
    expect(queryByTestId('powerup-sprite-POINTS')).toBeNull();
  });

  it.each(ALL_KINDS)(
    'falls back to the vector shape for %s while the sprite decodes',
    (kind) => {
      (
        Skia as unknown as { __setImagesDecoded(v: boolean): void }
      ).__setImagesDecoded(false);
      const { queryByTestId } = wrap(
        <PowerupGlyph kind={kind} cx={10} cy={10} r={6} />,
      );
      expect(queryByTestId(`powerup-sprite-${kind}`)).toBeNull();
    },
  );

  it('accepts a color override in vector mode (HUD chip tinting)', () => {
    expect(() =>
      wrap(
        <PowerupGlyph kind="MAGNET" cx={10} cy={10} r={6} color="#123456" vector />,
      ),
    ).not.toThrow();
  });
});
