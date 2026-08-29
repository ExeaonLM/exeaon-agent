import { RotateCcw, Download } from "lucide-react";
import { useUpdater } from "#/exeaon/updater";
import { cn } from "#/utils/utils";

/**
 * Sidebar affordance for an in-app update. Appears only once an update has
 * finished downloading ("ready") — clicking relaunches to apply it — or shows a
 * quiet progress state while downloading. Hidden otherwise. Driven by the shared
 * updater store, so a check kicked off from Settings surfaces here automatically.
 */
export function UpdaterRestartChip({ collapsed = false }: { collapsed?: boolean }) {
  const { status, availableVersion, progress, relaunch } = useUpdater();

  if (status === "downloading") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-[#FFD026]/30 bg-[#FFD026]/10 px-2.5 py-1.5 text-xs text-[#FFD026]",
          collapsed && "justify-center px-0",
        )}
        title={`Downloading update… ${Math.round(progress * 100)}%`}
      >
        <Download className="size-3.5 shrink-0 animate-pulse" aria-hidden />
        {!collapsed && <span>Downloading… {Math.round(progress * 100)}%</span>}
      </div>
    );
  }

  if (status !== "ready") return null;

  return (
    <button
      type="button"
      data-testid="updater-restart-chip"
      onClick={() => void relaunch()}
      title="Restart to install the update"
      className={cn(
        "flex items-center gap-2 rounded-md border border-[#FFD026]/40 bg-[#FFD026]/15 px-2.5 py-1.5 text-xs font-semibold text-[#FFD026] hover:bg-[#FFD026]/25 transition-colors",
        collapsed && "justify-center px-0",
      )}
    >
      <RotateCcw className="size-3.5 shrink-0" aria-hidden />
      {!collapsed && (
        <span className="truncate">
          Restart to update{availableVersion ? ` · ${availableVersion}` : ""}
        </span>
      )}
    </button>
  );
}
