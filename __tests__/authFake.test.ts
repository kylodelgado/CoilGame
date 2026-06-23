import { createInMemoryAuth, type AuthUser } from '../src/services/AuthPort';

describe('createInMemoryAuth (in-memory fake)', () => {
  it('signInAnonymously yields an anonymous user and sets current', async () => {
    const auth = createInMemoryAuth();
    expect(auth.getCurrentUser()).toBeNull();

    const user = await auth.signInAnonymously();
    expect(user.isAnonymous).toBe(true);
    expect(user.displayName).toBeNull();
    expect(typeof user.uid).toBe('string');
    expect(auth.getCurrentUser()).toEqual(user);
  });

  it('signUp yields a named, non-anonymous user that signIn can return', async () => {
    const auth = createInMemoryAuth();

    const created = await auth.signUp('a@b.com', 'pw', 'Ada');
    expect(created.isAnonymous).toBe(false);
    expect(created.displayName).toBe('Ada');
    expect(auth.getCurrentUser()).toEqual(created);

    await auth.signOut();
    expect(auth.getCurrentUser()).toBeNull();

    const signedIn = await auth.signIn('a@b.com', 'pw');
    expect(signedIn.uid).toBe(created.uid);
    expect(signedIn.displayName).toBe('Ada');
  });

  it('signIn rejects on unknown email or wrong password', async () => {
    const auth = createInMemoryAuth();
    await auth.signUp('a@b.com', 'pw', 'Ada');

    await expect(auth.signIn('nobody@b.com', 'pw')).rejects.toThrow();
    await expect(auth.signIn('a@b.com', 'wrong')).rejects.toThrow();
  });

  it('onAuthChange fires on changes and stops after unsubscribe', async () => {
    const auth = createInMemoryAuth();
    const seen: Array<AuthUser | null> = [];
    const unsubscribe = auth.onAuthChange((u) => seen.push(u));

    const anon = await auth.signInAnonymously();
    expect(seen).toEqual([anon]);

    await auth.signOut();
    expect(seen).toEqual([anon, null]);

    unsubscribe();
    await auth.signInAnonymously();
    expect(seen).toEqual([anon, null]); // no further deliveries
  });

  it('getCurrentUser reflects the latest state and signOut clears it', async () => {
    const auth = createInMemoryAuth();
    await auth.signUp('a@b.com', 'pw', 'Ada');
    expect(auth.getCurrentUser()?.displayName).toBe('Ada');

    await auth.signOut();
    expect(auth.getCurrentUser()).toBeNull();
  });
});
