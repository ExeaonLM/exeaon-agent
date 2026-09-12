import { useState } from "react";
import { FaGithub } from "react-icons/fa6";
import { useSearchSecrets } from "#/hooks/query/use-get-secrets";
import { GITHUB_TOKEN_SECRET } from "#/constants/github-oauth";
import { GitHubRepoModal } from "./github-repo-modal";

/**
 * Home pill shown once GitHub is connected: opens the repo picker to clone one
 * of the user's real repositories into a new conversation. Hidden when GitHub
 * isn't connected (the ConnectGitHubButton handles that state).
 */
export function GitHubRepoButton() {
  const { data: secrets = [] } = useSearchSecrets();
  const isConnected = secrets.some((s) => s.name === GITHUB_TOKEN_SECRET);
  const [open, setOpen] = useState(false);

  if (!isConnected) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-full border border-[var(--oh-border)] pl-3 pr-3.5 text-sm text-[var(--oh-fg)] transition-colors hover:border-[#F3CE49]/50"
      >
        <FaGithub className="size-3.5 text-[var(--oh-muted)]" />
        Clone repo
      </button>
      {open ? <GitHubRepoModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
