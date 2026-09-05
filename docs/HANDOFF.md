# EXEAON — Handoff & Continuation Guide

**Updated:** 2026-09-01 · Read this first if you are picking up the work.

Two repos:
- **Exeaon Claw** (Tauri desktop / OpenHands fork): `C:/Users/Kweku Elliot/Downloads/exeaon-agent`
- **Exeaon Cloud** (Go ai-gateway): `C:/Users/Kweku Elliot/Downloads/SudoSpace/exeaon-cloud`, deployed to Fly as app `exeaon-claw` → https://exeaon-claw.fly.dev

Companion docs: `docs/SESSION_STATUS_2026-09-01.md` (detailed), `docs/EXEAON_BACKLOG.md`.

---

## 1. Status by workstream

### A. Cloud gateway — Plan usage + Paystack (BUILT, committed, NOT deployed)
- Plans Free/Pro/Max, credit-spend **hourly+weekly** windows on `/me`; Paystack plan-upgrade endpoints. Commits `207fc5c`, `1cae51f` (local-only; remote is upstream — never push).
- **Redis was broken (readyz 503, NOAUTH)** → fixed by setting the **native** Redis Fly secrets (not REST). Now `readyz` = `{"ready":true}`.
- **CORS fix** (localhost:8000/3005 + tauri origins) committed but **needs deploy** to take effect for web-dev sign-in.
- **ACTION: deploy** → `flyctl deploy --config deploy/fly/fly.toml --remote-only` (user runs).

### B. Claw — Plan usage UI (BUILT, type-clean)
- Under-input `PlanUsageLimitsBar`, context-meter popover section, account-settings Upgrade/Top-up. Only render when signed into cloud. Top-bar icons trimmed (Files + ⋯ + Usage).

### C. Claw — startup + bundle (FIXED)
- ~10-min cold start fixed by **precompiling the bundled Python bytecode** (`compileall --invalidation-mode unchecked-hash`, 14,724+ `.pyc`). `lib.rs` reverted to no pycache-prefix.
- Automation left enabled (works via bundled runtime; earlier failures were `:18001` startup timing).

### D. Engineering Agent — Phase 0 (DONE) + Phase 1 Cyber (IN PROGRESS)
- **Phase 0:** field (none/cyber/robotics/computing/device) × mode (simulation/real/auto) in the composer like Code/Plan; store + persistence; `utils/engineering-labs.ts`; directive prepended to SERVER message content.
- **Phase 1 Cyber built + bundled:**
  - Cyber Real MCP = `pentesting-cyber-mcp` unified server (50 tools) → **built** and **staged into `src-tauri/resources/mcp/cyber-unified/`** (self-contained via `pnpm deploy --config.node-linker=hoisted`).
  - `windows-mcp-server.exe` (Go) → staged into `src-tauri/resources/mcp/`.
  - Managed registry `utils/engineering-mcp-managed.ts` (`exeaon-field-*`, users can't touch — filtered out in `utils/mcp-installed-servers.ts`).
  - Tauri cmd `mcp_runtime_paths` (lib.rs) + reconcile hook `hooks/use-engineering-mcp-reconcile.ts` (in chat-interface) patch `mcp_config` by field/mode. Desktop-only.
  - `tauri.conf.json` bundle.resources includes `resources/mcp`.
- **Architecture decision (IMPORTANT):** CALDERA is **emulation = Real mode** (not sim); **CybORG = Simulation mode** (safe, pure-Python). Sim/Real backends cloned in `vendor/sim/` (CALDERA +plugins, CybORG).

### E. Bundle build — Rust OK, bundling failed on a file lock (RETRY)
- `npm run desktop:build`: Rust **compiled fine** (`Finished release in 16m38s`, only the pre-existing `unused_mut` warning at lib.rs:356), then **failed at bundling**:
  `failed to bundle project: The process cannot access the file because it is being used by another process. (os error 32)`.
- **Cause:** a Windows file lock during the resource copy — almost certainly **Defender real-time scanning/locking the freshly-staged `resources/mcp` files** (windows-mcp-server.exe 35MB + cyber-unified), or a running Claw/dev instance holding a resource.
- **Fix:** close any running Claw/`npm run dev` instance, let Defender finish scanning (or add a Defender exclusion for `src-tauri/target` and `src-tauri/resources`), then re-run `npm run desktop:build`. The compile is cached so the retry is fast (only re-links + bundles).

---

### F. Session 2 (2026-09-02) — cyber agent deepened (cyber-first; other fields → a different agent)
All code compiles (frontend tsc + `build:app` exit 0; Rust `cargo check` exit 0); both MCP wrappers smoke-tested.
- **Cyber brain:** `buildCyberContract(mode)` in `utils/engineering-labs.ts` — the operating contract prepended per message: NO-SHORTCUTS tool-install discipline, methodology, CONFIRMED-vs-POTENTIAL findings, milestone-only structured reports.
- **Tool manifest:** `resources/mcp/cyber-tools.json` — install recipe/license/tier for all ~50 cyber-unified tools (cyber-unified spawns by bare name via PATH → the agent installs to PATH).
- **`caldera-mcp`** (`resources/mcp/caldera-mcp/index.mjs`) — dependency-free Node MCP over CALDERA REST (agents/abilities/adversaries/operations/facts/create_operation). Env `CALDERA_URL`/`CALDERA_API_KEY`. Ships no implants. ✓ handshake tested.
- **`cyborg-sim`** (`resources/mcp/cyborg-sim/server.py`) — stdlib-only Python MCP; lazy-imports CybORG, clear install hint if absent. Live env-driving needs verification once `pip install -e vendor/sim/cage-challenge-4`. ✓ handshake tested.
- **Wiring:** `specsFor` mode-aware (Real→cyber-unified+device-windows+cyber-caldera; Sim→cyber-sim); `mcp_runtime_paths` returns `pythonPath` + caldera/cyborg exists flags; reconcile enables only present servers. All staged under `resources/mcp/` (in `tauri.conf` bundle.resources).
- Fixed a shared `ContextMenuListItem` tsc error (added optional `onMouseEnter`) from the other agent's field-picker flyout.

---

## 2. Next plans (ordered)
1. **Bundle build** — was re-running at handoff (task `bxo4s2kvv`). If it fails at bundling on `os error 32` (file lock, §1.E): add a Defender exclusion for `src-tauri/{target,resources}` (the 35MB `windows-mcp-server.exe` triggers a scan-lock), close running instances, retry `npm run desktop:build` (compile is cached). Installers land in `bundle/nsis/*.exe` (preferred) / `bundle/msi/*.msi`.
2. **Verify cyber end-to-end** in `npm run tauri dev` → Cyber→Real spawns cyber-unified + caldera-mcp; Cyber→Simulation spawns cyborg-sim. Confirm the agent installs a missing tool (e.g. httpx) per the contract.
3. **Ship `node`** in the Tauri bundle (cyber-unified + caldera-mcp need node at runtime; end-users may lack it). Add node to resources; set `nodePath` in `mcp_runtime_paths`.
4. **Stage bundle-safe Go binaries** into `resources/mcp/bin` + a `CYBER_BIN_DIR` PATH-prepend at the top of cyber-unified (so bundled recon tools are found without a system install). See `cyber-tools.json` (tier "bundled").
5. **Verify cyborg-sim live** once CybORG is pip-installed (the env-driving in `server.py` is written against the CC4 API but untested).
6. **Usage meter bug** (`[[usage-tracking-local-vs-cloud]]`): plan hourly/weekly read 0% because local-model inference never hits the cloud gateway meter — fix with the user.
7. Robotics/Computing/Device (a different agent) → neutral orchestrator + MHS.
8. **Deploy the gateway** for the plan + CORS changes.

---

## 3. Important commands

```bash
# Claw dev (desktop, needed to test engineering MCP reconcile — invoke is desktop-only):
npm run tauri dev
# Claw web dev (ingress :8000; reconcile is a no-op here):
npm run dev
# Claw frontend build (tauri build does NOT rebuild frontend — run this first if UI changed):
npm run build:app
# Claw Windows installer:
npm run desktop:build   # → src-tauri/target/release/bundle/{nsis,msi}/  (do NOT pipe through tail)

# Gateway build/test/deploy:
cd exeaon-cloud/backend && go build ./...
flyctl deploy --config deploy/fly/fly.toml --remote-only          # user runs
flyctl secrets set AIGW_REDIS_ADDR=<host>:6379 AIGW_REDIS_PASSWORD=<native-pw> AIGW_REDIS_TLS=true -a exeaon-claw
curl -s https://exeaon-claw.fly.dev/readyz                         # want {"ready":true}

# Cyber Real MCP (rebuild if changed):
cd vendor/mcp/pentesting-cyber-mcp && pnpm install --ignore-scripts && pnpm --filter mcp-unified... build
cd vendor/mcp/windows-mcp-server && go build -o windows-mcp-server.exe ./cmd/windows-mcp-server
# Re-stage unified into resources (flat/portable node_modules):
pnpm --filter mcp-unified deploy --prod --config.node-linker=hoisted <repo>/src-tauri/resources/mcp/cyber-unified

# Cyber sim backends (user runs; CALDERA trips AV — see gotchas):
pip install -e vendor/sim/cage-challenge-4                          # CybORG
cd vendor/sim/caldera && pip install -r requirements.txt && python server.py --insecure --build
```

---

## 4. Failures & gotchas (learned this session — do not repeat)
- **Build logs:** NEVER pipe `npm run desktop:build` through `tail`/`cat` other output first — it hides the result. Run clean, read the full task file.
- **pentesting-cyber-mcp install:** `node-pty` native build fails; use `pnpm install --ignore-scripts` (unified is pure TS, doesn't need it). Its build script had `tsc && chmod` → patched to `tsc` (chmod is a Windows no-op that exit-1'd).
- **pnpm node_modules are symlinks** → not bundle-safe. Use `pnpm deploy --config.node-linker=hoisted` for a flat, real-file, portable copy.
- **CALDERA implants trip Defender** (`Trojan:Win32/Wingo` on manx/sandcat payloads) — EXPECTED (they're real C2). **Never bundle CALDERA** (would flag the installer as malware); operator-install it in an isolated VM/lab; user sets a Defender exclusion if they run it. Only the `caldera-mcp` wrapper ships.
- **Env security classifier BLOCKS auto-building/running offensive tooling** (e.g. `npm run build` in a pentest repo was denied). Hand the user the exact command to run; do not route around the classifier.
- **`vendor/` must be excluded from the app tsconfig** (already done) or the vendored repos break `tsc`/lint/CI.
- **Redis:** gateway uses **native** go-redis (TCP+TLS), NOT the Upstash REST API. The `rediss://default:<pw>@host:6379` password ≠ the REST token.
- **Startup slowness:** read-only installs (MSI/Program Files) recompile Python bytecode each launch → precompile at build (unchecked-hash). Prefer NSIS (per-user, writable).
- **`tauri build` uses the existing `build/` dir** (no `beforeBuildCommand`) — run `npm run build:app` first for UI changes.
- **`os error 32` at bundling** = Windows file lock. **Most common cause: a running `npm run dev`** — the dev stack serves the `build/` folder, and `tauri build` copies `build/` (frontendDist) into the installer, so the static server locks it. **Stop `npm run dev` (Ctrl+C) before `npm run desktop:build`.** (Secondary causes: Defender scanning `resources/mcp`, or a running Claw/agent/windows-mcp instance.) Rust compile is cached, so retries are ~1 min.

---

## 5. Rules for agents — MUST / MUST NOT

### Cross-cutting
- **NO AI co-author trailer** in commits/PRs/HF/model cards (user rule).
- Deliver improvements to the user's tech; don't just audit. Show progress (scores/visuals), lead with the result.
- Don't block-wait on long jobs — kick, check ~30s in, move on. Metered data — validate on cloud, don't pull GBs locally.

### Cloud gateway
- Gateway commits are **LOCAL-ONLY** — remote is upstream `adcwb/ai-gateway`, no push access. Deploy via `flyctl` (user runs; sandbox can't).
- Use `git -c core.hooksPath=/dev/null` for gateway commits.
- Gate runtime decisions on `!isCloudAppServerBackend()`, **never** `backend.kind` (flips to "cloud" on cloud sign-in — recurring bug).
- Migrations additive only. Never serialize secrets. Fail-open on economics, fail-closed on security.

### Claw agent
- The agent always runs on the LOCAL sovereign engine (`isCloudAppServerBackend()` is always false in Exeaon).
- Conversation MCP config = `mcp_config` in settings; the engineering **field MCPs are system-managed** (`exeaon-field-*`) and users must NOT be able to edit/remove them (filtered out of the MCP page).

### Engineering-agent / security tooling
- **Validation gate = the safety layer** for Real/Auto (already in Claw). Keep ON by default. Real mode: authorized targets only, isolated lab, audit.
- **Never bundle CALDERA** or any real implant/payload into the installer. Only wrappers that call an operator-run backend.
- CybORG = safe local sim; CALDERA = isolated-lab Real emulation.
- Don't fabricate MCP run commands — vet each repo, pin the commit, run isolated (per ENGINEERING_LABS_PROVIDER_RESEARCH.md).
