import type { InfoContent } from './InfoContent';

/**
 * The Coil terms of service, as structured data rendered by InfoScreen.
 * Plain-English on purpose; keep paragraphs short so they read well on a phone.
 *
 * <!-- OWNER TODO: replace the [JURISDICTION] placeholder in the "Governing
 * law" section below with the actual governing jurisdiction (e.g. "the State
 * of Florida, USA") before release. Searching this file for [JURISDICTION]
 * finds the one spot. -->
 */
export const termsOfService: InfoContent = {
  title: 'Terms of Service',
  effectiveDate: 'August 17, 2026',
  sections: [
    {
      heading: 'Acceptance',
      paragraphs: [
        'These terms are an agreement between you and the operator of Coil (contact: brandonbay9703@gmail.com). By installing or playing Coil, you accept them. If you do not agree, do not use the app.',
        'You must be at least 13 years old (or the minimum age in your region) to create an account.',
      ],
    },
    {
      heading: 'License',
      paragraphs: [
        'We grant you a personal, non-exclusive, non-transferable, revocable license to install and play Coil on devices you own or control, for your own entertainment.',
        'You may not copy, modify, distribute, sell, or reverse-engineer the app except where the law expressly allows it despite this restriction.',
      ],
    },
    {
      heading: 'Accounts and display names',
      paragraphs: [
        'Accounts are optional and only needed for the online leaderboard. You are responsible for your account credentials and for activity on your account.',
        'Your display name is shown publicly on the leaderboard. Do not use a name that impersonates another person or brand, or that is offensive, hateful, or misleading. We may change or remove display names, and suspend or remove accounts, that break this rule.',
      ],
    },
    {
      heading: 'Leaderboard fair play',
      paragraphs: [
        'The leaderboard is for scores earned by actually playing. Do not cheat: no automation or bots, no modified clients, no exploiting bugs, and no tampering with score submission.',
        'We may remove or reset scores we reasonably believe are fraudulent or not earned through normal play, and may suspend accounts involved. Leaderboard entries are for bragging rights only — they have no monetary value.',
      ],
    },
    {
      heading: 'Purchases and refunds',
      paragraphs: [
        'Coil Premium is a one-time in-app purchase that removes ads. Purchases are processed by Apple’s App Store or Google Play under their terms; we never receive your payment details.',
        'Refunds are handled by the store you bought through, under that store’s refund policy. Restoring a purchase on a new device is done through the same store account.',
      ],
    },
    {
      heading: 'Ads',
      paragraphs: [
        'Versions of Coil without Premium may show ads (banners, interstitials, and optional rewarded ads), served by Google AdMob. Ad content comes from third parties and we do not endorse it. How ads use data is covered in the Privacy Policy.',
      ],
    },
    {
      heading: 'Disclaimer of warranties',
      paragraphs: [
        'Coil is provided "as is" and "as available", without warranties of any kind, express or implied — including fitness for a particular purpose and uninterrupted or error-free operation. Online features (accounts, leaderboards, ads) may change, break, or be discontinued at any time.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'To the maximum extent the law allows, we are not liable for indirect, incidental, special, or consequential damages, or for lost data, lost scores, or lost profits, arising from your use of Coil.',
        'Our total liability for any claim relating to the app is limited to the amount you paid for it in the 12 months before the claim (or 10 USD if you paid nothing). Some jurisdictions do not allow certain limits, so parts of this section may not apply to you.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You can stop using Coil, and delete your account in-app, at any time. We may suspend or terminate accounts that violate these terms (including cheating or abusive display names). Sections that by their nature should survive — such as the liability limits — survive termination.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        // <!-- OWNER TODO: fill in [JURISDICTION] before release. -->
        'These terms are governed by the laws of [JURISDICTION], without regard to conflict-of-law rules. Courts located in [JURISDICTION] have exclusive jurisdiction over disputes, except where the law of your country of residence gives you mandatory consumer protections and venue rights, which remain unaffected.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update these terms as the app evolves. The effective date above will change when we do, and material changes will be highlighted in the app or its store listing. Continuing to play after a change takes effect means you accept the updated terms.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions about these terms: brandonbay9703@gmail.com.',
      ],
    },
  ],
};
