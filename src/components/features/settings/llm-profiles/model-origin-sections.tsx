import { Cloud, Cpu, HardDrive } from "lucide-react";
import { useCloudModels } from "#/hooks/query/use-cloud-models";
import { useLocalGgufModels } from "#/hooks/query/use-local-gguf-models";
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
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
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

/**
 * The read-only "Cloud" and "On-device (GGUF)" model sections that sit above the
 * editable LLM-profile list, so local and cloud models are visible together.
 * Cloud models come from the gateway catalog; local GGUFs from the models
 * folder + running server. Each hides itself when it has nothing to show, so
 * the profile list is unchanged when neither applies (e.g. on the web build).
 */
export function ModelOriginSections() {
  const { data: cloudModels } = useCloudModels();
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
          />
          <div className={listClassName}>
            {cloudModels!.map((m) => (
              <div
                key={m.id}
                className={cn(
                  settingsListRowClassName,
                  "justify-between gap-3",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="truncate text-sm font-medium text-white">
                    {m.name}
                  </span>
                  {m.provider ? (
                    <span className="truncate text-xs text-[var(--oh-muted)]">
                      {m.provider}
                    </span>
                  ) : null}
                  {m.description ? (
                    <span className="hidden truncate text-xs text-[var(--oh-muted)] sm:inline">
                      {m.description}
                    </span>
                  ) : null}
                </div>
                <OriginBadge label="Cloud" tone="cloud" />
              </div>
            ))}
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
          />
          <div className={listClassName}>
            {local.models.map((m) => {
              const isRunning =
                local.running &&
                (local.runningModel === m.name || local.runningModel === null);
              return (
                <div
                  key={m.path}
                  className={cn(
                    settingsListRowClassName,
                    "justify-between gap-3",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="truncate text-sm font-medium text-white">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--oh-muted)]">
                      {m.sizeGb.toFixed(1)} GB
                    </span>
                    {isRunning ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-300">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        running · {local.endpoint}
                      </span>
                    ) : null}
                  </div>
                  <OriginBadge label="Local" tone="local" />
                </div>
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
