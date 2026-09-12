import { useEffect, useRef } from "react";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { useActivateLlmProfile } from "#/hooks/mutation/use-activate-llm-profile";
import { syncCloudModelProfiles } from "#/api/cloud/exeaon-models.api";
import { readCloudUser } from "#/api/cloud/session-store";

/**
 * Local-mode & Exeaon Cloud UX policy: keep an LLM profile active whenever at least one
 * exists, so the agent always has a usable LLM without a manual "activate"
 * step. Automatically syncs Exeaon Cloud virtual keys into cloud profiles on mount.
 */
export function useEnsureActiveProfile(): void {
  const { backend } = useActiveBackend();
  const { data: profilesData, refetch } = useLlmProfiles();
  const { mutate: activate, isPending } = useActivateLlmProfile();

  // Remember the last profile we tried to activate so we don't re-fire while
  // the mutation + refetch settle, or hammer a profile whose activation fails.
  const attemptedRef = useRef<string | null>(null);
  const cloudSyncedRef = useRef(false);

  // A backend switch is a clean slate for the above guard.
  useEffect(() => {
    attemptedRef.current = null;
    cloudSyncedRef.current = false;
  }, [backend.id]);

  // On mount or cloud login, auto-sync the user's gateway virtual key into Cloud profiles
  useEffect(() => {
    const cloudUser = readCloudUser();
    if (!cloudUser || cloudSyncedRef.current) return;
    cloudSyncedRef.current = true;
    syncCloudModelProfiles({ activateDefault: false }).then(() => {
      refetch();
    });
  }, [backend.id, refetch]);

  useEffect(() => {
    if (isPending || !profilesData) return;

    const { profiles, active_profile: activeProfile } = profilesData;
    const activeValid =
      activeProfile != null && profiles.some((p) => p.name === activeProfile);

    if (profiles.length === 0 || activeValid) {
      attemptedRef.current = null;
      return;
    }

    // Prefer a profile with a key so the result is immediately usable.
    const target = profiles.find((p) => p.api_key_set) ?? profiles[0];
    if (attemptedRef.current === target.name) return;
    attemptedRef.current = target.name;
    activate(target.name);
  }, [profilesData, isPending, activate]);
}
