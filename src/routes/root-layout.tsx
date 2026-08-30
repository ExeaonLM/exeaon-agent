import React from "react";
import {
  useRouteError,
  isRouteErrorResponse,
  Outlet,
  useLocation,
} from "react-router";
import { useTranslation } from "react-i18next";
import { Plug, RefreshCw, TriangleAlert } from "lucide-react";
import { I18nKey } from "#/i18n/declaration";
import i18n from "#/i18n";
import { isAgentServerUnavailableError } from "#/api/agent-server-compatibility";
import { useConfig } from "#/hooks/query/use-config";
import { Sidebar } from "#/components/features/sidebar/sidebar";
import { SidebarMobileNavProvider } from "#/components/features/sidebar/sidebar-mobile-nav-context";
import { SidebarMobileMenuBar } from "#/components/features/sidebar/sidebar-mobile-menu-bar";
import { useSettings } from "#/hooks/query/use-settings";
import { useEnsureActiveProfile } from "#/hooks/use-ensure-active-profile";
import { useSyncTelemetryConsent } from "#/hooks/use-sync-telemetry-consent";
import { useSyncAutomationTelemetryConsent } from "#/hooks/use-sync-automation-telemetry-consent";

import { useTelemetryIdentity } from "#/hooks/use-telemetry-identity";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { useAppTitle } from "#/hooks/use-app-title";
import { ReactRouterNavigationProvider } from "./react-router-navigation-provider";
import { OnboardingHost } from "#/components/features/onboarding";
import { isOnboardingPreviewActive } from "#/components/features/onboarding/onboarding-preview";

const EnvironmentSwitchOverlay = React.lazy(
  () => import("#/components/features/backends/environment-switch-overlay"),
);
const AlertBanner = React.lazy(() =>
  import("#/components/features/alerts/alert-banner").then((m) => ({
    default: m.AlertBanner,
  })),
);
const CommandMenu = React.lazy(() =>
  import("#/components/features/command-menu/command-menu").then((m) => ({
    default: m.CommandMenu,
  })),
);

export function ErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation("openhands");

  const engineDown = isAgentServerUnavailableError(error);
  const title = engineDown
    ? "Engine not reachable"
    : isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`.trim()
      : t(I18nKey.ERROR$GENERIC);
  const message = engineDown
    ? "The local engine isn't responding yet. It may still be starting up — give it a moment and reload. If this persists, restart Exeaon Claw."
    : isRouteErrorResponse(error)
      ? typeof error.data === "string"
        ? error.data
        : JSON.stringify(error.data)
      : error instanceof Error
        ? error.message
        : t(I18nKey.ERROR$UNKNOWN);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-base px-6 text-center">
      <div
        className={`flex size-14 items-center justify-center rounded-2xl border ${
          engineDown
            ? "border-[#FFD026]/30 bg-[#FFD026]/10 text-[#FFD026]"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}
      >
        {engineDown ? (
          <Plug className="size-7" aria-hidden />
        ) : (
          <TriangleAlert className="size-7" aria-hidden />
        )}
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="text-sm leading-relaxed text-[var(--oh-muted)]">
          {message}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-lg bg-[#F3CE49] px-4 py-2 text-sm font-semibold text-[#070605] hover:bg-[#F7DA6B]"
        >
          <RefreshCw className="size-4" aria-hidden />
          Reload
        </button>
      </div>
    </div>
  );
}

export default function MainApp() {
  const location = useLocation();
  const appTitle = useAppTitle();
  const { data: settings } = useSettings();
  const config = useConfig();

  useSyncAutomationTelemetryConsent();

  useSyncTelemetryConsent();
  useTelemetryIdentity();
  // Local-mode policy: keep a profile active so a usable LLM is always selected.
  useEnsureActiveProfile();

  React.useEffect(() => {
    if (settings?.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings?.language]);

  if (config.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Conversation + full-screen panel routes put the mobile menu control in the
  // chat / panel header; omit the extra top row so we don't duplicate chrome.
  const hideMobileSidebarMenuBar = /^\/conversations\/[^/]+/.test(
    location.pathname,
  );
  const showOnboardingPreview = isOnboardingPreviewActive(location.search);

  return (
    <ReactRouterNavigationProvider>
      <SidebarMobileNavProvider>
        <div
          data-testid="root-layout"
          className="h-screen lg:min-w-5xl flex flex-col md:flex-row bg-base overflow-hidden p-0"
        >
          <title>{appTitle}</title>
          <Sidebar />

          <div className="flex min-h-0 flex-col w-full min-w-0 h-full gap-3">
            {!hideMobileSidebarMenuBar ? <SidebarMobileMenuBar /> : null}
            {config.data &&
              (config.data.maintenance_start_time ||
                (config.data.faulty_models &&
                  config.data.faulty_models.length > 0) ||
                config.data.error_message) && (
                <React.Suspense fallback={null}>
                  <AlertBanner
                    maintenanceStartTime={config.data.maintenance_start_time}
                    faultyModels={config.data.faulty_models}
                    errorMessage={config.data.error_message}
                    updatedAt={config.data.updated_at}
                  />
                </React.Suspense>
              )}
            <div
              id="root-outlet"
              className="relative flex-1 overflow-auto px-0 custom-scrollbar"
            >
              <Outlet />
            </div>
          </div>
        </div>
        <React.Suspense fallback={null}>
          <EnvironmentSwitchOverlay />
          <CommandMenu />
        </React.Suspense>
        {showOnboardingPreview ? <OnboardingHost /> : null}
      </SidebarMobileNavProvider>
    </ReactRouterNavigationProvider>
  );
}
