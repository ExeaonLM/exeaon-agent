import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaGithub } from "react-icons/fa6";
import { Loader2, Lock, Search } from "lucide-react";
import {
  listGitHubBranches,
  listGitHubRepos,
  type GitHubRepo,
} from "#/api/github-repos";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useNavigation } from "#/context/navigation-context";
import {
  displayErrorToast,
  TOAST_OPTIONS,
} from "#/utils/custom-toast-handlers";

/**
 * Clone a real GitHub repository into a new conversation. Lists the user's repos
 * (via the connected token, read back from the Secret store), lets them pick a
 * branch, and launches a conversation whose first task is to clone the repo into
 * its workspace using `$GITHUB_TOKEN` — so the agent operates on actual code.
 */
export function GitHubRepoModal({ onClose }: { onClose: () => void }) {
  const { navigate } = useNavigation();
  const { mutateAsync: createConversation, isPending: isCreating } =
    useCreateConversation();

  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [branch, setBranch] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    listGitHubRepos()
      .then((list) => {
        if (!cancelled) setRepos(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load repos.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? repos.filter((r) => r.fullName.toLowerCase().includes(q))
      : repos;
    return list.slice(0, 50);
  }, [repos, query]);

  const pickRepo = (repo: GitHubRepo) => {
    setSelected(repo);
    setBranch(repo.defaultBranch);
    setBranches(null);
    listGitHubBranches(repo.fullName)
      .then((bs) => setBranches(bs.map((b) => b.name)))
      .catch(() => setBranches([repo.defaultBranch]));
  };

  const launch = async () => {
    if (!selected || isCreating) return;
    const ref = branch || selected.defaultBranch;
    // Clone into a workspace folder NAMED after the repo (not a random scratch
    // hex) so it groups under the repo name in the sidebar, shows in the Files
    // panel, and is findable on disk. `workingDir` is persisted as the
    // conversation's selected_workspace by createConversation.
    const repoName = (selected.fullName.split("/").pop() || "repo").replace(
      /[^A-Za-z0-9._-]/g,
      "-",
    );
    const workingDir = `exeaon-repos/${repoName}`;
    const toastId = toast.loading(
      `Cloning ${selected.fullName}…`,
      TOAST_OPTIONS,
    );
    try {
      const data = await createConversation({
        // The agent clones using the GITHUB_TOKEN secret exposed to the runtime.
        query:
          `Clone the GitHub repository ${selected.fullName} (branch ${ref}) into ` +
          `the current working directory, authenticating over HTTPS with the ` +
          `GITHUB_TOKEN environment variable (e.g. \`git clone --branch ${ref} ` +
          `https://x-access-token:$GITHUB_TOKEN@github.com/${selected.fullName}.git .\`). ` +
          `Then give me a short overview of the project structure.`,
        repository: {
          name: selected.fullName,
          gitProvider: "github",
          branch: ref,
        },
        workingDir,
        workspaceMode: "local_repo",
        entryPoint: "github_repo_modal",
      });
      toast.dismiss(toastId);
      onClose();
      navigate(`/conversations/${data.conversation_id}`);
    } catch (e) {
      toast.dismiss(toastId);
      displayErrorToast(e instanceof Error ? e.message : null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-[#2B2316] bg-[#0D0B08] text-[#EDE7D8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#241F16] px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#241F14] text-[#FFD026]">
            <FaGithub className="size-4" />
          </div>
          <h2 className="text-sm font-bold text-white">
            Clone a GitHub repository
          </h2>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
          <div className="flex items-center gap-2 rounded-lg border border-[#2B2316] bg-[#14110C] px-3">
            <Search
              className="size-4 shrink-0 text-[var(--oh-muted)]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your repositories…"
              className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-[var(--oh-muted)]"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#201B12] bg-[#0A0907]">
            {loadError ? (
              <p className="p-4 text-sm text-red-400">{loadError}</p>
            ) : !repos ? (
              <p className="flex items-center gap-2 p-4 text-sm text-[var(--oh-muted)]">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading your repositories…
              </p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-[var(--oh-muted)]">
                No matching repositories.
              </p>
            ) : (
              filtered.map((repo) => (
                <button
                  key={repo.fullName}
                  type="button"
                  onClick={() => pickRepo(repo)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                    selected?.fullName === repo.fullName
                      ? "bg-white/[0.06] text-white"
                      : "text-[var(--oh-foreground)]"
                  }`}
                >
                  {repo.private ? (
                    <Lock
                      className="size-3.5 shrink-0 text-[var(--oh-muted)]"
                      aria-hidden
                    />
                  ) : (
                    <FaGithub className="size-3.5 shrink-0 text-[var(--oh-muted)]" />
                  )}
                  <span className="truncate">{repo.fullName}</span>
                </button>
              ))
            )}
          </div>

          {selected ? (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-[var(--oh-muted)]">
                Branch
              </span>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[#2B2316] bg-[#14110C] px-2 py-1.5 text-sm text-white outline-none"
              >
                {(branches ?? [selected.defaultBranch]).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#241F16] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2E281F] bg-[#18140E] px-4 py-2 text-xs font-medium text-[#B8AF9E] hover:border-[#FFD026]/40 hover:text-[#EDE7D8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={launch}
            disabled={!selected || isCreating}
            className="rounded-xl bg-[#FFD026] px-5 py-2 text-xs font-bold text-black hover:bg-[#FFE066] disabled:opacity-40"
          >
            {isCreating ? "Cloning…" : "Clone & open"}
          </button>
        </div>
      </div>
    </div>
  );
}
