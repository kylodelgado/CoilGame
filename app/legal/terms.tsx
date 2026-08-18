import { InfoScreen } from '../../src/screens/InfoScreen';
import { termsOfService } from '../../src/legal/termsOfService';

/** Route: /legal/terms — linked from Settings. */
export default function TermsRoute() {
  return <InfoScreen content={termsOfService} />;
}
