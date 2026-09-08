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
      "Physics, control, dynamics. Simulation = MuJoCo with a live 3D war-room viewer. Real (physical labs) deferred.",
    available: true,
    modes: ["simulation"],
  },
  {
    id: "computing",
    label: "Computing / RTL",
    shortLabel: "RTL",
    icon: "Cpu",
    blurb:
      "Digital logic & RTL. Simulation = Icarus Verilog with a live waveform viewer (VCD). Grows into Verilator/SPICE/FPGA.",
    available: true,
    modes: ["simulation"],
  },
  {
    id: "device",
    label: "Device Control",
    shortLabel: "Device",
    icon: "MonitorCog",
    blurb:
      "Desktop / device automation via the Windows control MCP. Real-only, every action Validation-gated. Acts only on your own machine.",
    available: true,
    modes: ["real", "auto"],
  },
  {
    id: "research",
    label: "Research",
    shortLabel: "Research",
    icon: "Microscope",
    blurb:
      "Replicate, reason, and produce falsifiable results — browse + read real sources, compute/simulate to verify, write with integrity. Requires a strong (cloud) model.",
    available: true,
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
    blurb:
      "Agent chooses Simulation or Real per step; never escalates unsafely.",
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
      // mac-mcp was removed (Swift/macOS-only); the Windows control MCP is the
      // shipped device backend (same server that powers Cyber real OS-control).
      return {
        simBackends: [],
        mcpServers: ["windows-mcp"],
        realCapable: true,
      };
    case "research":
      // Uses the agent's built-in browser + compute (bash) + file tools — no
      // managed MCP in v1; may also drive the robotics/RTL sims to verify a
      // physical/hardware claim.
      return { simBackends: [], mcpServers: [], realCapable: true };
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
  if (field === "robotics") return buildRoboticsContract(mode);
  if (field === "computing") return buildComputingContract(mode);
  if (field === "research") return buildResearchContract(mode);

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
 * The Research operating contract — the field's "brain". Its north-star test:
 * "can the agent produce evidence that survives an attempt to prove it wrong?"
 * Reuses the agent's built-in browser + compute + file tools (and the sim
 * fields where a physical claim needs simulating). Gated to strong models.
 */
function buildResearchContract(mode: ExecutionMode): string {
  const L: string[] = [
    `[Exeaon Engineering Labs] Field: Research · Mode: ${EXECUTION_MODES[mode].label}.`,
    "NORTH STAR: produce evidence that survives an attempt to prove it wrong. Run the full loop — Think → Browse → Read → Extract → Plan → Compute → Simulate → Operate → Observe → Verify → CHALLENGE (actively try to falsify your own result) → Repeat → Write → Integrity check → Publish. The CHALLENGE step is mandatory: before writing, try hard to break your own claim.",
    "MODEL REQUIREMENT: research REQUIRES a strong (cloud/frontier) model. If you are a small/local model, STOP and tell the user to switch to a strong model — do not attempt research on a weak model; it fabricates citations and cannot falsify.",
    "TOOLS: browse the internet and read pages for REAL sources — cite everything with URLs, never invent a citation. Run computations/simulations in the sandbox to actually test claims (don't assert math/physics you didn't run); drive the robotics (MuJoCo) or computing (RTL) sims where a physical/hardware claim can be simulated. Use files to draft.",
    "METHOD: replicate before you extend — reproduce a paper's result end-to-end, then push toward the novelty gap. Consolidate prior work, find the pattern, form a hypothesis, TEST it, iterate. Validate against physics/maths; normalize units and assumptions; DECLARE every assumption explicitly. Where a result doesn't conform to an established standard, flag it openly and resolve it — never hide it.",
    "INTEGRITY: separate CLAIM from EVIDENCE; every claim carries its evidence + the falsification attempt you made. Check originality — paraphrase and cite, never copy-paste source text. State limitations honestly.",
    "DOCUMENT ONLY ON A COMPLETED MILESTONE: emit a structured paper/report to the workspace — Abstract → Background (cited) → Method → Results (with the actual computed/simulated evidence) → Falsification attempts → Limitations → References. One per completed investigation.",
  ];
  return L.join(" ");
}

/**
 * The Robotics operating contract — the field's "brain" for the MuJoCo sim.
 * Simulation-only in v1 (physical labs deferred). Prepended to each message so
 * the agent drives the physics sim rigorously and its motion shows in the live
 * 3D viewer.
 */
function buildRoboticsContract(mode: ExecutionMode): string {
  const L: string[] = [
    `[Exeaon Engineering Labs] Field: Robotics · Mode: ${EXECUTION_MODES[mode].label}.`,
    "SIMULATION only: drive the MuJoCo physics simulation through the `robotics-mujoco` MCP (tools: mujoco_status, list_models, load_model, reset, set_control, step, get_state). No real hardware; there is no physical-robot mode in v1.",
    "NO SHORTCUTS: call mujoco_status first. If MuJoCo isn't installed, INSTALL it before proceeding — `pip install mujoco numpy` — then re-check mujoco_status. Never fabricate physics results or describe motion you didn't actually simulate.",
    "METHOD: state the objective (control, stability, trajectory, analysis) → load_model (a built-in demo: cartpole, double_pendulum, bouncing_ball, reacher — or your own MJCF via `xml`) → design a controller/policy → run a CLOSED LOOP (set_control → step → read state) → measure the objective → iterate → report.",
    "The live 3D viewer renders the sim from your step observations (each step returns per-geom world transforms). Step in modest increments (e.g. n=5–20) so the motion is visible and controllable, not one giant jump.",
    "DOCUMENT ONLY ON A COMPLETED MILESTONE: emit a structured Markdown report to the workspace — Objective → Model → Controller/approach → Procedure → Results (metrics: stability, tracking error, settling time, energy) → Conclusion. One report per completed task.",
  ];
  return L.join(" ");
}

/**
 * The Computing / RTL operating contract — the field's "brain" for the Icarus
 * Verilog simulation. Simulation-only. Prepended to each message so the agent
 * designs/verifies digital logic rigorously and the waveforms show in the
 * live viewer.
 */
function buildComputingContract(mode: ExecutionMode): string {
  const L: string[] = [
    `[Exeaon Engineering Labs] Field: Computing / RTL · Mode: ${EXECUTION_MODES[mode].label}.`,
    "SIMULATION only: design and verify digital logic through the `rtl-sim` MCP (tools: rtl_status, list_examples, simulate, get_waveform). The engine is Icarus Verilog; simulation returns a parsed VCD waveform.",
    "NO SHORTCUTS: call rtl_status first. If Icarus Verilog isn't installed, INSTALL it before proceeding — `winget install --id=IcarusVerilog.IcarusVerilog` (or `scoop install iverilog`) — then re-check. Never fabricate waveforms or claim a design passed without actually simulating it.",
    'METHOD: state the spec → write the Verilog `design` → write a `testbench` that drives inputs and MUST call `$dumpfile("dump.vcd"); $dumpvars;` (so the waveform renders) → simulate → read get_waveform + the log → check the behaviour against the spec (add `$display`/asserts for self-checking) → iterate → report. Start from a built-in `example` (counter, adder, dff) when useful.',
    "The live waveform viewer renders the signals from your last simulation. Keep testbenches bounded (finish with `$finish`) so simulations return promptly.",
    "DOCUMENT ONLY ON A COMPLETED MILESTONE: emit a structured Markdown report to the workspace — Spec → Design (RTL) → Testbench → Results (waveform summary, timing, pass/fail of checks) → Conclusion. One report per completed task.",
  ];
  return L.join(" ");
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

  // Tooling: use the cyber-unified MCP tools directly (50 tools pre-registered).
  if (mode !== "simulation") {
    L.push(
      "TOOLS: The `cyber-unified` MCP server is ALREADY registered, active, and exposes 50 security tools (recon-httpx, recon-subfinder, recon-dnsx, recon-nmap, recon-katana, recon-crtsh, web-http-headers, web-sslscan, web-nuclei, web-ffuf, code-semgrep, code-gitleaks, cloud-prowler, cloud-trivy, etc.). INVOKE THESE MCP TOOLS DIRECTLY.",
    );
    L.push(
      "DO NOT attempt system-level package installations (`choco install`, `winget install`, `scoop install`, etc.) via terminal — all primary capabilities are already provided by the active `cyber-unified` MCP server. If an external command-line binary is not installed on the system, do NOT attempt to install it with package managers; use the corresponding MCP tool or run a native Python script (socket, ssl, urllib, requests) in the workspace to accomplish the task.",
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
      'SWARM LEAD: for any non-trivial engagement you lead a swarm — DECOMPOSE it into independent slices and SUMMON operatives to run them IN PARALLEL. Use the `task` tool: in a SINGLE turn, issue MULTIPLE `task` calls with subagent_type="cyber-operative", each carrying a precise, self-composed mission prompt (e.g. one call "Port+service scan <scope>; return assets", another "Web stack+headers+TLS on <url>; return findings", another "Enumerate SMB/LDAP on <host>"). Firing several `task` calls together runs the operatives concurrently — that is your swarm. Summon as many as THIS engagement needs (more for wide scope, fewer for one host); no fixed roster. Give each operative its scope + authorization explicitly in the prompt. When they return, FUSE their facts: dedupe, resolve conflicts, cross-reference (a recon service version → a CVE another operative confirmed). Produce ONE consolidated report — never N disjoint ones. You remain accountable for scope, authorization, and Validation across every operative.',
    );
    L.push(
      "EXECUTION STRATEGY (PARALLEL vs SEQUENTIAL): Strictly adhere to the user's explicit instructions regarding PARALLEL (summoning/dispatching tools and operatives concurrently in a single turn) versus SEQUENTIAL (step-by-step phased execution). In security audits, adopt a staged 2-phase pipeline: Phase 1 concurrent discovery & reconnaissance in parallel, followed by Phase 2 concurrent deep vulnerability scanning & assessment on discovered endpoints.",
    );
  }
  return L.join(" ");
}
