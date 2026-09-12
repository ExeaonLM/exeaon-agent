import type {
  ManagedSpec,
  ManagedMcpContext,
} from "#/utils/engineering-mcp-managed";
import {
  MANAGED_SPECS,
  MANAGED_MCP_PREFIX,
} from "#/utils/engineering-mcp-managed";
import type { MCPServerConfig } from "#/types/mcp-server";

/**
 * Exeaon capability layer — the DISCOVERY spine of the environment-aware agent.
 * See docs/EXEAON_ARCHITECTURE.md §5 (capability discovery) and §11 (ARD).
 *
 * The old model asked the USER to pick a field, and `specsFor(field)` decided
 * the tools. That's backwards. Here the agent instead answers, per task:
 *
 *   task intent + environment  →  what capability do I NEED?
 *                              →  resolve against the REGISTRY (federated)
 *                              →  what do I HAVE vs. what's MISSING?
 *                              →  acquire the gap, then use.
 *
 * Nothing is loaded into context until the resolver selects it — that is the
 * whole reason discovery exists (never cram every tool in). Discovery is
 * FEDERATED across tiers (local → enterprise → public), and ARD
 * (Agentic Resource Discovery, the industry standard) is ONE public source
 * plugged in here — Exeaon sits ABOVE it and owns acquire/execute/verify; ARD
 * is discovery-only ("not an execution runtime").
 *
 * This module is the model + resolver + source interface. Trust/compat metadata
 * is first-class (pillar §3.2) so discovery can never mean "install random
 * stuff". The environment snapshot is filled by the env-awareness milestone;
 * until then callers may pass a partial snapshot and everything degrades safely.
 */

export type CapabilityKind =
  | "mcp"
  | "native"
  | "skill"
  | "plugin"
  | "api"
  | "cli"
  | "connector";

/** Where a capability was discovered — locality-first federation order. */
export type CapabilityTier = "local" | "enterprise" | "public";

export type OsPlatform = "win32" | "darwin" | "linux";

/** Trust / compatibility metadata — pillar §3.2. Without this, discovery is
 *  "let the agent install random crap." */
export interface CapabilityMeta {
  /** OSes this capability can run on. */
  platforms: OsPlatform[];
  /** Does invoking it require network access? */
  requiresNetwork: boolean;
  /** Runtime prerequisites (pip pkg, a CLI on PATH, …) that gate readiness. */
  deps?: string[];
  /** How it comes to exist here. bundled = ships with Exeaon; on-demand =
   *  Exeaon can install it; external = needs a connection/credential. */
  install: "bundled" | "on-demand" | "external";
  /** Blast radius / trust level — governs whether a policy gate is needed. */
  security: "low" | "medium" | "high";
}

/** A capability the agent can resolve, acquire and use. */
export interface Capability {
  /** stable key (unique within a tier), e.g. "cyber-unified". */
  key: string;
  kind: CapabilityKind;
  tier: CapabilityTier;
  /** Capability tags this provides, e.g. "web.fetch", "sim.physics". A task's
   *  needs are matched against these. */
  provides: string[];
  meta: CapabilityMeta;
  /** One-line human description (for the acquisition UX + logs). */
  description: string;
  /** For kind==="mcp": the managed spec used to build its server config. */
  spec?: ManagedSpec;
}

/** Whether a required capability can be used now, acquired, or not at all. */
export type CapabilityStatus = "ready" | "acquirable" | "unavailable";

/** A machine-derived environment snapshot. Filled by the env-awareness
 *  milestone (§4); every field optional so the resolver degrades safely. */
export interface EnvironmentSnapshot {
  os?: OsPlatform;
  hasNetwork?: boolean;
  /** Names of runtimes/CLIs/pkgs known to be present (git, docker, node,
   *  python, mujoco, iverilog, …). Machine-derived, never model-asserted. */
  installed?: Record<string, boolean>;
}

/** What a task needs, as capability tags. Derived from the task by the intent
 *  step (later); the resolver itself only matches tags → capabilities. */
export interface TaskIntent {
  needs: string[];
}

/** A discovery source contributes candidate capabilities for a tier. */
export interface DiscoverySource {
  id: string;
  tier: CapabilityTier;
  discover(
    intent: TaskIntent,
    env: EnvironmentSnapshot,
  ): Capability[] | Promise<Capability[]>;
}

// --------------------------------------------------------------------------- //
// Local source — the vendored managed MCPs, annotated with capability tags +
// trust/compat metadata. This is the seed registry; enterprise/ARD add more.
// --------------------------------------------------------------------------- //

/** Capability metadata for each managed MCP, keyed by spec.key. */
const LOCAL_MCP_META: Record<
  string,
  { provides: string[]; meta: CapabilityMeta; description: string }
> = {
  "cyber-unified": {
    provides: [
      "web.fetch",
      "web.scrape",
      "web.crawl",
      "security.recon",
      "security.pentest",
    ],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: true,
      deps: ["node"],
      install: "bundled",
      security: "high",
    },
    description:
      "50-tool unified recon/pentest + web fetch/scrape/crawl server.",
  },
  "device-windows": {
    provides: ["device.control", "os.control", "desktop.automation"],
    meta: {
      platforms: ["win32"],
      requiresNetwork: false,
      install: "bundled",
      security: "high",
    },
    description: "Windows device / desktop control.",
  },
  "cyber-caldera": {
    provides: ["security.adversary-emulation", "security.enumeration"],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: true,
      deps: ["node"],
      install: "external",
      security: "high",
    },
    description: "CALDERA adversary-emulation client (operator-run API).",
  },
  "cyber-sim": {
    provides: ["security.simulation"],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: false,
      deps: ["python"],
      install: "bundled",
      security: "low",
    },
    description: "CybORG CAGE-4 autonomous-defence simulation (no real hosts).",
  },
  "robotics-mujoco": {
    provides: ["sim.physics", "robotics.control"],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: false,
      deps: ["python", "mujoco"],
      install: "on-demand",
      security: "low",
    },
    description: "MuJoCo physics simulation (3D viewer).",
  },
  "rtl-sim": {
    provides: ["sim.rtl", "hardware.digital-logic"],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: false,
      deps: ["python", "iverilog"],
      install: "on-demand",
      security: "low",
    },
    description: "Icarus-Verilog RTL simulation + waveforms.",
  },
  research: {
    provides: ["research.integrity", "research.reproduction", "writing.qc"],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: false,
      deps: ["python"],
      install: "bundled",
      security: "low",
    },
    description:
      "Research integrity, reproduction scorecard, writing/QC suite.",
  },
  scholar: {
    provides: ["research.retrieval", "scholarly.search"],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: true,
      deps: ["python"],
      install: "bundled",
      security: "low",
    },
    description:
      "arXiv / Semantic Scholar / OpenAlex / PubMed / Crossref search.",
  },
  "academic-research": {
    provides: [
      "research.retrieval",
      "scholarly.systematic-review",
      "scholarly.citation-graph",
    ],
    meta: {
      platforms: ["win32", "darwin", "linux"],
      requiresNetwork: true,
      deps: ["python", "bibtexparser"],
      install: "on-demand",
      security: "low",
    },
    description: "Citation networks, author/funding profiles, PRISMA review.",
  },
};

/** The local discovery source: the vendored managed MCPs as capabilities. */
export const localManagedMcpSource = {
  id: "local:managed-mcp",
  tier: "local" as CapabilityTier,
  discover(_intent: TaskIntent, _env: EnvironmentSnapshot): Capability[] {
    const caps: Capability[] = [];
    for (const spec of MANAGED_SPECS) {
      const meta = LOCAL_MCP_META[spec.key];
      if (!meta) continue; // a spec with no capability metadata is not offered
      caps.push({
        key: spec.key,
        kind: "mcp",
        tier: "local",
        provides: meta.provides,
        meta: meta.meta,
        description: meta.description,
        spec,
      });
    }
    return caps;
  },
};

/**
 * ARD (Agentic Resource Discovery) — the public/federated discovery standard.
 * Exeaon consumes it as ONE source; it is NOT an execution runtime. Wiring the
 * real ARD client (query a discovery service, read trust/compat, negotiate a
 * connection) is a later milestone — this stub returns nothing so the resolver
 * runs today on the local source alone, and the seam already exists.
 */
export const ardDiscoverySource = {
  id: "public:ard",
  tier: "public" as CapabilityTier,
  discover(_intent: TaskIntent, _env: EnvironmentSnapshot): Capability[] {
    return [];
  },
};

/** Default federation order: locality-first (local → enterprise → public). */
export const DEFAULT_SOURCES: DiscoverySource[] = [
  localManagedMcpSource,
  ardDiscoverySource,
];

const TIER_ORDER: Record<CapabilityTier, number> = {
  local: 0,
  enterprise: 1,
  public: 2,
};

/** Can this capability be used now, acquired, or not at all on this env? */
export function capabilityStatus(
  cap: Capability,
  env: EnvironmentSnapshot,
): CapabilityStatus {
  if (env.os && !cap.meta.platforms.includes(env.os)) return "unavailable";
  if (cap.meta.requiresNetwork && env.hasNetwork === false) {
    return "unavailable";
  }
  const installed = env.installed ?? {};
  const depsMet = (cap.meta.deps ?? []).every((d) => installed[d]);
  if (depsMet) return "ready";
  // Deps missing: ready to acquire iff Exeaon can install/connect it.
  if (cap.meta.install === "on-demand" || cap.meta.install === "external") {
    return "acquirable";
  }
  // Bundled but a hard dep (e.g. python runtime) is absent and unknown → treat
  // as acquirable rather than a hard no; the acquisition step probes/installs.
  return "acquirable";
}

export interface ResolvedCapability {
  capability: Capability;
  status: CapabilityStatus;
  /** which of the task's needs this capability satisfies. */
  matched: string[];
}

export interface ResolutionResult {
  /** Every capability that matches the intent, best-tier-first, deduped. */
  required: ResolvedCapability[];
  /** Subset usable right now. */
  available: ResolvedCapability[];
  /** Subset that must be acquired (installed/connected) before use. */
  missing: ResolvedCapability[];
  /** intent needs that NO source could satisfy — a genuine capability gap. */
  unmet: string[];
}

/**
 * Resolve a task's needs against the federated registry.
 *
 * Aggregates candidates from all sources, keeps the best-tier instance of each
 * capability (locality-first), matches `provides` against `intent.needs`, and
 * classifies each match as ready / acquirable / unavailable by the environment.
 */
export async function resolveCapabilities(
  intent: TaskIntent,
  env: EnvironmentSnapshot = {},
  sources: DiscoverySource[] = DEFAULT_SOURCES,
): Promise<ResolutionResult> {
  const needs = new Set(intent.needs);

  // Gather candidates from every source.
  const gathered: Capability[] = [];
  for (const source of sources) {
    const caps = await source.discover(intent, env);
    for (const cap of caps) gathered.push(cap);
  }

  // Dedupe by key, keeping the best (lowest) tier — locality wins.
  const byKey = new Map<string, Capability>();
  for (const cap of gathered) {
    const existing = byKey.get(cap.key);
    if (!existing || TIER_ORDER[cap.tier] < TIER_ORDER[existing.tier]) {
      byKey.set(cap.key, cap);
    }
  }

  const required: ResolvedCapability[] = [];
  const satisfied = new Set<string>();
  for (const cap of byKey.values()) {
    const matched = cap.provides.filter((p) => needs.has(p));
    if (matched.length === 0) continue;
    matched.forEach((m) => satisfied.add(m));
    required.push({
      capability: cap,
      status: capabilityStatus(cap, env),
      matched,
    });
  }

  // Best-tier-first, then more-matches-first for a stable, sensible order.
  required.sort((a, b) => {
    const t = TIER_ORDER[a.capability.tier] - TIER_ORDER[b.capability.tier];
    return t !== 0 ? t : b.matched.length - a.matched.length;
  });

  return {
    required,
    available: required.filter((r) => r.status === "ready"),
    missing: required.filter((r) => r.status === "acquirable"),
    unmet: [...needs].filter((n) => !satisfied.has(n)),
  };
}

/**
 * Build the `mcp_config` fragment for a set of resolved MCP capabilities —
 * the bridge from "resolved capabilities" to the agent-server's managed MCP
 * reconcile. Mirrors buildManagedMcpConfig but keyed on capabilities, not a
 * field. Only capabilities of kind "mcp" with a spec contribute.
 */
export function buildMcpConfigForCapabilities(
  caps: ResolvedCapability[],
  ctx: ManagedMcpContext,
): Record<string, MCPServerConfig> {
  const out: Record<string, MCPServerConfig> = {};
  for (const { capability } of caps) {
    if (capability.kind !== "mcp" || !capability.spec) continue;
    const cfg = capability.spec.build(ctx);
    out[cfg.name ?? cfg.id] = { ...cfg, enabled: true };
  }
  return out;
}

/** Re-exported for callers that build managed MCP configs from capabilities. */
export { MANAGED_MCP_PREFIX };
