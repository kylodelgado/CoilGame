import { render, screen } from '@testing-library/react-native';
import { GpsArrow } from '../src/render/GpsArrow';
import { SkinProvider } from '../src/skins/SkinProvider';
import { computeViewport } from '../src/render/camera';
import type { Cell, WorldSpec } from '../src/engine/types';

const WORLD: WorldSpec = { worldColumns: 40, worldRows: 40, cellSize: 10 };
const HEAD: Cell = { x: 20, y: 20 };
const viewport = computeViewport(HEAD, WORLD, 12, 12);

const renderArrow = (food: Cell | null) =>
  render(
    <SkinProvider>
      <GpsArrow head={HEAD} food={food} viewport={viewport} />
    </SkinProvider>,
  );

describe('GpsArrow component', () => {
  it('renders the arrow when the food is off-screen', () => {
    renderArrow({ x: 38, y: 20 });
    expect(screen.getByTestId('gps-arrow')).toBeOnTheScreen();
  });

  it('hides the arrow when the food is within the viewport', () => {
    renderArrow({ x: 21, y: 21 });
    expect(screen.queryByTestId('gps-arrow')).toBeNull();
  });

  it('hides the arrow when there is no food', () => {
    renderArrow(null);
    expect(screen.queryByTestId('gps-arrow')).toBeNull();
  });
});
