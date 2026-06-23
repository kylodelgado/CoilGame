import { act } from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SkinProvider, useSkin } from '../src/skins/SkinProvider';
import { getSkin } from '../src/skins/registry';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';

function Probe() {
  const skin = useSkin();
  return <Text testID="skin-id">{skin.id}</Text>;
}

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: false });
});

describe('SkinProvider driven by the settings store (Prompt 33)', () => {
  it('returns the skin matching the store skinId', () => {
    useSettingsStore.setState({ skinId: 'neon' });
    render(
      <SkinProvider>
        <Probe />
      </SkinProvider>,
    );
    expect(screen.getByTestId('skin-id')).toHaveTextContent(getSkin('neon').id);
  });

  it('defaults to greenOnBlack before hydration', () => {
    render(
      <SkinProvider>
        <Probe />
      </SkinProvider>,
    );
    expect(screen.getByTestId('skin-id')).toHaveTextContent('greenOnBlack');
  });

  it('flips the value returned to consumers when skinId changes in the store', () => {
    render(
      <SkinProvider>
        <Probe />
      </SkinProvider>,
    );
    expect(screen.getByTestId('skin-id')).toHaveTextContent('greenOnBlack');

    act(() => {
      useSettingsStore.setState({ skinId: 'amberCrt' });
    });
    expect(screen.getByTestId('skin-id')).toHaveTextContent('amberCrt');
  });

  it('still honors an explicit skin override on the provider', () => {
    useSettingsStore.setState({ skinId: 'neon' });
    render(
      <SkinProvider skin={getSkin('monoLcd')}>
        <Probe />
      </SkinProvider>,
    );
    // Explicit prop wins over the store so swatches can preview a fixed skin.
    expect(screen.getByTestId('skin-id')).toHaveTextContent('monoLcd');
  });
});
