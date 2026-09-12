/**
 * Exeaon Agent brand configuration — the single source of truth for identity.
 *
 * Everything the user sees that says "Exeaon Agent" reads from here. Nothing is
 * hardcoded across the 109 files that mention the upstream name; those keep the
 * upstream identifiers so merges stay clean (see MERGE_STRATEGY.md). This file
 * is overlay-only — upstream never touches it, so it never conflicts.
 */

export const BRAND = {
  name: "Exeaon Agent",
  tagline: "Sovereign AI coding agent, on your hardware.",

  /**
   * Where the agent talks to a model by default. Our runtime speaks the OpenAI
   * API, so the whole platform points here through the standard triple. Swap
   * the base URL between a local `epure serve` and the hosted endpoint; the
   * model id and key are the same either way.
   */
  model: {
    provider: "openai" as const,
    id: "openai/exeaon",
    // Local runtime by default; override with EXEAON_MODEL_BASE_URL for hosted.
    baseUrl:
      (typeof process !== "undefined" &&
        process.env?.EXEAON_MODEL_BASE_URL) ||
      "http://localhost:8000/v1",
    // Any non-empty key: the runtime does not authenticate, and LiteLLM only
    // requires the field to be present.
    apiKey:
      (typeof process !== "undefined" && process.env?.EXEAON_MODEL_API_KEY) ||
      "sk-exeaon-local",
  },

  links: {
    site: "https://exeaon.dev",
    docs: "https://exeaon.dev/docs",
    upstream: "https://github.com/All-Hands-AI/OpenHands",
  },
} as const;

export type Brand = typeof BRAND;
