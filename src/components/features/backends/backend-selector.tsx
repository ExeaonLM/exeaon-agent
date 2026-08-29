import React from "react";
import { useNavigate } from "react-router";
import { Plus, Server, Settings, LogOut } from "lucide-react";
import { isNoBackend } from "#/api/backend-registry/active-store";
import { useActiveBackendContext } from "#/contexts/active-backend-context";
import { useAllCloudOrganizations } from "#/hooks/query/use-cloud-organizations";
import { useCloudCurrentUserId } from "#/hooks/query/use-cloud-current-user-id";
import { readCloudUser, cloudLogout } from "#/api/cloud/session-store";
import { fetchCloudMe } from "#/api/cloud/exeaon-me.api";
import { AddBackendModal } from "./add-backend-modal";
import { ManageBackendsModal } from "./manage-backends-modal";
import { cn } from "#/utils/utils";

interface BackendSelectorProps {
  /** Render the menu above the trigger (e.g. when pinned to bottom of sidebar). */
  openUpward?: boolean;
  /** Hide the selector input trigger and only render the menu. */
  hideTrigger?: boolean;
  /** Whether the profile menu should start open on mount. */
  defaultOpen?: boolean;
  /** Callback fired after selecting a menu action. */
  onSelectOption?: () => void;
  /**
   * Override the internal Add Backend modal handling. When provided, the "Add
   * backend" item calls this instead of opening the internal modal — used when
   * the selector is mounted in an ephemeral container (the collapsed-sidebar
   * popover) whose modal must survive the parent unmounting.
   */
  onOpenAddBackend?: () => void;
  /** Same as onOpenAddBackend but for the Manage Backends modal. */
  onOpenManageBackends?: () => void;
  /** Whether the surrounding sidebar rail is in its collapsed variant. */
  sidebarCollapsed?: boolean;
}

// openUpward / hideTrigger / sidebarCollapsed remain on the props type so the
// existing callers (SidebarRailBody) keep compiling, but the redesigned
// profile-menu UI doesn't need them, so they're intentionally not destructured.
export function BackendSelector({
  defaultOpen = false,
  onSelectOption,
  onOpenAddBackend,
  onOpenManageBackends,
}: BackendSelectorProps = {}) {
  const { active, setActive } = useActiveBackendContext();
  const cloudOrgs = useAllCloudOrganizations();
  const currentUserIds = useCloudCurrentUserId();
  const navigate = useNavigate();
  const [, forceAccountRefresh] = React.useState(0);
  const cloudUser = readCloudUser();
  const accountInitial = (cloudUser?.displayName || cloudUser?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  // Real plan tier from the cloud gateway (GET /ai/gateway/me), fetched on
  // mount and whenever the signed-in user changes. null = not signed in or
  // gateway unreachable; the "Pro" badge is only shown when this resolves.
  const [cloudTier, setCloudTier] = React.useState<"pro" | "free" | null>(null);
  const cloudUserId = cloudUser?.userId ?? null;
  React.useEffect(() => {
    let cancelled = false;
    if (cloudUserId == null) {
      setCloudTier(null);
      return undefined;
    }
    fetchCloudMe()
      .then((m) => {
        if (!cancelled) setCloudTier(m?.tier ?? "free");
      })
      .catch(() => {
        if (!cancelled) setCloudTier(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cloudUserId]);

  const [addBackendModalOpen, setAddBackendModalOpen] = React.useState(false);
  const [manageBackendsModalOpen, setManageBackendsModalOpen] =
    React.useState(false);

  const noBackendSelected = isNoBackend(active.backend);

  // Self-heal a malformed `(cloudBackendId, null)` selection: once a cloud
  // backend's orgs resolve, snap the selection onto its current org (or the
  // personal workspace / first org). Recorded locally only; the cloud request
  // scope follows from the X-Org-Id header, so the cloud UI is never mutated.
  React.useEffect(() => {
    if (noBackendSelected || active.backend.kind !== "cloud" || active.orgId)
      return;
    const { backend } = active;
    const entry = cloudOrgs[backend.id];
    if (!entry || entry.orgs.length === 0) return;

    const currentOrg = entry.currentOrgId
      ? entry.orgs.find((o) => o.id === entry.currentOrgId)
      : undefined;
    const userId = currentUserIds[backend.id]?.userId ?? null;
    const personal = userId
      ? entry.orgs.find((o) => o.id === userId)
      : undefined;
    const target = currentOrg ?? personal ?? entry.orgs[0];
    if (target) {
      setActive(backend.id, target.id);
    }
  }, [active, cloudOrgs, currentUserIds, setActive, noBackendSelected]);

  const openAddBackendModal = React.useCallback(() => {
    if (onOpenAddBackend) {
      onOpenAddBackend();
      onSelectOption?.();
      return;
    }
    setAddBackendModalOpen(true);
  }, [onOpenAddBackend, onSelectOption]);

  const openManageBackendsModal = React.useCallback(() => {
    if (onOpenManageBackends) {
      onOpenManageBackends();
      onSelectOption?.();
      return;
    }
    setManageBackendsModalOpen(true);
  }, [onOpenManageBackends, onSelectOption]);

  const [profileMenuOpen, setProfileMenuOpen] = React.useState(defaultOpen);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  const menuRowClass =
    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[var(--oh-foreground)] hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer text-left";

  return (
    <>
      <div ref={containerRef} className="relative flex items-center w-full">
        {/* User Profile Trigger Pill */}
        <button
          type="button"
          data-testid="user-profile-trigger"
          onClick={() => setProfileMenuOpen((prev) => !prev)}
          className={cn(
            "flex items-center gap-2.5 w-full h-11 px-2 py-1.5 rounded-xl transition-all cursor-pointer text-left select-none",
            profileMenuOpen
              ? "bg-white/[0.08] text-white"
              : "hover:bg-white/[0.05] text-[var(--oh-foreground)]",
          )}
        >
          <div className="flex items-center justify-center size-7 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 text-amber-400 font-semibold text-xs shrink-0 shadow-inner">
            {accountInitial}
          </div>

          <div className="flex flex-col min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-white truncate">
                {cloudUser?.displayName || cloudUser?.email || "Sign in"}
              </span>
              {cloudUser && (
                <>
                  <span className="text-xs text-[var(--oh-text-dim)]">·</span>
                  <span className="text-[11px] font-semibold text-amber-400">
                    {cloudUser.isPlatformAdmin ? "Admin" : "Member"}
                  </span>
                </>
              )}
            </div>
          </div>

          <span className="shrink-0 text-[var(--oh-muted)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "size-4 transition-transform duration-200",
                profileMenuOpen ? "rotate-180 text-white" : "",
              )}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>

        {/* Floating Profile Menu */}
        {profileMenuOpen && (
          <div
            data-testid="user-profile-popover"
            className="absolute left-0 bottom-full mb-2 z-50 w-[270px] rounded-2xl bg-[#141413] border border-white/10 shadow-2xl p-1.5 flex flex-col gap-0.5 text-sm animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
              <div className="text-xs text-[var(--oh-text-dim)] truncate font-mono">
                {cloudUser?.email || "Not signed in"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                if (cloudUser) {
                  cloudLogout();
                  forceAccountRefresh((n) => n + 1);
                } else {
                  navigate("/signin");
                }
              }}
              className={menuRowClass}
            >
              <LogOut className="size-4 text-[var(--oh-muted)]" />
              <span>{cloudUser ? "Log out of Cloud" : "Sign in"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                navigate("/settings");
              }}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-[var(--oh-foreground)] hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="size-4 text-[var(--oh-muted)]" />
                <span>Settings</span>
              </div>
              <span className="text-[11px] text-[var(--oh-text-dim)] font-mono">
                Ctrl+,
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                navigate("/settings/app");
              }}
              className={menuRowClass}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 text-[var(--oh-muted)]"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              <span>Language</span>
            </button>

            <a
              href="https://exeaon.dev"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setProfileMenuOpen(false)}
              className={cn(menuRowClass, "no-underline")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 text-[var(--oh-muted)]"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              <span>Get help</span>
            </a>

            <div className="my-1 border-t border-white/[0.08]" />

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                navigate("/settings/account");
              }}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-[var(--oh-foreground)] hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 text-amber-400"
                >
                  <path d="m5 12 7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
                <span>Account & Cloud</span>
              </div>
              {cloudTier && (
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border",
                    cloudTier === "pro"
                      ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                      : "text-[var(--oh-muted)] bg-white/5 border-white/10",
                  )}
                >
                  {cloudTier === "pro" ? "Pro" : "Free"}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="add-backend-menu-item"
              onClick={() => {
                setProfileMenuOpen(false);
                openAddBackendModal();
              }}
              className={menuRowClass}
            >
              <Plus className="size-4 text-[var(--oh-muted)]" />
              <span>Add backend</span>
            </button>

            <button
              type="button"
              data-testid="manage-backends-menu-item"
              onClick={() => {
                setProfileMenuOpen(false);
                openManageBackendsModal();
              }}
              className={menuRowClass}
            >
              <Server className="size-4 text-[var(--oh-muted)]" />
              <span>Manage backends</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                navigate("/settings/skills");
              }}
              className={menuRowClass}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 text-[var(--oh-muted)]"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>Get apps and extensions</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                navigate("/settings/app");
              }}
              className={menuRowClass}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 text-[var(--oh-muted)]"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>View changelog</span>
            </button>

            <a
              href="https://exeaon.dev"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setProfileMenuOpen(false)}
              className={cn(menuRowClass, "justify-between no-underline")}
            >
              <div className="flex items-center gap-2.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 text-[var(--oh-muted)]"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="16" y2="12" />
                  <line x1="12" x2="12" y1="8" y2="8.01" />
                </svg>
                <span>Learn more</span>
              </div>
              <span className="text-xs text-[var(--oh-muted)]">›</span>
            </a>
          </div>
        )}
      </div>
      {addBackendModalOpen ? (
        <AddBackendModal onClose={() => setAddBackendModalOpen(false)} />
      ) : null}
      {manageBackendsModalOpen ? (
        <ManageBackendsModal
          onClose={() => setManageBackendsModalOpen(false)}
        />
      ) : null}
    </>
  );
}
