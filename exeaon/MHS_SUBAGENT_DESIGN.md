# MHS Subagent + the Exeaon Agentic Engineering Ecosystem — Design

Status: **design / prep** (no runtime code yet). Two layers to this doc:
1. **The Exeaon MHS subagent** — a subagent under Claw that closes the
   engineering loop (design → simulate → deploy → measure → analyze → iterate).
2. **What MHS brings out of the Exeaon system** — the agentic engineering
   sandbox / remote-lab ecosystem that becomes possible once a hardware
   standard exists as the bottom layer.

Honesty markers used throughout: **[real]** = verified fact about MHS today;
**[build]** = the Exeaon system to design/build; **[open]** = a decision or
unknown.

---

## 1. What MHS actually is  [real]

**Model Hardware Standard (MHS)** — Anthropic research preview, announced
**2026-08-27**. A shared spec + standardized **driver** that lets AI agents
safely operate physical devices, cutting per-device integration from
weeks/months to hours.

- **Primitives:** a driver translates agent/OS commands into device operations
  through two verbs every device understands — **`read`** (e.g. get temperature)
  and **`write`** (e.g. set temperature). (This matches the read/write instinct
  we already had — see [[libitai-coprocessor-state]].)
- **Discovery:** drivers auto-produce a reference file describing what a device
  can **measure**, what's **adjustable**, and **what safety limits are
  enforced**, plus natural-language tags capturing the "manual/tacit knowledge."
- **Control pathways (three):** **MCP**, a **CLI**, or **code/APIs**. MHS is
  **model-agnostic** — any harness, any model. MCP is *one* pathway, not the
  only one.
- **Safety at the device level:** the driver **enforces device safety limits**
  (e.g. caps laser power so an agent can't damage a sample) and agents stop for
  **human confirmation** on anything even slightly risky.
- **"Programmable interface" is broad:** APIs, SDKs, GUI automation, even
  legacy directory/job-submission instruments.
- **Availability:** research-preview waitlist (modelhardwarestandard.com), labs
  like Genentech, CMU, UW, QuEra, HHMI Janelia; early integrations already in
  **Hugging Face LeRobot**, **Raspberry Pi**, and vendors (Tecan, Universal
  Robots, QIAGEN…). **Anthropic plans to open-source it.**

Sources: [anthropic.com/news/model-hardware-standard-research-preview](https://www.anthropic.com/news/model-hardware-standard-research-preview),
CNBC / Fortune 2026-08-27.

**Why this matters for us:** the MCP analogy is exactly Anthropic's framing —
*MCP standardizes agents ↔ the digital/tool world; MHS standardizes agents ↔
programmable physical systems.* MHS becoming an open, model-agnostic standard
means Exeaon can **build on it as a substrate** rather than reinvent hardware
integration — and everything Exeaon adds *above* it (simulation, sandbox,
remote-lab orchestration, education) is where the system's value comes out.

---

## 2. The layered stack  [build on real]

MHS is the hardware-abstraction floor. The interesting Exeaon layers sit between
"tools" and "real hardware":

```
  MCP                         agents ↔ digital tools            [real, we speak it]
   │
  Software / tools            CAD · Python · HDL · solvers       [real]
   │
  Simulation / Digital Twin   experiment cheaply + safely        [BUILD — the gap]
   │
  Hardware abstraction        capability view of a device        [BUILD]
   │
  MHS                         read/write driver + safety limits  [real, adopt via MCP]
   │
  Physical hardware           FPGA · scope · robot · reactor     [real / remote]
```

The **simulation / digital-twin layer between MCP and MHS** is the piece MHS
deliberately does **not** provide — MHS abstracts *real* hardware; it has no
cheap-safe "try it before you touch reality" layer. That gap is the highest-
leverage thing Exeaon can build, and it's what makes the closed loop safe.

---

## 3. The closed engineering loop  [build]

The prize is not "AI that writes engineering code." It's an agent that can
**design → simulate → validate → deploy → measure → analyze → redesign**:

```
   ENGINEERING PROBLEM
          │  AI understands → plans
          ▼
   ┌──────────────────────┐   simulate FIRST (cheap, safe)
   │  DIGITAL WORLD        │──────────────┐
   │  MCP · CAD · HDL ·    │              ▼
   │  Python · simulators  │        VALIDATE DESIGN
   └──────────────────────┘              │  (sim passes gate?)
                                          ▼
                                 HARDWARE INTERFACE (MHS)
                                          │
                                     REAL HARDWARE
                                          │  measure → observe
                                          ▼
                                     AI ANALYZES
                                          │
                                          └────────► ITERATE
```

Worked example — *"Design a PID controller for this motor"*: understand spec →
derive controller → generate code → simulate motor → plot response → spot
instability → tune params → re-simulate → **only once the sim gate passes**,
deploy to a real/remote device → collect real measurements → compare sim vs
reality → explain the discrepancy. The simulation gate is a hard precondition to
any `write` to real hardware.

Simulation-as-guardrail example: agent wants more motor torque → sim says "at
80% duty the predicted temperature exceeds the limit" → agent lowers duty +
changes the cooling profile → only then deploy. **Simulation + MHS device-level
safety limits + human confirmation** compound into real physical safety.

---

## 4. The Exeaon Engineering Sandbox  [build]

An engineering student without a $50k lab opens the sandbox; the agent is the
connective tissue across simulation, tools, and (real or remote) hardware:

```
                       SANDBOX
        ┌────────────────┼────────────────┐
   Simulation          Agent            Hardware
   Digital Twin         AI               MHS
        │           ┌────┴────┐            │
        │          MCP      Tools          │
        └────────────────┼────────────────┘
                     Experiment
                         │
                  Real / Remote HW
```

**Tiers (a real infrastructure business):**

| Tier | What runs | Hardware needed |
|------|-----------|-----------------|
| **Student sandbox** | simulation only | none |
| **Virtual lab** | simulation + digital twin | none |
| **Remote lab** | real equipment, accessed remotely | shared/remote |
| **Research lab** | dedicated hardware, longer experiments | owned/remote |
| **Enterprise** | private hardware fleet + agent orchestration | owned |

Crucially: **it starts with zero hardware** (simulation), and hardware is added
per-tier. A university runs *one* expensive lab serving thousands of students
remotely instead of every student needing every instrument. The
**Ghana/education wedge** — a student here submitting an experiment to a remote
FPGA/scope/robot lab, agent deploys it, collects measurements, returns data — is
a distribution + market angle the standard itself won't chase (connects to
[[portfolio-priority]] and the education mission).

---

## 5. Hardware-lab-as-API + capability view  [build]

The spicy shift: **the lab becomes an API.** Instead of "book equipment for
Thursday," the agent orchestrates:

```
  discover → reserve → configure → deploy → run → capture → return data
```

The agent never needs the lowest-level device details — it sees **capabilities**
(the MHS reference file gives it exactly this: measurables, adjustables, safety
limits). It composes them into experiments:

```
  FPGA:        program() · read() · stream()
  Oscilloscope: configure() · capture() · measure()
  Signal gen:   set_frequency() · set_amplitude() · output()
```

Discipline coverage this unlocks (the agent is the connective tissue):
- **EE:** circuit → SPICE → FPGA → oscilloscope
- **ME:** CAD → simulation → robotic system
- **CompE:** algorithm → simulator → FPGA → benchmark
- **Chemical:** process model → simulation → instrumentation
- **Robotics:** environment sim → controller → robot
- **Quantum:** quantum sim → calibration/control → quantum hardware

The **Kintex-7 can be one of the first nodes** in this ecosystem — an owned
device exposed through an MHS driver + capability wrapper, driven by the Exeaon
agent through the same loop. Start there; add scopes / signal gens /
microcontrollers / SDRs / robotic arms / 3D printers / CNC / GPUs over time.

---

## 6. Where the Exeaon MHS subagent sits  [build]

**Claw stays the orchestrator/control plane; the MHS subagent runs the
engineering loop and returns results.** Claw already owns the workspace,
automation server, conversations, and model serving — the natural place to
delegate from. MHS is reachable **through MCP**, which Claw/OpenHands already
speaks, so no new transport is needed to start.

```
 ┌──────────────── Exeaon Claw (orchestrator) ────────────────┐
 │  workspace · automation · conversations · model serving     │
 │   task ─▶ delegate(experiment) ─▶ ┌───────────────────────┐ │
 │             ◀── results/artifacts ─│  Exeaon MHS subagent  │ │
 │                                    └──────────┬────────────┘ │
 └───────────────────────────────────────────────┼─────────────┘
                                                  ▼
   ┌── policy + guardrail gate (fail-closed on safety) ──────────┐
   │  LangGraph loop ─┬─ NeMo agent/tool defs                    │
   │   (bounded)      ├─ AI-Q research/RAG pattern               │
   │                  ├─ Goose-style MCP tool execution          │
   │                  └─ Simulation gate BEFORE any hardware write│
   │        ▲ critic evaluates each step/output ▲                │
   └── MCP ─▶ MHS driver (read/write + device safety limits) ────┘
                                                  ▼
                              Simulation / Digital twin  ·  Real/Remote HW
```

---

## 7. Security-first harness  [build] — complements MHS, doesn't replace it

MHS enforces safety at the **device** level (limits + human confirmation). The
subagent adds the **agent/orchestration** level — "fail open on economics, fail
**closed** on safety" (mirrors the cloud gateway's D06 posture,
[[exeaon-runtime-and-harness]]):

- **Policy:** allowed devices/tools, egress rules, resource + wall-clock +
  token budgets, and a hard **max-iteration** cap on every loop. Deny by
  default. Any `write` to real hardware is gated behind a passing simulation.
- **Guardrails:** scan inputs/outputs + tool args/results; never exceed the
  device's declared safety limits (read them from the MHS reference file).
- **Critic:** evaluates each step for correctness + policy adherence before it's
  accepted — maps to the existing **Settings → Validation → "Enable Critic"**
  toggle. "Confirmation Mode" maps to requiring user/human sign-off before a
  physical action (aligns with MHS's own human-in-the-loop default).
- **Loops:** bounded iterative refinement — terminate on critic-pass,
  budget-exhausted, or no-progress; never open-ended, and never straight to
  hardware without the sim gate.

---

## 8. Subagent invocation contract  [build, proposed]

Claw ↔ subagent over one narrow, auditable boundary:

```
POST (internal) /mhs/run
  { taskId, goal, context{files,refs},
    policy{devices,tools,budgets,egress,maxIterations},
    requireSimGate: true, critic: bool, confirmMode: bool }
→ stream { step, phase: design|simulate|deploy|measure|analyze,
           action, toolCall?, criticVerdict, tokensUsed }
→ final { status: ok|blocked|budget_exhausted|sim_gate_failed,
          artifacts[], measurements[], auditTrail[] }
```

- Every step audited (same audit trail the gateway already models).
- Physical side effects returned as **proposed** actions; Claw applies them,
  gated by Confirmation Mode.
- **Deployment target [open]:** local-first (sim on-device, sovereign default),
  cloud/remote-lab later. Design the contract transport-agnostic.

---

## 9. Component roles  [build, proposal — not verified integrations]

| Piece | Role in the subagent |
|-------|---------------------|
| **LangGraph** | the control graph — nodes = phases/tools, cycles = the bounded loops. The spine. |
| **NVIDIA NeMo Agent Toolkit** | agent + tool definitions, profiling hooks feeding the critic. |
| **NVIDIA AI-Q** | the research/RAG *pattern* for deep-dive tasks (retrieve → reason → synthesize). |
| **Goose** | local, MCP-based tool execution surface — a natural fit since MHS is reachable over MCP. |

**[open]** which is primary vs a borrowed pattern. Recommendation: **LangGraph
spine**, NeMo for defs+profiling, AI-Q as a sub-pattern, Goose's MCP surface for
local + MHS tool calls. Adopting all four wholesale is likely over-engineered.

---

## 10. Model naming — "Exeaon Coder" + profile dedup  [build]

Unchanged from prior: **one source per origin** — cloud model profiles from the
gateway (already clean), local profiles from the local model server, and
**delete the app-side seeded duplicates** (the double "Exeaon Coder" in the
picker comes from `src/utils/format-model-name.ts` mapping several backend model
IDs to the same brand name **plus** duplicate seeded profiles). Adopt **"Exeaon
Coder"** as the flagship coder profile. Coordinate the seed edit with the other
agent (`scripts/seed-automation-ux-data.mjs` is their WIP).

---

## 11. Phasing  [build]

1. **Contract + harness first** — the policy/guardrail/critic/loop wrapper, the
   `/mhs/run` boundary, the **simulation gate**, and the critic wired to the
   Validation toggles. Stub MHS that echoes proves the boundary + audit.
2. **Simulation/digital-twin layer** — the piece MHS lacks; start with one
   domain (motor/PID or an FPGA flow around the Kintex-7).
3. **LangGraph spine** — control graph with bounded loops + critic node.
4. **MHS via MCP** — adopt the standard for a first real device (Kintex-7),
   capability-wrapped; enforce its declared safety limits.
5. **Sandbox tiers** — simulation-only → virtual lab → remote lab, exposed as a
   product surface (education wedge first).

---

## 12. Honest read + open questions
- **MHS will be open-source** — it's the commodity floor, not the differentiator.
  What Exeaon builds **above** it — simulation/digital-twin, sandbox tiers,
  remote-lab-as-API orchestration, the education distribution — is where the
  system's value comes out and where "why us" lives (per [[field-selection-rule]]:
  unsolved / matters / asymmetric).
- **[open]** MHS access: it's a gated research preview today — join the waitlist;
  until then, prototype against the *pattern* (our own read/write driver +
  capability wrapper on the Kintex-7) so we're ready when it opens.
- **[open]** simulation stack per domain (SPICE / FPGA sim / control sim / …) —
  which first, and buy-vs-build per domain.
- **[open]** MHS expansion of scope, primary agent engine (§9), local-first vs
  cloud-first execution, and what model actually sits behind "Exeaon Coder."
- **Honesty caveat [real]:** even Anthropic notes models still struggle with
  physical/chemical/biological constraints — expert oversight stays in the loop;
  the sim gate + critic + human confirmation are not optional.
