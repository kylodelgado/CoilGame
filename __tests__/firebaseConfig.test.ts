import Constants from 'expo-constants';
import { readFirebaseConfig } from '../src/services/firebaseConfig';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

const setExtra = (extra: unknown) => {
  (Constants as unknown as { expoConfig: { extra: unknown } }).expoConfig = {
    extra,
  } as never;
};

describe('readFirebaseConfig', () => {
  it('returns the config when all required keys are present', () => {
    setExtra({
      firebase: {
        apiKey: 'k',
        authDomain: 'd',
        projectId: 'p',
        appId: 'a',
      },
    });
    expect(readFirebaseConfig()).toEqual({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      appId: 'a',
    });
  });

  it('returns null when the firebase block is missing', () => {
    setExtra({});
    expect(readFirebaseConfig()).toBeNull();
  });

  it('returns null when a required key is missing or empty', () => {
    setExtra({ firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p' } });
    expect(readFirebaseConfig()).toBeNull();
    setExtra({
      firebase: { apiKey: '', authDomain: 'd', projectId: 'p', appId: 'a' },
    });
    expect(readFirebaseConfig()).toBeNull();
  });
});
