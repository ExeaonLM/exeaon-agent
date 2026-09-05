import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import i18n from "#/i18n";
import { I18nKey } from "./i18n/declaration";
import { retrieveAxiosErrorMessage } from "./utils/retrieve-axios-error-message";
import {
  displayErrorToast,
  displayWarningToast,
} from "./utils/custom-toast-handlers";
import { getActiveBackend } from "#/api/backend-registry/active-store";
import { recordBackendSuccess } from "#/api/backend-registry/health-store";

const is401 = (error: unknown): boolean =>
  error instanceof AxiosError &&
  (error.response?.status === 401 || error.status === 401);

const handle401Error = (error: AxiosError, client: QueryClient) => {
  if (error?.response?.status === 401 || error?.status === 401) {
    client.invalidateQueries({ queryKey: ["user", "authenticated"] });
  }
};

// The local agent-server's session API key is delivered only at page-serve time
// (baked `VITE_SESSION_API_KEY` in dev, or `window.__AGENT_CANVAS_SESSION_API_KEY__`
// injected into index.html for the packaged app). When the agent-server restarts
// it mints a NEW key, so the running app's key goes stale and every call 401s —
// with no way to fetch a fresh key from JS by design. The only recovery is a page
// reload, which re-reads the freshly-injected key (this is the "a page refresh
// recovers" note in agent-server-compatibility.ts). So on a local-backend 401 we
// reload once, automatically, instead of dead-ending in a toast.
const AGENT_SERVER_401_RELOAD_KEY = "oh:agent-server-401-reload-at";
// Long enough to cover the post-reload 401 burst (so we never double-reload),
// short enough that a genuinely-later rotation still recovers on its own.
const AGENT_SERVER_401_RELOAD_COOLDOWN_MS = 30_000;
// Suppresses the flood of concurrent 401s that fire the instant the key goes
// stale — the first one schedules the reload, the rest are swallowed silently.
let recoveringAgentServer401 = false;

const maybeRecoverAgentServer401 = (error: unknown): boolean => {
  if (typeof window === "undefined") return false;
  if (!is401(error)) return false;
  // Cloud 401s are an auth/session concern handled elsewhere (login screen);
  // only the local agent-server's key is recoverable by re-serving the page.
  if (getActiveBackend().backend.kind !== "local") return false;

  // A reload is already scheduled for this burst — swallow the rest.
  if (recoveringAgentServer401) return true;

  let lastReloadAt = 0;
  try {
    lastReloadAt = Number(
      window.sessionStorage.getItem(AGENT_SERVER_401_RELOAD_KEY) ?? "0",
    );
  } catch {
    // sessionStorage unavailable (private mode) — treat as never reloaded.
  }
  // We already reloaded once and it's STILL 401 (server down, not just a key
  // rotation) — stop, don't loop; let the toast surface so the user knows.
  if (
    lastReloadAt &&
    Date.now() - lastReloadAt < AGENT_SERVER_401_RELOAD_COOLDOWN_MS
  ) {
    return false;
  }

  recoveringAgentServer401 = true;
  try {
    window.sessionStorage.setItem(
      AGENT_SERVER_401_RELOAD_KEY,
      String(Date.now()),
    );
  } catch {
    // Best-effort; without persistence the cooldown just won't survive reload.
  }
  displayWarningToast("Agent server session refreshed — reconnecting…");
  // Small delay so the notice is visible before the window reloads.
  window.setTimeout(() => window.location.reload(), 700);
  return true;
};

const isActiveCloudBackendAuthError = (error: unknown) => {
  if (!(error instanceof AxiosError)) return false;
  if (error.response?.status !== 401 && error.status !== 401) return false;

  const activeBackend = getActiveBackend().backend;
  if (activeBackend.kind !== "cloud") return false;

  const requestUrl = error.config?.url || "";
  const baseURL = error.config?.baseURL || "";
  const host = activeBackend.host.replace(/\/+$/, "");

  return (
    !requestUrl ||
    requestUrl.startsWith(host) ||
    baseURL.startsWith(host) ||
    requestUrl.startsWith("/api/")
  );
};

const shownErrors = new Set<string>();

export const createAgentServerQueryClient = () => {
  const client = new QueryClient({
    queryCache: new QueryCache({
      onSuccess: (_data, query) => {
        const backendId =
          query.meta?.backendId ?? query.options.meta?.backendId;
        if (typeof backendId === "string") {
          recordBackendSuccess(backendId);
        }
      },
      onError: (error, query) => {
        const isAuthQuery =
          query.queryKey[0] === "user" && query.queryKey[1] === "authenticated";
        if (!isAuthQuery) {
          handle401Error(error, client);
          // Local agent-server key went stale (server restarted) — reload once
          // to pick up the freshly-served key instead of dead-ending in a toast.
          if (maybeRecoverAgentServer401(error)) return;
        }

        const disableToast =
          query.meta?.disableToast ?? query.options.meta?.disableToast;

        if (!disableToast && !isActiveCloudBackendAuthError(error)) {
          const errorMessage = retrieveAxiosErrorMessage(error);

          if (!shownErrors.has(errorMessage || "")) {
            displayErrorToast(errorMessage || i18n.t(I18nKey.ERROR$GENERIC));
            shownErrors.add(errorMessage || "");

            setTimeout(() => {
              shownErrors.delete(errorMessage || "");
            }, 3000);
          }
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _, __, mutation) => {
        handle401Error(error, client);
        if (maybeRecoverAgentServer401(error)) return;

        const disableToast =
          mutation?.meta?.disableToast ?? mutation?.options.meta?.disableToast;

        if (!disableToast && !isActiveCloudBackendAuthError(error)) {
          const message = retrieveAxiosErrorMessage(error);
          displayErrorToast(message || i18n.t(I18nKey.ERROR$GENERIC));
        }
      },
    }),
  });

  return client;
};

let defaultQueryClient: QueryClient | null = null;
let activeQueryClient: QueryClient | null = null;

export const getDefaultQueryClient = () => {
  if (!defaultQueryClient) {
    defaultQueryClient = createAgentServerQueryClient();
    if (import.meta.env.DEV || import.meta.env.VITE_MOCK_API === "true") {
      (
        window as unknown as { __OH_QUERY_CLIENT__?: typeof defaultQueryClient }
      ).__OH_QUERY_CLIENT__ = defaultQueryClient;
    }
  }

  return defaultQueryClient;
};

export const getQueryClient = () =>
  activeQueryClient ?? getDefaultQueryClient();

export const setQueryClient = (client?: QueryClient | null) => {
  activeQueryClient = client ?? getDefaultQueryClient();
  return activeQueryClient;
};

export const queryClient = new Proxy({} as QueryClient, {
  get: (_target, prop) => {
    const client = getQueryClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set: (_target, prop, value) => {
    const client = getQueryClient();
    return Reflect.set(client, prop, value, client);
  },
}) as QueryClient;
