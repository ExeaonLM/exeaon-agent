# Changelog

All notable changes to Exeaon Agent Canvas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Claude-Style Top Header Lane Search**: Migrated the command search bar into a compact icon-only button directly in the sidebar header next to the Exeaon logo and collapse toggle.
- **Engineering Prompt Macros & Workflows**: Revamped landing prompt suggestions and the Prompt Macros submenu with production-grade engineering workflows:
  - **Build Full-Stack App**: Scaffolds modular TypeScript full-stack architectures with Dark Void UI and service contracts.
  - **Find & Fix Bugs**: Deep-dive static & runtime code auditing, type safety enforcement, and automated regression verification.
  - **Refactor & Modernize**: Monolith decomposition, custom hooks, performance optimization, and modern code idioms.
  - **Automate & Deploy**: Multi-stage Docker containerization, docker-compose orchestration, and CI/CD GitHub Actions pipelines.
- **Claude-Style Live Thinking & Status Animations**:
  - Dual-ring pulsing Solar Gold indicator (`animate-ping` + amber glow) inside frosted glass pill containers (`#120F0A`/95 + `backdrop-blur-md`).
  - Seamless Framer Motion transitions (`opacity`, `translateY`, `scale`) for status indicators, preventing layout shifts and flickering.
  - Animated collapsible `<think>` reasoning sections with clean Markdown formatting and responsive state chevrons.
- **Polished Dark Void Agent Status Controls**: Upgraded the in-chat agent status pill with live pulsing activity dots, tactile pause/resume controls, and subtle Dark Void glass badges.
- **Interactive Token & Context Analytics Modal**: Real-time context window capacity meter with percentile breakdown (Input, Output, Cache Hits, Cache Writes), session cost tracking, and quick context compaction action.
- **Enhanced Folder & Workspace Browser**: Modernized file browser modal with native Windows drive detection, favorites list (Home, Desktop, Documents, Downloads), custom sleek scrollbars, and absolute path resolution.

### Changed
- **Settings Navigation Rebranding**:
  - Rebranded **Application** $\rightarrow$ **Appearance**.
  - Rebranded **Condenser** $\rightarrow$ **Compactor**.
  - Rebranded **Agent Canvas** $\rightarrow$ **Exeaon Canvas**.
  - Rebranded **Macros** $\rightarrow$ **Prompt Macros**.
  - Rebranded **Automations** $\rightarrow$ **Flows** across dashboard metrics, filter chips, recommended flows rail, and templates.
- **Agent Error Card Redesign**: Transformed raw error text into an alert card with Dark Void borders and expandable debugging details.

### Fixed
- Fixed `AnimatePresence` multiple-child warning by wrapping status indicator components in a single motion container.
- Fixed translation completeness and removed redundant string references across multilingual language bundles.
- Fixed duplicate tab header rendering inside the desktop drawer panel.
- Fixed Windows absolute path resolution in folder browser.

## [1.15.0] - 2026-08-24

### Added
- Exeaon Agent UI integration & LiteLLM function calling support.
- Initial Exeaon dark theme tokens and custom styling components.

