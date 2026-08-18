/**
 * The shared shape for every static info document in the app (privacy policy,
 * terms of service, how-to-play, licenses). One structure, one renderer
 * (src/screens/InfoScreen.tsx), so legal text stays plain data — reviewable in
 * a diff and testable without rendering.
 */
export interface InfoSection {
  heading: string;
  paragraphs: string[];
}

export interface InfoContent {
  title: string;
  /** Shown under the title for dated documents (legal docs); omit elsewhere. */
  effectiveDate?: string;
  sections: InfoSection[];
}
