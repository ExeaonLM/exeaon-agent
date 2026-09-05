import { useTranslation } from "react-i18next";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";

import { type Backend } from "#/api/backend-registry/types";
import {
  isCloudBackendLoggedOutHealthError,
  isInvalidBackendApiKeyHealthError,
  type BackendHealth,
} from "#/hooks/query/use-backends-health";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import { BackendStatusDot } from "./backend-status-dot";
import { BackendVersion } from "./backend-version";
import { DeviceFlowAuth } from "./device-flow-auth";
import { getBackendStatusLabel } from "./backend-status-label";
import { getLockedCloudHost } from "#/api/agent-server-config";

const ROW_ACTION_BUTTON_CLASS =
  "inline-flex cursor-pointer items-center justify-center rounded-md p-1 text-muted transition-colors hover:bg-interactive-hover hover:text-white";

interface BackendRowProps {
  backend: Backend;
  health: BackendHealth | undefined;
  orgLabel?: string;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onLogin?: (apiKey: string) => void;
}

export function BackendRow({
  backend,
  health,
  orgLabel,
  onSelect,
  onEdit,
  onRemove,
  onLogin,
}: BackendRowProps) {
  const { t } = useTranslation("openhands");
  const isInvalidApiKey = isInvalidBackendApiKeyHealthError(health?.lastError);
  const isCloudLoggedOut =
    backend.kind === "cloud" &&
    isCloudBackendLoggedOutHealthError(health?.lastError);
  const isServerDown =
    health?.isConnected === false &&
    health.lastError &&
    (health.lastError.includes("502") ||
      health.lastError.includes("ECONNREFUSED") ||
      health.lastError.includes("127.0.0.1:18000"));

  const statusDetail = isServerDown
    ? "Exeaon Sovereign Server Offline — Please restart the application."
    : !isInvalidApiKey &&
        !isCloudLoggedOut &&
        health?.isConnected === false &&
        health.lastError
      ? health.lastError
      : null;

  const statusLabel = isCloudLoggedOut
    ? t(I18nKey.BACKEND$LOGGED_OUT)
    : isServerDown
      ? "Server Offline"
      : getBackendStatusLabel(t, backend, health);

  const statusClassName =
    health?.isConnected === true
      ? "text-green-300"
      : health?.isConnected === false
        ? "text-red-400 font-medium"
        : "text-[var(--oh-muted)]";
  const dotStatus = isInvalidApiKey ? false : (health?.isConnected ?? null);
  const canSelect = health?.isConnected === true && !isInvalidApiKey;

  return (
    <li
      className="flex items-stretch"
      data-testid={`manage-backends-row-${backend.name}`}
    >
      <button
        type="button"
        disabled={!canSelect}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left",
          canSelect
            ? "cursor-pointer transition-colors hover:bg-interactive-hover focus-visible:bg-interactive-hover focus-visible:outline-none"
            : "cursor-default",
        )}
      >
        <BackendStatusDot isConnected={dotStatus} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">
              {backend.name}
            </span>
            <BackendVersion backend={backend} />
          </div>
          {orgLabel ? (
            <span
              data-testid={`manage-backends-org-${backend.name}`}
              className="truncate text-xs text-[var(--oh-text-secondary)]"
            >
              {orgLabel}
            </span>
          ) : null}
          <span className="truncate text-xs text-[var(--oh-muted)] font-mono">
            {backend.host}
          </span>
          <span
            data-testid={`manage-backends-status-${backend.name}`}
            className={cn("truncate text-xs mt-0.5", statusClassName)}
          >
            {statusLabel}
          </span>
          {statusDetail ? (
            <span
              data-testid={`manage-backends-status-detail-${backend.name}`}
              title={statusDetail}
              className="text-xs text-red-400/90 whitespace-normal break-words mt-0.5"
            >
              {statusDetail}
            </span>
          ) : null}
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20">
          {backend.kind === "cloud"
            ? t(I18nKey.BACKEND$KIND_CLOUD)
            : t(I18nKey.BACKEND$KIND_LOCAL)}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2 px-3 py-3">
        {isCloudLoggedOut && onLogin ? (
          <DeviceFlowAuth
            host={backend.host}
            onSuccess={onLogin}
            testIdRoot={`manage-backends-login-${backend.id}`}
            idleButtonLabel={t(I18nKey.BACKEND$LOG_BACK_IN)}
            idleButtonContent={
              <RefreshCw className="size-4" strokeWidth={2} aria-hidden />
            }
            className="w-auto"
            buttonVariant="unstyled"
            buttonClassName={ROW_ACTION_BUTTON_CLASS}
            statusDisplay="modal"
            analyticsSource="manage_backends_modal"
          />
        ) : null}
      </div>
    </li>
  );
}
