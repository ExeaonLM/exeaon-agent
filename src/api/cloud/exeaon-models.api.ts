import axios from "axios";
import { readStoredBackends } from "#/api/backend-registry/storage";

/**
 * A model the Exeaon Cloud gateway can serve, as returned by the session-authed
 * `GET /ai/gateway/models`. These are read-only in the app — the gateway
 * provisions them; there is nothing to edit here.
 */
export interface CloudModel {
  id: number;
  name: string;
  provider: string;
  modelType: string;
  contextWindow: number;
  isDefault: boolean;
  description: string;
  /** "free" | "pro" — the plan tier required to use this model. */
  minTier: string;
  /** True when this is a pro-only model. */
  requiresPro: boolean;
  /** Whether the current caller's plan may actually use it (else: locked). */
  available: boolean;
}

/** The stored cloud backend (host + session-token apiKey), if signed in. */
function cloudBackend(): { host: string; apiKey: string } | null {
  const cloud = readStoredBackends().find((b) => b.kind === "cloud");
  if (!cloud?.host || !cloud.apiKey) return null;
  return { host: cloud.host.replace(/\/+$/, ""), apiKey: cloud.apiKey };
}

/** The cloud gateway host (origin), if signed in — for building /ai/v1 URLs. */
export function cloudHost(): string | null {
  return cloudBackend()?.host ?? null;
}

const MY_KEY_STORAGE = "exeaon-gateway-user-key";

/**
 * Return the caller's personal gateway virtual key (sk-vk-*), used to route
 * cloud-model inference through the gateway's /ai/v1. Cached locally after the
 * first fetch (it's stable); re-fetched via POST /ai/gateway/my-key when absent.
 * Throws when not signed in to cloud.
 */
export async function fetchMyGatewayKey(): Promise<string> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  try {
    const cached = localStorage.getItem(`${MY_KEY_STORAGE}:${be.host}`);
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  const res = await axios.post(
    `${be.host}/ai/gateway/my-key`,
    {},
    { timeout: 15000, headers: { Authorization: `Bearer ${be.apiKey}` } },
  );
  const body = res.data as { data?: { plainKey?: string } } | undefined;
  const key = body?.data?.plainKey;
  if (!key) throw new Error("Gateway did not return a key.");
  try {
    localStorage.setItem(`${MY_KEY_STORAGE}:${be.host}`, key);
  } catch {
    /* ignore */
  }
  return key;
}

/**
 * Fetch the real cloud model catalog. Returns [] when not signed in to cloud
 * (so callers can render "no cloud models" without special-casing auth), and
 * throws only on an actual network/gateway error.
 */
export async function fetchCloudModels(): Promise<CloudModel[]> {
  const be = cloudBackend();
  if (!be) return [];
  const res = await axios.get(`${be.host}/ai/gateway/models`, {
    timeout: 15000,
    headers: { Authorization: `Bearer ${be.apiKey}` },
  });
  const body = res.data as { data?: unknown } | undefined;
  const rows = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(res.data)
      ? res.data
      : [];
  return (rows as Record<string, unknown>[]).map((d) => ({
    id: Number(d.id ?? 0),
    name: String(d.name ?? ""),
    provider: String(d.provider ?? ""),
    modelType: String(d.modelType ?? "llm"),
    contextWindow: Number(d.contextWindow ?? 0),
    isDefault: Boolean(d.isDefault),
    description: String(d.description ?? ""),
    minTier: String(d.minTier ?? "free"),
    requiresPro: Boolean(d.requiresPro),
    available: d.available === undefined ? true : Boolean(d.available),
  }));
}
