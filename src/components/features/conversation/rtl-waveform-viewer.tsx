import { useMemo, type ReactNode } from "react";
import { Cpu, Timer, Activity, Download } from "lucide-react";
import { useRtlSimState, type RtlSignal } from "#/hooks/use-rtl-sim-state";

const LABEL_W = 130;
const ROW_H = 34;
const PAD_R = 24;
const HIGH = 7;
const LOW = 25;
const MID = 16;

function binToHex(bits: string): string {
  if (/[xz]/i.test(bits)) return bits; // keep unknowns literal
  if (bits.length <= 1) return bits;
  let out = "";
  let b = bits;
  while (b.length % 4 !== 0) b = "0" + b;
  for (let i = 0; i < b.length; i += 4) {
    out += parseInt(b.slice(i, i + 4), 2).toString(16);
  }
  return "0x" + out.replace(/^0+(?=.)/, "");
}

function ScalarTrace({
  wave,
  x,
  endTime,
  y0,
}: {
  wave: [number, string][];
  x: (t: number) => number;
  endTime: number;
  y0: number;
}) {
  const levelY = (v: string) => {
    if (v === "1") return y0 + HIGH;
    if (v === "0") return y0 + LOW;
    return y0 + MID; // x / z
  };
  if (wave.length === 0) return null;
  let prevY = levelY(wave[0][1]);
  let d = `M ${x(0)} ${prevY} L ${x(wave[0][0])} ${prevY}`;
  for (let i = 1; i < wave.length; i += 1) {
    const px = x(wave[i][0]);
    const py = levelY(wave[i][1]);
    d += ` L ${px} ${prevY} L ${px} ${py}`;
    prevY = py;
  }
  d += ` L ${x(endTime)} ${prevY}`;
  return <path d={d} fill="none" stroke="#FFD026" strokeWidth={1.6} />;
}

function BusTrace({
  wave,
  x,
  endTime,
  y0,
}: {
  wave: [number, string][];
  x: (t: number) => number;
  endTime: number;
  y0: number;
}) {
  const cells: ReactNode[] = [];
  for (let i = 0; i < wave.length; i += 1) {
    const t0 = wave[i][0];
    const t1 = i + 1 < wave.length ? wave[i + 1][0] : endTime;
    const x0 = x(t0);
    const x1 = x(t1);
    if (x1 - x0 < 1) continue;
    const label = binToHex(wave[i][1]);
    cells.push(
      <g key={i}>
        <polygon
          points={`${x0 + 2},${y0 + MID} ${x0 + 5},${y0 + HIGH} ${x1 - 5},${y0 + HIGH} ${x1 - 2},${y0 + MID} ${x1 - 5},${y0 + LOW} ${x0 + 5},${y0 + LOW}`}
          fill="rgba(16,185,129,0.12)"
          stroke="#10B981"
          strokeWidth={1.2}
        />
        {x1 - x0 > 26 && (
          <text
            x={(x0 + x1) / 2}
            y={y0 + MID + 3}
            textAnchor="middle"
            fontSize={9}
            fill="#9AF5C8"
            fontFamily="monospace"
          >
            {label}
          </text>
        )}
      </g>,
    );
  }
  return <g>{cells}</g>;
}

/**
 * Live RTL waveform viewer — a digital timing diagram driven by the parsed VCD
 * of the agent's last simulation (see useRtlSimState). Scalars render as stepped
 * traces; multi-bit buses as value cells.
 */
export function RtlWaveformViewer() {
  const wf = useRtlSimState();

  const width = 760;
  const x = useMemo(() => {
    const span = width - LABEL_W - PAD_R;
    const end = wf.endTime || 1;
    return (t: number) => LABEL_W + (Math.max(0, t) / end) * span;
  }, [wf.endTime]);

  if (wf.installed === false) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/50 text-[#FFD026]">
          <Download className="size-6" />
        </div>
        <p className="max-w-sm text-sm text-[var(--oh-muted)]">
          Icarus Verilog is not installed yet. The agent will install it (
          <span className="text-[#FFD026]">
            winget install IcarusVerilog.IcarusVerilog
          </span>
          ) on the next simulation, then the waveforms render here.
        </p>
      </div>
    );
  }

  if (!wf.active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/50 text-[#FFD026]">
          <Cpu className="size-6" />
        </div>
        <p className="max-w-xs text-sm text-[var(--oh-muted)]">
          No simulation yet. In{" "}
          <span className="text-[#FFD026]">Computing → Simulation</span>, ask
          the agent to simulate a design (counter, adder, …) — the waveforms
          render here.
        </p>
      </div>
    );
  }

  const height = wf.signals.length * ROW_H + 8;

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
          RTL Waveforms
        </span>
        <span className="flex items-center gap-1 text-[var(--oh-muted)]">
          <Cpu className="size-3" /> {wf.signals.length} signals
        </span>
        <span className="flex items-center gap-1 text-[var(--oh-muted)]">
          <Timer className="size-3" /> {wf.endTime} {wf.timescale}
        </span>
        <span className="flex items-center gap-1 text-[#10B981]">
          <Activity className="size-3" /> simulated
        </span>
      </div>

      <svg
        className="block"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {wf.signals.map((sig: RtlSignal, i: number) => {
          const y0 = i * ROW_H + 2;
          return (
            <g key={sig.name + i}>
              <rect
                x={0}
                y={y0}
                width={width}
                height={ROW_H}
                fill={i % 2 ? "rgba(255,255,255,0.015)" : "transparent"}
              />
              <line
                x1={LABEL_W}
                y1={y0 + ROW_H - 1}
                x2={width}
                y2={y0 + ROW_H - 1}
                stroke="rgba(255,255,255,0.05)"
              />
              <text
                x={10}
                y={y0 + MID + 3}
                fontSize={11}
                fill="var(--oh-foreground)"
                fontFamily="monospace"
              >
                {sig.name}
                {sig.width > 1 ? `[${sig.width - 1}:0]` : ""}
              </text>
              {sig.width > 1 ? (
                <BusTrace wave={sig.wave} x={x} endTime={wf.endTime} y0={y0} />
              ) : (
                <ScalarTrace
                  wave={sig.wave}
                  x={x}
                  endTime={wf.endTime}
                  y0={y0}
                />
              )}
            </g>
          );
        })}
      </svg>

      {wf.log && (
        <div className="px-3 pb-3">
          <pre className="max-h-28 overflow-auto rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/70 px-3 py-2 font-mono text-[10.5px] text-[var(--oh-muted)]">
            {wf.log}
          </pre>
        </div>
      )}
    </div>
  );
}
