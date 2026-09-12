# Session — Workspaces, native folder picker, GitHub Device Flow, sidebar renovation

Date: 2026-08-30 · Branch: `exeaon/setup`

Context: Exeaon Claw is a local-first desktop agent (Tauri) that signs into Exeaon
Cloud for identity/models but **always runs the agent on the local sovereign
engine** (127.0.0.1:18000). A recurring theme this session: several UI features
were gated on `backend.kind`, which flips to `"cloud"` the moment a user signs in
— even though the runtime stays local. The correct signal is the runtime seam
`!isCloudAppServerBackend()` (always local today).

## Shipped

### Workspaces
- **Home workspace picker** (`workspace-picker.tsx`): Claude-style pill under the
  composer — Recent workspaces + "Open folder…" + "No workspace (scratch)".
  Persisted recents live in `home-store.ts` (`recentWorkspaces`, deduped by path).
- **New chats default to the most-recent workspace** (auto-select once on mount).
- **Native OS folder picker**: "Open folder…" opens the OS dialog (folder create,
  rename, navigation come free from the OS) via `@tauri-apps/plugin-dialog`
  (`pick-workspace-folder.ts`), falling back to the in-app browser when the native
  dialog isn't available.
- **Mandate rule** was tried then **reverted**: hard-blocking send until a folder
  is picked is bad first-run UX. Final rule: always auto-assign a workspace
  (recent, else scratch), never block. Every conversation still has a real working
  dir, so the Files panel always reflects the model's edits.
- Gated the picker/mode-selector on the runtime, not `backend.kind`, so they show
  when signed into cloud. Mode label reads **"Local Repo"**, never "Cloud Repo".

### Plan mode 422
- `createConversation` now inherits the parent's `working_dir` when a child is
  launched without an explicit workspace, fixing the agent-server 422 "Parent
  conversation … belongs to a different workspace" that broke Plan mode.

### Live activity + message footer
- Typing indicator elapsed time is now anchored to the **last user message's
  timestamp** (data-derived), so it no longer resets when the indicator unmounts
  on scroll.
- Per-message footer shows **reply time + tokens** and persists (derived from
  event timestamps), like Claude Code.

### Conversations sidebar
- Removed the redundant `+` (new-thread) button from the Conversations header.
- Filter icon → config-style (sliders).
- **Filter popover renovated to Claude's look**: collapsed rows (Group by, Sort
  by, Show, Automations, Display) each showing the current value + a `>` that
  opens a **nested flyout submenu** (`menu-submenu-row.tsx`). Real Exeaon filters,
  no fake rows, nothing removed.

### GitHub integration (OAuth Device Flow)
- **Why Device Flow**: desktop-appropriate (like `gh` CLI / VS Code), no client
  secret shipped. OAuth App under **ExeaonLM**, client id
  `Ov23ctxxjymJg6lSdnQU` (public, `constants/github-oauth.ts`), scope
  `repo read:user`.
- Rust commands `github_device_start` / `github_device_poll` / `open_external`
  (`src-tauri/src/lib.rs`, via `reqwest`) run HTTP + browser-open server-side to
  dodge GitHub's missing CORS headers and the webview's unreliable `window.open`.
- **CRITICAL**: `provider_tokens_set` is **cloud-only** — the local agent-server
  never populates it and `saveSettings` silently drops it. So the token is stored
  as a **Secret** named `GITHUB_TOKEN` (`SecretsService.createSecret`), exposed to
  the runtime as `$GITHUB_TOKEN` for the agent's git commands. **Connected state =
  that secret exists** (`useSearchSecrets`), not `provider_tokens_set`.
- **VSCode-style account chip** (`github-account-chip.tsx`): the GitHub identity
  (name + avatar) is fetched once at connect time and cached (avatar as a data URL
  for offline) in `github-account-store.ts`. The chip lives in the sidebar account
  menu + Settings → Account; clicking opens a menu with **Disconnect** (confirmed).
- The home "Connect GitHub" pill **vanishes** once connected.
- **Confirmations** added to: GitHub disconnect, and Cloud logout (both the sidebar
  account popover and Settings → Account).
- Gated the in-conversation remote-repo "Connect Repo" flow on the runtime so the
  broken cloud repo-search modal no longer appears on Exeaon.

## Still open
- **Repo picker on local**: list the connected GitHub repos → pick → clone →
  worktree. Auth now persists (secret) and the connected account is known, so this
  is the natural next build. The remote-repo UI that exists is cloud-only and does
  not work against the Exeaon gateway.

## Notes / gotchas
- Rust changes (dialog plugin, `reqwest`, new commands) require a full Tauri
  rebuild + restart; frontend changes hot-reload. New files + a persisted store
  field also need a full webview reload (Vite Fast Refresh bails).
- Tauri CSP is `null`, so the frontend can call `api.github.com` directly.
