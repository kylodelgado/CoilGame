import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccountScreen } from '../src/screens/AccountScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useAuthStore } from '../src/state/useAuthStore';
import { createInMemoryAuth } from '../src/services/AuthPort';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: false, error: null });
});

const renderAccount = (auth = createInMemoryAuth()) =>
  render(
    <SkinProvider>
      <AccountScreen auth={auth} />
    </SkinProvider>,
  );

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const press = async (testID: string) =>
  act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });

describe('AccountScreen (auth UI + gating)', () => {
  it('sign up success updates the store and shows the user', async () => {
    renderAccount();
    fill('account-email', 'a@b.com');
    fill('account-password', 'pw');
    fill('account-name', 'Ada');

    await press('signup-button');

    expect(useAuthStore.getState().user?.displayName).toBe('Ada');
    expect(screen.getByTestId('current-user')).toHaveTextContent('Ada');
    // The form is replaced by the signed-in view.
    expect(screen.queryByTestId('signup-button')).toBeNull();
  });

  it('sign in success after sign up shows the user', async () => {
    const auth = createInMemoryAuth();
    await auth.signUp('a@b.com', 'pw', 'Ada');
    await auth.signOut();
    renderAccount(auth);

    fill('account-email', 'a@b.com');
    fill('account-password', 'pw');
    await press('signin-button');

    expect(useAuthStore.getState().user?.displayName).toBe('Ada');
    expect(screen.getByTestId('current-user')).toHaveTextContent('Ada');
  });

  it('a rejected sign in renders an error and leaves the user signed out', async () => {
    renderAccount();
    fill('account-email', 'nobody@b.com');
    fill('account-password', 'pw');

    await press('signin-button');

    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByTestId('auth-error')).toBeOnTheScreen();
    expect(screen.getByTestId('signin-button')).toBeOnTheScreen(); // still on the form
  });

  it('continue anonymously yields an anonymous user', async () => {
    renderAccount();
    await press('anon-button');

    expect(useAuthStore.getState().user?.isAnonymous).toBe(true);
    expect(screen.getByTestId('current-user')).toHaveTextContent('Anonymous');
  });

  it('sign out clears the user', async () => {
    renderAccount();
    await press('anon-button');
    expect(useAuthStore.getState().user).not.toBeNull();

    await press('signout-button');
    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByTestId('anon-button')).toBeOnTheScreen(); // back to the form
  });
});
