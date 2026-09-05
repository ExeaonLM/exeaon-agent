/* eslint-disable no-control-regex */
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import {
  Bot,
  Crown,
  FileText,
  Loader2,
  Check,
  X,
  Search,
  ShieldAlert,
  Cloud,
  FileCode,
  Key,
  Terminal,
  Cpu,
  Radio,
  ExternalLink,
  Plus,
  Minus,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import { useSwarmState, type SwarmOperative, type CyberNodeKind } from "#/hooks/use-swarm-state";
import { cn } from "#/utils/utils";

const NODE_W = 210;
const COL = 230; // horizontal spacing per operative
const LEAD_Y = 54;
const OP_Y = 220;
const REPORT_Y = 400;
const PAD = 60;

function cleanAnsi(str?: string) {
  if (!str) return "";
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "").replace(/\[;[0-9;]*m/g, "").trim();
}

function statusColor(s: SwarmOperative["status"]) {
  if (s === "done") return "#10B981";
  if (s === "error") return "#EF4444";
  return "#FFD026";
}

function kindConfig(kind: CyberNodeKind) {
  switch (kind) {
    case "recon":
      return { label: "RECON", color: "#06B6D4", icon: Search };
    case "web":
      return { label: "WEB VULN", color: "#F97316", icon: ShieldAlert };
    case "cloud":
      return { label: "CLOUD", color: "#3B82F6", icon: Cloud };
    case "audit":
      return { label: "CODE AUDIT", color: "#10B981", icon: FileCode };
    case "auth":
      return { label: "AUTH/EXPLOIT", color: "#EC4899", icon: Key };
    case "terminal":
      return { label: "BASH / CLI", color: "#8B5CF6", icon: Terminal };
    case "swarm":
      return { label: "SWARM AGENT", color: "#FFD026", icon: Bot };
    default:
      return { label: "CYBER TOOL", color: "#94A3B8", icon: Cpu };
  }
}

/** Cubic bezier between two points (vertical flow, ComfyUI style). */
function edge(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

/**
 * Live Cyber Activity & Swarm node-graph (ComfyUI visualizer).
 * Includes auto-fit, smooth zoom in/out, pan drag, and ComfyUI interactive canvas controls.
 */
export function SwarmGraph() {
  const { operatives, running, done, error, active } = useSwarmState();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasUserInteractedRef = useRef(false);

  const selectedOp = operatives.find((o) => o.id === selectedId);

  const n = Math.max(operatives.length, 1);
  const rowW = n * COL;
  const width = Math.max(720, rowW + PAD * 2);
  const height = 500;
  const cx = width / 2;
  const rowStart = (width - rowW) / 2 + NODE_W / 2;
  const opX = (i: number) => rowStart + i * COL;
  const allSettled = operatives.length > 0 && running === 0;

  // Auto-fit function: scales and centers the graph content inside container
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const pad = 36;
    const scaleX = (cw - pad * 2) / width;
    const scaleY = (ch - pad * 2) / height;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.18), 1.05);
    const nextPanX = (cw - width * nextZoom) / 2;
    const nextPanY = Math.max((ch - height * nextZoom) / 2, 16);

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  }, [width, height]);

  // Auto-fit on mount and whenever node count changes
  useEffect(() => {
    if (!hasUserInteractedRef.current) {
      fitToView();
    }
  }, [operatives.length, fitToView]);

  // Auto-fit on container resize if user hasn't manually zoomed/panned
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      if (!hasUserInteractedRef.current) {
        fitToView();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  // Mouse wheel zoom centered on pointer
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    hasUserInteractedRef.current = true;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * factor, 0.15), 2.5);
      setPan((prevPan) => ({
        x: cursorX - ((cursorX - prevPan.x) / prevZoom) * nextZoom,
        y: cursorY - ((cursorY - prevPan.y) / prevZoom) * nextZoom,
      }));
      return nextZoom;
    });
  };

  // Canvas background drag-to-pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    hasUserInteractedRef.current = true;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-10 text-center bg-[#0B0A08]">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[#FFD026]/30 bg-[#1A160F] text-[#FFD026] shadow-md">
          <Radio className="size-6 animate-pulse" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <h3 className="text-sm font-medium text-white">Cyber Activity Pipeline Ready</h3>
          <p className="text-xs text-[var(--oh-muted)]">
            Run security scans, bash tools, or summon Swarm operatives in{" "}
            <span className="text-[#FFD026] font-semibold">Cyber mode</span> to trace execution live on this ComfyUI canvas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-full w-full overflow-hidden select-none"
      style={{
        backgroundColor: "#0B0A08",
        backgroundImage:
          "radial-gradient(circle, rgba(255,208,38,0.06) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Header chips */}
      <div
        data-no-pan
        className="shrink-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#0B0A08]/90 px-4 py-2.5 backdrop-blur text-[11px]"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#FFD026]/40 bg-[#241F14] px-2.5 py-0.5 font-semibold text-[#FFD026]">
            Cyber Activity Pipeline
          </span>
          <span className="text-[var(--oh-muted)]">
            {operatives.length} node{operatives.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {running > 0 && (
            <span className="flex items-center gap-1 text-[#FFD026]">
              <Loader2 className="size-3 animate-spin" /> {running} active
            </span>
          )}
          {done > 0 && <span className="text-[#10B981] font-medium">{done} done</span>}
          {error > 0 && <span className="text-red-400 font-medium">{error} error</span>}
        </div>
      </div>

      {/* Main Interactive Graph Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "relative flex-1 overflow-hidden",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {/* Floating ComfyUI Canvas Toolbar */}
        <div
          data-no-pan
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-[#16140F]/90 p-1 backdrop-blur shadow-2xl text-xs text-white"
        >
          <button
            type="button"
            title="Zoom Out (-)"
            onClick={() => {
              hasUserInteractedRef.current = true;
              setZoom((z) => Math.max(z * 0.85, 0.15));
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-white/10 active:bg-white/20 text-[var(--oh-muted)] hover:text-white"
          >
            <Minus className="size-3.5" />
          </button>

          <button
            type="button"
            title="Reset Zoom to 100%"
            onClick={() => {
              hasUserInteractedRef.current = true;
              setZoom(1);
            }}
            className="px-2 py-0.5 font-mono text-[11px] text-[var(--oh-muted)] hover:text-[#FFD026]"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            title="Zoom In (+)"
            onClick={() => {
              hasUserInteractedRef.current = true;
              setZoom((z) => Math.min(z * 1.15, 2.5));
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-white/10 active:bg-white/20 text-[var(--oh-muted)] hover:text-white"
          >
            <Plus className="size-3.5" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          <button
            type="button"
            title="Fit to Screen"
            onClick={() => {
              hasUserInteractedRef.current = false;
              fitToView();
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-white/10 active:bg-white/20 text-[var(--oh-muted)] hover:text-[#FFD026]"
          >
            <Maximize2 className="size-3.5" />
          </button>

          <button
            type="button"
            title="Center View"
            onClick={() => {
              hasUserInteractedRef.current = true;
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-white/10 active:bg-white/20 text-[var(--oh-muted)] hover:text-white"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>

        {/* Scaled & Panned Content Canvas */}
        <div
          className="absolute origin-top-left transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width,
            height,
          }}
        >
          {/* Connecting bezier cables */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={width}
            height={height}
          >
            {operatives.map((op, i) => {
              const conf = kindConfig(op.kind);
              return (
                <path
                  key={`e1-${op.id}`}
                  d={edge(cx, LEAD_Y + 44, opX(i), OP_Y - 2)}
                  fill="none"
                  stroke={op.status === "running" ? "#FFD026" : conf.color}
                  strokeWidth={1.8}
                  strokeOpacity={op.status === "running" ? 0.9 : 0.6}
                  className={op.status === "running" ? "animate-pulse" : ""}
                />
              );
            })}
            {allSettled &&
              operatives.map((op, i) => (
                <path
                  key={`e2-${op.id}`}
                  d={edge(opX(i), OP_Y + 90, cx, REPORT_Y - 2)}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={1.8}
                  strokeOpacity={0.5}
                />
              ))}
          </svg>

          {/* Lead Controller Node */}
          <NodeCard
            x={cx}
            y={LEAD_Y}
            accent="#FFD026"
            title="Cyber Controller / Lead"
            icon={<Crown className="size-3.5" />}
          >
            <span className="text-[10.5px] text-[var(--oh-muted)]">
              Target Scope · Tool Dispatcher · Swarm
            </span>
          </NodeCard>

          {/* Operative / Tool Nodes */}
          {operatives.map((op, i) => (
            <CyberActivityNode
              key={op.id}
              op={op}
              x={opX(i)}
              y={OP_Y}
              isSelected={selectedId === op.id}
              onSelect={() => setSelectedId(selectedId === op.id ? null : op.id)}
            />
          ))}

          {/* Consolidated Report Node */}
          <NodeCard
            x={cx}
            y={REPORT_Y}
            accent={allSettled ? "#10B981" : "#6B6350"}
            title="Consolidated Telemetry & Report"
            icon={<FileText className="size-3.5" />}
            dim={!allSettled}
          >
            <span className="text-[10px] text-[var(--oh-muted)]">
              {allSettled ? "Pipeline execution finalized · Ready" : "Awaiting active cyber tasks…"}
            </span>
          </NodeCard>
        </div>
      </div>

      {/* Interactive Node Inspector Drawer */}
      {selectedOp && (
        <div className="shrink-0 border-t border-white/10 bg-[#12110D] p-3 max-h-48 overflow-auto animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: statusColor(selectedOp.status) }}
              />
              <span>{selectedOp.subagent}</span>
              <span className="text-[10px] font-normal text-[var(--oh-muted)]">
                (Node #{selectedOp.index})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-[var(--oh-muted)] hover:text-white text-xs px-2 py-0.5 rounded"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            <div>
              <span className="text-[10px] uppercase text-[var(--oh-muted)] font-mono">Parameters / Command:</span>
              <p className="font-mono text-[11px] text-amber-200/90 break-all bg-black/40 p-1.5 rounded mt-0.5">
                {cleanAnsi(selectedOp.mission || selectedOp.details)}
              </p>
            </div>
            {selectedOp.result && (
              <div>
                <span className="text-[10px] uppercase text-[var(--oh-muted)] font-mono">Output / Findings:</span>
                <pre className="font-mono text-[11px] text-emerald-300/90 whitespace-pre-wrap break-all bg-black/60 p-2 rounded max-h-28 overflow-auto mt-0.5">
                  {cleanAnsi(selectedOp.result)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NodeCard({
  x,
  y,
  accent,
  title,
  icon,
  children,
  dim,
}: {
  x: number;
  y: number;
  accent: string;
  title: string;
  icon: ReactNode;
  children?: ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute -translate-x-1/2 rounded-lg border bg-[#16140F] shadow-xl backdrop-blur select-none",
        dim && "opacity-60",
      )}
      style={{ left: x, top: y, width: NODE_W, borderColor: `${accent}66` }}
    >
      {/* ComfyUI Output connector pin */}
      <div
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full border-2 border-[#0B0A08]"
        style={{ backgroundColor: accent }}
      />
      <div
        className="flex items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-[11px] font-semibold"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        {icon}
        {title}
      </div>
      <div className="px-2.5 py-2">{children}</div>
    </div>
  );
}

function CyberActivityNode({
  op,
  x,
  y,
  isSelected,
  onSelect,
}: {
  op: SwarmOperative;
  x: number;
  y: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const conf = kindConfig(op.kind);
  const color = op.status === "running" ? "#FFD026" : conf.color;
  const Icon = conf.icon;

  return (
    <div
      data-node-card
      onClick={onSelect}
      className={cn(
        "absolute -translate-x-1/2 rounded-lg border bg-[#16140F] shadow-xl cursor-pointer transition-all hover:scale-[1.02]",
        isSelected && "ring-2 ring-[#FFD026]",
      )}
      style={{ left: x, top: y, width: NODE_W, borderColor: `${color}88` }}
    >
      {/* ComfyUI Input connector pin */}
      <div
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full border-2 border-[#0B0A08]"
        style={{ backgroundColor: color }}
      />

      {/* ComfyUI Output connector pin */}
      <div
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full border-2 border-[#0B0A08]"
        style={{ backgroundColor: statusColor(op.status) }}
      />

      {/* Node Header */}
      <div
        className="flex items-center justify-between gap-1.5 rounded-t-lg px-2.5 py-1.5 text-[11px] font-semibold"
        style={{ backgroundColor: `${color}25`, color }}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{op.subagent}</span>
        </span>
        {op.status === "running" ? (
          <Loader2 className="size-3.5 animate-spin text-[#FFD026] shrink-0" />
        ) : op.status === "error" ? (
          <X className="size-3.5 text-red-400 shrink-0" />
        ) : (
          <Check className="size-3.5 text-[#10B981] shrink-0" />
        )}
      </div>

      {/* Node Body */}
      <div className="flex flex-col gap-1 px-2.5 py-2">
        <div className="flex items-center justify-between text-[9px]">
          <span
            className="rounded px-1 py-0.2 font-mono uppercase tracking-wider font-semibold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {conf.label}
          </span>
          <span className="text-[var(--oh-muted)] font-mono">#{op.index}</span>
        </div>
        <p className="line-clamp-2 text-[10.5px] leading-snug font-mono text-[var(--oh-foreground)]">
          {cleanAnsi(op.mission) || "(executing)"}
        </p>
        {op.result && op.status !== "running" && (
          <p className="mt-0.5 line-clamp-2 border-t border-white/5 pt-1 text-[9.5px] text-emerald-400/90 font-mono">
            {cleanAnsi(op.result).slice(0, 140)}
          </p>
        )}
      </div>
    </div>
  );
}

