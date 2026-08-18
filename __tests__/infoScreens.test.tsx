import { render, screen, fireEvent } from '@testing-library/react-native';
import { InfoScreen } from '../src/screens/InfoScreen';
import type { InfoContent } from '../src/legal/InfoContent';
import { privacyPolicy } from '../src/legal/privacyPolicy';
import { termsOfService } from '../src/legal/termsOfService';
import { howToPlay } from '../src/legal/howToPlay';
import { LICENSES } from '../src/legal/licenses.gen';
import PrivacyRoute from '../app/legal/privacy';
import TermsRoute from '../app/legal/terms';
import LicensesRoute from '../app/legal/licenses';
import HowToPlayRoute from '../app/how-to-play';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({}),
  Stack: Object.assign(() => null, { Screen: () => null }),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InfoScreen', () => {
  const sample: InfoContent = {
    title: 'Sample Document',
    effectiveDate: 'August 17, 2026',
    sections: [
      { heading: 'First Section', paragraphs: ['Alpha paragraph.', 'Beta paragraph.'] },
      { heading: 'Second Section', paragraphs: ['Gamma paragraph.'] },
    ],
  };

  it('renders the title, effective date, and every section heading and paragraph', () => {
    render(<InfoScreen content={sample} />);

    expect(screen.getByTestId('info-title')).toHaveTextContent('Sample Document');
    expect(screen.getByText('Effective August 17, 2026')).toBeOnTheScreen();
    expect(screen.getByText('First Section')).toBeOnTheScreen();
    expect(screen.getByText('Second Section')).toBeOnTheScreen();
    expect(screen.getByText('Alpha paragraph.')).toBeOnTheScreen();
    expect(screen.getByText('Beta paragraph.')).toBeOnTheScreen();
    expect(screen.getByText('Gamma paragraph.')).toBeOnTheScreen();
  });

  it('omits the effective-date line when the content has none', () => {
    const { effectiveDate: _omit, ...rest } = sample;
    render(<InfoScreen content={rest} />);
    expect(screen.queryByText(/^Effective /)).toBeNull();
  });

  it('navigates back from the labeled back button', () => {
    render(<InfoScreen content={sample} />);
    fireEvent.press(screen.getByTestId('info-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('info routes', () => {
  it('mounts /legal/privacy with the privacy policy content', () => {
    render(<PrivacyRoute />);
    expect(screen.getByTestId('info-title')).toHaveTextContent(privacyPolicy.title);
    expect(
      screen.getByText('The "GPS" mode uses no location'),
    ).toBeOnTheScreen();
  });

  it('mounts /legal/terms with the terms content', () => {
    render(<TermsRoute />);
    expect(screen.getByTestId('info-title')).toHaveTextContent(termsOfService.title);
    expect(screen.getByText('Leaderboard fair play')).toBeOnTheScreen();
  });

  it('mounts /how-to-play with the guide content', () => {
    render(<HowToPlayRoute />);
    expect(screen.getByTestId('info-title')).toHaveTextContent(howToPlay.title);
    expect(screen.getByText('The three modes')).toBeOnTheScreen();
  });

  it('mounts /legal/licenses and lists every generated package', () => {
    render(<LicensesRoute />);
    expect(screen.getByTestId('info-title')).toHaveTextContent('Open-Source Licenses');
    // Spot-check a package that must ship with the app.
    expect(screen.getByText(/^react-native \d/)).toBeOnTheScreen();
  });
});

describe('legal content invariants', () => {
  it('generated licenses list is non-empty and every entry has a license string', () => {
    expect(LICENSES.length).toBeGreaterThan(0);
    for (const entry of LICENSES) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.license).toBe('string');
      expect(entry.license.length).toBeGreaterThan(0);
    }
  });

  it('legal documents carry the effective date and contact address', () => {
    for (const doc of [privacyPolicy, termsOfService]) {
      expect(doc.effectiveDate).toBe('August 17, 2026');
      const text = doc.sections.flatMap((s) => s.paragraphs).join(' ');
      expect(text).toContain('brandonbay9703@gmail.com');
    }
  });

  it('the terms flag the jurisdiction placeholder for the owner to fill', () => {
    const text = termsOfService.sections.flatMap((s) => s.paragraphs).join(' ');
    expect(text).toContain('[JURISDICTION]');
  });
});
