import React from "react";
import { Gauge, ChevronUp } from "lucide-react";
import { useCloudMe } from "#/hooks/query/use-cloud-me";
import { useClickOutsideElement } from "#/hooks/use-click-outside-element";
import type { CloudMeWindow } from "#/api/cloud/exeaon-me.api";
import { cn } from "#/utils/utils";

function pct(w: CloudMeWindow): number {
  if (w.includedCredits <= 0) return 0;
  return Math.min(100, (w.usedCredits / w.includedCredits) * 100);
}

/** "Resets in 42m" / "Resets in 3h" / "Resets in 2d 4h". */
function fmtReset(resetAtUnix: number): string {
  const ms = resetAtUnix * 1000 - Date.now();
  if (ms <= 0) return "Resetting…";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `Resets in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Resets in ${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `Resets in ${days}d ${hours % 24}h`;
}

function toneFor(p: number): { bar: string; label: string } {
  if (p >= 100) return { bar: "bg-red-500", label: "text-red-500" };
  if (p >= 80) return { bar: "bg-amber-500", label: "text-amber-500" };
  return { bar: "bg-[#FFD026]", label: "text-[var(--oh-muted)]" };
}

function WindowRow({ label, window: w }: { label: string; window: CloudMeWindow }) {
  const p = pct(w);
  const tone = toneFor(p);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[var(--oh-foreground)]">{label}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--oh-muted)]">
            {fmtReset(w.resetAtUnix)}
          </span>
          <span className={cn("font-medium tabular-nums", tone.label)}>
            {Math.round(p)}%
          </span>
        </span>
      </div>
      <div
        className="relative h-1.5 w-full rounded-full"
        style={{ backgroundColor: "var(--oh-border-subtle)" }}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
            tone.bar,
          )}
          style={{ width: `${Math.max(p > 0 ? 2 : 0, p)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Compact "Plan usage limits" section for the context-window popover — the
 * hourly + weekly credit windows every plan is subject to, Claude-style.
 * Renders nothing when the user isn't signed in to cloud or the windows are
 * unavailable.
 */
export function PlanUsageLimits() {
  const { data: me } = useCloudMe();
  if (!me || !me.hourly || !me.weekly) return null;

  return (
    <div className="flex flex-col gap-2 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--oh-foreground)]">
          Plan usage limits
        </span>
        <span className="inline-flex items-center rounded-full border border-[#FFD026]/40 bg-[#241F14] px-1.5 py-0.5 text-[10px] font-semibold text-[#FFD026]">
          {me.planName || "Free"}
        </span>
      </div>
      <WindowRow label="Hourly limit" window={me.hourly} />
      <WindowRow label="Weekly limit" window={me.weekly} />
    </div>
  );
}

/**
 * Under-the-input trigger for the plan usage limits: a slim, always-visible
 * summary line placed directly below the composer (below the send button) that
 * expands the full hourly/weekly popover downward on click. Renders nothing
 * when the user isn't signed in to cloud.
 */
export function PlanUsageLimitsBar() {
  const { data: me } = useCloudMe();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = useClickOutsideElement<HTMLDivElement>(
    () => setOpen(false),
    triggerRef,
  );

  if (!me || !me.hourly || !me.weekly) return null;

  const hPct = Math.round(pct(me.hourly));
  const wPct = Math.round(pct(me.weekly));
  const worst = Math.max(hPct, wPct);
  const tone = toneFor(worst);

  return (
    <div className="relative mt-1.5 w-full px-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1",
          "text-[11px] text-[var(--oh-muted)] transition-colors",
          "hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Gauge className="size-3" aria-hidden />
          <span className="font-medium text-[var(--oh-foreground)]">
            {me.planName || "Free"}
          </span>
          <span>plan usage</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("tabular-nums font-medium", tone.label)}>
            H {hPct}% · W {wPct}%
          </span>
          <ChevronUp
            className={cn(
              "size-3 transition-transform",
              open ? "rotate-0" : "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          className={cn(
            "absolute left-0 right-0 top-full z-[60] mt-1",
            "rounded-md border border-[var(--oh-border-subtle)] bg-tertiary py-1 shadow-lg",
          )}
        >
          <PlanUsageLimits />
        </div>
      )}
    </div>
  );
}
