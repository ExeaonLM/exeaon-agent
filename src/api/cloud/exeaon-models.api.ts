import axios from "axios";
import { readStoredBackends } from "#/api/backend-registry/storage";
import { ProfilesService } from "#/api/profiles-service/profiles-service.api";
import { sanitizeProfileName } from "#/utils/format-model-name";
import { BRAND } from "#/exeaon/brand";
import { isSovereignLLM } from "#/exeaon/cloud-models";

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
export async function fetchMyGatewayKey(forceRefresh = false): Promise<string> {
  const be = cloudBackend();
  if (!be) throw new Error("Not signed in to Exeaon Cloud.");
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(`${MY_KEY_STORAGE}:${be.host}`);
      // Only trust a cached value that is actually a gateway virtual key. A
      // stale non-`sk-vk-` value (e.g. an old `sk-exeaon` left by a prior bug)
      // would authenticate as "invalid" forever, so ignore it and re-mint.
      if (cached?.startsWith("sk-vk-")) return cached;
    } catch {
      /* ignore */
    }
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
 * The cached gateway virtual key (`sk-vk-*`) for the signed-in host, or null.
 * Synchronous (no network) so the conversation-build path can resolve a
 * sovereign key inline. Returns null unless a real `sk-vk-` key is cached —
 * never a non-gateway value.
 */
export function getCachedGatewayKey(): string | null {
  const host = cloudHost();
  if (!host) return null;
  try {
    const cached = localStorage.getItem(`${MY_KEY_STORAGE}:${host}`);
    return cached?.startsWith("sk-vk-") ? cached : null;
  } catch {
    return null;
  }
}

/**
 * The key a sovereign Exeaon model should use when its OWN stored key is empty.
 *
 * Gateway models (`litellm_proxy/…` served over `…/ai/v1`) REQUIRE the user's
 * `sk-vk-*` virtual key — the gateway rejects any bearer not prefixed `sk-vk-`
 * ("missing or invalid Authorization header"), so `sk-exeaon` is NEVER valid
 * there. Return the cached virtual key, or undefined (never a key we know the
 * gateway will reject). The BRAND default model talks to a direct Modal
 * endpoint, not the gateway, so the static brand key is valid for it.
 */
export function resolveSovereignApiKey(llm: {
  model?: unknown;
  base_url?: unknown;
}): string | undefined {
  if (!isSovereignLLM(llm)) return undefined;
  const model = typeof llm.model === "string" ? llm.model : "";
  const base = (typeof llm.base_url === "string" ? llm.base_url : "").replace(
    /\/+$/,
    "",
  );
  const isGateway =
    model.startsWith("litellm_proxy/") || base.endsWith("/ai/v1");
  if (isGateway) return getCachedGatewayKey() ?? undefined;
  return BRAND.model.apiKey || undefined;
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

// MUST match the gateway's registered model names EXACTLY (see the gateway's
// GET /ai/v1/models — names carry spaces: "Exeaon Spark 1.0"). The gateway
// resolves the virtual model by this literal name; a hyphenated variant
// ("Exeaon-Spark-1.0") does not match and fails with "all upstream providers
// failed". `sanitizeProfileName` still maps these to the same hyphenated
// PROFILE name, so the profile's `model` field carries the resolvable
// spaced name while the profile id/label is unchanged.
const DEFAULT_CLOUD_MODELS = [
  "Exeaon Spark 1.0",
  "Exeaon Video 1.0",
  "Exeaon Arc 1.0",
];

/**
 * Automatically provisions and syncs the user's Exeaon Cloud gateway virtual key
 * into local agent-server profiles for Cloud models.
 *
 * This ensures that on login or startup, Exeaon Cloud models (Spark, Video, Arc)
 * are immediately usable with full authentication without requiring the user to
 * manually input keys or click buttons. Local GGUF models and custom API models
 * remain completely untouched.
 */
export async function syncCloudModelProfiles(options?: {
  activateDefault?: boolean;
}): Promise<void> {
  try {
    const host = cloudHost() || "https://exeaon-claw.fly.dev";
    let key: string | null = null;
    // Whether `key` is the user's real gateway virtual key (vs the static brand
    // fallback). Only a fresh key justifies overwriting an existing profile.
    let keyIsFresh = false;
    try {
      // Force a fresh mint (bypass a possibly-stale cache) so the repaired
      // profile is guaranteed to hold a currently-valid sk-vk-* virtual key.
      key = await fetchMyGatewayKey(true);
      keyIsFresh = key.startsWith("sk-vk-");
    } catch {
      key = BRAND.model.apiKey || "sk-exeaon";
    }
    if (!key) key = "sk-exeaon";

    const profileList = await ProfilesService.listProfiles();
    const existingProfiles = profileList.profiles ?? [];

    for (const modelName of DEFAULT_CLOUD_MODELS) {
      const sanitized = sanitizeProfileName(modelName);
      const existing = existingProfiles.find((p) => p.name === sanitized);

      // (Re)save when the profile is absent, has no key, OR whenever we hold a
      // fresh gateway key. The last case is the important repair: a key stored
      // under an OLD session key still reports `api_key_set: true` but decrypts
      // to nothing at inference ("missing Authorization header"). Re-saving
      // re-encrypts it under the CURRENT session key — no re-login needed.
      if (!existing || !existing.api_key_set || keyIsFresh) {
        await ProfilesService.saveProfile(sanitized, {
          llm: {
            model: `litellm_proxy/${modelName}`,
            base_url: `${host}/ai/v1`,
            api_key: key,
            native_tool_calling: false,
          },
          include_secrets: true,
        } as unknown as Parameters<typeof ProfilesService.saveProfile>[1]);
      }
    }

    if (
      options?.activateDefault &&
      (!profileList.active_profile ||
        DEFAULT_CLOUD_MODELS.some(
          (m) => sanitizeProfileName(m) === profileList.active_profile,
        ))
    ) {
      const target =
        profileList.active_profile ||
        sanitizeProfileName(DEFAULT_CLOUD_MODELS[0]);
      await ProfilesService.activateProfile(target);
    }
  } catch (err) {
    console.warn("Could not auto-sync cloud model profiles:", err);
  }
}
