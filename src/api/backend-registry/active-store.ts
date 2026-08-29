import { getBackendHealthEntry } from "./health-store";
import {
  readStoredActiveBackend,
  readStoredBackends,
  writeStoredActiveBackend,
  writeStoredBackends,
} from "./storage";
import type { Backend, BackendSelection, ResolvedActiveBackend } from "./types";
import {
  currentLocationSearch,
  readBackendSelectionFromUrl,
} from "./url-selection";

type Listener = () => void;

interface Snapshot {
  backends: Backend[];
  selection: BackendSelection | null;
  active: ResolvedActiveBackend;
}

export const NO_BACKEND_ID = "no-backend";

/**
 * Sentinel returned when the registry has no usable backend. It must never be
 * persisted, and callers must check `isNoBackend()` before interpreting fields
 * like `kind`, `host`, or `apiKey`.
 */
export const NO_BACKEND: Backend = {
  id: NO_BACKEND_ID,
  name: "No Backend Available",
  host: "",
  apiKey: "",
  kind: "local",
};

export function isNoBackend(backend: Backend): boolean {
  return backend.id === NO_BACKEND_ID;
}

/**
 * Choose an active backend when there is no valid explicit selection (fresh
 * start, or the selected backend was removed). Most of the GUI speaks the
 * local agent-server protocol, so a cloud or dead-local backend at index 0
 * would leave `getEffectiveLocalBackend()` null and make every local-protocol
 * call throw "No backend is configured" even when a healthy local backend is
 * registered further down the list. Consult the synchronous, persisted health
 * store and prefer a healthy local backend; fall back to any local backend so
 * the effective-local resolver still resolves, then to the prior deterministic
 * `backends[0]` behavior for the registry-has-no-local case.
 */
function pickFallbackBackend(backends: Backend[]): Backend {
  const healthyLocalBackend = backends.find(
    (backend) =>
      backend.kind === "local" &&
      getBackendHealthEntry(backend.id)?.disabled !== true,
  );
  if (healthyLocalBackend) return healthyLocalBackend;

  const localBackend = backends.find((backend) => backend.kind === "local");
  return localBackend ?? backends[0] ?? NO_BACKEND;
}

function computeSnapshot(
  backends: Backend[],
  selection: BackendSelection | null,
): Snapshot {
  let activeBackend: Backend | null = null;
  let activeOrgId: string | null = null;

  if (selection) {
    const found = backends.find((b) => b.id === selection.backendId);
    if (found) {
      activeBackend = found;
      activeOrgId = selection.orgId ?? null;
    }
    // If the selection points at a removed backend, fall through to
    // the unselected case below; we also drop the orgId since it only
    // makes sense in the context of a specific cloud backend.
  }

  // @spec BM-003 — Fallback on active backend removal
  if (!activeBackend) {
    activeBackend = pickFallbackBackend(backends);
    activeOrgId = null;
  }

  return {
    backends,
    selection,
    active: { backend: activeBackend, orgId: activeOrgId },
  };
}

/**
 * Resolve the selection this tab boots with. A backend pinned in the URL wins
 * over stored state so a link opened in a new tab (cmd/ctrl-click, middle
 * click, "Open in new tab") lands on the backend that owns the linked
 * conversation, even when the new tab starts with an empty `sessionStorage`
 * and would otherwise adopt the `localStorage` fallback. The honoured
 * selection is persisted so later in-tab navigation — which drops the query
 * parameters — keeps the same backend.
 */
function readInitialSelection(backends: Backend[]): BackendSelection | null {
  const fromUrl = readBackendSelectionFromUrl(
    backends,
    currentLocationSearch(),
  );
  if (fromUrl) {
    writeStoredActiveBackend(fromUrl);
    return fromUrl;
  }
  return readStoredActiveBackend();
}

const initialBackends = readStoredBackends();
let snapshot: Snapshot = computeSnapshot(
  initialBackends,
  readInitialSelection(initialBackends),
);

const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getActiveBackend(): ResolvedActiveBackend {
  return snapshot.active;
}

/**
 * Pick the backend to use for *local agent-server protocol* calls.
 *
 * Most of the GUI's services (settings reads/writes, conversation CRUD,
 * skills/MCP/secrets, etc.) speak the local agent-server's protocol —
 * they would fail against a cloud host. Only the active backend is eligible:
 * a cloud selection must not borrow another registered local backend.
 */
export function getEffectiveLocalBackend(): Backend | null {
  const active = snapshot.active.backend;
  if (active.kind === "local" && !isNoBackend(active)) return active;
  return null;
}

/**
 * Whether the active backend implements the OpenHands *app-server* API —
 * conversations, settings, skills, secrets, git, MCP, plugins, agent profiles.
 *
 * Exeaon's cloud backend is the Kratos ai-gateway: it does auth, billing/usage,
 * and LLM-inference proxying, but implements NONE of those app-server endpoints
 * (they return the gateway's plain "404 page not found"). The agent itself
 * always runs on the LOCAL sovereign engine (127.0.0.1:18000), which is always
 * connected; cloud *models* are used as LLM profiles whose inference is routed
 * to the gateway at runtime. So app-server operations must always target the
 * local engine, regardless of which backend is "active" for identity/billing —
 * that is exactly what lets local and cloud models coexist without the app
 * losing its conversations, skills, secrets, or profiles when signed in.
 *
 * This predicate is therefore always false today. It exists as the single,
 * named seam where a future real cloud app-server would opt back in, replacing
 * the scattered `getActiveBackend().backend.kind === "cloud"` app-server checks.
 */
export function isCloudAppServerBackend(): boolean {
  return false;
}

export function getRegisteredBackends(): Backend[] {
  return snapshot.backends;
}

export function getActiveSelection(): BackendSelection | null {
  return snapshot.selection;
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

export function setActiveSelection(selection: BackendSelection | null): void {
  writeStoredActiveBackend(selection);
  snapshot = computeSnapshot(snapshot.backends, selection);
  notify();
}

export function setRegisteredBackends(backends: Backend[]): void {
  writeStoredBackends(backends);

  let nextSelection = snapshot.selection;
  if (
    nextSelection &&
    !backends.some((b) => b.id === nextSelection!.backendId)
  ) {
    nextSelection = null;
    writeStoredActiveBackend(null);
  }

  snapshot = computeSnapshot(backends, nextSelection);
  notify();
}

export function subscribeActiveBackend(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: re-read storage and clear listeners. */

export function __resetActiveStoreForTests(): void {
  const backends = readStoredBackends();
  snapshot = computeSnapshot(backends, readInitialSelection(backends));
  listeners.clear();
}
