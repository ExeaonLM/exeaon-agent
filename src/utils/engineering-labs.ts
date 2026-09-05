import type {
  EngineeringField,
  ExecutionMode,
} from "#/stores/conversation-store";

/**
 * Exeaon Engineering Labs — field + execution-mode model.
 *
 * Source of truth for the composer's Field control and the agent context/
 * tool-gating scaffold (Phase 0 of ENGINEERING_LABS_PROVIDER_RESEARCH.md).
 * Every field runs in one of three modes — Simulation (safe/sandboxed), Real
 * (acts on real systems/tools, gated by Validation), or Auto (agent chooses per
 * step). The backend/MCP lists below are the *plan* each (field, mode) resolves
 * to; Phase 1+ wires the actual MCP servers / local engines behind them.
 */

export interface EngineeringFieldMeta {
  id: EngineeringField;
  label: string;
  /** Short label for composer pill button (avoids cluttering the bar). */
  shortLabel: string;
  /** lucide-react icon name, resolved by the UI. */
  icon: string;
  blurb: string;
  /** false = shown but not yet wired (roadmap), true = v1. */
  available: boolean;
  /** Modes this field supports (order = display order). */
  modes: ExecutionMode[];
}

export const ENGINEERING_FIELDS: EngineeringFieldMeta[] = [
  {
    id: "none",
    label: "General",
    shortLabel: "Field",
    icon: "Sparkles",
    blurb: "The general Exeaon agent — no engineering field active.",
    available: true,
    modes: ["simulation"],
  },
  {
    id: "cyber",
    label: "Cybersecurity",
    shortLabel: "Cyber",
    icon: "Shield",
    blurb:
      "Recon, pentest, vuln assessment, DFIR. Simulation = CybORG (safe sim); Real = pentest + OS-control + CALDERA emulation MCP tools (Validation-gated, isolated lab).",
    available: true,
    modes: ["simulation", "real", "auto"],
  },
  {
    id: "robotics",
    label: "Robotics",
    shortLabel: "Robotics",
    icon: "Bot",
    blurb:
      "Physics, control, dynamics. Simulation = MuJoCo (live 3D). Real (physical labs) deferred.",
    available: false,
    modes: ["simulation"],
  },
  {
    id: "computing",
    label: "Computing / RTL",
    shortLabel: "RTL",
    icon: "Cpu",
    blurb:
      "Digital logic & hardware. Simulation = Verilator + cocotb with live waveforms. Grows into SPICE/FPGA.",
    available: false,
    modes: ["simulation"],
  },
  {
    id: "device",
    label: "Device Control",
    shortLabel: "Device",
    icon: "MonitorCog",
    blurb:
      "Desktop / device automation via Windows + macOS MCP. Real-only, Validation-gated. (Coming last.)",
    available: false,
    modes: ["real", "auto"],
  },
];

export interface ExecutionModeMeta {
  id: ExecutionMode;
  label: string;
  icon: string;
  blurb: string;
}

export const EXECUTION_MODES: Record<ExecutionMode, ExecutionModeMeta> = {
  simulation: {
    id: "simulation",
    label: "Simulation",
    icon: "FlaskConical",
    blurb: "Safe, sandboxed. No real-world effect.",
  },
  real: {
    id: "real",
    label: "Real",
    icon: "Zap",
    blurb: "Acts on real systems through real tools. Validation-gated.",
  },
  auto: {
    id: "auto",
    label: "Auto",
    icon: "Wand2",
    blurb: "Agent chooses Simulation or Real per step; never escalates unsafely.",
  },
};

export function fieldMeta(id: EngineeringField): EngineeringFieldMeta {
  return ENGINEERING_FIELDS.find((f) => f.id === id) ?? ENGINEERING_FIELDS[0];
}

/**
 * The tool plan a (field, mode) resolves to. Phase 0 returns the *intended*
 * backend/MCP inventory so the UI + agent context are correct and Phase 1 only
 * has to register the actual servers. `mcpServers` names map to MCP servers
 * Claw's MCP router will host; `simBackends` are local engines (bundled Python
 * / native binary).
 */
export interface FieldToolPlan {
  simBackends: string[];
  mcpServers: string[];
  /** Whether Real actions are possible in this (field, mode). */
  realCapable: boolean;
}

export function getFieldToolPlan(
  field: EngineeringField,
  mode: ExecutionMode,
): FieldToolPlan {
  const wantsReal = mode === "real" || mode === "auto";
  switch (field) {
    case "cyber":
      // Simulation = CybORG (pure-Python sim, no real implants). Real =
      // pentest MCP + OS control + CALDERA adversary emulation (operator-run in
      // an isolated lab; the caldera-mcp wrapper connects to its REST API).
      return {
        simBackends: ["cyborg"],
        mcpServers: wantsReal
          ? ["cyber-unified", "windows-mcp", "caldera-mcp"]
          : [],
        realCapable: wantsReal,
      };
    case "robotics":
      return { simBackends: ["mujoco"], mcpServers: [], realCapable: false };
    case "computing":
      return {
        simBackends: ["verilator", "cocotb"],
        mcpServers: [],
        realCapable: false,
      };
    case "device":
      return {
        simBackends: [],
        mcpServers: ["windows-mcp", "mac-mcp"],
        realCapable: true,
      };
    case "none":
    default:
      return { simBackends: [], mcpServers: [], realCapable: false };
  }
}

/**
 * A concise directive prepended to the agent's context when a field is active,
 * so the model knows the field, the execution mode, and the safety posture. Kept
 * short and machine-clear. Returns "" for the general (none) field so ordinary
 * chats are untouched.
 */
export function buildEngineeringDirective(
  field: EngineeringField,
  mode: ExecutionMode,
  swarm = false,
): string {
  if (field === "none") return "";
  if (field === "cyber") return buildCyberContract(mode, swarm);

  const meta = fieldMeta(field);
  const plan = getFieldToolPlan(field, mode);
  const lines: string[] = [
    `[Exeaon Engineering Labs] Active field: ${meta.label}. Execution mode: ${EXECUTION_MODES[mode].label}.`,
  ];
  if (mode === "simulation") {
    lines.push(
      "Operate in SIMULATION only: use sandboxed/simulated backends; take no real-world action.",
    );
  } else if (mode === "real") {
    lines.push(
      "REAL mode: you may act on real systems using the field's real tools. Every real action is gated by Validation and requires user confirmation. Only act on targets the user owns or is explicitly authorized to assess.",
    );
  } else {
    lines.push(
      "AUTO mode: prefer simulation; escalate to real tools only when clearly appropriate and authorized. Never escalate to a real action on an unauthorized or out-of-scope target — default to simulation when authorization is absent.",
    );
  }
  if (plan.simBackends.length) {
    lines.push(`Simulation backends: ${plan.simBackends.join(", ")}.`);
  }
  if (plan.mcpServers.length) {
    lines.push(`Real-tool MCP servers: ${plan.mcpServers.join(", ")}.`);
  }
  return lines.join(" ");
}

/**
 * The Cybersecurity operating contract — the field's "brain". Prepended to each
 * message's server content so the agent always operates to standard: right
 * tools, persistent (legitimate) tool installation, sound methodology,
 * disciplined findings, and milestone-only documentation. Mode-aware.
 */
function buildCyberContract(mode: ExecutionMode, swarm = false): string {
  const L: string[] = [
    `[Exeaon Engineering Labs] Field: Cybersecurity · Mode: ${EXECUTION_MODES[mode].label}${swarm ? " · SWARM" : ""}.`,
  ];

  if (mode === "simulation") {
    L.push(
      "SIMULATION only: operate against the CybORG simulated network (cyborg-sim MCP). No real-world action, no real targets, no real scanning. Use sim to rehearse tradecraft, train/evaluate autonomous defence/attack, and explain technique — then report.",
    );
  } else if (mode === "real") {
    L.push(
      "REAL mode: you may act on real systems with the cyber tools. EVERY intrusive action is Validation-gated (the user confirms first). Only targets the user owns or is explicitly authorized to assess; prefer a disposable/isolated lab; record tool·target·time for every real action. No exploitation beyond the agreed scope.",
    );
  } else {
    L.push(
      "AUTO mode: default to SIMULATION (CybORG); escalate to a REAL tool only when the target is clearly authorized and in-scope. Never escalate to a real action on an unauthorized/out-of-scope target.",
    );
  }

  // Tooling + the no-shortcut install discipline (applies in real/auto).
  if (mode !== "simulation") {
    L.push(
      "TOOLS: your primary instrument is the `cyber-unified` MCP — 50+ security tools (recon-nmap, recon-httpx, recon-subfinder, recon-dnsx, recon-katana, web-http-headers, web-sslscan, web-nuclei, web-ffuf, code-semgrep, code-gitleaks, cloud-prowler/trivy, plus shodan/virustotal/crtsh via API keys). Also windows-mcp (host control) and caldera-mcp (adversary emulation / enumeration).",
    );
    L.push(
      "NO SHORTCUTS — if a tool's binary is missing, INSTALL it before falling back, in order: (1) the app's bundled `mcp/bin`, (2) `winget install` / `choco install` / `scoop install`, (3) the tool's official GitHub release / `go install` / `pip install`. Never use cracked, pirated, or untrusted-mirror binaries. If it needs elevation you can't get, use a native equivalent (Python socket/ssl/urllib/requests) and clearly NOTE the substitution. Verify each tool with `--version` before relying on it. In security you either get the real capability working or you honestly report you couldn't — never silently skip.",
    );
  }

  // Methodology + findings + reporting discipline (all modes).
  L.push(
    "METHOD: scope & confirm authorization → discovery (live hosts, ports, service/versions) → per-service enumeration (web headers/TLS, HTTP stack, subdomains, DNS, auth surfaces) → analysis (map the stack, weaknesses) → report.",
  );
  L.push(
    "FINDINGS: severity = impact × CONFIRMED exploitability. Separate CONFIRMED (you observed it / a working path) from POTENTIAL (version-inferred CVEs). Do NOT inflate an outdated banner to Critical without a verified exploit path. Every finding carries evidence and a concrete, actionable remediation.",
  );
  L.push(
    "DOCUMENT ONLY ON A COMPLETED MILESTONE/ENGAGEMENT (not routine intermediate steps): emit a structured Markdown report saved to the workspace — Executive summary → Methodology & tool-execution notes → Asset inventory → Service/version analysis → Findings (risk-rated, confirmed vs potential) → Remediation → Reproduction artifacts. One report per completed engagement.",
  );

  if (swarm) {
    L.push(
      "SWARM LEAD: for any non-trivial engagement you lead a swarm — DECOMPOSE it into independent slices and SUMMON operatives to run them IN PARALLEL. Use the `task` tool: in a SINGLE turn, issue MULTIPLE `task` calls with subagent_type=\"cyber-operative\", each carrying a precise, self-composed mission prompt (e.g. one call \"Port+service scan <scope>; return assets\", another \"Web stack+headers+TLS on <url>; return findings\", another \"Enumerate SMB/LDAP on <host>\"). Firing several `task` calls together runs the operatives concurrently — that is your swarm. Summon as many as THIS engagement needs (more for wide scope, fewer for one host); no fixed roster. Give each operative its scope + authorization explicitly in the prompt. When they return, FUSE their facts: dedupe, resolve conflicts, cross-reference (a recon service version → a CVE another operative confirmed). Produce ONE consolidated report — never N disjoint ones. You remain accountable for scope, authorization, and Validation across every operative.",
    );
  }
  return L.join(" ");
}
