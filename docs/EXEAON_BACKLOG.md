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
- [x] **API keys leak across users** (GW) — `ListVirtualKeys` had no owner filter,
  so every authenticated user saw every key. Now scoped to `created_by = caller`
  for non-platform-admins (platform admin still sees all), and `CreateVirtualKey`
  enforces a **50-key/user** cap (`ErrKeyLimitReached`). *Needs a gateway deploy
  to take effect — the fix is server-side.*
- [ ] **Automations backend unavailable** (Claw/Rust) — Flows shows "Automations
  Unavailable"; dev shows repeated `vite ws proxy error ECONNABORTED`. Fix the
  automation sidecar spawn/health once and for all (or gate Flows cleanly when
  it's genuinely off).
- [~] **Usage shows 0 everywhere** (GW) — `/me` summed usage by the user's primary
  tenant, but usage rolls up under the *key's* tenant (can differ) → 0. Now sums
  over the user's owned keys (`created_by`), tenant-independent. *Deploy needed. If
  it's STILL 0 after deploy, no rollup rows are being written at all (settlement
  path) — needs runtime logs. Console Usage page (admin/tenant-scoped) is separate.*
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
- [x] **Settings cleanup** (Claw) — removed the dead "Integrations" settings link
  and repointed "All Cloud Settings" → "Cloud console" at `/console/` (both had
  pointed at OpenHands `/settings*` paths that 404 on the gateway). The top-level
  Integrations nav (MCP page) is real and stays.
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
