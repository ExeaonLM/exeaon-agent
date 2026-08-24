# Changelog

All notable changes to Exeaon Agent Canvas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Claude-Style Compact Top Bar**: Added clean, icon-only header navigation buttons (`size-6`) for Files, Changes, Terminal, Browser, Usage, Git Actions, and VSCode with quick hover tooltips and Solar Gold active indicators.
- **Interactive Token & Context Analytics Modal**: Real-time context window capacity meter with percentile breakdown (Input, Output, Cache Hits, Cache Writes), session cost tracking, and quick context compaction action.
- **High-Contrast Dark Void Aesthetic**: Obsidian dark canvas theme (`#080705` to `#14110C`) paired with Solar Gold (`#FFD026`) and Sunset Amber (`#FF7A00`) accents across context menus, command palette, and modal dialogs.
- **Enhanced Folder & Workspace Browser**: Modernized file browser modal with native Windows drive detection, favorites list (Home, Desktop, Documents, Downloads), custom sleek scrollbars, and absolute path resolution.
- **Sanitized Conversation Titles**: Automatic stripping of raw `<think>` blocks, prefixes, and markdown artifacts from sidebar conversation headings.

### Changed
- **Right Panel Overhaul**: Removed redundant drawer tab headers and duplicate menus inside active tools. Opening a tool now directly renders its dedicated workspace view.
- **Usage Action**: Changed "Display Usage and Cost" across conversation context menus to open the sleek dialog modal rather than toggling the secondary sidebar.
- **Rebranding**: Complete branding alignment to **Exeaon Canvas** with updated release endpoints and environment variable labels (`EXEAON_`).

### Fixed
- Fixed Windows absolute path error (`400 Bad Request: Path must be absolute`) in folder browser when referencing root paths.
- Fixed dark / unreadable metric numbers in the Token Analytics dashboard by enforcing high-contrast bold typography.
- Fixed duplicate tab header rendering inside the desktop drawer panel.

## [1.15.0] - 2026-08-24

### Added
- Exeaon Agent UI integration & LiteLLM function calling support.
- Initial Exeaon dark theme tokens and custom styling components.
