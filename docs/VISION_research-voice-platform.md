# Exeaon — Research Mode, Voice, Platform: design & decisions

Status: **design doc, not yet built** (per "we document before proceeding").
Captures the 2026-09 vision dump + the near-term bug fixes, framed by tier-1/
tier-2 so we build the load-bearing things and defer/skip the rest.

## 0. First principles (the frame for everything below)

The one question Exeaon answers: **"What can one operator + this app *do* that no
frontier model and no generic agent will?"** → run real, consequential technical
work (offensive security, physical robotics, hardware/RTL, falsifiable research)
on your own machine, watchable live, gated by your authority, with a swappable
brain.

- **Tier-1 (one-way doors — already built):** field × mode × MCP architecture;
  the loop *agent → real tools → live viewer → validation gate*; brain-
  pluggability (local/cloud/frontier via the gateway); sovereign/licensed posture.
- **Tier-2 (two-way doors — decide fast, swap freely):** sim engine choice, model
  choice, SVG vs WebGL, voice, competition, community, exact tool lists.

Spend judgement on tier-1; keep tier-2 reversible and don't over-polish it early.

---

## 1. Near-term fixes (bugs the operator is hitting now)

### 1a. Plan-usage should be a POPOVER, not a roll-down
Current: a panel that expands downward inside the composer. Wanted: an **upward
popover** anchored to the usage pill (like the Claude Code usage popover), with a
**hover tooltip** showing the summary. 
- Build: a small anchored popover (position: top, `absolute`/portal), triggered on
  click of the usage pill; a `title`/tooltip on hover showing "Weekly · all
  models: N%". Reuse the existing usage numbers; only the container/placement
  changes. Tier-2, small.

### 1b. Hourly/Weekly usage must be GLOBAL (cloud), not per-session
Current: the meter resets to 0% on a new conversation / session — it's derived
per-conversation locally. Wanted: **one global cloud-model budget** across all
sessions/conversations (resets on the real hourly/weekly window, like Pro's
5-hour/weekly). This is the standing [[usage-tracking-local-vs-cloud]] issue.
- Root: the meter reads local per-conversation state; cloud spend is metered by
  the **gateway** (exeaon-claw), which is the single source of truth for cloud-
  model usage. 
- Build: the client reads the hourly/weekly spend from the **gateway usage
  endpoint** (per-user, global), not from conversation-local state. Cache briefly;
  poll. Local-model inference stays uncounted (it never hits the gateway — which
  is correct).

### 1c. API models (e.g. Deepseek direct) fail in the bundled app
Observed: `litellm ... DeepseekException - Cannot connect to host
api.deepseek.com:443 ... semaphore timeout`. The app tried Deepseek's **direct**
API and the connection timed out (network/SSL/firewall).
- Fix (matches "same litellm for all"): route **every** model through the
  Exeaon gateway (`exeaon-claw.fly.dev`, OpenAI-compatible) instead of hitting
  provider hosts directly. One egress, one auth, gateway handles provider quirks
  + failover + the global usage meter (which also fixes 1b). Provider-direct is
  the fragile path; the gateway is the tier-1 brain-plug.

---

## 2. Research Agent — the 5th field (the flagship next build)

The most differentiated new capability, and it **reuses the whole spine**: the
robotics/RTL sims are the *compute/simulate/verify* backend for physical/math
claims; browse + device control are the *read/observe* tools; the validation gate
+ milestone reports are the *integrity* layer.

**North-star test:** *"Can the Research agent produce evidence that survives an
attempt to prove it wrong?"* Everything is built to make that answer defensible.

### The loop (operating contract)
`Think → Browse → Read → Extract → Plan → Compute → Simulate → Operate
tools/devices → Observe → Verify → Challenge → Repeat → Write → Integrity check →
Publish.` The **Challenge** step is non-negotiable: the agent must actively try to
falsify its own result before writing.

### What Research mode does
- Replicate a paper end-to-end; push toward the novelty gap.
- Consolidate a corpus of prior papers → find patterns → reason → hypothesize.
- Test/iterate/replicate; validate against physics/maths; **normalize** units and
  assumptions; **declare assumptions** explicitly (house rule).
- Flag where a new result does NOT conform to an established standard, and treat
  that as a finding to resolve, not to hide.

### Tools it needs (beyond what exists)
- **Web research**: browse the internet, open pages, extract/cite (the browser
  MCP + a fetch/read tool). Real sources, real citations.
- **Compute/sim**: reuse robotics (MuJoCo) + RTL (Icarus) + a general compute
  sandbox (Python/numpy already in the bundled runtime) to actually *run* the math.
- **Paper stack**: LaTeX/docx writing, reference management, figure/plot
  generation, and an **integrity toolset** — plagiarism check + "humanize"/style
  pass + a claims-vs-evidence audit.
- **Device control + MCP** for instrument/data access where relevant.

### Hard rule: no weak local models for Research
Research mode **requires a strong model** (frontier/cloud via the gateway). The
field explicitly refuses to run on a small local model — stated in the contract
and enforced in the UI (gate the Research field to cloud/frontier brains). Weak
models fabricate citations and can't falsify; that breaks the north-star test.

### Interface
A "research war-room" tab like the others: the pipeline stages as live nodes
(Browse/Read/Compute/Simulate/Verify/Challenge/Write), sources + citations
panel, and an **integrity scorecard** (claims, evidence, falsification attempts,
plagiarism/originality). Same event-derived pattern as the swarm/robotics viewers.

---

## 3. Voice (TTS + STT + a novel beat)

- **TTS**: a speaker icon on each AI message that reads it aloud.
- **STT**: a mic in the input to dictate prompts.
- **Novel beat — Voice Validation:** approve a Validation-gated action **by
  voice** ("authorized") for cyber/device/real ops. This is the "voice authorized"
  showcase moment already sketched for the swarm demo — ties voice to the tier-1
  validation gate instead of being a bolt-on.
- Engine choice is tier-2 (browser SpeechSynthesis/SpeechRecognition for a
  zero-dep v1; a cloud TTS/STT via the gateway for quality later). Ship the
  zero-dep version first.

---

## 4. Platform: competition vs community (honest)

- **Competition on fly.io (AI+human):** *recommend skipping.* Your own instinct is
  right — if the AI does the work, it's a prompt leaderboard, not a competition;
  participants get bored because they aren't the ones building. The "human+AI"
  framing doesn't fix that.
- **Community (publish robotics builds / RTL designs / research):** *the play.* It
  is the honest form of the showcase-marketing you already believe in — it
  demonstrates sovereign capability, compounds (network effect), and gives the
  demos a home. Build it **after** there's a steady stream of real outputs worth
  publishing (i.e. after Research mode + a few flagship sims). Likely a thin
  gallery on the same fly.io footprint as the gateway.

---

## 5. Per-field tool matrix (what each agent still needs)

| Field | Has | Still needs |
| --- | --- | --- |
| Cyber | 50-tool unified MCP, CALDERA, CybORG, swarm | VPN spawn/setup (earlier ask), more recon/report tools |
| Robotics | MuJoCo sim + 3D viewer (bundled) | more models, real-lab bridge (deferred) |
| Computing/RTL | Icarus sim + waveform viewer (bundled) | Verilator/cocotb, SPICE/FPGA (later) |
| Device | windows-mcp | broader OS/app control, mac bridge |
| **Research (new)** | — | browse/read/extract, paper+integrity stack, compute sandbox, citation mgmt |

Cross-cutting: **internet browsing + page access** benefits cyber and research
both; **device control** augments every field (real instruments, real machines).

---

## 6. Recommended sequence (tier-1 first, honest)

The tier-1 spine is built. So the highest-leverage order:

1. **Fixes 1a–1c** (popover, global cloud usage via gateway, all-models-through-
   gateway). Small, unblocks daily use, and 1c+1b share the gateway path.
2. **Voice v1** (browser TTS/STT + voice-validation). Cheap, high demo value.
3. **Research mode** as the 5th field (the differentiated new capability; reuses
   the spine). Gate it to strong/cloud brains.
4. **Community gallery** — only once 1–3 produce things worth publishing.
5. **Competition** — deprioritised / skip unless a concrete format beats the
   "AI-does-the-work → boredom" problem.

See [[engineering-agent-fields]], [[gateway-db-and-mapping-cache]],
[[usage-tracking-local-vs-cloud]], [[plan-usage-windows]].
