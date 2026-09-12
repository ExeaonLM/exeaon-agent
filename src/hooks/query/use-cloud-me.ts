import { useQuery } from "@tanstack/react-query";
import { fetchCloudMe } from "#/api/cloud/exeaon-me.api";

/**
 * Shared query for the signed-in Exeaon Cloud user's enriched session — plan,
 * balance, and the live hourly/weekly gating windows (GET /ai/gateway/me).
 * Returns null when not signed in to cloud. Cached + polled so the context
 * meter's plan-limits section and the settings panel stay in sync without
 * duplicate fetches.
 */
export function useCloudMe() {
  return useQuery({
    queryKey: ["cloud-me"],
    queryFn: fetchCloudMe,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}
