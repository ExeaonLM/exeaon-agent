# Exeaon — Session Status (2026-09-01)

Snapshot of what shipped this session across **Exeaon Claw** (Tauri desktop) and
**Exeaon Cloud** (Go ai-gateway), plus the state of the in-progress
Engineering-Agent work.

---

## 1. Cloud gateway — Plan usage + Paystack (BUILT, committed, deploy pending)

**Commercial model chosen:** credit-spend windows, all tiers.

- **Plans** `Free / Pro / Max`, config-driven, env-overridable
  (`AIGW_PLAN_<TIER>_HOURLY|_WEEKLY|_PRICE`). Defaults: Free $0.25/hr·$1/wk,
  Pro $3/hr·$25/wk·$20/mo, Max $15/hr·$150/wk·$100/mo. → `backend/internal/biz/plans.go`
- **Hourly + weekly credit-spend windows** on `/me`: hourly from per-request
  audit rows, weekly from the daily rollup, scoped to the caller's own keys.
- **Billing account**: added `Plan` + `PlanExpiresAt` (additive migration).
- **Paystack plan purchase**: `POST /ai/gateway/billing/plan/initialize` +
  `GET /ai/gateway/billing/plan/verify` (activates the plan for one month).
- **Commits:** `207fc5c` (plans + Paystack), `1cae51f` (CORS fix). Local-only
  (remote is upstream, no push). **Deploy pending:**
  `flyctl deploy --config deploy/fly/fly.toml --remote-only`.

**Two production incidents diagnosed & fixed this session:**

- **Redis NOAUTH (readyz 503):** the gateway's Upstash Redis had no password →
  billing/quota/cache degraded. Fixed by setting native-Redis Fly secrets
  (`AIGW_REDIS_ADDR` host:6379, `AIGW_REDIS_PASSWORD` = the `rediss://` password,
  `AIGW_REDIS_TLS=true`) — **NOT** the REST URL/token. `readyz` now `{"ready":true}`.
- **Sign-in "Network Error" (web dev):** CORS — the default allowlist was
  `tauri.localhost` only, so `http://localhost:8000` was blocked. Widened the
  default allowlist (localhost:8000/3005 + tauri http/https). Ships with the next
  deploy. Desktop sign-in (`tauri.localhost`) was never blocked.

## 2. Claw desktop — Plan usage UI (BUILT)

- `CloudMe` extended (plan, windows, catalog) + billing helpers
  (`startCloudTopUp`, `startCloudPlanUpgrade`).
- **Account settings**: hourly/weekly bars + Upgrade/Top-up.
- **Context-meter popover**: "Plan usage limits" section.
- **Under-the-input `PlanUsageLimitsBar`**: compact trigger below the send
  button, expands the hourly/weekly popover. (All render only when signed into cloud.)
- **Top-bar icons trimmed**: Files + ⋯ (Changes/Terminal/Browser/VSCode) + Usage.

## 3. Claw desktop — bundle / startup / automation (BUILT)

- **Slow ~10-min cold start FIXED:** the bundled Python was recompiling its whole
  dependency tree on launch (read-only install → no `__pycache__` reuse).
  Precompiled the runtime in place with `compileall --invalidation-mode
  unchecked-hash` (14,724+ `.pyc` shipped) → fast first *and* every launch,
  read-only-safe. `lib.rs` unchanged (a pycache-prefix approach was tried then
  reverted in favor of the precompile).
- **Automation:** left enabled (it works via the bundled runtime; earlier
  failures were the `:18001` startup-timing window). Its POSIX `/tmp` path is a
  known Windows caveat for cloud-sandbox automations, not a v1 blocker.
- **Windows bundle**: `npm run desktop:build` → `src-tauri/target/release/bundle/`
  (`nsis/*.exe` preferred = per-user/writable; `msi/*.msi` = Program Files).
  It is Windows-only (ships `python.exe`), not an Android apk.

## 4. Engineering Agent — Phase 0 (BUILT, type-clean)

Per `ENGINEERING_LABS_PROVIDER_RESEARCH.md`. Fields with Simulation/Real/Auto
modes, chosen like Code/Plan; leverages OpenHands' MCP + subagents (no heavy
orchestrator yet); Validation gate = the safety layer (already in Claw).

- **Store + persistence:** `engineeringField` (none/cyber/robotics/computing/device)
  + `executionMode` (simulation/real/auto), per-conversation. →
  `stores/conversation-store.ts`, `utils/conversation-local-storage.ts`
- **Model + tool-gating scaffold:** `utils/engineering-labs.ts` —
  `getFieldToolPlan(field,mode)` declares each field's backends/MCP servers
  (cyber real → pentest-cyber-mcp + windows-mcp + mac-mcp; cyber sim →
  caldera/cyborg; robotics → mujoco; computing → verilator/cocotb; device →
  windows/mac MCP) + `buildEngineeringDirective()`.
- **Composer control:** `components/features/chat/components/engineering-field-control.tsx`
  — a Field button + Sim/Real/Auto popover, next to Code/Plan (device = "soon").
- **Context injection:** the directive is prepended to the **server** message
  content only (visible bubble unchanged) in `chat-interface.tsx`.
- Test fixtures updated for the two new state fields; `tsc` clean.

## 5. Engineering Agent — Phase 1 Cyber (IN PROGRESS)

**Vendored MCP repos** → `vendor/mcp/` (git clones):
- `pentesting-cyber-mcp` — the chosen cyber MCP (pnpm monorepo, 50 security-tool
  servers behind one `unified` stdio endpoint: `mcp-security` / `mcp-unified`).
- `pentest-mcp` — fallback single-server (kept).
- `windows-mcp-server` — Go, device-control MCP (`stdio` subcommand).
- `mac-mcp` — DELETED (Swift/macOS-only; re-add on Mac builds).

**Built (Windows):**
- ✅ Cyber unified MCP → `pentesting-cyber-mcp/servers/unified/build/index.js`
  (`pnpm install --ignore-scripts` to skip the `node-pty` native build that one
  of the *other* servers needs; `unified` is pure TS. Build script patched from
  `tsc && chmod …` → `tsc` for Windows.)
- ✅ `windows-mcp-server.exe` (`go build ./cmd/windows-mcp-server`).

**Wiring (code, type-clean, cargo-clean):**
- `utils/engineering-mcp-managed.ts` — system-managed registry, `exeaon-field-*`
  names, `buildManagedMcpConfig(field,mode,ctx)`; users can't touch these
  (filtered out of the MCP page in `utils/mcp-installed-servers.ts`).
- `src-tauri/src/lib.rs` — `mcp_runtime_paths` command resolves the vendored MCP
  dir (bundle: `<resources>/mcp`; dev: `<src-tauri>/../vendor/mcp`) + reports
  which servers are built.
- `hooks/use-engineering-mcp-reconcile.ts` (mounted in `chat-interface.tsx`) —
  on field/mode change, patches `mcp_config` so exactly the active field's built
  managed servers are enabled, others removed. Desktop-only (no-op on web).

**Test:** `npm run tauri dev` → in a conversation pick **Cyber → Real**; the
reconcile invokes `mcp_runtime_paths`, patches `mcp_config`, and the local
agent-server spawns the unified cyber MCP (Validation gates real actions).

**Simulation side (cloned, setup next):** CALDERA + CybORG (cage-challenge-4) →
`vendor/sim/` (Python) — the cyber *sim* mode backends.

## 6. Remaining

- **Bundle** `vendor/mcp` build outputs into `src-tauri/resources/mcp` (+ add to
  `tauri.conf.json` bundle.resources; ship a `node` for end-users without it) so
  the installer carries the field MCPs. (Dev/`tauri dev` already works via the
  fallback path.)
- **Cyber simulation:** wire CALDERA (REST server) + CybORG (gym) as the sim-mode
  backends behind the field adapter.
- Then Robotics (MuJoCo), Computing/RTL (Verilator+cocotb), Device control
  (windows-mcp as the Device field's Real backend), then the neutral
  orchestrator + MHS adapter.
- **Deploy the gateway** (`flyctl deploy …`) for the plan/CORS changes.
