export const FREE_MODEL_BADGE_LABEL = "Exeaon";

export const EXEAON_MODELS = {
  "openai/exeaon": "Exeaon 14B (Nunya)",
  "exeaon": "Exeaon 14B (Nunya)",
  "exeaon/exeaon1-nunya-14b": "Exeaon 14B (Nunya)",
  "exeaon/exeaon-27b": "Exeaon 27B",
  "exeaon/exeaon-72b": "Exeaon 72B",
  "openhands/kimi-k3": "Kimi K3",
  "openhands/glm-5.2": "GLM-5.2",
  "openhands/deepseek-v4-flash": "DeepSeek V4 Flash",
  "openhands/minimax-m2.7": "MiniMax M2.7",
} as const;

export const FREE_OPENHANDS_MODELS = EXEAON_MODELS;
export const FREE_OPENHANDS_MODEL_IDS = Object.keys(FREE_OPENHANDS_MODELS);
export const FREE_OPENHANDS_MODEL_NOTE = `Exeaon models: Exeaon 14B (Nunya), Exeaon 27B, Exeaon 72B. Running on Exeaon runtime.`;

export const isFreeOpenHandsModel = (
  model: string | null | undefined,
): model is keyof typeof FREE_OPENHANDS_MODELS =>
  Boolean(model && model in FREE_OPENHANDS_MODELS);

export function formatModelNameForDisplay(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  return isFreeOpenHandsModel(model) ? FREE_OPENHANDS_MODELS[model] : model;
}

export function formatProviderModelNameForDisplay(
  provider: string | null | undefined,
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  const fullModel = provider ? `${provider}/${model}` : model;
  return isFreeOpenHandsModel(fullModel)
    ? FREE_OPENHANDS_MODELS[fullModel]
    : model;
}

/**
 * Format a native (OpenHands-kind) routing model string for display, stripping
 * the provider route prefix (e.g. ``"anthropic/claude-sonnet-4-5-20250929"`` →
 * ``"claude-sonnet-4-5-20250929"``, ``"litellm_proxy/openai/gpt-4o"`` →
 * ``"gpt-4o"``) so a conversation chip shows a meaningful model name rather than
 * the full routing path.
 *
 * Returns ``null`` for an empty/nullish input, and falls back to the original
 * string when stripping the prefix would leave nothing (e.g. a trailing slash)
 * — never an empty string, which would collapse the chip text.
 *
 * Display-only: unlike {@link deriveProfileNameFromModel} this does not sanitize
 * to an identifier, so it keeps the real model id intact for the chip.
 */
export function formatNativeModelName(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  if (isFreeOpenHandsModel(model)) return FREE_OPENHANDS_MODELS[model];
  const lastSegment = model.split("/").pop();
  return lastSegment || model;
}
