import { useState } from "react";
import {
  Check,
  Cloud,
  Cpu,
  HardDrive,
  Lock,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { useCloudModels } from "#/hooks/query/use-cloud-models";
import {
  useLocalGgufModels,
  type LocalGgufModel,
} from "#/hooks/query/use-local-gguf-models";
import { formatNativeModelName } from "#/utils/format-model-name";
import {
  settingsListContainerClassName,
  settingsListDividerClassName,
  settingsListRowClassName,
} from "#/utils/settings-list-classes";
import { cn } from "#/utils/utils";

const listClassName = cn(
  settingsListContainerClassName,
  settingsListDividerClassName,
);

function SectionHeader({
  icon,
  title,
  hint,
  onRefresh,
  refreshing,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-base font-medium text-[var(--cool-grey-50)]">
        {title}
      </h2>
      {hint ? (
        <span className="text-xs text-[var(--oh-muted)]">{hint}</span>
      ) : null}
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
            aria-hidden
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      ) : null}
    </div>
  );
}

function OriginBadge({
  label,
  tone,
}: {
  label: string;
  tone: "cloud" | "local";
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone === "cloud"
          ? "bg-[#FFD026]/10 text-[#FFD026] border border-[#FFD026]/30"
          : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
      )}
    >
      {label}
    </span>
  );
}

/** One on-device GGUF row with inline display-name rename (name-edit only). */
function LocalGgufRow({
  model,
  isRunning,
  endpoint,
  onRename,
}: {
  model: LocalGgufModel;
  isRunning: boolean;
  endpoint: string;
  onRename: (path: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model.displayName);

  const save = () => {
    onRename(model.path, draft);
    setEditing(false);
  };

  return (
    <div className={cn(settingsListRowClassName, "justify-between gap-3")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {editing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={80}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-[#F3CE49]"
          />
        ) : (
          <span className="truncate text-sm font-medium text-white">
            {model.displayName}
          </span>
        )}
        <span className="shrink-0 text-xs text-[var(--oh-muted)]">
          {model.sizeGb.toFixed(1)} GB
        </span>
        {isRunning && !editing ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-400" />
            running · {endpoint}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              className="text-emerald-300 hover:text-emerald-200"
              title="Save name"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[var(--oh-muted)] hover:text-white"
              title="Cancel"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(model.displayName);
              setEditing(true);
            }}
            className="text-[var(--oh-muted)] hover:text-white"
            title="Rename (display name only)"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        <OriginBadge label="Local" tone="local" />
      </div>
    </div>
  );
}

/**
 * The read-only "Cloud" and "On-device (GGUF)" model sections that sit above the
 * editable LLM-profile list, so local and cloud models are visible together.
 * Cloud models come from the gateway catalog; local GGUFs from the models
 * folder + running server. Each hides itself when it has nothing to show, so
 * the profile list is unchanged when neither applies (e.g. on the web build).
 */
export function ModelOriginSections() {
  const {
    data: cloudModels,
    refetch: refetchCloud,
    isFetching,
  } = useCloudModels();
  const local = useLocalGgufModels();

  const hasCloud = (cloudModels?.length ?? 0) > 0;
  const hasLocal = local.hasTauri && local.models.length > 0;

  if (!hasCloud && !hasLocal) return null;

  return (
    <>
      {hasCloud ? (
        <div className="flex flex-col gap-3">
          <SectionHeader
            icon={<Cloud className="size-4 text-[#FFD026]" />}
            title="Cloud models"
            hint="served by Exeaon Cloud · read-only"
            onRefresh={() => refetchCloud()}
            refreshing={isFetching}
          />
          <div className={listClassName}>
            {cloudModels!.map((m) => {
              const locked = !m.available;
              return (
                <div
                  key={m.id}
                  className={cn(
                    settingsListRowClassName,
                    "justify-between gap-3",
                    locked && "opacity-60",
                  )}
                  title={
                    locked
                      ? "Pro model — upgrade your plan to use it"
                      : undefined
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="truncate text-sm font-medium text-white">
                      {formatNativeModelName(m.name) || m.name}
                    </span>
                    {m.description ? (
                      <span className="hidden truncate text-xs text-[var(--oh-muted)] sm:inline">
                        {m.description}
                      </span>
                    ) : m.provider ? (
                      <span className="truncate text-xs text-[var(--oh-muted)]">
                        {m.provider}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.requiresPro ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          locked
                            ? "bg-white/5 text-[var(--oh-muted)] border border-white/10"
                            : "bg-[#FFD026]/10 text-[#FFD026] border border-[#FFD026]/30",
                        )}
                      >
                        {locked ? <Lock className="size-3" /> : null}
                        Pro
                      </span>
                    ) : null}
                    <OriginBadge label="Cloud" tone="cloud" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasLocal ? (
        <div className="flex flex-col gap-3">
          <SectionHeader
            icon={<HardDrive className="size-4 text-emerald-300" />}
            title="On-device models"
            hint={
              local.running
                ? `server running · ${local.endpoint}`
                : "server stopped · start from the Models page"
            }
            onRefresh={() => local.refresh()}
          />
          <div className={listClassName}>
            {local.models.map((m) => {
              const isRunning =
                local.running &&
                (local.runningModel === m.name || local.runningModel === null);
              return (
                <LocalGgufRow
                  key={m.path}
                  model={m}
                  isRunning={isRunning}
                  endpoint={local.endpoint}
                  onRename={local.rename}
                />
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-[var(--oh-muted)]">
            <Cpu className="size-3.5" aria-hidden />
            Manage on-device models (start / stop / switch / download) from the
            Models page in the sidebar.
          </p>
        </div>
      ) : null}
    </>
  );
}
