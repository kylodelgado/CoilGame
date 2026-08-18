import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AdBanner, AD_BANNER_HEIGHT } from '../src/monetization/AdBanner';
import { StoreScreen } from '../src/screens/StoreScreen';
import {
  MOCK_PREMIUM_PRODUCT,
  PREMIUM_PRODUCT_ID,
} from '../src/services/PurchasesPort';
import { useEntitlementsStore } from '../src/state/useEntitlementsStore';
import { SkinProvider } from '../src/skins/SkinProvider';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
}));

// Deterministic, delay-free purchases singleton for screen tests.
const mockGetProducts = jest.fn();
const mockPurchase = jest.fn();
const mockRestoreConvenience = jest.fn();
jest.mock('../src/services/purchasesInstance', () => ({
  appPurchases: {
    initialize: () => Promise.resolve(),
    getProducts: (...args: unknown[]) => mockGetProducts(...args),
    purchase: (...args: unknown[]) => mockPurchase(...args),
    restorePurchases: () => Promise.resolve([]),
  },
  purchasesMode: 'mock',
  getMonetizationMode: () => 'mock',
  restorePurchases: (...args: unknown[]) => mockRestoreConvenience(...args),
}));

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

/** Render and flush the async product load so no state lands outside act. */
const wrapSettled = async (node: React.ReactElement) => {
  const result = wrap(node);
  await act(async () => {});
  return result;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue([{ ...MOCK_PREMIUM_PRODUCT }]);
  mockPurchase.mockResolvedValue('purchased');
  mockRestoreConvenience.mockResolvedValue([]);
  useEntitlementsStore.setState({
    premium: false,
    purchasedIds: [],
    hydrated: true,
  });
});

describe('StoreScreen', () => {
  it('renders the hero, all three benefits, and the store-data price', async () => {
    wrap(<StoreScreen />);

    expect(screen.getByTestId('store-hero')).toHaveTextContent('Coil Premium');
    expect(screen.getByText(/no ads/i)).toBeOnTheScreen();
    expect(screen.getByText(/instant revives/i)).toBeOnTheScreen();
    expect(screen.getByText(/support development/i)).toBeOnTheScreen();

    // Price arrives async from getProducts.
    await waitFor(() =>
      expect(screen.getByTestId('store-buy-button')).toHaveTextContent(/2\.99/),
    );
  });

  it('purchase success grants premium and shows the celebratory state', async () => {
    wrap(<StoreScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('store-buy-button')).toHaveTextContent(/2\.99/),
    );

    fireEvent.press(screen.getByTestId('store-buy-button'));

    await waitFor(() =>
      expect(screen.getByTestId('store-success')).toBeOnTheScreen(),
    );
    expect(screen.getByText(/welcome to premium/i)).toBeOnTheScreen();
    expect(mockPurchase).toHaveBeenCalledWith(PREMIUM_PRODUCT_ID);
    expect(useEntitlementsStore.getState().premium).toBe(true);
    // The buy button is gone once premium.
    expect(screen.queryByTestId('store-buy-button')).toBeNull();
  });

  it('a cancelled purchase shows a quiet notice and does NOT grant premium', async () => {
    mockPurchase.mockResolvedValue('cancelled');
    wrap(<StoreScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('store-buy-button')).toHaveTextContent(/2\.99/),
    );

    fireEvent.press(screen.getByTestId('store-buy-button'));

    await waitFor(() =>
      expect(screen.getByTestId('store-cancelled')).toBeOnTheScreen(),
    );
    expect(useEntitlementsStore.getState().premium).toBe(false);
  });

  it('a failed purchase shows a retryable error and does NOT grant premium', async () => {
    mockPurchase.mockResolvedValue('failed');
    wrap(<StoreScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('store-buy-button')).toHaveTextContent(/2\.99/),
    );

    fireEvent.press(screen.getByTestId('store-buy-button'));

    await waitFor(() =>
      expect(screen.getByTestId('store-error')).toBeOnTheScreen(),
    );
    expect(useEntitlementsStore.getState().premium).toBe(false);
  });

  it('an already-premium player sees the owned state instead of a buy button', async () => {
    useEntitlementsStore.setState({ premium: true });
    await wrapSettled(<StoreScreen />);

    expect(screen.getByTestId('store-success')).toBeOnTheScreen();
    expect(screen.getByText(/you own coil premium/i)).toBeOnTheScreen();
    expect(screen.queryByTestId('store-buy-button')).toBeNull();
    // Restore stays available (e.g. to sync another product later).
    expect(screen.getByTestId('store-restore')).toBeOnTheScreen();
  });

  it('Restore reports success when coil.premium comes back', async () => {
    mockRestoreConvenience.mockResolvedValue([PREMIUM_PRODUCT_ID]);
    await wrapSettled(<StoreScreen />);

    fireEvent.press(screen.getByTestId('store-restore'));

    await waitFor(() =>
      expect(screen.getByTestId('store-restored')).toBeOnTheScreen(),
    );
    expect(mockRestoreConvenience).toHaveBeenCalledTimes(1);
  });

  it('Restore reports "nothing found" when the store returns no purchases', async () => {
    mockRestoreConvenience.mockResolvedValue([]);
    await wrapSettled(<StoreScreen />);

    fireEvent.press(screen.getByTestId('store-restore'));

    await waitFor(() =>
      expect(screen.getByTestId('store-restore-empty')).toBeOnTheScreen(),
    );
  });

  it('legal fine print links to /legal/terms and /legal/privacy', async () => {
    await wrapSettled(<StoreScreen />);

    fireEvent.press(screen.getByTestId('store-legal-terms'));
    expect(mockPush).toHaveBeenCalledWith('/legal/terms');

    fireEvent.press(screen.getByTestId('store-legal-privacy'));
    expect(mockPush).toHaveBeenCalledWith('/legal/privacy');
  });

  it('Back navigates back', async () => {
    await wrapSettled(<StoreScreen />);
    fireEvent.press(screen.getByTestId('store-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('AdBanner', () => {
  it('renders the truthful mock placeholder for free players', () => {
    wrap(<AdBanner />);
    expect(screen.getByTestId('ad-banner-mock')).toBeOnTheScreen();
    expect(screen.getByText('Ad')).toBeOnTheScreen();
    expect(screen.getByText(/your ad here · mock/i)).toBeOnTheScreen();
  });

  it('reserves the exact adaptive-banner height so layout is truthful', () => {
    wrap(<AdBanner />);
    expect(screen.getByTestId('ad-banner-mock')).toHaveStyle({
      height: AD_BANNER_HEIGHT,
    });
    expect(AD_BANNER_HEIGHT).toBe(60);
  });

  it('renders NOTHING for premium players — no reserved space', () => {
    useEntitlementsStore.setState({ premium: true });
    const { toJSON } = render(<AdBanner />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('ad-banner-mock')).toBeNull();
    expect(screen.queryByTestId('ad-banner-real')).toBeNull();
  });
});
