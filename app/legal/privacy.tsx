import { InfoScreen } from '../../src/screens/InfoScreen';
import { privacyPolicy } from '../../src/legal/privacyPolicy';

/** Route: /legal/privacy — linked from Settings. */
export default function PrivacyRoute() {
  return <InfoScreen content={privacyPolicy} />;
}
