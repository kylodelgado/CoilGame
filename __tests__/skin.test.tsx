import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SkinProvider, useSkin } from '../src/skins/SkinProvider';
import { greenOnBlack } from '../src/skins/greenOnBlack';
import type { Skin } from '../src/skins/Skin';

function Probe() {
  const skin = useSkin();
  return <Text testID="skin-json">{JSON.stringify(skin)}</Text>;
}

describe('skin system (FR-A4/A5)', () => {
  it('useSkin returns greenOnBlack tokens inside SkinProvider with no override', () => {
    render(
      <SkinProvider>
        <Probe />
      </SkinProvider>,
    );
    const rendered = JSON.parse(screen.getByTestId('skin-json').props.children);
    expect(rendered).toEqual(greenOnBlack);
  });

  it('honors an explicit skin override on the provider', () => {
    const custom: Skin = { ...greenOnBlack, id: 'custom', foodColor: '#ff0000' };
    render(
      <SkinProvider skin={custom}>
        <Probe />
      </SkinProvider>,
    );
    const rendered = JSON.parse(screen.getByTestId('skin-json').props.children);
    expect(rendered.id).toBe('custom');
    expect(rendered.foodColor).toBe('#ff0000');
  });

  it('renders the head visibly brighter than the body (head !== body)', () => {
    // Intent: the head must read as distinct from the body, so the player can
    // always locate it. We assert inequality as the testable proxy for that.
    expect(greenOnBlack.snakeHead).not.toBe(greenOnBlack.snakeBody);
  });

  it('has all required Skin fields with the correct types', () => {
    const s = greenOnBlack;
    expect(typeof s.id).toBe('string');
    expect(typeof s.background).toBe('string');
    expect(s.gridLine === null || typeof s.gridLine === 'string').toBe(true);
    expect(typeof s.cellGap).toBe('number');
    expect(['square', 'rounded']).toContain(s.cellShape);
    expect(typeof s.snakeHead).toBe('string');
    expect(typeof s.snakeBody).toBe('string');
    expect(typeof s.foodColor).toBe('string');
    expect(['square', 'circle']).toContain(s.foodShape);
  });
});
