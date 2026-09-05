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
/** One live gating window (hourly or weekly), all values in credits. */
export interface CloudMeWindow {
  usedCredits: number;
  includedCredits: number;
  resetAtUnix: number;
}

/** A selectable plan tier for the upgrade UI. */
export interface CloudPlanItem {
  id: string;
  name: string;
  hourlyCredits: number;
  weeklyCredits: number;
  monthlyPriceUsd: number;
}

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
  plan: string;
  planName: string;
  hourly: CloudMeWindow | null;
  weekly: CloudMeWindow | null;
  planCatalog: CloudPlanItem[];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function unwrapWindow(v: unknown): CloudMeWindow | null {
  if (!v || typeof v !== "object") return null;
  const w = v as Record<string, unknown>;
  return {
    usedCredits: num(w.usedCredits),
    includedCredits: num(w.includedCredits),
    resetAtUnix: num(w.resetAtUnix),
  };
}

function unwrapPlanCatalog(v: unknown): CloudPlanItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      hourlyCredits: num(p.hourlyCredits),
      weeklyCredits: num(p.weeklyCredits),
      monthlyPriceUsd: num(p.monthlyPriceUsd),
    };
  });
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
    plan: String(d.plan ?? "free"),
    planName: String(d.planName ?? "Free"),
    hourly: unwrapWindow(d.hourly),
    weekly: unwrapWindow(d.weekly),
    planCatalog: unwrapPlanCatalog(d.planCatalog),
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
 * Open a URL outside the app. In the Tauri desktop shell we invoke the app's
 * `open_external` command (registered in src-tauri); on the web we open a new
 * tab. Both are best-effort — checkout must never crash the app.
 */
async function openExternal(url: string): Promise<void> {
  try {
    const tauri = (
      window as unknown as {
        __TAURI_INTERNALS__?: { invoke?: (cmd: string, args: unknown) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    if (tauri?.invoke) {
      await tauri.invoke("open_external", { url });
      return;
    }
  } catch {
    // fall through to window.open
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Result of starting a hosted checkout: where to send the browser + ref. */
export interface CheckoutStart {
  authorizationUrl: string;
  reference: string;
}

/**
 * Start a pay-as-you-go top-up: buys `amountUsd` of credits via Paystack hosted
 * checkout. Opens the authorization URL and returns the reference to verify on
 * return. Throws when not signed in or Paystack is unconfigured.
 */
export async function startCloudTopUp(amountUsd: number): Promise<CheckoutStart> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  const me = await fetchCloudMe();
  const res = await axios.post(
    `${be.host}/ai/gateway/billing/paystack/initialize`,
    { tenantId: me?.tenantId ?? 0, email: me?.email ?? "", amount: amountUsd },
    { timeout: 20000, headers: { Authorization: `Bearer ${be.apiKey}` } },
  );
  const d = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
  const start: CheckoutStart = {
    authorizationUrl: String(d.authorizationUrl ?? ""),
    reference: String(d.reference ?? ""),
  };
  if (start.authorizationUrl) await openExternal(start.authorizationUrl);
  return start;
}

/**
 * Start a plan upgrade (pro / max) via Paystack hosted checkout. Opens the
 * authorization URL; on successful payment the gateway sets the account's plan
 * for the billing period. Throws when not signed in or Paystack is unconfigured.
 */
export async function startCloudPlanUpgrade(
  planId: string,
): Promise<CheckoutStart> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  const me = await fetchCloudMe();
  const res = await axios.post(
    `${be.host}/ai/gateway/billing/plan/initialize`,
    { tenantId: me?.tenantId ?? 0, email: me?.email ?? "", planId },
    { timeout: 20000, headers: { Authorization: `Bearer ${be.apiKey}` } },
  );
  const d = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
  const start: CheckoutStart = {
    authorizationUrl: String(d.authorizationUrl ?? ""),
    reference: String(d.reference ?? ""),
  };
  if (start.authorizationUrl) await openExternal(start.authorizationUrl);
  return start;
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
