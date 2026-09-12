import { useEffect, useMemo, useRef, useState } from "react";
import { Folder, FolderOpen, Check, X, ChevronDown } from "lucide-react";
import { useLocalWorkspaces } from "#/hooks/query/use-local-workspaces";
import { useHomeStore } from "#/stores/home-store";
import { LocalWorkspace } from "#/types/workspace";

interface WorkspacePickerProps {
  /** The currently-selected workspace, or null for a scratch conversation. */
  value: LocalWorkspace | null;
  onChange: (workspace: LocalWorkspace | null) => void;
  /** Opens the folder-browse dialog to add a workspace not in the list. */
  onOpenFolder: () => void;
  disabled?: boolean;
  /** Non-null when the agent-server is too old to support workspaces. */
  unsupportedMessage?: string | null;
}

/**
 * Home workspace selector, styled after Claude's: a pill that opens a popover
 * listing recent workspaces plus "Open folder…". A new chat defaults to the
 * most-recent workspace (the launcher pre-selects it), so the common case is a
 * single click to send; picking "None" runs in a fresh scratch directory.
 *
 * "Recent" is the union of the persisted recent list (ordered by last use) and
 * the workspaces the agent-server knows about, deduped by path so a folder the
 * user configured but hasn't launched yet still appears.
 */
export function WorkspacePicker({
  value,
  onChange,
  onOpenFolder,
  disabled,
  unsupportedMessage,
}: WorkspacePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const recentWorkspaces = useHomeStore((state) => state.recentWorkspaces);
  const { data } = useLocalWorkspaces({ enabled: !unsupportedMessage });
  const available = data?.workspaces ?? [];

  const options = useMemo(() => {
    const seen = new Set<string>();
    const merged: LocalWorkspace[] = [];
    for (const workspace of [...recentWorkspaces, ...available]) {
      if (seen.has(workspace.path)) continue;
      seen.add(workspace.path);
      merged.push(workspace);
    }
    return merged;
  }, [recentWorkspaces, available]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = value ? value.name : "No workspace";
  const isUnsupported = Boolean(unsupportedMessage);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !isUnsupported && setOpen((o) => !o)}
        disabled={disabled || isUnsupported}
        title={unsupportedMessage || value?.path || label}
        className="flex h-9 items-center gap-2 rounded-full border border-[var(--oh-border)] pl-3 pr-2.5 text-sm text-[var(--oh-fg)] transition-colors hover:border-[#F3CE49]/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Folder className="size-3.5 text-[var(--oh-muted)]" aria-hidden />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className="size-3.5 text-[var(--oh-muted)]" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-72 flex-col rounded-xl border border-[var(--oh-border)] bg-[#141413] p-1.5 shadow-2xl">
          {options.length > 0 && (
            <>
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--oh-muted)]">
                Recent
              </div>
              <div className="flex max-h-60 flex-col overflow-y-auto">
                {options.map((workspace) => {
                  const selected = value?.path === workspace.path;
                  return (
                    <button
                      key={workspace.path}
                      type="button"
                      onClick={() => {
                        onChange(workspace);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--oh-foreground)] transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <Folder
                        className="size-4 shrink-0 text-[var(--oh-muted)]"
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{workspace.name}</span>
                        <span className="truncate text-[11px] text-[var(--oh-muted)]">
                          {workspace.path}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          className="size-4 shrink-0 text-[#F3CE49]"
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="my-1 h-px bg-[var(--oh-border)]" />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenFolder();
            }}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--oh-foreground)] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <FolderOpen className="size-4 text-[var(--oh-muted)]" aria-hidden />
            <span>Open folder…</span>
          </button>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--oh-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X className="size-4" aria-hidden />
              <span>No workspace (scratch)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
