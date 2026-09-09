import {
  Microscope,
  Link2,
  FileCheck2,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";
import { useResearchState } from "#/hooks/use-research-state";
import { cn } from "#/utils/utils";

function originalityTone(o: number): string {
  if (o >= 0.85) return "#10B981";
  if (o >= 0.6) return "#FFD026";
  return "#EF4444";
}

/**
 * Live Research war-room — the pipeline progress + gathered sources + the
 * claim/evidence/falsification integrity scorecard + originality, driven by the
 * `research` MCP's tool observations (see useResearchState). Real research
 * state, not animation.
 */
export function ResearchWarRoom() {
  const state = useResearchState();

  if (!state.active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/50 text-[#FFD026]">
          <Microscope className="size-6" />
        </div>
        <p className="max-w-xs text-sm text-[var(--oh-muted)]">
          No research yet. In <span className="text-[#FFD026]">Research</span>,
          ask the agent to replicate a paper or test a claim — sources, the
          claim/evidence scorecard, and originality render here as it works.
        </p>
      </div>
    );
  }

  const withEvidence = state.claims.filter((c) => c.evidence).length;
  const withFalsification = state.claims.filter((c) => c.falsification).length;

  const stages = [
    {
      label: "Gather",
      icon: Link2,
      done: state.sources.length > 0,
      n: state.sources.length,
    },
    {
      label: "Reason",
      icon: FlaskConical,
      done: state.claims.length > 0,
      n: state.claims.length,
    },
    {
      label: "Verify",
      icon: ShieldCheck,
      done: withFalsification > 0,
      n: withFalsification,
    },
    {
      label: "Report",
      icon: FileCheck2,
      done: state.reported,
      n: state.reported ? 1 : 0,
    },
  ];

  return (
    <div
      className="relative h-full w-full overflow-auto"
      style={{
        backgroundColor: "#0B0A08",
        backgroundImage:
          "radial-gradient(circle, rgba(255,208,38,0.06) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-gradient-to-b from-[#0B0A08] to-transparent px-3 py-2 text-[11px]">
        <span className="rounded-full border border-[#FFD026]/40 bg-[#241F14] px-2 py-0.5 font-semibold text-[#FFD026]">
          Research
        </span>
        <span className="text-[var(--oh-muted)]">
          {state.sources.length} source{state.sources.length === 1 ? "" : "s"}
        </span>
        <span className="text-[var(--oh-muted)]">
          {state.claims.length} claim{state.claims.length === 1 ? "" : "s"}
        </span>
        {state.originality !== null && (
          <span
            className="font-semibold"
            style={{ color: originalityTone(state.originality) }}
          >
            {Math.round(state.originality * 100)}% original
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Pipeline strip */}
        <div className="flex items-center gap-2">
          {stages.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2",
                    s.done
                      ? "border-[#FFD026]/40 bg-[#241F14] text-[#FFD026]"
                      : "border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/40 text-[var(--oh-muted)]",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="text-[10px] font-semibold">{s.label}</span>
                  <span className="text-[10px] tabular-nums">{s.n}</span>
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={cn(
                      "h-px w-3 shrink-0",
                      s.done ? "bg-[#FFD026]/50" : "bg-[var(--oh-border)]",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Originality */}
        {state.originality !== null && (
          <div className="rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/60 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-[var(--oh-muted)]">
                Originality (vs cited sources)
              </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: originalityTone(state.originality) }}
              >
                {Math.round(state.originality * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--oh-border-subtle)]">
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(state.originality * 100)}%`,
                  backgroundColor: originalityTone(state.originality),
                }}
              />
            </div>
            {state.flaggedSpans.length > 0 && (
              <div className="mt-1.5 text-[10px] text-red-400">
                Copied spans:{" "}
                {state.flaggedSpans.slice(0, 3).map((s, i) => (
                  <span key={i} className="mr-2 italic">
                    “{s.slice(0, 60)}”
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {state.sources.length > 0 && (
          <div className="rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/60 px-3 py-2">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--oh-muted)]">
              Sources
            </div>
            <div className="flex flex-col gap-1.5">
              {state.sources.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px]">
                  <Link2 className="mt-0.5 size-3 shrink-0 text-[#FFD026]" />
                  <div className="min-w-0">
                    <div className="truncate text-[var(--oh-foreground)]">
                      {s.title || s.url}
                    </div>
                    {s.title && (
                      <div className="truncate text-[10px] text-[var(--oh-muted)]">
                        {s.url}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reproduction scorecard — the "did we actually reproduce it?" proof */}
        {state.reproductions.length > 0 && (
          <div className="rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/60 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--oh-muted)]">
              <span>Reproduction scorecard</span>
              <span className="normal-case">
                {state.reproductions.filter((r) => r.match).length}/
                {state.reproductions.length} reproduced
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {state.reproductions.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11px]"
                  title={r.note}
                >
                  <span
                    className={`shrink-0 font-bold ${r.match ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {r.match ? "✓" : "✗"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--oh-foreground)]">
                    {r.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--oh-muted)]">
                    {r.claimed} vs {r.reference}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${r.match ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {(r.relError * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claims scorecard */}
        {state.claims.length > 0 && (
          <div className="rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/60 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--oh-muted)]">
              <span>Claims · evidence · falsification</span>
              <span className="normal-case">
                {withEvidence}/{state.claims.length} evidenced ·{" "}
                {withFalsification}/{state.claims.length} challenged
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {state.claims.map((c, i) => (
                <div
                  key={i}
                  className="rounded border border-[var(--oh-border-subtle)] px-2 py-1.5 text-[11px]"
                >
                  <div className="text-[var(--oh-foreground)]">{c.claim}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px]">
                    <span
                      className={c.evidence ? "text-[#10B981]" : "text-red-400"}
                    >
                      {c.evidence ? "✓ evidence" : "✗ no evidence"}
                    </span>
                    <span
                      className={
                        c.falsification ? "text-[#10B981]" : "text-amber-500"
                      }
                    >
                      {c.falsification
                        ? "✓ falsification tried"
                        : "⚠ not challenged"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
