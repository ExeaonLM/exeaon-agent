import axios from "axios";
import { readStoredBackends } from "#/api/backend-registry/storage";

/**
 * The desktop app's enriched, session-scoped view of the signed-in Exeaon Cloud
 * user: identity plus a plan tier and real usage, derived server-side from the
 * tenant's billing account + usage rollup (GET /ai/gateway/me).
 *
 * Auth mirrors exeaon-auth.api.ts: the session token lives on the cloud backend
 * registry entry as its apiKey and is sent as a plain bearer (the webview can't
 * rely on cross-site cookies). "pro" means a funded, active billing account;
 * a fresh account-less user is honestly "free" with zero usage.
 */
export interface CloudMe {
  userId: number;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
  tenantId: number;
  orgName: string;
  role: string;
  tier: "pro" | "free";
  status: string;
  currency: string;
  balanceCredits: number;
  creditLimitCredits: number;
  windowDays: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  spendCredits: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function unwrap(payload: unknown): CloudMe {
  const body = payload as { data?: Record<string, unknown> } | undefined;
  const d = (body?.data ?? body ?? {}) as Record<string, unknown>;
  return {
    userId: num(d.userId),
    email: String(d.email ?? ""),
    displayName: String(d.displayName ?? ""),
    isPlatformAdmin: Boolean(d.isPlatformAdmin),
    tenantId: num(d.tenantId),
    orgName: String(d.orgName ?? ""),
    role: String(d.role ?? ""),
    tier: d.tier === "pro" ? "pro" : "free",
    status: String(d.status ?? "none"),
    currency: String(d.currency ?? ""),
    balanceCredits: num(d.balanceCredits),
    creditLimitCredits: num(d.creditLimitCredits),
    windowDays: num(d.windowDays) || 30,
    requests: num(d.requests),
    promptTokens: num(d.promptTokens),
    completionTokens: num(d.completionTokens),
    totalTokens: num(d.totalTokens),
    spendCredits: num(d.spendCredits),
  };
}

/** The stored cloud backend (host + session-token apiKey), if signed in. */
function cloudBackend(): { host: string; apiKey: string } | null {
  const cloud = readStoredBackends().find((b) => b.kind === "cloud");
  if (!cloud?.host || !cloud.apiKey) return null;
  return { host: cloud.host.replace(/\/+$/, ""), apiKey: cloud.apiKey };
}

/**
 * Fetch the enriched session view. Returns null when not signed in to cloud.
 * Throws on network/auth errors so callers can distinguish "signed out" (null)
 * from "fetch failed" (throw).
 */
export async function fetchCloudMe(): Promise<CloudMe | null> {
  const be = cloudBackend();
  if (!be) return null;
  const res = await axios.get(`${be.host}/ai/gateway/me`, {
    timeout: 15000,
    headers: { Authorization: `Bearer ${be.apiKey}` },
  });
  return unwrap(res.data);
}

/**
 * Rename the signed-in user's own organization (its display name). The gateway
 * enforces that the caller is an owner/admin of their tenant. Returns the new
 * name on success; throws when not signed in or the request fails.
 */
export async function renameCloudOrg(displayName: string): Promise<string> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  const res = await axios.post(
    `${be.host}/ai/gateway/org/rename`,
    { displayName },
    { timeout: 15000, headers: { Authorization: `Bearer ${be.apiKey}` } },
  );
  const body = res.data as { data?: { displayName?: string } } | undefined;
  return String(body?.data?.displayName ?? displayName);
}
