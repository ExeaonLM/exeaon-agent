import { useQuery } from "@tanstack/react-query";
import {
  fetchCloudModels,
  type CloudModel,
} from "#/api/cloud/exeaon-models.api";
import { getActiveBackend } from "#/api/backend-registry/active-store";
import { readStoredBackends } from "#/api/backend-registry/storage";

/**
 * The real cloud model catalog from the Exeaon gateway (read-only). Enabled
 * whenever a cloud backend is registered (signed in), independent of which
 * backend is "active", so the Cloud section shows even while the local engine
 * is active. Toasts are suppressed — an empty/unreachable catalog degrades to
 * "no cloud models" rather than an error banner.
 */
export function useCloudModels() {
  const active = getActiveBackend();
  const hasCloud = readStoredBackends().some((b) => b.kind === "cloud");
  return useQuery<CloudModel[]>({
    queryKey: ["cloud-models", active.backend.id],
    queryFn: fetchCloudModels,
    enabled: hasCloud,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    meta: { disableToast: true },
  });
}
