/**
 * Whether the current user may MUTATE profiles (LLM profiles and agent profiles
 * alike): create, edit, rename, delete, duplicate, or activate/switch.
 *
 * In Exeaon, profiles always live on the local agent-server (the "cloud" backend
 * is the ai-gateway, which has no org-scoped profile API — the old cloud
 * role-gating relied on an OpenHands app-server `/api/organizations/{orgId}/me`
 * call that 404s against the gateway and made every local profile read-only
 * once signed in). Local profiles are always the user's to manage, so this is
 * always true. (Cloud models are surfaced read-only elsewhere, not through this
 * profile-management path.)
 */
export function useCanManageOrgProfiles(): boolean {
  return true;
}
