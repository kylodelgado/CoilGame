import type { InfoContent } from './InfoContent';

/**
 * The Coil privacy policy, as structured data rendered by InfoScreen.
 *
 * Written for the app as shipped: offline-first gameplay, optional
 * Firebase-backed accounts + public leaderboard, optional AdMob ads (active
 * only when the app owner has configured AdMob), store-processed purchases,
 * no analytics SDK, no crash reporting, no location access.
 *
 * Keep this file in sync with what the app actually does — it has legal weight.
 */
export const privacyPolicy: InfoContent = {
  title: 'Privacy Policy',
  effectiveDate: 'August 17, 2026',
  sections: [
    {
      heading: 'Overview',
      paragraphs: [
        'Coil is a snake game built to work offline. You can play every mode without creating an account, and your gameplay data stays on your device.',
        'This policy explains the little data the app does handle: what stays on your phone, what is shared if you opt into the online leaderboard, and what advertising involves when ads are enabled. It applies to the Coil app on iOS and Android.',
        'Coil is operated by an independent developer. Contact for anything in this policy: brandonbay9703@gmail.com.',
      ],
    },
    {
      heading: 'Data stored on your device',
      paragraphs: [
        'Your settings (control scheme, board preset, skin, sound and haptics choices, game mode) and your local high scores are saved only on your device, in the app’s local storage. They are not uploaded, and we cannot see them.',
        'Deleting the app deletes this data. You can also reset high scores at any time from Settings.',
      ],
    },
    {
      heading: 'Optional accounts and leaderboards',
      paragraphs: [
        'Coil has an optional account system that powers the online leaderboard. You never need an account to play.',
        'If you create an account, we collect an email address, a password, and a display name. You can instead play anonymously on the leaderboard without providing an email. Accounts and leaderboard scores are stored with Google Firebase (Firebase Authentication and Cloud Firestore), which processes this data on our behalf. Passwords are handled by Firebase Authentication; we never see or store your password ourselves.',
        'Public by design: when you submit a score to the leaderboard, your display name and score are visible to everyone who opens the leaderboard. Do not use a display name you would not want shown publicly.',
        'You can delete your account from inside the app at any time (see Data retention and deletion below).',
      ],
    },
    {
      heading: 'Advertising',
      paragraphs: [
        'Coil can show ads through Google AdMob: banners on end-of-game screens, occasional interstitials between games, and optional rewarded ads you can choose to watch to revive a run. Ads are only active in versions of the app where advertising has been configured; if you see no ads, no ad data is being collected.',
        'When ads are active, AdMob and its partners may use device identifiers (such as the iOS advertising identifier or the Android advertising ID), IP address, and coarse device information to serve, frequency-cap, and measure ads, and — where you consent — to personalize them.',
        'Consent and your choices: in regions covered by GDPR and similar laws, the app asks for your consent before serving personalized ads, and you can decline. On iOS, Apple’s App Tracking Transparency prompt lets you deny tracking; if you deny it, ads are served without cross-app tracking. On Android, you can turn off ad personalization or reset/delete your advertising ID in system Settings (Privacy > Ads).',
        'How Google uses this data is described in Google’s partner policy: https://policies.google.com/technologies/partner-sites — and in Google’s privacy policy: https://policies.google.com/privacy.',
        'Coil Premium (a one-time purchase) removes ads entirely.',
      ],
    },
    {
      heading: 'Purchases',
      paragraphs: [
        'Coil offers one in-app purchase, Coil Premium, which removes ads. It is a one-time (non-consumable) purchase.',
        'Payment is processed entirely by Apple’s App Store or Google Play. The app never sees your card number, billing address, or any other payment details. The app only learns whether the purchase succeeded so it can unlock Premium.',
      ],
    },
    {
      heading: 'The "GPS" mode uses no location',
      paragraphs: [
        'One of Coil’s game modes is named "GPS". The name is fictional flavor: it refers to a large in-game world with an on-screen arrow that points toward food, like a navigator.',
        'The GPS mode — and the app as a whole — never accesses your device’s location. Coil does not request location permission, and no location data is collected, stored, or shared.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'Coil is not directed at children under 13, and we do not knowingly collect personal data from children under 13 (or the equivalent minimum age in your region).',
        'If you believe a child has created an account, contact us at brandonbay9703@gmail.com and we will delete it.',
      ],
    },
    {
      heading: 'Data retention and deletion',
      paragraphs: [
        'On-device data (settings, local high scores) stays until you reset it in the app or uninstall the app.',
        'Account data (email, display name, leaderboard scores) is kept while your account exists. You can delete your account from inside the app: open the Account screen and choose delete. This removes your account and its associated data from our systems, and your entries are removed from the leaderboard.',
        'You can also email brandonbay9703@gmail.com from the address on your account to request deletion or ask what data is held about you. We aim to answer within 30 days.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Depending on where you live (for example under the EU/UK GDPR or the California CCPA/CPRA), you may have rights to access, correct, delete, or receive a copy of your personal data, to object to or restrict certain processing, and to withdraw consent (such as ad-personalization consent) at any time without affecting your use of the game.',
        'We honor these requests regardless of where you live. Exercise them in-app (account deletion, ad-consent settings) or by emailing brandonbay9703@gmail.com. We do not sell your personal information, and we do not use it for purposes beyond those described in this policy. If you are unsatisfied with our response, you may also lodge a complaint with your local data-protection authority.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If the app’s data practices change — for example if analytics or crash reporting is ever added — this policy will be updated, the effective date above will change, and material changes will be highlighted in the app or its store listing before they take effect.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions, requests, or concerns about privacy in Coil: brandonbay9703@gmail.com.',
      ],
    },
  ],
};
