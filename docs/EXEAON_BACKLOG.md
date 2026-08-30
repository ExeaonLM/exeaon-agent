# Exeaon Claw — Backlog / TODO

Living checklist toward the first full Tauri release. Grouped by area, with the
repo each item lives in. Check items off as they land.

Legend: `[ ]` todo · `[x]` done · **(Claw)** = exeaon-agent · **(GW)** = Go
ai-gateway (exeaon-cloud) · **(Console)** = exeaon-cloud/frontend · **(Rust)** =
src-tauri.

## Recurring root cause (keep applying)
Many features gate on `backend.kind === "cloud"`, which flips to cloud the moment
a user signs into Exeaon Cloud — even though the agent **runtime is always local**.
The correct signal is `!isCloudAppServerBackend()`. Grep for `backend.kind` /
`kind === "cloud"` whenever something "works local but breaks signed-in".

## P0 — correctness / blocking

- [x] **Files panel "No files in workspace"** (Claw) — used the cloud file-listing
  endpoint (absent on the gateway) when signed in. Fixed `use-workspace-files.ts`
  + `use-workspace-file-content.ts` to the runtime seam. *Verify after reload.*
- [x] **Clone lands in a scratch dir, not a named workspace** (Claw) — the repo
  modal now clones into `exeaon-repos/<repo-name>` and persists it as the
  conversation's `selected_workspace`, so it groups under the repo name and the
  Files panel anchors to it. *Note: a stopped runtime (old conversation) still
  can't list files — that's expected; use a fresh clone.*
- [ ] **API keys leak across users** (GW) — every user sees the admin/owner's API
  keys. Owner/tenant-owner must NOT grant system/admin visibility; scope key
  listing to the caller's own account. Enforce a **50 keys/user** cap. Security.
- [ ] **Automations backend unavailable** (Claw/Rust) — Flows shows "Automations
  Unavailable"; dev shows repeated `vite ws proxy error ECONNABORTED`. Fix the
  automation sidecar spawn/health once and for all (or gate Flows cleanly when
  it's genuinely off).
- [ ] **Usage shows 0 everywhere** (GW + Claw + Console) — requests/tokens/spend
  read 0 in Settings and on the cloud console even after real usage. Usage
  accounting/rollup isn't reaching the UI.
- [ ] **Public share fails** (Claw/GW) — "Failed to update public sharing /
  Disconnected". Decide: implement or hide until deploy.

## P1 — product surface

- [ ] **Right-side panel views redesigned like Claude** (Claw) — the top-right
  icons (files, diff, terminal, browser, usage, git, info) that open the right
  pane. Match Claude's layout/feel; make the "middle" content coherent.
- [ ] **User-drivable browser + "Open in browser"** (Claw) — today the browser is
  agent-only (like the terminal was before the 2nd user terminal). Add a
  user-typeable browser tab and make the "open in browser" button work. (Can this
  session drive browser commands? — evaluate.)
- [ ] **Agent Tools: add/open more tools** (Claw) — the Agent Tools page is
  read-only/limited (5 registered); restore add/configure as before.
- [ ] **Settings cleanup** (Claw) — remove or repurpose "Integrations" and "All
  Cloud Settings" (→ an "Open cloud console" link) — they're leftovers.
- [ ] **Real Help routes** (Claw) — "Learn more", "Get help", "View changelog"
  must go to real in-app/hosted pages, not GitHub redirects.

## P1 — billing & gating

- [ ] **Pro upgrade via Paystack** (GW + Console/Claw) — wire the Pro-plan upgrade
  payment (Paystack; pay-as-you-go already works). Add a plan-management page.
- [ ] **Usage gating (Claude-style)** (GW + Claw) — hourly + weekly limits with a
  usage meter/gating UI.

## P1 — docs

- [ ] **Cloud API docs** (GW/Console) — API-key usage, OpenAI- & Anthropic-
  compatible base URLs, completion routes, models & pricing page, OpenAPI. The
  gateway console already has a Docs route — populate it for real.

## P2 — runtime / packaging

- [ ] **Tauri instant server setup + app-open** (Rust) — fast, reliable local
  server bring-up on launch.
- [ ] **Port strategy** (Rust) — avoid fixed-port collisions on end-user machines;
  ideally smart relocation / occupancy fault-tolerance (hard — scope later).

## Next milestone (after the above)
- [ ] **Engineering agent** — per `ENGINEERING_LABS_PROVIDER_RESEARCH.md` (user to
  brief). Not started until the core app is fast, connective, and stable.
