import { useMemo, type ReactNode } from "react";
import { Bot, Cpu, Timer, Activity, Download } from "lucide-react";
import {
  useRoboticsSimState,
  type RoboticsGeom,
  type RoboticsScene,
} from "#/hooks/use-robotics-sim-state";

// Isometric projection: MuJoCo world (x,y,z, z up) → 2D screen.
const A = Math.PI / 6;
const COS = Math.cos(A);
const SIN = Math.sin(A);

function project(
  p: number[],
  s: number,
  cx: number,
  cy: number,
): [number, number] {
  const [x, y, z] = p;
  return [(x - y) * COS * s + cx, ((x + y) * SIN - z) * s + cy];
}

/** Apply a row-major 3x3 rotation (geom_xmat) to a local vector. */
function xform(m: number[], v: number[]): number[] {
  if (!m || m.length < 9) return v;
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function add(a: number[], b: number[]): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function rgba(c: number[] | undefined, alpha = 1): string {
  if (!c || c.length < 3) return `rgba(200,200,210,${alpha})`;
  const [r, g, b, a = 1] = c;
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(
    b * 255,
  )},${alpha * a})`;
}

// Cuboid corner (i: 0..7) as local half-extent signs.
function boxCorner(i: number, sz: number[]): number[] {
  return [
    (i & 1 ? 1 : -1) * sz[0],
    (i & 2 ? 1 : -1) * sz[1],
    (i & 4 ? 1 : -1) * sz[2],
  ];
}
const BOX_FACES: number[][] = [
  [0, 1, 3, 2], // z-
  [4, 5, 7, 6], // z+
  [0, 1, 5, 4], // y-
  [2, 3, 7, 6], // y+
  [0, 2, 6, 4], // x-
  [1, 3, 7, 5], // x+
];
const FACE_SHADE = [0.55, 1, 0.7, 0.8, 0.65, 0.9];

interface Drawn {
  depth: number;
  el: ReactNode;
}

function drawGeom(
  geom: RoboticsGeom,
  xpos: number[],
  xmat: number[],
  s: number,
  cx: number,
  cy: number,
  key: string,
): Drawn | null {
  if (!xpos || xpos.length < 3) return null;
  const depth = xpos[0] + xpos[1] - xpos[2];
  const base = geom.rgba;

  if (geom.type === "plane") return null; // floor handled as a grid

  if (geom.type === "sphere" || geom.type === "ellipsoid") {
    const [px, py] = project(xpos, s, cx, cy);
    const r = Math.max(2, (geom.size[0] ?? 0.1) * s);
    return {
      depth,
      el: (
        <g key={key}>
          <circle
            cx={px}
            cy={py}
            r={r}
            fill={rgba(base)}
            stroke={rgba(base, 1)}
          />
          <circle
            cx={px - r * 0.3}
            cy={py - r * 0.3}
            r={r * 0.35}
            fill="rgba(255,255,255,0.25)"
          />
        </g>
      ),
    };
  }

  if (geom.type === "capsule" || geom.type === "cylinder") {
    const radius = geom.size[0] ?? 0.04;
    const half = geom.size[1] ?? 0.2;
    const e1 = add(xpos, xform(xmat, [0, 0, half]));
    const e2 = add(xpos, xform(xmat, [0, 0, -half]));
    const [x1, y1] = project(e1, s, cx, cy);
    const [x2, y2] = project(e2, s, cx, cy);
    const w = Math.max(2, radius * s * 2);
    return {
      depth,
      el: (
        <line
          key={key}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={rgba(base)}
          strokeWidth={w}
          strokeLinecap="round"
        />
      ),
    };
  }

  // box (default) — draw 6 depth-sorted, shaded faces for a solid look.
  const corners = Array.from({ length: 8 }, (_, i) =>
    add(xpos, xform(xmat, boxCorner(i, geom.size))),
  );
  const faces = BOX_FACES.map((idx, fi) => {
    const pts = idx.map((ci) => project(corners[ci], s, cx, cy));
    const fdepth =
      idx.reduce(
        (acc, ci) => acc + corners[ci][0] + corners[ci][1] - corners[ci][2],
        0,
      ) / idx.length;
    return {
      fdepth,
      d: pts.map(([x, y]) => `${x},${y}`).join(" "),
      shade: FACE_SHADE[fi],
    };
  }).sort((a, b) => a.fdepth - b.fdepth);

  return {
    depth,
    el: (
      <g key={key}>
        {faces.map((f, i) => (
          <polygon
            key={i}
            points={f.d}
            fill={rgba(base, f.shade)}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.5}
          />
        ))}
      </g>
    ),
  };
}

function FloorGrid({
  s,
  cx,
  cy,
  z,
}: {
  s: number;
  cx: number;
  cy: number;
  z: number;
}) {
  const lines: ReactNode[] = [];
  const G = 2;
  for (let i = -G; i <= G; i += 1) {
    const a = project([i, -G, z], s, cx, cy);
    const b = project([i, G, z], s, cx, cy);
    const c = project([-G, i, z], s, cx, cy);
    const d = project([G, i, z], s, cx, cy);
    lines.push(
      <line
        key={`gx${i}`}
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        stroke="rgba(255,208,38,0.10)"
        strokeWidth={1}
      />,
      <line
        key={`gy${i}`}
        x1={c[0]}
        y1={c[1]}
        x2={d[0]}
        y2={d[1]}
        stroke="rgba(255,208,38,0.10)"
        strokeWidth={1}
      />,
    );
  }
  return <g>{lines}</g>;
}

function autoScale(scene: RoboticsScene): number {
  let ext = 1;
  for (const p of scene.xpos) {
    if (!p || p.length < 3) continue;
    ext = Math.max(ext, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]) + 0.5);
  }
  return Math.min(160, Math.max(40, 150 / ext));
}

/**
 * Live robotics 3D war-room — an isometric render of the MuJoCo sim, driven by
 * the real per-geom world transforms every `step` returns (see
 * useRoboticsSimState). It animates as the agent actually simulates.
 */
export function RoboticsViewer() {
  const scene = useRoboticsSimState();
  const W = 660;
  const H = 460;
  const cx = W / 2;
  const cy = H * 0.62;
  const s = useMemo(() => autoScale(scene), [scene]);

  const drawn = useMemo(() => {
    if (!scene.active) return [] as Drawn[];
    const out: Drawn[] = [];
    scene.geoms.forEach((geom, i) => {
      const xpos = scene.xpos[i];
      const xmat = scene.xmat[i] ?? [];
      const d = drawGeom(geom, xpos ?? [0, 0, 0], xmat, s, cx, cy, `g${i}`);
      if (d) out.push(d);
    });
    return out.sort((a, b) => a.depth - b.depth);
  }, [scene, s, cx, cy]);

  if (scene.installed === false) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/50 text-[#FFD026]">
          <Download className="size-6" />
        </div>
        <p className="max-w-sm text-sm text-[var(--oh-muted)]">
          MuJoCo is not installed yet. The agent will install it (
          <span className="text-[#FFD026]">pip install mujoco numpy</span>) on
          the next simulation step, then the model renders here live.
        </p>
      </div>
    );
  }

  if (!scene.active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/50 text-[#FFD026]">
          <Bot className="size-6" />
        </div>
        <p className="max-w-xs text-sm text-[var(--oh-muted)]">
          No simulation running. In{" "}
          <span className="text-[#FFD026]">Robotics → Simulation</span>, ask the
          agent to load a model (cartpole, reacher, …) and step it — the physics
          renders here in 3D.
        </p>
      </div>
    );
  }

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
          MuJoCo Sim
        </span>
        {scene.model && (
          <span className="flex items-center gap-1 text-[var(--oh-muted)]">
            <Cpu className="size-3" /> {scene.model}
          </span>
        )}
        <span className="flex items-center gap-1 text-[var(--oh-muted)]">
          <Timer className="size-3" /> t={scene.time.toFixed(2)}s
        </span>
        <span className="flex items-center gap-1 text-[#10B981]">
          <Activity className="size-3" /> {scene.updates} steps
        </span>
      </div>

      <svg
        className="mx-auto block"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        <FloorGrid s={s} cx={cx} cy={cy} z={0} />
        {drawn.map((d) => d.el)}
      </svg>

      {scene.qpos.length > 0 && (
        <div className="px-3 pb-3">
          <div className="rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/70 px-3 py-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--oh-muted)]">
              Joint state (qpos)
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--oh-foreground)]">
              {scene.qpos.slice(0, 12).map((q, i) => (
                <span key={i}>
                  q{i}=<span className="text-[#FFD026]">{q.toFixed(3)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
