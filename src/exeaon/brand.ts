/**
 * Exeaon Agent brand — the importable source of truth for identity.
 *
 * Lives under src/exeaon/, a directory upstream OpenHands never creates or
 * touches, so it never causes a merge conflict. Upstream files reference this
 * (e.g. the document title) through a one-line import; the value lives here.
 * See ../../exeaon/MERGE_STRATEGY.md.
 */
export const BRAND = {
  name: "Exeaon Agent",
  tagline: "Sovereign AI coding agent, on your hardware.",
  logo: "/exeaon-logo-512.jpg",
  links: {
    site: "https://exeaon.dev",
    upstream: "https://github.com/All-Hands-AI/OpenHands",
  },
} as const;

export type Brand = typeof BRAND;
