import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearCachedAgentServerInfo } from "#/api/agent-server-compatibility";
import { QUERY_KEYS } from "#/hooks/query/query-keys";

/**
 * Non-blocking "agent engine is starting" banner.
 *
 * The app shell opens immediately; this banner sits on top while the local
 * agent server boots in the background. It re-probes every 3s and disappears
 * on its own once `/server_info` answers. Progress copy changes over time so
 * a first launch never looks frozen.
 */
const STEPS = [
  { after: 0, label: "Preparing the agent engine…" },
  { after: 6000, label: "Starting services…" },
  { after: 20000, label: "Still starting — first launch can take a minute." },
];

export function EngineStartingBanner() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = React.useState(0);

  const retry = React.useCallback(() => {
    clearCachedAgentServerInfo();
    void queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.WEB_CLIENT_CONFIG,
    });
  }, [queryClient]);

  // Re-probe while the banner is visible.
  React.useEffect(() => {
    const timer = window.setInterval(retry, 3000);
    return () => window.clearInterval(timer);
  }, [retry]);

  // Progress copy that changes as the wait grows.
  React.useEffect(() => {
    const timer = window.setInterval(() => setElapsed((s) => s + 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const step = [...STEPS].reverse().find((s) => elapsed >= s.after) ?? STEPS[0];

  return (
    <div
      data-testid="engine-starting-banner"
      className="flex items-center gap-3 border-b border-[var(--oh-border)] bg-[var(--oh-surface-raised)] px-4 py-2"
    >
      <span
        className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--oh-border)] border-t-[#F3CE49]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--oh-text)]">
          Starting your agent engine…
        </div>
        <div className="truncate text-xs text-[var(--oh-text-secondary)]">
          {step.label} You can use Settings and Models in the meantime.
        </div>
      </div>
      <button
        type="button"
        onClick={retry}
        className="shrink-0 rounded-lg border border-[var(--oh-border)] px-3 py-1 text-xs font-medium text-[var(--oh-text)] hover:bg-[var(--oh-bg)]"
      >
        Retry now
      </button>
    </div>
  );
}
