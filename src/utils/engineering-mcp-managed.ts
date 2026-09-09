import type { MCPServerConfig } from "#/types/mcp-server";
import type {
  EngineeringField,
  ExecutionMode,
} from "#/stores/conversation-store";

/**
 * System-managed field MCP servers.
 *
 * These back the Engineering Labs fields (ENGINEERING_LABS_PROVIDER_RESEARCH.md).
 * Unlike user MCP servers they are **owned by Exeaon**: defined here in code,
 * reconciled into the agent's `mcp_config` by field + execution mode, and hidden
 * from the MCP page (see `isManagedMcpName`) so a user can never edit, disable,
 * or remove a field's tooling. Names are namespaced with `exeaon-field-` so the
 * reconcile pass and the UI filter can identify them unambiguously.
 *
 * The servers are the vendored repos under `vendor/mcp/` (Cyber → the 50-tool
 * `unified` server of pentesting-cyber-mcp; Device → windows-mcp-server). At
 * runtime their absolute paths differ between dev and the bundled app, so the
 * caller supplies a `ManagedMcpContext` (resolved from the Tauri resource dir /
 * bundled node) rather than hardcoding paths here.
 */

export const MANAGED_MCP_PREFIX = "exeaon-field-";

/** True for any server this module owns — the MCP page filters these out. */
export function isManagedMcpName(name: string | undefined | null): boolean {
  return typeof name === "string" && name.startsWith(MANAGED_MCP_PREFIX);
}

/** Runtime paths the managed specs need, resolved per environment. */
export interface ManagedMcpContext {
  /** Absolute path to the bundled/dev node executable used to run JS servers. */
  nodePath: string;
  /** Absolute path to the bundled python (runs the CybORG sim server). */
  pythonPath: string;
  /** Absolute path to the MCP resources root (dev + bundle: <resources>/mcp). */
  mcpRoot: string;
}

/** A managed server spec before path resolution. */
interface ManagedSpec {
  /** stable id/name (without the prefix). */
  key: string;
  build: (ctx: ManagedMcpContext) => MCPServerConfig;
}

const CYBER_UNIFIED: ManagedSpec = {
  key: "cyber-unified",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}cyber-unified`,
    name: `${MANAGED_MCP_PREFIX}cyber-unified`,
    type: "stdio",
    command: ctx.nodePath,
    args: [`${ctx.mcpRoot}/cyber-unified/build/index.js`],
    // The unified server advertises the ~50 security-tool servers over one
    // stdio endpoint. Underlying CLIs (nmap, ghidra, …) are separate prereqs.
    env: { MCP_TRANSPORT: "stdio" },
  }),
};

const DEVICE_WINDOWS: ManagedSpec = {
  key: "device-windows",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}device-windows`,
    name: `${MANAGED_MCP_PREFIX}device-windows`,
    type: "stdio",
    command: `${ctx.mcpRoot}/windows-mcp-server.exe`,
    args: ["stdio"],
  }),
};

// Cyber Real: CALDERA adversary emulation / enumeration (talks to an
// operator-run CALDERA REST API — ships no implants). CALDERA_URL /
// CALDERA_API_KEY come from the user's environment / lab config.
const CYBER_CALDERA: ManagedSpec = {
  key: "cyber-caldera",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}cyber-caldera`,
    name: `${MANAGED_MCP_PREFIX}cyber-caldera`,
    type: "stdio",
    command: ctx.nodePath,
    args: [`${ctx.mcpRoot}/caldera-mcp/index.mjs`],
  }),
};

// Cyber Simulation: the CybORG CAGE-4 autonomous-defence sim (pure Python,
// no real hosts/implants). Runs on the bundled Python.
const CYBER_SIM: ManagedSpec = {
  key: "cyber-sim",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}cyber-sim`,
    name: `${MANAGED_MCP_PREFIX}cyber-sim`,
    type: "stdio",
    command: ctx.pythonPath,
    args: [`${ctx.mcpRoot}/cyborg-sim/server.py`],
  }),
};

// Robotics Simulation: the MuJoCo physics sim (pure Python, no real hardware).
// Runs on the bundled Python; MuJoCo itself is installed on demand (the server
// reports a clear install hint until then). Every step returns per-geom world
// transforms so the desktop's live 3D viewer renders the actual model.
const ROBOTICS_MUJOCO: ManagedSpec = {
  key: "robotics-mujoco",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}robotics-mujoco`,
    name: `${MANAGED_MCP_PREFIX}robotics-mujoco`,
    type: "stdio",
    command: ctx.pythonPath,
    args: [`${ctx.mcpRoot}/mujoco-sim/server.py`],
  }),
};

// Research: integrity tools (offline originality check, humanize review) +
// structured session state (sources, claims) that also drives the research
// war-room viewer. Pure Python on the bundled runtime; the agent's own browser
// + compute + file tools do the rest.
const RESEARCH_MCP: ManagedSpec = {
  key: "research",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}research`,
    name: `${MANAGED_MCP_PREFIX}research`,
    type: "stdio",
    command: ctx.pythonPath,
    args: [`${ctx.mcpRoot}/research-mcp/server.py`],
  }),
};

// Scholarly retrieval: arXiv / Semantic Scholar / OpenAlex / PubMed / Crossref
// over their free no-key APIs (stdlib-only Python, no extra deps). Gives the
// Research swarm real multi-source literature search instead of browser-only
// scraping. Network errors/rate-limits are returned as data, never crash it.
const SCHOLAR_MCP: ManagedSpec = {
  key: "scholar",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}scholar`,
    name: `${MANAGED_MCP_PREFIX}scholar`,
    type: "stdio",
    command: ctx.pythonPath,
    args: [`${ctx.mcpRoot}/scholar-mcp/server.py`],
  }),
};

// Richer scholarly toolkit (vendored academic-research-mcp): 25 tools incl.
// author/funding profiles, citation networks, snowball search, and a full
// PRISMA systematic-review workflow. Needs pip deps in the bundled runtime
// (bundle-sim-deps.ps1, `bibtexparser<2` pin); if those aren't present it
// simply won't start and the zero-dep `scholar` MCP still covers retrieval.
const ACADEMIC_MCP: ManagedSpec = {
  key: "academic-research",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}academic-research`,
    name: `${MANAGED_MCP_PREFIX}academic-research`,
    type: "stdio",
    command: ctx.pythonPath,
    args: [`${ctx.mcpRoot}/academic-research/server.py`],
  }),
};

// Computing / RTL Simulation: Verilog compile + simulate via Icarus Verilog,
// returning parsed VCD waveforms. Pure Python protocol layer on the bundled
// Python; the `iverilog` binary is found on PATH or in mcp/bin (installed on
// demand until bundled). Drives the waveform viewer.
const RTL_SIM: ManagedSpec = {
  key: "rtl-sim",
  build: (ctx) => ({
    id: `${MANAGED_MCP_PREFIX}rtl-sim`,
    name: `${MANAGED_MCP_PREFIX}rtl-sim`,
    type: "stdio",
    command: ctx.pythonPath,
    args: [`${ctx.mcpRoot}/rtl-sim/server.py`],
  }),
};

/**
 * Which managed servers a (field, mode) activates. Simulation mode uses the
 * field's local sim backends (CALDERA/CybORG, MuJoCo, Verilator) which are NOT
 * MCP servers — so no managed MCP is enabled in pure simulation. Real/Auto
 * enable the field's real-tool MCP servers.
 */
function specsFor(field: EngineeringField, mode: ExecutionMode): ManagedSpec[] {
  const wantsReal = mode === "real" || mode === "auto";
  const wantsSim = mode === "simulation" || mode === "auto";
  switch (field) {
    case "cyber": {
      const out: ManagedSpec[] = [];
      // Real: unified pentest MCP + OS control + CALDERA emulation/enumeration.
      if (wantsReal) out.push(CYBER_UNIFIED, DEVICE_WINDOWS, CYBER_CALDERA);
      // Simulation: the CybORG sim (also available in Auto).
      if (wantsSim) out.push(CYBER_SIM);
      return out;
    }
    case "robotics":
      // Simulation only in v1 (physical labs deferred): the MuJoCo sim MCP.
      return wantsSim ? [ROBOTICS_MUJOCO] : [];
    case "computing":
      // Simulation only: the Icarus-Verilog RTL sim MCP.
      return wantsSim ? [RTL_SIM] : [];
    case "device":
      return wantsReal ? [DEVICE_WINDOWS] : [];
    case "research":
      // Research gets the WIDEST toolset — the MCPs are cross-field, not siloed:
      // its own integrity/war-room MCP, the cyber-unified tools for fetching/
      // scraping/crawling web sources (recon-httpx/katana/crtsh + more), the
      // robotics (MuJoCo) and computing (RTL) sims to actually test physical/
      // hardware claims, and device control — on top of the agent's built-in
      // browser + compute + file tools.
      return [
        RESEARCH_MCP,
        SCHOLAR_MCP,
        ACADEMIC_MCP,
        CYBER_UNIFIED,
        ROBOTICS_MUJOCO,
        RTL_SIM,
        DEVICE_WINDOWS,
      ];
    default:
      return [];
  }
}

/**
 * The full managed-MCP reconcile plan for a (field, mode): the set of managed
 * servers that should be ENABLED, keyed by name. The reconcile pass patches
 * `mcp_config` so exactly these managed servers are present+enabled and every
 * other `exeaon-field-` server is removed — the user's own servers are never
 * touched.
 */
export function buildManagedMcpConfig(
  field: EngineeringField,
  mode: ExecutionMode,
  ctx: ManagedMcpContext,
): Record<string, MCPServerConfig> {
  const out: Record<string, MCPServerConfig> = {};
  for (const spec of specsFor(field, mode)) {
    const cfg = spec.build(ctx);
    out[cfg.name ?? cfg.id] = { ...cfg, enabled: true };
  }
  return out;
}

/** Names of every managed server this build knows about (for cleanup/reconcile). */
export function allManagedMcpNames(): string[] {
  return [
    CYBER_UNIFIED,
    DEVICE_WINDOWS,
    CYBER_CALDERA,
    CYBER_SIM,
    ROBOTICS_MUJOCO,
    RTL_SIM,
    RESEARCH_MCP,
    SCHOLAR_MCP,
    ACADEMIC_MCP,
  ].map((s) => `${MANAGED_MCP_PREFIX}${s.key}`);
}
