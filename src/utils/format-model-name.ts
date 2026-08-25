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
  const cleaned = model.replace(/^(openai|openhands|litellm_proxy)\//, "");
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

export function formatNativeModelName(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  const meta = getExeaonModelMeta(model);
  if (meta) return meta.name;
  const lastSegment = model.split("/").pop();
  return lastSegment || model;
}
