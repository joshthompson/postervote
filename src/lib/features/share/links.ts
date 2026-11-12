// Links to the live site, tagged with where they were handed out (UTM parameters). Mixpanel adds a
// visit's landing-page `utm_*` to every event of that visit, so votes and shares can be split by
// where visitors came from. See "Sources" in AGENTS.md for the values we use.

/** The live site, wherever this is running. */
export const SITE = 'https://postervote.com';

/** Where a link was handed out: becomes `utm_source`, `utm_medium` and so on. */
export type Utm = { source: string; medium: string; content?: string; campaign?: string };

/** `url` (absolute) with `utm` added to its query, e.g. "…/?utm_source=school&utm_medium=qr". */
export function withUtm(url: string, utm: Utm): string {
  const tagged = new URL(url);
  for (const [key, value] of Object.entries(utm)) if (value) tagged.searchParams.set(`utm_${key}`, value);
  return tagged.href;
}

/** A UTM value as we write them: lowercase, with runs of anything but letters, digits and hyphens as one underscore. */
export const cleanUtm = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '');
