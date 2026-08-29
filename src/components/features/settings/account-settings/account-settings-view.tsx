import React from "react";
import { Laptop, LogOut, Sparkles, Cpu, RefreshCw } from "lucide-react";
import { BrandButton } from "#/components/features/settings/brand-button";
import { BrandBadge } from "#/components/shared/badge";
import { useNavigate } from "react-router";
import { readCloudUser, cloudLogout } from "#/api/cloud/session-store";
import { fetchCloudMe, type CloudMe } from "#/api/cloud/exeaon-me.api";

function fmtInt(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}

export function AccountSettingsView() {
  const navigate = useNavigate();
  // Re-read on every render trigger so logout/login reflects immediately.
  const [tick, setTick] = React.useState(0);
  const user = React.useMemo(() => readCloudUser(), [tick]);
  const isCloudConnected = !!user;

  const [me, setMe] = React.useState<CloudMe | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Fetch the enriched session (plan + usage) on mount and on refresh/login.
  const refresh = React.useCallback(() => {
    if (!isCloudConnected) {
      setMe(null);
      return;
    }
    setLoading(true);
    setError(false);
    fetchCloudMe()
      .then((data) => setMe(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isCloudConnected]);

  React.useEffect(() => {
    refresh();
  }, [refresh, tick]);

  const initial = (me?.displayName || user?.displayName || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const handleAuthClick = () => {
    if (isCloudConnected) {
      cloudLogout();
      setTick((n) => n + 1);
    } else {
      navigate("/signin");
    }
  };

  const tier = me?.tier ?? "free";
  const isPro = tier === "pro";
  const roleLabel =
    me?.role ||
    (user?.isPlatformAdmin || me?.isPlatformAdmin ? "Administrator" : "Member");

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Profile & Identity Section */}
      <section className="flex flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-tr from-[#FFD026] to-[#FF7A00] text-black font-semibold text-base shadow-[0_0_15px_rgba(255,208,38,0.3)]">
              {initial}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {me?.displayName ||
                    user?.displayName ||
                    user?.email ||
                    "Not signed in"}
                </span>
                {isCloudConnected && (
                  <BrandBadge
                    className={
                      isPro
                        ? "px-2 py-0.5 text-[10px] bg-[#FFD026]/10 text-[#FFD026] border border-[#FFD026]/30"
                        : "px-2 py-0.5 text-[10px] bg-white/5 text-[var(--oh-muted)] border border-white/10"
                    }
                  >
                    {isPro ? "PRO" : "FREE"}
                  </BrandBadge>
                )}
              </div>
              <span className="text-xs text-[var(--oh-muted)]">
                {me?.email || user?.email || "Sign in to use Exeaon Cloud"}
              </span>
            </div>
          </div>

          <BrandButton
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={handleAuthClick}
          >
            <LogOut className="size-3.5 mr-1 text-[var(--oh-muted)]" />
            {isCloudConnected ? "Log out of Cloud" : "Sign in"}
          </BrandButton>
        </div>

        {isCloudConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[var(--oh-border)] text-xs">
            <div>
              <span className="text-[var(--oh-muted)] block mb-1">
                Organization ID
              </span>
              <code className="bg-black/40 px-2 py-1 rounded text-white font-mono text-[11px] select-all border border-white/5">
                {me ? me.tenantId || "—" : loading ? "…" : "—"}
              </code>
            </div>
            <div>
              <span className="text-[var(--oh-muted)] block mb-1">Role</span>
              <span className="text-white font-medium capitalize">
                {roleLabel}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Usage & Plan — Cloud (real, derived from billing) */}
      {isCloudConnected && (
        <section className="flex flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#FFD026]" />
              <h3 className="text-sm font-medium text-white">
                Usage & Plan · Cloud
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--oh-muted)]">
                Last {me?.windowDays ?? 30} days
              </span>
              <button
                type="button"
                onClick={refresh}
                className="text-[var(--oh-muted)] hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw
                  className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-xs text-[var(--oh-muted)]">
              Usage is unavailable right now. It will appear once the cloud
              gateway is reachable.
            </p>
          ) : (
            <>
              {/* Plan line */}
              <div className="flex justify-between text-xs">
                <span className="text-[var(--oh-muted)]">Plan</span>
                <span className="text-white font-medium">
                  {isPro ? "Pro — funded account" : "Free — pay-as-you-go"}
                  {me?.currency && me.balanceCredits > 0
                    ? ` · ${fmtInt(me.balanceCredits)} ${me.currency} credits`
                    : ""}
                </span>
              </div>

              {/* Credit balance bar (only meaningful when a limit exists) */}
              {me && me.creditLimitCredits > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--oh-muted)]">
                      Credit balance
                    </span>
                    <span className="text-white font-medium">
                      {fmtInt(me.balanceCredits)} /{" "}
                      {fmtInt(me.creditLimitCredits)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFD026] to-[#FF7A00] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            (me.balanceCredits / me.creditLimitCredits) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Real usage stats */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--oh-border)]">
                <Stat label="Requests" value={me ? fmtInt(me.requests) : "…"} />
                <Stat
                  label="Tokens"
                  value={me ? fmtInt(me.totalTokens) : "…"}
                />
                <Stat
                  label="Spend"
                  value={
                    me
                      ? `${fmtInt(me.spendCredits)} ${me.currency || "cr"}`
                      : "…"
                  }
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* Execution Connections */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-white">
          Execution Connections
        </h3>

        {/* Local Sovereign Engine Connection */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Laptop className="size-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  Local Sovereign Engine
                </span>
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">
                  Connected
                </span>
              </div>
              <span className="text-xs text-[var(--oh-muted)] font-mono">
                http://127.0.0.1:18000
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--oh-muted)] bg-black/30 px-2.5 py-1 rounded-md border border-white/5">
            <Cpu className="size-3 text-[var(--oh-muted)]" />
            <span>On-device · unmetered</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-[var(--oh-muted)]">
        {label}
      </span>
      <span className="text-sm text-white font-semibold">{value}</span>
    </div>
  );
}
