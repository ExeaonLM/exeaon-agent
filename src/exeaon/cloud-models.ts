/**
 * Cloud model list sync for the desktop app.
 *
 * The gateway's OpenAI-compatible `/ai/v1/models` (authenticated with the
 * user's virtual key) returns the Exeaon-facing model names. The app fetches
 * and caches the list on sign-in and on startup — a restart (or a manual
 * reconnect) picks up newly added models, so customers never need to type a
 * model name by hand.
 */

const MODELS_KEY = "exeaon_cloud_models";
const CLOUD_URL_KEY = "exeaon_cloud_url";
const CLOUD_KEY_KEY = "exeaon_cloud_key";

export interface CloudModelInfo {
  id: string;
  object?: string;
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

export function getCloudConnection(): { baseUrl: string; apiKey: string } | null {
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
