import React from "react";
import { Laptop, LogOut, Sparkles, Cpu, RefreshCw, Pencil } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { BrandButton } from "#/components/features/settings/brand-button";
import { BrandBadge } from "#/components/shared/badge";
import { ConnectGitHubButton } from "#/components/features/home/connect-github-button";
import { useSearchSecrets } from "#/hooks/query/use-get-secrets";
import { SecretsService } from "#/api/secrets-service";
import { GITHUB_TOKEN_SECRET } from "#/constants/github-oauth";
import {
  clearGitHubAccount,
  readGitHubAccount,
} from "#/api/cloud/github-account-store";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { readCloudUser, cloudLogout } from "#/api/cloud/session-store";
import {
  fetchCloudMe,
  renameCloudOrg,
  type CloudMe,
} from "#/api/cloud/exeaon-me.api";

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
      if (
        !window.confirm(
          "Log out of Exeaon Cloud? You'll need to sign in again to use cloud models and your account.",
        )
      ) {
        return;
      }
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

  // Org rename (owner/admin only; the gateway also enforces it).
  const canRenameOrg =
    me?.role === "owner" || me?.role === "admin" || !!me?.isPlatformAdmin;
  const [editingOrg, setEditingOrg] = React.useState(false);
  const [orgDraft, setOrgDraft] = React.useState("");
  const [savingOrg, setSavingOrg] = React.useState(false);
  const [orgError, setOrgError] = React.useState("");

  const startEditOrg = () => {
    setOrgDraft(me?.orgName || "");
    setOrgError("");
    setEditingOrg(true);
  };
  const saveOrgName = async () => {
    const name = orgDraft.trim();
    if (!name) {
      setOrgError("Enter an organization name.");
      return;
    }
    setSavingOrg(true);
    setOrgError("");
    try {
      const saved = await renameCloudOrg(name);
      setMe((prev) => (prev ? { ...prev, orgName: saved } : prev));
      setEditingOrg(false);
    } catch {
      setOrgError("Could not rename. Check your connection and role.");
    } finally {
      setSavingOrg(false);
    }
  };

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
                Organization
              </span>
              {editingOrg ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={orgDraft}
                      onChange={(e) => setOrgDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveOrgName();
                        if (e.key === "Escape") setEditingOrg(false);
                      }}
                      disabled={savingOrg}
                      maxLength={128}
                      className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-xs outline-none focus:border-[#F3CE49]"
                    />
                    <button
                      type="button"
                      onClick={saveOrgName}
                      disabled={savingOrg}
                      className="rounded bg-[#F3CE49] px-2 py-1 text-[11px] font-semibold text-black hover:bg-[#F7DA6B] disabled:opacity-50"
                    >
                      {savingOrg ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingOrg(false)}
                      disabled={savingOrg}
                      className="text-[11px] text-[var(--oh-muted)] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  {orgError && (
                    <span className="text-[11px] text-red-400">{orgError}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {me?.orgName || (loading ? "…" : "—")}
                  </span>
                  {canRenameOrg && me && (
                    <button
                      type="button"
                      onClick={startEditOrg}
                      title="Rename organization"
                      className="text-[var(--oh-muted)] hover:text-white"
                    >
                      <Pencil className="size-3" />
                    </button>
                  )}
                </div>
              )}
              {me && me.tenantId > 0 && (
                <code className="mt-1 inline-block text-[10px] text-[var(--oh-muted)] font-mono select-all">
                  ID {me.tenantId}
                </code>
              )}
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

        {/* GitHub connection (Device Flow). Connect/disconnect the token the
            git-service uses for real repositories. */}
        <GitHubConnectionCard />
      </section>
    </div>
  );
}

function GitHubConnectionCard() {
  const queryClient = useQueryClient();
  const { data: secrets = [] } = useSearchSecrets();
  const isConnected = secrets.some((s) => s.name === GITHUB_TOKEN_SECRET);
  const account = isConnected ? readGitHubAccount() : null;
  const [isPending, setIsPending] = React.useState(false);

  const disconnect = async () => {
    if (
      !window.confirm(
        "Disconnect GitHub? Exeaon will forget your GitHub token, so cloning, branches, and pull requests stop working until you reconnect.",
      )
    ) {
      return;
    }
    setIsPending(true);
    try {
      await SecretsService.deleteSecret(GITHUB_TOKEN_SECRET);
      clearGitHubAccount();
      await queryClient.invalidateQueries({ queryKey: ["secrets"] });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4">
      <div className="flex items-center gap-3">
        {account?.avatar ? (
          <img
            src={account.avatar}
            alt=""
            className="size-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white">
            <FaGithub className="size-4" />
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {account?.name || account?.login || "GitHub"}
            </span>
            {isConnected ? (
              <>
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">
                  Connected
                </span>
              </>
            ) : (
              <span className="text-[11px] text-[var(--oh-muted)]">
                Not connected
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--oh-muted)]">
            {account?.login
              ? `GitHub · @${account.login}`
              : "Clone, branch, and open pull requests on your repositories"}
          </span>
        </div>
      </div>

      {isConnected ? (
        <BrandButton
          type="button"
          variant="secondary"
          className="text-xs"
          onClick={disconnect}
          isDisabled={isPending}
        >
          {isPending ? "Disconnecting…" : "Disconnect"}
        </BrandButton>
      ) : (
        <ConnectGitHubButton />
      )}
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
