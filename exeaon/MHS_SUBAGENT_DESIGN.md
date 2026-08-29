# MHS Subagent — Design & Integration Plan

Status: **design / prep only** (per the locked decision). No runtime code yet.
Owner: Exeaon build. Open questions are called out inline — nothing here is fabricated as settled.

> **MHS acronym:** used throughout as the name of the multi-agent system to be
> built. Its exact expansion is yours to fix (Multi-Head System / Modular
> Hierarchical System / …); this doc doesn't assume one.

## 1. The core idea

**Exeaon Claw (the OpenHands-derived agent) stays the orchestrator / control
plane. MHS is a *subagent* it delegates to — not a peer, not a replacement.**

Why this shape (your reasoning, made explicit):
- Claw already orchestrates the **workspace/folders**, drives the **automation
  server** (Flows, `:18001`), owns **conversations**, and serves **models**
  (local `:18002` + cloud gateway). That machinery is the natural control plane.
- MHS is where the *hard multi-agent reasoning* lives. Claw hands it a scoped
  task; MHS runs its internal multi-agent graph and returns a result. Claw
  remains responsible for side effects on the real workspace.

```
 ┌────────────────────────── Exeaon Claw (orchestrator) ──────────────────────────┐
 │  workspace/folders · automation server · conversations · model serving          │
 │                                                                                  │
 │   user task ──▶ Claw planner ──▶ delegate(scoped task) ──▶ ┌───────────────┐     │
 │                                    ◀── result / artifacts ──│  MHS subagent │     │
 │                                                             └───────────────┘     │
 └──────────────────────────────────────────────────────────────────────────────────┘
                                                                     │
                     ┌───────────────────────────────────────────────┘
                     ▼   MHS internals (security-first)
   ┌──────────── policy + guardrail gate (fail-closed on security) ────────────┐
   │  LangGraph state machine  ─┬─ NeMo Agent Toolkit agents/tools             │
   │   (bounded loops)          ├─ AI-Q research/RAG patterns                  │
   │                            └─ Goose-style tool execution (MCP)            │
   │            ▲ critic evaluates each step/output ▲                          │
   └──────────────────────────────────────────────────────────────────────────┘
```

## 2. Component roles (honest mapping)

These are external frameworks; the mapping below is a **design proposal**, not a
verified integration. Each has an open question about how far we adopt it.

| Piece | What it is | Role in MHS |
|-------|-----------|-------------|
| **LangGraph** | Stateful, cyclic graph orchestration for agents | The MHS control graph — nodes = agent/tool steps, edges = routing, cycles = the bounded loops. The backbone. |
| **NVIDIA NeMo Agent Toolkit** | Framework to build/connect agents, tool-calling, profiling | Agent + tool definitions and the profiling/eval hooks feeding the critic. |
| **NVIDIA AI-Q (Blueprint)** | Enterprise research-assistant blueprint over NeMo + tools | The research/RAG *pattern* MHS uses for deep-dive tasks (retrieve → reason → synthesize). Adopt the pattern, not necessarily the full stack. |
| **Goose** | Block's local, extensible MCP-based coding agent | Local tool-execution style + MCP tool surface. Candidate executor for on-device tool runs. |

**Open question (needs your call):** which of these is the *primary* engine vs a
borrowed pattern? Recommendation: **LangGraph as the spine**, NeMo for
agent/tool defs + profiling, AI-Q as a research sub-pattern, Goose's MCP surface
for local tools. Adopting all four wholesale is likely over-engineered.

## 3. Security-first harness (non-negotiable, wraps everything)

Mirrors the cloud gateway's posture ("fail open on economics, fail **closed** on
security" — see `exeaon-cloud` D06 guardrails).

- **Policy layer:** allowed-tool whitelist, filesystem/network egress rules,
  resource + wall-clock + token budgets, and a hard **max-iteration** cap on
  every loop. Deny by default.
- **Guardrails:** input/output scanning on every LLM egress and tool
  argument/result (reuse the gateway's guardrail-chain concepts for cloud calls;
  a local equivalent for on-device). Block/redact/log per policy.
- **Critic:** a critic agent evaluates each step for correctness + policy
  adherence before the result is accepted. **This maps directly to the existing
  Settings → Validation → "Enable Critic" toggle** already in the app — that
  switch becomes the real control for MHS's critic. "Confirmation Mode" there
  maps to requiring user approval before MHS side effects.
- **Loops:** bounded iterative refinement — a loop controller with explicit
  termination criteria (critic-pass, budget-exhausted, or no-progress), never
  open-ended.

## 4. Subagent invocation contract (proposed interface)

Claw ↔ MHS should talk over one narrow, auditable boundary:

```
POST (internal) /mhs/run
  { taskId, goal, context{files,refs}, policy{tools,budgets,egress},
    critic: bool, confirmMode: bool }
→ stream of { step, action, toolCall?, criticVerdict, tokensUsed }
→ final { status: ok|blocked|budget_exhausted, artifacts[], auditTrail[] }
```

- Every step is audited (feeds the same audit trail the gateway already models).
- Side effects on the real workspace are **returned as proposed artifacts**;
  Claw (the orchestrator) applies them, gated by Confirmation Mode.
- Deployment target is an **open question**: run MHS **local** (on-device, under
  Claw's process) or **cloud** (a gateway-fronted service). Recommendation:
  design the contract transport-agnostic; ship local first (sovereign default),
  cloud as an execution connection later.

## 5. Model naming — "Exeaon Coder" + profile dedup (your decision)

Decision recap: **one source per origin.**
- **Cloud** model profiles come only from the gateway (it already loads them
  clean). **Local** profiles come only from the local model server.
- **Delete the app-side hardcoded/seeded profile duplicates** — those are what
  produce the **double "Exeaon Coder"** in the profile picker (one seeded by the
  app, one from cloud). Redundant → remove the app copy.
- Adopt **"Exeaon Coder"** as the flagship coder profile name. Two adoption
  paths: (a) serve locally for local use, or (b) use cloud's. Since cloud is
  already clean, the app-side seed is the redundant one to drop.

**Implementation note / coordination flag:** the profile seed appears to live in
`scripts/seed-automation-ux-data.mjs`, which is currently **another agent's
uncommitted WIP**. The dedup edit must be coordinated with them (or done after
they commit) to avoid entangling changes. Not done in this pass for that reason.

## 6. Phasing (when implementation is greenlit)

1. **Contract + harness first** — the policy/guardrail/critic/loop wrapper and
   the `/mhs/run` boundary, with the critic wired to the existing Validation
   toggles. No agents yet; a stub MHS that echoes proves the boundary + audit.
2. **LangGraph spine** — the control graph with bounded loops + the critic node.
3. **Tools/agents** — NeMo agent/tool defs; Goose MCP surface for local tools.
4. **Research pattern** — AI-Q-style retrieve→reason→synthesize for deep tasks.
5. **Cloud execution option** — expose MHS as a gateway-fronted connection.

## 7. Open questions for you
- MHS expansion / official name.
- Primary engine vs borrowed patterns (see §2 recommendation).
- Local-first vs cloud-first execution (see §4 recommendation).
- Does "Exeaon Coder" ship as a **local** served model, a **cloud** profile, or
  both — and what's the underlying model behind that name?
