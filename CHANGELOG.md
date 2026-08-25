# Changelog

All notable changes to Exeaon Agent Canvas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Dedicated Settings Pages for Skills & Agent Tools**:
  - `/settings/skills`: Interactive skill explorer with categories, search, toggles, and detail drawer.
  - `/settings/tools`: Live schema browser showing runtime tools (`terminal_command`, `file_editor`, `browser_engine`, `agent_skills`, `subagent_orchestrator`) and read-only sovereign system prompt protocols.
- **Claude-Style User Profile Footer (`[E] Elliot · Pro ⌄`)**:
  - Replaced legacy backend selector with an avatar pill button and upward floating menu (Email, Settings `Ctrl+,`, Language, Account & Cloud with Pro badge, Get Apps & Extensions, View Changelog, Log Out).
- **Sovereign Exeaon Model Pipeline**:
  - Connected directly to `Exeaon/Exeaon1-Claw-32B` (and `Exeaon1-Nunya-14B` / `Exeaon1-Kese-32B`) via `epure-runtime` on the active Modal `exeaon-compress` endpoint (`https://elliotakpalu--exeaon-compress-exeaonendpoint-api.modal.run/v1`).
- **Claude-Style Top Header Lane Search**: Migrated the command search bar into a compact icon-only button directly in the sidebar header next to the Exeaon logo and collapse toggle.
- **Engineering Prompt Macros & Workflows**: Revamped landing prompt suggestions and the Prompt Macros submenu with production-grade engineering workflows (Full-Stack, Find & Fix Bugs, Refactor, Automate & Deploy).
- **Claude-Style Live Thinking & Status Animations**: Dual-ring pulsing Solar Gold indicator inside frosted glass pill containers with collapsible `<think>` reasoning blocks.
- **Interactive Token & Context Analytics Modal**: Real-time context capacity meter, token breakdown, and quick context compaction.

### Changed
- **Connection Security & UI Locking**:
  - Locked default sovereign backend connection and removed edit/delete/add tampering buttons from backend management modals.
  - Formatted all connection failures (502 / ECONNREFUSED) into clean, professional *"Exeaon Server Offline — Please restart the application"* notices.
- **Modal Smart Idle Scaling**:
  - Removed `min_containers=1` to prevent 24/7 idle credit burn on A100 GPUs.
  - Configured `scaledown_window=600` (10 minutes) for zero-latency multi-turn conversations while scaling to 0 when idle.
- **Chat `+` Context Menu Simplification**:
  - Streamlined chat attachment context menu strictly to Prompt Macros, Attach Files & Images, and Git Tools.
- **Command Menu (`Cmd+K`) Modernization**:
  - Aligned search results with native Exeaon routes: Models, Skills, Agent Tools, Account & Cloud, Compactor, Context, Validation, Appearance, Secrets, and MCP Servers.
- **Settings Navigation Rebranding**:
  - Rebranded **Application** $\rightarrow$ **Appearance**.
  - Rebranded **Condenser** $\rightarrow$ **Compactor**.
  - Rebranded **Agent Canvas** $\rightarrow$ **Exeaon Canvas**.
  - Rebranded **Automations** $\rightarrow$ **Flows**.
- **Model Display Name Formatting**:
  - Standardized model selector labels across chat input, profile cards, and settings to clean branded names (`Exeaon Coder`, `Exeaon Nunya 14B`, `Exeaon Kese 32B`).

### Fixed
- Fixed 502 Bad Gateway by managing process sockets on ports 18000, 18001, and 18080.
- Fixed stale conversation configs carrying disabled workspace URLs by cleaning old conversation caches and patching agent server settings.
- Fixed `AnimatePresence` multiple-child warning by wrapping status indicator components in a single motion container.
- Fixed Windows absolute path resolution in folder browser.

## [1.15.0] - 2026-08-24

### Added
- Exeaon Agent UI integration & LiteLLM function calling support.
- Initial Exeaon dark theme tokens and custom styling components.

