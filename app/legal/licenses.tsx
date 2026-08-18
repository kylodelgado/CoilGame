import { useMemo } from 'react';
import { InfoScreen } from '../../src/screens/InfoScreen';
import type { InfoContent } from '../../src/legal/InfoContent';
import { LICENSES } from '../../src/legal/licenses.gen';

/**
 * Route: /legal/licenses — linked from Settings. Renders the generated
 * open-source list (src/legal/licenses.gen.ts, produced by
 * tools/gen_licenses.js) through the shared InfoScreen: one line per package.
 */
export default function LicensesRoute() {
  const content = useMemo<InfoContent>(
    () => ({
      title: 'Open-Source Licenses',
      sections: [
        {
          heading: 'Coil is built on open source',
          paragraphs: [
            'These packages ship inside the app. Each is listed with its version and license. Thank you to their maintainers.',
          ],
        },
        {
          heading: 'Packages',
          paragraphs: LICENSES.map(
            (entry) => `${entry.name} ${entry.version} — ${entry.license}`,
          ),
        },
      ],
    }),
    [],
  );

  return <InfoScreen content={content} />;
}
