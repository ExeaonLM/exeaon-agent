import { LLMMetadataClient } from "@openhands/typescript-client/clients";
import { getAgentServerClientOptions } from "../agent-server-client-options";
import { getActiveBackend } from "../backend-registry/active-store";
import { callCloudProxy } from "../cloud/proxy";
import type {
  LLMModel,
  LLMModelPage,
  LLMProvider,
  ProviderPage,
  SearchModelsParams,
  SearchProvidersParams,
} from "./config-service.types";

function filterByQuery<T extends { name: string }>(
  items: T[],
  query?: string,
): T[] {
  if (!query) {
    return items;
  }

  const normalizedQuery = query.toLowerCase();
  return items.filter((item) =>
    item.name.toLowerCase().includes(normalizedQuery),
  );
}

function filterByVerified<T extends { verified: boolean }>(
  items: T[],
  verified?: boolean,
): T[] {
  if (verified === undefined) {
    return items;
  }

  return items.filter((item) => item.verified === verified);
}

function limitItems<T>(items: T[], limit?: number): T[] {
  if (!limit || limit <= 0) {
    return items;
  }

  return items.slice(0, limit);
}

function buildCloudQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

class ConfigService {
  /**
   * @param verifiedByProvider - Pre-fetched verified-models map used by the
   *   local reconstruction path. Ignored for cloud backends, which call
   *   `/api/v1/config/models/search` directly (verified status is embedded in
   *   each returned item).
   */
  static async searchModels(
    params: SearchModelsParams = {},
    verifiedByProvider?: Record<string, string[]>,
  ): Promise<LLMModelPage> {
    const active = getActiveBackend();

    if (active.backend.kind === "cloud") {
      // Return our curated Exeaon Cloud model list instead of calling the upstream
      // cloud registry, which returns unrelated Claude/OpenAI models.
      const provider = params.provider__eq ?? null;
      const cloudNames: string[] = [];
      if (provider === "openhands") {
        cloudNames.push("glm-5.2", "kimi-k3", "deepseek-v4-flash", "minimax-m2.7");
      } else if (provider === "exeaon" || provider === "openai") {
        cloudNames.push("exeaon1-nunya-14b", "exeaon-27b", "exeaon-72b");
      }
      const items: LLMModel[] = cloudNames.map((name) => ({
        provider,
        name,
        verified: true,
      }));
      return { items, next_page_id: null };
    }

    const llmClient = new LLMMetadataClient(getAgentServerClientOptions());
    const verifiedFetch =
      verifiedByProvider !== undefined
        ? Promise.resolve(verifiedByProvider)
        : llmClient.getVerifiedModels();
    const [models, verifiedMap] = await Promise.all([
      llmClient.getModels(),
      verifiedFetch,
    ]);

    const provider = params.provider__eq ?? null;
    const verifiedNames = new Set<string>();
    if (provider === "exeaon" || provider === "openai") {
      verifiedNames.add("exeaon1-nunya-14b");
      verifiedNames.add("exeaon-27b");
      verifiedNames.add("exeaon-72b");
    } else if (provider === "openhands") {
      verifiedNames.add("glm-5.2");
      verifiedNames.add("kimi-k3");
      verifiedNames.add("deepseek-v4-flash");
      verifiedNames.add("minimax-m2.7");
    }
    const verifiedItems: LLMModel[] = [...verifiedNames].map((name) => ({
      provider,
      name,
      verified: true,
    }));

    const prefixedItems: LLMModel[] = [];

    const items = limitItems(
      filterByVerified(
        filterByQuery([...verifiedItems, ...prefixedItems], params.query),
        params.verified__eq,
      ),
      params.limit,
    );

    return { items, next_page_id: null };
  }

  /**
   * @param verifiedByProvider - Pre-fetched verified-models map used by the
   *   local reconstruction path. Ignored for cloud backends, which call
   *   `/api/v1/config/providers/search` directly (verified status is embedded in
   *   each returned item).
   */
  static async searchProviders(
    params: SearchProvidersParams = {},
    verifiedByProvider?: Record<string, string[]>,
  ): Promise<ProviderPage> {
    const active = getActiveBackend();

    if (active.backend.kind === "cloud") {
      // Cloud exposes /api/v1/config/providers/search which returns ProviderPage directly.
      // verifiedByProvider is not needed — the cloud API embeds verified status natively.
      const qs = buildCloudQueryString({
        page_id: params.page_id,
        limit: params.limit,
        query: params.query,
        verified__eq: params.verified__eq,
      });
      return callCloudProxy<ProviderPage>({
        backend: active.backend,
        method: "GET",
        path: `/api/v1/config/providers/search${qs}`,
      });
    }

    const providerItems: LLMProvider[] = [
      { name: "exeaon", verified: true },
      { name: "openhands", verified: true },
    ];

    const items = limitItems(
      filterByVerified(
        filterByQuery(providerItems, params.query),
        params.verified__eq,
      ),
      params.limit,
    );

    return { items, next_page_id: null };
  }
}

export default ConfigService;
