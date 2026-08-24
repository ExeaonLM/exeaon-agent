/**
 * Exeaon Agent brand — the importable source of truth for identity and the
 * default model endpoint.
 *
 * Lives under src/exeaon/, a directory upstream OpenHands never creates or
 * touches, so it never causes a merge conflict. Upstream files reference this
 * through one-line imports; the values live here. See ../../exeaon/MERGE_STRATEGY.md.
 */
export const BRAND = {
  name: "Exeaon Agent",
  tagline: "Sovereign AI coding agent, on your hardware.",
  logo: "/exeaon-logo-512.png",

  /**
   * The default model the agent talks to: our published Exeaon model served by
   * our runtime over an OpenAI-compatible endpoint. Proven live -- the hosted
   * endpoint serves Exeaon/Exeaon1-Nunya-14B and answers /v1/chat/completions.
   * OpenHands routes model calls through LiteLLM, so this is the standard
   * openai/<name> + base_url + key triple.
   */
  model: {
    provider: "openai" as const,
    id: "openai/exeaon",
    // Hosted published-model endpoint by default; point at a local `epure
    // serve` by setting EXEAON_MODEL_BASE_URL.
    baseUrl:
      (typeof process !== "undefined" && process.env?.EXEAON_MODEL_BASE_URL) ||
      "https://akpaluelliot9--exeaon-compress-exeaonendpoint-api.modal.run/v1",
    apiKey:
      (typeof process !== "undefined" && process.env?.EXEAON_MODEL_API_KEY) ||
      "sk-exeaon",
  },

  links: {
    site: "https://exeaon.dev",
    upstream: "https://github.com/All-Hands-AI/OpenHands",
  },
} as const;

export type Brand = typeof BRAND;
