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
const AGENT_SERVER_401_RELOADED_KEY = "oh:agent-server-401-reloaded";
// Suppresses the flood of concurrent 401s that fire the instant the key goes
// stale — the first one schedules the reload, the rest are swallowed silently.
let recoveringAgentServer401 = false;

// Cleared on the next successful response so a genuine LATER key rotation (which
// follows a period of success) still earns its own single reload.
const clearAgentServer401Recovery = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AGENT_SERVER_401_RELOADED_KEY);
  } catch {
    // ignore — nothing to clear if storage is unavailable.
  }
};

const maybeRecoverAgentServer401 = (error: unknown): boolean => {
  if (typeof window === "undefined") return false;
  if (!is401(error)) return false;
  // Cloud 401s are an auth/session concern handled elsewhere (login screen);
  // only the local agent-server's key is recoverable by re-serving the page.
  if (getActiveBackend().backend.kind !== "local") return false;

  // A reload only helps when the key is re-served per page load — the packaged
  // binary injects `window.__AGENT_CANVAS_SESSION_API_KEY__` into index.html.
  // In dev the key is baked into the bundle (`VITE_SESSION_API_KEY`), so a
  // reload re-reads the SAME stale key: reloading is futile (and, on a slow or
  // persistently-401'ing dev agent-server, would just flash a blank screen).
  // Skip auto-reload there and let the 401 surface as a normal toast.
  const bakedKey = import.meta.env.VITE_SESSION_API_KEY;
  if (typeof bakedKey === "string" && bakedKey.trim() !== "") return false;

  // A reload is already scheduled for this burst — swallow the rest.
  if (recoveringAgentServer401) return true;

  // At most ONE reload per stale-key episode. If we already reloaded and it's
  // STILL 401, the reload didn't fix it (server down, or slow to boot) — do NOT
  // reload again, or the app is trapped in a blank reload loop. Fall through to
  // the normal toast instead. The guard lives in sessionStorage so it survives
  // the reload, and is cleared on the next success. If storage can't be read or
  // written we can't guarantee the loop-guard, so we skip auto-reload entirely
  // (a toast is a far better failure than an infinite reload).
  try {
    if (window.sessionStorage.getItem(AGENT_SERVER_401_RELOADED_KEY) === "1") {
      return false;
    }
    window.sessionStorage.setItem(AGENT_SERVER_401_RELOADED_KEY, "1");
  } catch {
    return false;
  }

  recoveringAgentServer401 = true;
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
        // A successful response means the key is valid again — reset the 401
        // reload guard so a future rotation can recover once more.
        clearAgentServer401Recovery();
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
