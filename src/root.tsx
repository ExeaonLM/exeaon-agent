import { BRAND } from "./exeaon/brand";
import {
  Links,
  LinksFunction,
  Meta,
  MetaFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useNavigation as useRouterNavigation,
} from "react-router";
import "./tailwind.css";
import "./index.css";
import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import {
  clearCachedAgentServerInfo,
  isAgentServerUnavailableError,
  isAgentServerAuthError,
} from "#/api/agent-server-compatibility";
import {
  getLockedCloudAuthMode,
  getLockedCloudHost,
  isAuthRequiredAndMissing,
  isSameCloudHost,
} from "#/api/agent-server-config";
import {
  authenticateWithMainAppCookie,
  redirectToMainAppLogin,
  shouldUseMainAppCookieAuth,
} from "#/api/main-app-auth";
import { getEffectiveLocalBackend } from "#/api/backend-registry/active-store";
import { refreshCloudModels } from "#/exeaon/cloud-models";
import { EngineStartingBanner } from "#/exeaon/engine-starting-banner";
import { useActiveBackendContext } from "#/contexts/active-backend-context";
import {
  isCloudBackendApiKeyOrNetworkHealthError,
  isCloudBackendLoggedOutHealthError,
  useBackendsHealth,
} from "#/hooks/query/use-backends-health";
import { TOAST_OPTIONS } from "#/utils/custom-toast-handlers";
import { ExeaonSplash } from "#/components/features/onboarding/exeaon-splash";
import { useConfig } from "#/hooks/query/use-config";
import { QUERY_KEYS } from "#/hooks/query/query-keys";
import { AgentServerUIRoot } from "#/components/providers";
import { TelemetryConsentBanner } from "#/components/features/analytics/telemetry-consent-banner";
import { buildAgentCanvasPath } from "#/utils/base-path";
import { useOnboardingCompletion } from "#/components/features/onboarding/use-onboarding-completion";
import { NavigationProvider } from "#/context/navigation-context";
import {
  applyColorTheme,
  readPersistedColorTheme,
} from "#/themes/color-themes";

/** Applies the persisted color-theme palette to document.body on mount. */
function ColorThemeApplier() {
  React.useEffect(() => {
    applyColorTheme(readPersistedColorTheme());
  }, []);
  return null;
}

// Rendered when the backend returns 401 (public mode — user must paste key).
const ApiKeyEntryScreen = React.lazy(
  () => import("#/components/features/backends/api-key-entry-screen"),
);

// Rendered only for first-run public/frontend-only bootstraps; keep the
// onboarding flow out of the root bundle until this rare gate is active.
const OnboardingModal = React.lazy(() =>
  import("#/components/features/onboarding/onboarding-modal").then((m) => ({
    default: m.OnboardingModal,
  })),
);

// Rendered for first-run in locked-to-Cloud mode; shows Cloud login directly
// without the onboarding progress bars.
const BackendFormModal = React.lazy(() =>
  import("#/components/features/backends/backend-form-modal").then((m) => ({
    default: m.BackendFormModal,
  })),
);

// Canonical in-app cloud sign-in. Consolidated onto the same full-page
// component the /signin route + account UI use (backend-registry + session
// store, which is what /me and the PRO badge read), replacing the old parallel
// modal flow that stored cloud state separately and was invisible to that UI.
const ExeaonCloudLogin = React.lazy(() =>
  import("#/components/features/backends/exeaon-cloud-login").then((m) => ({
    default: m.ExeaonCloudLogin,
  })),
);

export function Layout({ children }: { children: React.ReactNode }) {
  // Cloud model list sync: a restart (or a fresh connection) re-fetches the
  // gateway's model list so newly published Exeaon models appear without the
  // user typing a name. Cached locally for instant display; refreshed in the
  // background when a cloud connection exists.
  React.useEffect(() => {
    if (localStorage.getItem("exeaon_cloud_key")) {
      void refreshCloudModels();
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body data-agent-server-ui="" className="m-0">
        <AgentServerUIRoot contentClassName="min-h-screen">
          <ColorThemeApplier />
          {children}
          <Toaster toastOptions={TOAST_OPTIONS} />
          <div id="modal-portal-exit" />
        </AgentServerUIRoot>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AgentServerBootstrapLoading() {
  return <ExeaonSplash loop />;
}

/**
 * When the active backend is unreachable, the rest of the app cannot render
 * (most queries chain off of `/server_info`). Show the Exeaon splash with a
 * "Sign in to Exeaon Cloud" entry and auto-retry the probe — the local agent
 * server can take minutes to install on first launch, so this screen closes
 * itself once the backend answers. No backend-management UI: end users only
 * ever see the local agent or the cloud sign-in.
 */
function MissingAgentServerScreen() {
  const queryClient = useQueryClient();
  const [cloudSignInOpen, setCloudSignInOpen] = React.useState(false);

  const retryProbe = React.useCallback(() => {
    clearCachedAgentServerInfo();
    void queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.WEB_CLIENT_CONFIG,
    });
  }, [queryClient]);

  // Poll while this screen is visible so a late-starting backend (uvx
  // first-install) boots the main app without a manual reload.
  React.useEffect(() => {
    const timer = window.setInterval(retryProbe, 3000);
    return () => window.clearInterval(timer);
  }, [retryProbe]);

  return (
    <main
      data-testid="agent-server-onboarding-screen"
      className="min-h-screen bg-base"
    >
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <ExeaonSplash loop />
        <div className="max-w-md">
          <h1 className="text-lg font-semibold text-[var(--oh-text)]">
            Connecting to your local agent…
          </h1>
          <p className="mt-2 text-sm text-[var(--oh-text-secondary)]">
            Exeaon Claw is starting. The first launch installs the agent
            runtime and can take a minute or two — this screen closes by
            itself when it is ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={retryProbe}
            className="rounded-lg border border-[var(--oh-border)] px-4 py-2 text-sm font-medium text-[var(--oh-text)] hover:bg-[var(--oh-surface-raised)]"
          >
            Retry now
          </button>
          <button
            type="button"
            onClick={() => setCloudSignInOpen((v) => !v)}
            className="rounded-lg bg-[#F3CE49] px-4 py-2 text-sm font-semibold text-[#070605] hover:bg-[#F7DA6B]"
          >
            {cloudSignInOpen ? "Hide cloud sign in" : "Sign in to Exeaon Cloud"}
          </button>
        </div>
        {cloudSignInOpen && (
          <div className="w-full max-w-sm rounded-2xl border border-[var(--oh-border)] bg-base-secondary p-6">
            <React.Suspense
              fallback={
                <div className="text-sm text-[var(--oh-muted)]">Loading…</div>
              }
            >
              <ExeaonCloudLogin
                onSignedIn={() => window.location.reload()}
                onUseLocal={() => setCloudSignInOpen(false)}
              />
            </React.Suspense>
          </div>
        )}
      </div>
    </main>
  );
}
function FirstRunOnboardingScreen({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const routerNavigation = useRouterNavigation();
  const conversationId =
    location.pathname.match(/^\/conversations\/([^/]+)/)?.[1] ?? null;
  const navigationValue = React.useMemo(
    () => ({
      currentPath: location.pathname,
      conversationId,
      isNavigating: Boolean(routerNavigation.location),
      navigate: (to: string, options?: { replace?: boolean }) =>
        navigate(to, options),
    }),
    [conversationId, location.pathname, navigate, routerNavigation.location],
  );

  const lockedCloudHost = getLockedCloudHost();
  const isLockedToCloud = lockedCloudHost !== null;

  // In locked-to-Cloud mode, show the Add Backend modal directly with Cloud
  // login, instead of the full onboarding flow with progress bars. This
  // matches the UX expectation for canvas.openhands.dev where Cloud is the
  // only backend option.
  if (isLockedToCloud) {
    return (
      <main
        data-testid="first-run-onboarding-screen"
        className="min-h-screen bg-base"
      >
        <React.Suspense fallback={<AgentServerBootstrapLoading />}>
          <BackendFormModal
            mode="add"
            onClose={onClose}
            source="manage_backends_modal"
            hideCloseButton
          />
        </React.Suspense>
      </main>
    );
  }

  return (
    <main
      data-testid="first-run-onboarding-screen"
      className="min-h-screen bg-base"
    >
      <NavigationProvider value={navigationValue}>
        <React.Suspense fallback={<AgentServerBootstrapLoading />}>
          <OnboardingModal onClose={onClose} />
        </React.Suspense>
      </NavigationProvider>
    </main>
  );
}

export const links: LinksFunction = () => [
  {
    rel: "icon",
    type: "image/svg+xml",
    href: buildAgentCanvasPath("/favicon.svg"),
  },
];

export const meta: MetaFunction = () => [
  { title: BRAND.name },
  { name: "description", content: BRAND.tagline },
];

export default function App() {
  // Flag-based gate: in public mode (VITE_AUTH_REQUIRED=true) with no
  // session key yet, show the auth screen immediately — no network
  // round-trip needed.
  //
  // `isAuthRequiredAndMissing()` only checks for a *baked-in* session
  // key (env var / window global). In public mode the baked key is
  // intentionally absent — the user enters it through the auth screen,
  // which persists it to the backend registry (localStorage). After a
  // reload the baked key is still null, but the registry has the key.
  // So: skip the instant gate when a registered backend already carries
  // an API key — let the normal /server_info probe validate it instead.
  // Brief branded moment (logo) before the shell opens, so a cold
  // start feels intentional rather than blank. The app itself then
  // opens regardless of the agent engine — it boots in the background.
  const [logoDone, setLogoDone] = React.useState(false);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setLogoDone(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  const bakedKeyMissing = isAuthRequiredAndMissing();
  const hasRegisteredKey = Boolean(getEffectiveLocalBackend()?.apiKey);
  const authMissing = bakedKeyMissing && !hasRegisteredKey;
  const { active } = useActiveBackendContext();
  // In locked-to-Cloud mode the only valid backend is a Cloud backend whose
  // host matches the configured locked Cloud host. A missing backend, a stale
  // Local backend (e.g. one persisted from a previous non-locked session), or
  // a Cloud backend pointing at a *different* host must all trigger first-run
  // onboarding instead of the Manage Backends recovery modal — the onboarding
  // flow owns the Cloud login that replaces the stale backend.
  const lockedCloudHost = getLockedCloudHost();
  const lockedCloudAuthMode = getLockedCloudAuthMode();
  const isLockedToCloud = lockedCloudHost !== null;
  // True only when the active backend IS the configured locked Cloud host
  // (normalized comparison so trailing slash / case / protocol differences
  // don't cause false negatives). This is the single signal the locked-mode
  // gates key off of: a reachable stale Local backend or a Cloud backend on
  // another host must never be treated as the locked backend.
  const isActiveLockedCloudBackend =
    isLockedToCloud &&
    active.backend.kind === "cloud" &&
    isSameCloudHost(active.backend.host, lockedCloudHost);
  const { isCompleted: onboardingCompleted, markCompleted } =
    useOnboardingCompletion();

  // In locked-to-Cloud mode the `openhands-onboarded` localStorage flag is
  // not trustworthy: it may have been set during a previous non-locked
  // session on the same origin, and origin-scoped localStorage cannot tell
  // the two deployments apart. So when the active backend is not the locked
  // Cloud host we ignore the completion flag and force first-run onboarding
  // (which owns the Cloud login). A stale completion flag must never strand
  // the user on the Manage Backends recovery modal ("Add Backend") in locked
  // mode.
  //
  // Once the active backend IS the locked Cloud host, a Cloud login that
  // just succeeded (markCompleted fired via the onboarding modal's onClose)
  // must hide first-run onboarding immediately. Treating
  // `onboardingCompleted` as authoritative once the locked Cloud backend is
  // active suppresses reopen flicker. (The flag is only honored when the
  // active backend really is the locked Cloud host, so the stale-flag bypass
  // concerns above don't apply here.)
  const shouldCheckMainAppAuth = shouldUseMainAppCookieAuth();
  const showFirstRunOnboarding = isLockedToCloud
    ? !shouldCheckMainAppAuth &&
      (!isActiveLockedCloudBackend ||
        (lockedCloudAuthMode !== "cookie" && !onboardingCompleted))
    : !onboardingCompleted;
  const mainAppAuth = useQuery({
    queryKey: QUERY_KEYS.MAIN_APP_COOKIE_AUTH,
    queryFn: authenticateWithMainAppCookie,
    enabled: shouldCheckMainAppAuth && !showFirstRunOnboarding,
    retry: false,
    staleTime: 1000 * 60 * 5,
    meta: { disableToast: true },
  });
  const waitingForMainAppAuth =
    shouldCheckMainAppAuth &&
    !showFirstRunOnboarding &&
    mainAppAuth.isPending &&
    !mainAppAuth.isError;
  const redirectingToMainAppLogin =
    shouldCheckMainAppAuth && mainAppAuth.data === false;
  const mainAppAuthAllowsBackendQueries =
    !shouldCheckMainAppAuth || mainAppAuth.data === true || mainAppAuth.isError;

  React.useEffect(() => {
    if (redirectingToMainAppLogin) redirectToMainAppLogin();
  }, [redirectingToMainAppLogin]);

  // Skip the /server_info probe entirely when we already know auth is
  // required and missing — it would just 401 and waste time. Also keep the
  // root bootstrap quiet while the first-run onboarding modal owns backend
  // collection; the onboarding steps issue their own backend-specific queries.
  const config = useConfig({
    enabled:
      !authMissing &&
      !showFirstRunOnboarding &&
      mainAppAuthAllowsBackendQueries,
  });
  const activeCloudHealth = useBackendsHealth(
    active.backend.kind === "cloud" && mainAppAuthAllowsBackendQueries
      ? [active.backend]
      : [],
  )[active.backend.id];
  const activeCloudLoggedOut =
    active.backend.kind === "cloud" &&
    activeCloudHealth?.isConnected === false &&
    isCloudBackendLoggedOutHealthError(activeCloudHealth.lastError);
  // A cloud backend the health probe has given up on (disabled after repeated
  // CORS/network failures) is unreachable from this origin — most commonly a
  // self-hosted OHE that doesn't allow this frontend's origin. Route to the
  // same recovery screen as a logged-out backend so the user sees the real
  // connectivity error, not a misleading "LLM not configured" home page.
  const activeCloudUnreachable =
    active.backend.kind === "cloud" &&
    activeCloudHealth?.disabled === true &&
    isCloudBackendApiKeyOrNetworkHealthError(activeCloudHealth.lastError);

  if (showFirstRunOnboarding) {
    return (
      <>
        <FirstRunOnboardingScreen onClose={markCompleted} />
        <TelemetryConsentBanner />
      </>
    );
  }

  if (waitingForMainAppAuth || redirectingToMainAppLogin) {
    return <AgentServerBootstrapLoading />;
  }

  	// No key at all after onboarding was skipped/completed → auth screen.
  	// Stale key → /server_info 401 → auth screen (public mode only).
  	if (authMissing || isAgentServerAuthError(config.error)) {
  		return (
  			<React.Suspense fallback={<AgentServerBootstrapLoading />}>
  				<ApiKeyEntryScreen />
  			</React.Suspense>
  		);
  	}

  	// Backend unreachable → the Manage Backends recovery screen instead of an
  	// endless splash or a silently blank app shell. The retry policy already
  	// stops retrying unavailable errors; this branch is what the error must
  	// surface into (it previously fell through to <Outlet />).
  	if (config.isError && isAgentServerUnavailableError(config.error)) {
  		// Engine not up yet: hold the logo for a beat, then open the app shell
  		// anyway (settings/models stay usable) while the engine boots in the
  		// background. The banner polls and this branch flips once /server_info
  		// answers; the key change remounts the routes so their queries re-run.
  		if (!logoDone) {
  			return <AgentServerBootstrapLoading />;
  		}
  		return (
  			<>
  				<Outlet key="booting" />
  				<EngineStartingBanner />
  				<TelemetryConsentBanner />
  			</>
  		);
  	}

  if (config.isPending || config.isLoading) {
    return <AgentServerBootstrapLoading />;
  }

  return (
    <>
      <Outlet key="ready" />
      <TelemetryConsentBanner />
    </>
  );
}
