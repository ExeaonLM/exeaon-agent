import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FaGithub } from "react-icons/fa6";
import { LogOut } from "lucide-react";
import { SecretsService } from "#/api/secrets-service";
import { GITHUB_TOKEN_SECRET } from "#/constants/github-oauth";
import {
  clearGitHubAccount,
  readGitHubAccount,
} from "#/api/cloud/github-account-store";
import { cn } from "#/utils/utils";

/**
 * VSCode-style connected-account chip for GitHub: a rounded avatar + the account
 * name, opening a small menu whose only action is Disconnect (with a
 * confirmation). Identity comes from the offline cache, so it renders on reload
 * and offline; the avatar falls back to the login initial when unavailable.
 *
 * Render this only when GitHub is connected — the parent gates on the secret's
 * presence, and disconnecting here removes that secret so the parent unmounts us.
 */
export function GitHubAccountChip({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const account = readGitHubAccount();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const label = account?.name || account?.login || "GitHub";
  const initial = (account?.login || account?.name || "G")
    .trim()
    .charAt(0)
    .toUpperCase();

  const disconnect = async () => {
    if (
      !window.confirm(
        "Disconnect GitHub? Exeaon will forget your GitHub token, so cloning, branches, and pull requests stop working until you reconnect.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await SecretsService.deleteSecret(GITHUB_TOKEN_SECRET);
      clearGitHubAccount();
      await queryClient.invalidateQueries({ queryKey: ["secrets"] });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
        title={account?.login ? `@${account.login}` : "GitHub"}
      >
        {account?.avatar ? (
          <img
            src={account.avatar}
            alt=""
            className="size-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
            {initial}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-[var(--oh-foreground)]">
            {label}
          </span>
          {account?.login ? (
            <span className="truncate text-[11px] text-[var(--oh-muted)]">
              GitHub · @{account.login}
            </span>
          ) : (
            <span className="truncate text-[11px] text-[var(--oh-muted)]">
              GitHub connected
            </span>
          )}
        </span>
        <FaGithub className="size-4 shrink-0 text-[var(--oh-muted)]" />
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-full min-w-[190px] rounded-xl border border-[#2B2316] bg-[#141413] p-1.5 shadow-2xl">
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--oh-foreground)] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <LogOut className="size-4 text-[var(--oh-muted)]" aria-hidden />
            <span>{busy ? "Disconnecting…" : "Disconnect GitHub"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
