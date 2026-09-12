# Exeaon — Unified Agentic Operating Environment

> **Status:** North-star architecture (v1 draft, 2026-09-12). This is the
> canonical reference every re-architecture PR points back to. If a change
> contradicts this doc, either the change is wrong or this doc is — resolve it
> here first, in a PR that edits this file, before writing the code.

---

## 0. The thesis

Exeaon is **not** a collection of AI features or specialized "fields." It is
**one environment-aware agent** that:

> understands the user's goal → understands the environment it inhabits →
> determines what capabilities are required → acquires or invokes them →
> executes the work → validates the result → maintains continuity.

The user gives a **goal**. Exeaon figures out the rest — whether that goal is
coding, research, cybersecurity, automation, data analysis, browser work, or
document work. Those are **capabilities of the environment, not products the
user must navigate.**

The old model — Coding Agent / Research Agent / Cyber Agent / Automation Agent,
with the user choosing which — is gone. There is **one intelligence**;
specialized components live underneath it.

The interesting product is not a chatbot. It is:

> *An agent that inhabits a computer, understands it, knows what it can do,
> knows what it needs, can acquire capabilities, can operate the environment,
> can validate its own work, remembers what it did, and lets you either talk to
> it or watch it work.*

---

## 1. The runtime loop

The agent is not `prompt → answer`. It is a continuous loop:

```
GOAL
 └─▶ UNDERSTAND (prompting/planning layer)
      └─▶ OBSERVE ENVIRONMENT (machine-derived, never asserted)
           └─▶ PLAN
                └─▶ DISCOVER CAPABILITIES (task → required → available → missing)
                     └─▶ ACQUIRE / CONNECT / INSTALL / CONFIGURE
                          └─▶ VALIDATE CAPABILITY
                               └─▶ EXECUTE (control plane)
                                    └─▶ OBSERVE RESULT
                                         └─▶ VERIFY against success criteria
                                              ├─ PASS ─▶ COMPLETE
                                              └─ FAIL ─▶ REPLAN ─▶ (back to PLAN)
        every step appends to ─▶ TRAJECTORY (persistent state)
                                   └─▶ CONVERSATION · VIEW · LOGS
```

---

## 2. Layered architecture

```
USER GOAL
   │
   ▼
PROMPTING / PLANNING SERVICE  ── persistent plan + intentions, cross-session
   │  (intent, constraints, expected outcome, whether validation is required)
   ▼
EXEAON MAIN AGENT  ── the autonomous worker
   ├── ENVIRONMENT AWARENESS   (world state, machine-derived, refreshed)
   ├── CAPABILITY REGISTRY     (task→capability resolution, trust metadata)
   ├── MEMORY / STATE          (trajectory store, run history)
   └── POLICY / VALIDATION      (agent defaults + user policies)
   │
   ▼
CONTROL PLANE  ── filesystem · shell · browser · apps · package mgr · OS ·
                  network · MCP · APIs · plugins · devices · automation
   │
   ▼
OBSERVATION BUS  ── terminal/browser/file/tool observations, screenshots
   │
   ▼
TRAJECTORY STORE
   │
   ├─▶ CONVERSATION   (talk to it)
   ├─▶ VIEW           (watch it — live / replay; the "AI camera")
   └─▶ LOGS           (structured audit)
```

---

## 3. The three pillars (non-negotiable)

These are the reliability spine. Everything autonomous depends on them.

### 3.1 Environment truth is machine-derived
The model must **never assert** its environment. If Exeaon "believes" Docker is
installed when it is not, the entire autonomous loop produces garbage. The
environment snapshot is produced by **deterministic probes**, cached, and
**continuously refreshed** — not injected once into a prompt. When the agent
installs something, the snapshot updates (`Node ✗ → Node ✓`); when a connector
token expires, it degrades (`GitHub ✓ → ⚠ → reconnect → ✓`).

### 3.2 Capabilities carry trust / compatibility metadata
The registry must not say "here's an MCP that looks useful." Each capability
carries: platform/arch compatibility, dependencies, permissions, install
method, version, security level, network requirements, credentials required,
sandbox compatibility, validation status. Without this, "capability discovery"
becomes "let the agent install random crap." (See `ecc-agentshield`, §7.)

### 3.3 Verification is first-class
`agent says "done"` ≠ done. Every run ends with
`EXECUTE → OBSERVE → VERIFY against success criteria → PASS | REPLAN`. This is
the single most important reliability mechanism in the system.

---

## 4. Environment awareness

A live, machine-derived world model, refreshed continuously:

```
ENVIRONMENT STATE
├── Hardware   CPU · GPU · VRAM · RAM · storage · devices
├── Software   OS · runtimes · packages · applications · browsers · services
└── Access     permissions · credentials · connectors · MCP · plugins · skills
        │
        ▼
CAPABILITY STATE
├── AVAILABLE
└── MISSING ──▶ acquire / connect / install ──▶ READY
```

Partly present today (`runtime_services` info via the agent-server;
`device-windows` MCP). The gap is a **first-class, trusted, refreshed** snapshot
the planner and resolver read from — not reactive discovery mid-task.

---

## 5. Capability discovery & acquisition

```
TASK ─▶ ENVIRONMENT ─▶ what capability is NEEDED?
     ─▶ CAPABILITY REGISTRY ─▶ what is AVAILABLE here?
     ─▶ SELECT ─▶ (configure / install if necessary) ─▶ VALIDATE ─▶ USE
```

Capabilities are **not limited to MCP**. MCP sits alongside native tools, CLI
programs, APIs, SDKs, browser automation, OS controls, plugins, skills, local
services, remote services, specialized runtimes.

**Setup becomes agentic.** The user never faces a settings maze. Exeaon
discovers a task needs something and surfaces exactly that:

> "GitHub access is required for this task. Connect GitHub?" → `[Connect]`

Once authorized, Exeaon configures the capability, validates it, updates the
environment snapshot, and continues. Governed by user policy (§6): auto-install
dev deps if allowed; ask before system software if required.

**Context discipline (from ECC):** do not shove hundreds of tools into context.
Resolve per task; keep the *active* toolset small (ECC's rule of thumb: under
~10 MCPs / ~80 tools live at once). Capability discovery is what makes this
possible.

---

## 6. Policy / validation plane

Sits **between reasoning and execution**. Two layers, one gate:

```
VALIDATION
├── AGENT DEFAULT   did the command/build/tests/deploy/workflow actually succeed?
└── USER POLICY     "never complete unless these tests pass"
                    "ask me before anything leaves the machine"
                    "this workspace requires my approval to deploy"
                    "auto-install dev deps; ask before system software"
        │
        ▼
     FINAL CHECK  (both must pass)
```

Same agent, different user policy → different autonomy envelope. The model
*proposes* actions; deterministic software *validates and executes* them.

---

## 7. State, trajectory & View

### 7.1 Trajectory is the source of truth — not a video
Every meaningful run persists a structured trajectory:

```
RUN
├── goal · plan · environment snapshot · capabilities
├── actions · tool calls · observations · results
├── screenshots · browser states · terminal states · file diffs
├── validations · failures · replans · checkpoints
└── final state
```

This is what fixes the conversation/resume problem: an old conversation is not a
pile of messages — it has **execution history**, so Exeaon resumes
intelligently. Continuing a conversation **appends a chapter**; it never
overwrites the old trajectory.

### 7.2 View sits on top of the trajectory
```
TRAJECTORY ─▶ LIVE VIEW  (agent working now)
           ─▶ REPLAY     (open an old conversation → cinematic reconstruction)
           ─▶ LOGS       (structured audit)
```

**View is not the execution engine** and requires **no VM.** The agent works
natively (CLI / API / MCP / browser automation); the View **renderer
reconstructs** the experience from observations. The "AI camera" follows the
active surface — terminal → browser → editor → terminal — capturing output,
commands, file changes, and screenshots at meaningful moments. A sandboxed
GUI/computer-use surface is used **only when GUI interaction is actually
necessary**, and a remote environment **only when the local machine is too
weak** — never as a mandatory "giant virtual computer."

---

## 8. Model independence

The runtime survives the model. Because the intelligence lives in the runtime
(environment, registry, memory, policy, execution, trajectory, view), the model
is **replaceable**: a small local model for trivial tasks, a cloud model for
large ones, Exeaon's own model later. LiteLLM configs already make the model
swappable — this is a strategic position to protect, not erode.

---

## 9. UI architecture

The UI is the surface over the runtime — it is **being redefined, not
restyled.**

### 9.1 Home = conversation list (not a dashboard)
Open Exeaon → your conversations. Tap one.

### 9.2 The Exeaon window: Conversation | View
```
┌──────────────────────────────┐
│  CONVERSATION   or   VIEW     │
└──────────────────────────────┘
```
- **Conversation** — talk normally.
- **View** — watch the agent work (the AI camera; live or replay).

### 9.3 Utility stack (the working surfaces)
`Browser · Terminal · Files · Editor · Application · other surfaces`. These are
**not** Conversation/View — they are the actual tools, and Exeaon can operate
them.

### 9.4 The glowing orb (Exeaon popup, inside Utility)
```
◉ ─tap─▶ ◉ EXEAON  ┌───────┐
                    │ Chat  │
                    │ View  │
                    │ Status│
                    └───────┘
```
Switch to Conversation or View **without destroying the Utility.** Close the
Utility → the stack **restores the previous Exeaon surface.**

### 9.5 What collapses
The field tabs (`robotics-tab`, `rtl-tab`, `swarm-tab`) fold into **View**
(trajectory-driven, adaptive to whatever the run is doing). The settings sprawl
(`mcp`, `secrets`, `skills`, `models`, `connectors`, …) collapses into
**agentic, on-demand setup** (§5) — surfaced only when a task needs it.

---

## 10. No fields — the operating principle

The user never chooses a task type. They give the goal; Exeaon answers, in
order: **What is required? What do I have? What am I missing? How do I acquire
it? How do I execute it? How do I know I succeeded?**

Concretely, the current per-field system dissolves:
- The per-field contracts (`engineering-labs.ts`: research/cyber/robotics/
  computing/device) become **internal capability packs** the resolver surfaces
  on demand — the *knowledge* survives; the *mode picker* dies. Packs that don't
  earn their place get **removed**.
- `engineering-mcp-managed.ts`'s `specsFor(field)` is **re-keyed** from
  `field` (a user choice) to `task + environment` (agent-derived) — it becomes
  the capability resolver of §5.

> **Guard rail:** do **not** turn this into "30 agents talking to each other."
> Keep the hierarchy brutally simple — one intelligence the user experiences;
> specialized components underneath. Subagents are scoped workers the main agent
> delegates to, never a committee.

---

## 11. ECC as accelerator (not a product surface)

**ECC** (`affaan-m/ECC`, ecc.tools — third-party OSS, MIT; local copy in
`~/Downloads/ECC`) is *"the agent harness operating system."* We **leverage its
patterns and packages** for the runtime side; we do **not** expose it to users
as another product category. It accelerates three Exeaon layers:

| Exeaon layer | ECC provides |
|---|---|
| Capability packs (§5) | portable **skills** (durable workflow unit), **scaffolds**, **workflows**, **commands** (legacy shims), **mcp-configs** |
| Policy / governance plane (§6) | **hooks** (Pre/PostToolUse, UserPromptSubmit, Stop, PreCompact, Notification), **rules/**, and **`ecc-agentshield`** (governance/security → trust metadata of §3.2) |
| Planning & delegation (§2) | scoped, sandboxed **subagents** (planner/architect/reviewer/…) and MCP-on-demand discipline (§5) |

ECC's core discipline — *skills are the durable unit; keep active tools small;
scope subagents* — is exactly Exeaon's thesis validated by a battle-tested
harness. Attribution + license (MIT) must be respected wherever ECC code or
assets are vendored.

---

## 12. Reuse map — this is ~40% already built

| Vision layer | Current code | Action |
|---|---|---|
| Capability registry | `engineering-mcp-managed.ts` (`specsFor(field)`, reconcile-by-field) | **re-key** field→task+env; add trust metadata (§3.2) |
| Capability packs | `engineering-labs.ts` per-field contracts | demote to internal packs; remove what doesn't earn its place |
| Control plane | OpenHands agent-server (terminal/browser/files) | **keep and wrap** — do not replace |
| Trajectory substrate | event stream + action↔observation pairing (powers war-room/swarm viewers) | **formalize** into the trajectory store (§7.1) |
| View | war-room / swarm-graph / robotics / rtl viewers | **consolidate** into one adaptive, trajectory-driven View (§7.2) |
| Environment awareness | `runtime_services` info; `device-windows` MCP | **elevate** to a first-class, refreshed snapshot (§4) |
| Model independence | LiteLLM provider/base_url/api_key configs | **preserve** (§8) |
| UI shell | `home.tsx`/`index-home.tsx`, `conversation.tsx`, `browser-tab`, `files-tab`, terminal component | **restructure** into Home → Conversation\|View + Utility + orb (§9) |
| Planning | `planner-tab`, condenser | **grow** into the persistent planning service (§2) |

---

## 13. Decisions (locked 2026-09-12)

1. **Sequence:** document (this file) → **UI shell** first, then wire
   intelligence behind it.
2. **Fields:** do what's best — demote to internal capability packs; **remove
   any that aren't needed**. No user-facing field picker.
3. **Planning agent:** build the **persistent planning service** (the strongest
   option) — plan + intentions stored and updated across sessions, so resuming a
   conversation resumes the plan.
4. **Execution core:** keep OpenHands agent-server; wrap it. Do not rewrite.
5. **ECC:** leverage as runtime accelerator; not a user-facing surface.

---

## 14. Roadmap (milestones)

- **M0 — Architecture doc** *(this file)* ✅
- **M1 — UI shell:** Home = conversation list → Exeaon window (Conversation |
  View) + Utility stack + glowing orb (Chat/View/Status) with state restore.
  Retire field tabs into View; stub the settings collapse. *(next)*
- **M2 — Trajectory store + View:** formalize the run trajectory; live + replay
  renderer over it (consolidate the existing viewers).
- **M3 — Environment awareness:** machine-derived, refreshed snapshot (§4).
- **M4 — Capability resolver:** re-key `specsFor` to task+env; trust metadata;
  agentic on-demand acquisition UX (§5).
- **M5 — Policy / validation plane:** agent defaults + user policies + gate
  (§6); wire ECC hooks/agentshield.
- **M6 — Persistent planning service:** cross-session plan/intentions (§2).
- **M7 — Field dissolution complete:** contracts fully replaced by resolver;
  remove dead field packs.

Milestones after M1 may reorder as we learn, but M0 and the three pillars (§3)
do not move.
