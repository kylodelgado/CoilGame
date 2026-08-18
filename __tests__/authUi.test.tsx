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

// Valid credentials per client-side validation (password ≥ 8, name 3–20).
const EMAIL = 'a@b.com';
const PASSWORD = 'password1';
const NAME = 'Ada';

describe('AccountScreen (auth UI + gating)', () => {
  it('sign up success updates the store and shows the user', async () => {
    renderAccount();
    fill('account-email', EMAIL);
    fill('account-password', PASSWORD);
    fill('account-name', NAME);

    await press('signup-button');

    expect(useAuthStore.getState().user?.displayName).toBe('Ada');
    expect(screen.getByTestId('current-user')).toHaveTextContent('Ada');
    // The form is replaced by the signed-in view.
    expect(screen.queryByTestId('signup-button')).toBeNull();
  });

  it('sign in success after sign up shows the user', async () => {
    const auth = createInMemoryAuth();
    await auth.signUp(EMAIL, PASSWORD, NAME);
    await auth.signOut();
    renderAccount(auth);

    fill('account-email', EMAIL);
    fill('account-password', PASSWORD);
    await press('signin-button');

    expect(useAuthStore.getState().user?.displayName).toBe('Ada');
    expect(screen.getByTestId('current-user')).toHaveTextContent('Ada');
  });

  it('a rejected sign in renders a friendly error and leaves the user signed out', async () => {
    renderAccount();
    fill('account-email', 'nobody@b.com');
    fill('account-password', PASSWORD);

    await press('signin-button');

    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByTestId('auth-error')).toBeOnTheScreen();
    // The raw port message is mapped to friendly copy, not shown verbatim.
    expect(screen.queryByText('invalid email or password')).toBeNull();
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

  describe('client-side validation (never reaches the port)', () => {
    it('rejects a malformed email on sign up with an inline error', async () => {
      const auth = createInMemoryAuth();
      renderAccount(auth);
      fill('account-email', 'not-an-email');
      fill('account-password', PASSWORD);
      fill('account-name', NAME);

      await press('signup-button');

      expect(screen.getByTestId('field-error-email')).toBeOnTheScreen();
      expect(auth.getCurrentUser()).toBeNull(); // port never called
    });

    it('rejects a short password on sign up', async () => {
      renderAccount();
      fill('account-email', EMAIL);
      fill('account-password', 'short');
      fill('account-name', NAME);

      await press('signup-button');

      expect(screen.getByTestId('field-error-password')).toBeOnTheScreen();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('rejects a display name outside 3–20 characters', async () => {
      renderAccount();
      fill('account-email', EMAIL);
      fill('account-password', PASSWORD);
      fill('account-name', 'Ab');

      await press('signup-button');

      expect(screen.getByTestId('field-error-name')).toBeOnTheScreen();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('sign in does not enforce the sign-up password length, only presence', async () => {
      const auth = createInMemoryAuth();
      await auth.signUp(EMAIL, PASSWORD, NAME);
      await auth.signOut();
      renderAccount(auth);

      fill('account-email', EMAIL);
      // empty password: inline error, no port call
      await press('signin-button');
      expect(screen.getByTestId('field-error-password')).toBeOnTheScreen();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('delete account (double-confirm)', () => {
    it('deletes only after BOTH confirms; the account is really gone', async () => {
      const auth = createInMemoryAuth();
      renderAccount(auth);
      fill('account-email', EMAIL);
      fill('account-password', PASSWORD);
      fill('account-name', NAME);
      await press('signup-button');

      // Step 1: opens the first confirm — nothing deleted yet.
      await press('delete-account-button');
      expect(screen.getByTestId('delete-confirm-dialog')).toBeOnTheScreen();
      expect(useAuthStore.getState().user).not.toBeNull();

      // Step 2: continue to the final confirm — still nothing deleted.
      await press('delete-continue-button');
      expect(screen.getByTestId('delete-confirm-button')).toBeOnTheScreen();
      expect(useAuthStore.getState().user).not.toBeNull();

      // Final confirm: account removed and signed out.
      await press('delete-confirm-button');
      expect(useAuthStore.getState().user).toBeNull();
      expect(screen.getByTestId('anon-button')).toBeOnTheScreen();

      // Really deleted: the old credentials no longer sign in.
      await expect(auth.signIn(EMAIL, PASSWORD)).rejects.toThrow();
    });

    it('cancel at either step aborts without deleting', async () => {
      const auth = createInMemoryAuth();
      renderAccount(auth);
      fill('account-email', EMAIL);
      fill('account-password', PASSWORD);
      fill('account-name', NAME);
      await press('signup-button');

      await press('delete-account-button');
      await press('delete-cancel-button');
      expect(screen.queryByTestId('delete-confirm-dialog')).toBeNull();
      expect(useAuthStore.getState().user).not.toBeNull();

      await press('delete-account-button');
      await press('delete-continue-button');
      await press('delete-cancel-button');
      expect(screen.queryByTestId('delete-confirm-dialog')).toBeNull();
      expect(useAuthStore.getState().user).not.toBeNull();
    });
  });
});
