import { InfoScreen } from '../src/screens/InfoScreen';
import { howToPlay } from '../src/legal/howToPlay';

/** Route: /how-to-play — linked from Settings. */
export default function HowToPlayRoute() {
  return <InfoScreen content={howToPlay} />;
}
