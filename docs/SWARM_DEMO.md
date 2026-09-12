# Exeaon Cyber Swarm — Showcase Runbook

The 90-second demo that sells the sovereign AI cyber swarm. Rehearse it exactly.

## Before you go on stage (reliability > everything)
Hackathon demos die on flaky wifi + live installs. Pre-stage everything:
1. **Target = a lab you own, offline.** Options: a local `scanme`-style VM, a Docker
   vuln box (e.g. `vulhub`, `dvwa`, Metasploitable), or `scanme.nmap.org` only if
   the venue wifi is reliable. Never a target you don't control.
2. **Pre-install the tools** the operatives will reach for (nmap, httpx, nuclei) so
   nothing installs live. (`winget install Insecure.Nmap`; ProjectDiscovery Go bins
   on PATH.) The agent *can* self-install per the contract, but don't gamble it on stage.
3. **Run the desktop app**, sign in (or Explore), open a fresh conversation.
4. **Confirm the operative is present:** `~/.openhands/agents/cyber-operative.md`
   exists (the app seeds it on launch).

## The flow (the money shot)
1. In the composer: **Field → Cybersecurity**, open the mode flyout, **flip Swarm on**
   (🤖 appears on the pill). Mode = **Real** (or Simulation for a safe sim demo).
2. Say/type ONE sentence, e.g.:
   > *"Run an authorized assessment of the lab at `<TARGET>` — assets, web surface, and enumeration."*
3. The **Swarm war-room auto-opens.** The audience watches the **Lead** node fan out to
   **operatives** (op1/op2/op3), each lighting amber (running) with its mission, then
   green (done) with a result preview — converging into the **Consolidated Report** node.
4. When a dangerous action pops **Validation**, confirm it — this is your "voice
   authorized" beat once voice-accept ships; for now, one click.
5. It writes ONE fused report to the workspace. Open it — risk-rated, remediation, done.

## The one line to say while it runs
> "One operator. One sentence. A swarm of AI operatives fan out, run the real tools,
>  and fuse one report — sovereign, on your own machine, gated by your authorization.
>  This is the thing the frontier models are contractually barred from doing."

## If something stalls (recovery)
- No operatives appear → the model didn't call `task`. Re-prompt: *"Decompose this into
  parallel operatives and run them."* (The Swarm directive nudges this, but models vary.)
- An operative errors (red node) → that's fine, it's real; the lead notes it and moves on.
  Real > staged. Lean into it.

## What NOT to demo yet
Voice-accept (not built), robotics, SecFlow/defensive — all post-showcase. The swarm
war-room *is* the demo. Keep it to that one beat.
