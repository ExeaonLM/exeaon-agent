export const FREE_MODEL_BADGE_LABEL = "Exeaon";

export interface ExeaonModelMeta {
  name: string;
  subtitle: string;
}

export const EXEAON_MODELS: Record<string, ExeaonModelMeta> = {
  "openai/exeaon1-claw-32b": {
    name: "Exeaon Coder",
    subtitle: "Flagship sovereign coding & reasoning",
  },
  "openai/exeaon": {
    name: "Exeaon Coder",
    subtitle: "Flagship sovereign coding & reasoning",
  },
  "openhands/exeaon1-claw-32b": {
    name: "Exeaon Coder",
    subtitle: "Flagship sovereign coding & reasoning",
  },
  "exeaon1-claw-32b": {
    name: "Exeaon Coder",
    subtitle: "Flagship sovereign coding & reasoning",
  },
  "openai/exeaon1-nunya-14b": {
    name: "Exeaon Nunya 2.0",
    subtitle: "Fast lightweight reasoning & script automation",
  },
  "openhands/exeaon1-nunya-14b": {
    name: "Exeaon Nunya 2.0",
    subtitle: "Fast lightweight reasoning & script automation",
  },
  "exeaon1-nunya-14b": {
    name: "Exeaon Nunya 2.0",
    subtitle: "Fast lightweight reasoning & script automation",
  },
  "openai/exeaon1-kese-30b-a3b": {
    name: "Exeaon Kese",
    subtitle: "High-throughput MoE multi-agent architecture",
  },
  "exeaon1-kese-30b-a3b": {
    name: "Exeaon Kese",
    subtitle: "High-throughput MoE multi-agent architecture",
  },
  "openai/exeaon1-dzo-4b": {
    name: "Exeaon Dzo",
    subtitle: "Ultra-compact edge coder",
  },
  "exeaon1-dzo-4b": {
    name: "Exeaon Dzo",
    subtitle: "Ultra-compact edge coder",
  },
};

export const FREE_OPENHANDS_MODELS = Object.fromEntries(
  Object.entries(EXEAON_MODELS).map(([k, v]) => [k, v.name]),
);
export const FREE_OPENHANDS_MODEL_IDS = Object.keys(EXEAON_MODELS);
export const FREE_OPENHANDS_MODEL_NOTE = `Exeaon models: Exeaon Coder, Exeaon Nunya 2.0, Exeaon Kese, Exeaon Dzo.`;

export const isFreeOpenHandsModel = (
  model: string | null | undefined,
): model is keyof typeof EXEAON_MODELS =>
  Boolean(model && model in EXEAON_MODELS);

export function getExeaonModelMeta(
  model: string | null | undefined,
): ExeaonModelMeta | null {
  if (!model) return null;
  if (isFreeOpenHandsModel(model)) return EXEAON_MODELS[model];
  const cleaned = (model as string).replace(
    /^(openai|openhands|litellm_proxy)\//,
    "",
  );
  if (isFreeOpenHandsModel(cleaned)) return EXEAON_MODELS[cleaned];
  return null;
}

export function formatModelNameForDisplay(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  const meta = getExeaonModelMeta(model);
  if (meta) return meta.name;
  return model.replace(/^(openai|openhands|litellm_proxy)\//, "");
}

export function formatProviderModelNameForDisplay(
  provider: string | null | undefined,
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  const fullModel = provider ? `${provider}/${model}` : model;
  return formatModelNameForDisplay(fullModel);
}

/**
 * Where a model runs / is billed, so the Models list can show local and cloud
 * coexisting and apply the right permissions:
 * - "cloud": an Exeaon-branded model routed through the Exeaon Cloud gateway
 *   (a proxy prefix — openai/openhands/litellm_proxy). Read-only in-app: cloud
 *   models are provisioned server-side, there is nothing meaningful to edit.
 * - "api": a user-added external provider key (groq, openrouter, mistral, …).
 *   Fully editable/renamable/deletable — the user owns the key.
 * - "local": an on-device model — a local GGUF served by the sovereign engine
 *   (a bare Exeaon id with no proxy prefix, or a 127.0.0.1/localhost base URL).
 *   Editable; "removable" ultimately means removing the .gguf from the folder.
 */
export type ModelOrigin = "cloud" | "api" | "local";

/** Lowercased provider segment of a model id (`groq/qwen…` → `groq`), or null. */
export function getModelProviderPrefix(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  const slash = model.indexOf("/");
  return slash > 0 ? model.slice(0, slash).toLowerCase() : null;
}

export function getModelOrigin(
  model: string | null | undefined,
  baseUrl?: string | null,
): ModelOrigin {
  // NOTE: LLM *profiles* are never "cloud". Real cloud models come only from
  // the gateway catalog (GET /ai/gateway/models), shown as their own read-only
  // section. A profile is either an on-device model ("local") or a hosted /
  // external-API model the user manages ("api") — including the Exeaon-branded
  // hosted models, which are served over an OpenAI-compatible endpoint, not the
  // gateway. So this classifier only ever returns "api" or "local".

  // An explicit on-device base URL, or a bare model id with no provider prefix,
  // is a local model.
  if (baseUrl && /(127\.0\.0\.1|localhost)/.test(baseUrl)) return "local";
  const prefix = getModelProviderPrefix(model);
  if (!prefix) return "local";
  // Everything with a provider prefix (groq/…, openai/…, openhands/…) is a
  // hosted/external model reached with a key the user owns.
  return "api";
}

/** Short badge label for a model's origin. */
export function getModelOriginLabel(origin: ModelOrigin): string {
  if (origin === "cloud") return "Cloud";
  if (origin === "api") return "API";
  return "Local";
}

export function formatNativeModelName(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  const meta = getExeaonModelMeta(model);
  if (meta) return meta.name;
  const lastSegment = model.split("/").pop();
  return lastSegment || model;
}
