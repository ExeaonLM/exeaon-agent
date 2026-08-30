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
}

/** The stored cloud backend (host + session-token apiKey), if signed in. */
function cloudBackend(): { host: string; apiKey: string } | null {
  const cloud = readStoredBackends().find((b) => b.kind === "cloud");
  if (!cloud?.host || !cloud.apiKey) return null;
  return { host: cloud.host.replace(/\/+$/, ""), apiKey: cloud.apiKey };
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
  }));
}
