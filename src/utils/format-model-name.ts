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

/** External providers reached via a user-supplied API key (not the gateway). */
const API_PROVIDER_PREFIXES = new Set([
  "groq",
  "openrouter",
  "anthropic",
  "mistral",
  "together",
  "fireworks",
  "deepseek",
  "xai",
  "google",
  "gemini",
  "cohere",
  "perplexity",
  "azure",
  "ollama",
]);

const CLOUD_PROXY_PREFIXES = new Set(["openai", "openhands", "litellm_proxy"]);

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
  // An explicit on-device base URL is decisive regardless of the model id.
  if (baseUrl && /(127\.0\.0\.1|localhost)/.test(baseUrl)) return "local";

  const prefix = getModelProviderPrefix(model);
  const isExeaon = !!getExeaonModelMeta(model);

  // Exeaon model behind a proxy prefix = served by the Exeaon Cloud gateway.
  if (isExeaon && prefix && CLOUD_PROXY_PREFIXES.has(prefix)) return "cloud";
  // Bare Exeaon id (no proxy prefix) = the local GGUF build of that model.
  if (isExeaon && !prefix) return "local";

  if (prefix && API_PROVIDER_PREFIXES.has(prefix)) return "api";

  // Unknown provider prefix → an external key the user manages; no prefix at
  // all → treat as a local model.
  return prefix ? "api" : "local";
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
