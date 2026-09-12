/**
 * Cloud model list sync for the desktop app.
 *
 * The gateway's OpenAI-compatible `/ai/v1/models` (authenticated with the
 * user's virtual key) returns the Exeaon-facing model names. The app fetches
 * and caches the list on sign-in and on startup — a restart (or a manual
 * reconnect) picks up newly added models, so customers never need to type a
 * model name by hand.
 */

import { BRAND } from "#/exeaon/brand";

const MODELS_KEY = "exeaon_cloud_models";
const CLOUD_URL_KEY = "exeaon_cloud_url";
const CLOUD_KEY_KEY = "exeaon_cloud_key";

export interface CloudModelInfo {
  id: string;
  object?: string;
}

/**
 * A "sovereign" LLM is one served by Exeaon's own runtime/gateway — the default
 * published model, or a `litellm_proxy/…` cloud model pointed at `…/ai/v1`.
 *
 * ONLY these authenticate with the sovereign key (`sk-exeaon` / the user's
 * gateway virtual key). A custom user-added provider (Deepseek, raw OpenAI, …)
 * must use ITS OWN key and must NEVER be handed `sk-exeaon` — doing so makes the
 * provider reject the request (e.g. Deepseek: "Your api key: ****eaon is
 * invalid"). So the sovereign-key fallback must be gated on this predicate.
 */
export function isSovereignLLM(llm: {
  model?: unknown;
  base_url?: unknown;
}): boolean {
  const model = typeof llm.model === "string" ? llm.model : "";
  const base = (typeof llm.base_url === "string" ? llm.base_url : "").replace(
    /\/+$/,
    "",
  );
  const brandBase = (BRAND.model.baseUrl || "").replace(/\/+$/, "");
  return (
    model === BRAND.model.id ||
    model.startsWith("litellm_proxy/") ||
    base.endsWith("/ai/v1") ||
    (brandBase.length > 0 && base === brandBase)
  );
}

export function getCachedCloudModels(): string[] {
  try {
    const raw = localStorage.getItem(MODELS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function getCloudConnection(): {
  baseUrl: string;
  apiKey: string;
} | null {
  const baseUrl = localStorage.getItem(CLOUD_URL_KEY);
  const apiKey = localStorage.getItem(CLOUD_KEY_KEY);
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export async function refreshCloudModels(): Promise<string[]> {
  const conn = getCloudConnection();
  if (!conn) return [];
  try {
    const resp = await fetch(`${conn.baseUrl}/ai/v1/models`, {
      headers: { Authorization: `Bearer ${conn.apiKey}` },
    });
    if (!resp.ok) return getCachedCloudModels();
    const body = (await resp.json()) as { data?: CloudModelInfo[] };
    const names = (body.data ?? [])
      .map((m) => m.id)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .sort();
    localStorage.setItem(MODELS_KEY, JSON.stringify(names));
    return names;
  } catch {
    return getCachedCloudModels();
  }
}

export function cacheCloudModels(models: string[]): void {
  localStorage.setItem(MODELS_KEY, JSON.stringify(models));
}
