import {
  readStoredBackends,
  writeStoredBackends,
  writeStoredActiveBackend,
} from "#/api/backend-registry/storage";

/**
 * The signed-in Exeaon Cloud user, persisted so the account UI can show who is
 * logged in. The bearer token lives on the cloud backend (invisible to the
 * user); this holds only the display fields.
 */
export interface StoredCloudUser {
  userId: number;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
  host: string;
}

const KEY = "exeaon-cloud-user";

export function readCloudUser(): StoredCloudUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredCloudUser) : null;
  } catch {
    return null;
  }
}

export function writeCloudUser(user: StoredCloudUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(user));
}

/**
 * Sign out: drop the stored user and remove the Exeaon Cloud backend(s), so the
 * app falls back to local. The active backend is cleared if it was the cloud.
 */
export function cloudLogout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  const remaining = readStoredBackends().filter((b) => b.kind !== "cloud");
  writeStoredBackends(remaining);
  writeStoredActiveBackend(
    remaining.length ? { backendId: remaining[0].id, orgId: null } : null,
  );
}
