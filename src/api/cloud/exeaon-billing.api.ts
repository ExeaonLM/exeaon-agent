import axios from "axios";
import { readStoredBackends } from "#/api/backend-registry/storage";

/** The stored cloud backend (host + session-token apiKey), if signed in. */
function cloudBackend(): { host: string; apiKey: string } | null {
  const cloud = readStoredBackends().find((b) => b.kind === "cloud");
  if (!cloud?.host || !cloud.apiKey) return null;
  return { host: cloud.host.replace(/\/+$/, ""), apiKey: cloud.apiKey };
}

export interface PaystackConfig {
  enabled: boolean;
  currency: string;
  fxRate: number;
}

export interface PaystackInit {
  authorizationUrl: string;
  reference: string;
  currency: string;
  amountLocal: number;
  amountUsd: number;
}

export interface PaystackVerify {
  credited: boolean;
  credits: number;
  reference: string;
}

/** Whether hosted Paystack checkout is configured on the gateway. */
export async function fetchPaystackConfig(): Promise<PaystackConfig | null> {
  const be = cloudBackend();
  if (!be) return null;
  const res = await axios.get(
    `${be.host}/ai/gateway/billing/paystack/config`,
    { timeout: 15000, headers: { Authorization: `Bearer ${be.apiKey}` } },
  );
  const d = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
  return {
    enabled: Boolean(d.enabled),
    currency: String(d.currency ?? "GHS"),
    fxRate: Number(d.fxRate) || 0,
  };
}

/**
 * Start a top-up: the gateway creates a Paystack transaction and returns the
 * hosted-checkout URL to open in the browser, plus a reference to verify with
 * once the user has paid.
 */
export async function paystackInitialize(
  tenantId: number,
  email: string,
  amountUsd: number,
): Promise<PaystackInit> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  const res = await axios.post(
    `${be.host}/ai/gateway/billing/paystack/initialize`,
    { tenantId, email, amount: amountUsd },
    { timeout: 20000, headers: { Authorization: `Bearer ${be.apiKey}` } },
  );
  const d = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
  return {
    authorizationUrl: String(d.authorizationUrl ?? ""),
    reference: String(d.reference ?? ""),
    currency: String(d.currency ?? ""),
    amountLocal: Number(d.amountLocal) || 0,
    amountUsd: Number(d.amountUsd) || amountUsd,
  };
}

/**
 * Verify a top-up reference after the user returns from checkout. Idempotent on
 * the gateway (a reference credits at most once), so it's safe to call on retry.
 */
export async function paystackVerify(
  tenantId: number,
  reference: string,
): Promise<PaystackVerify> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  const res = await axios.get(
    `${be.host}/ai/gateway/billing/paystack/verify`,
    {
      params: { tenantId, reference },
      timeout: 20000,
      headers: { Authorization: `Bearer ${be.apiKey}` },
    },
  );
  const d = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
  return {
    credited: Boolean(d.credited),
    credits: Number(d.credits) || 0,
    reference: String(d.reference ?? reference),
  };
}
