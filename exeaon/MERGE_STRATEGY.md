# Merge strategy — upstream updates must not disrupt our system

This is a **living fork**. We keep pulling OpenHands' improvements (security
fixes, features, model support) while bolting on our own runtime and the other
frameworks — Goose, NeMo Agent Toolkit + AI-Q, LangGraph, CrewAI. Those two
goals fight each other unless the fork is disciplined, so this document is the
discipline.

The failure we are designing against is concrete: "OpenHands" appears in **109
source files**. If we find-and-replace across all of them, every upstream merge
becomes a 109-file conflict, and within a few releases we stop merging because
it hurts too much — which means we stop getting security fixes. That is how
forks die.

## The one rule

**Our code lives where upstream does not.** Everything we add goes in the
`exeaon/` overlay (this directory) and in a small, named set of wiring points.
Upstream never edits `exeaon/`, so a merge can never conflict there. The whole
strategy is a corollary of that rule.

## Three tiers of change, most-preferred first

### Tier 1 — Overlay (zero merge conflicts, always prefer this)

New files under `exeaon/`. Our branding config, our default endpoint, our
framework adapters, our theme tokens. Upstream cannot conflict with a file it
does not know exists. **Every feature we bolt on starts here.**

### Tier 2 — Extension points (rare conflicts, at designed seams)

OpenHands already exposes seams built for this:

- **ACP provider registry** (`src/constants/acp-providers.ts`) — add `exeaon`
  as a provider rather than replacing the model plumbing.
- **Brand marks** (`src/constants/acp-brand-marks.ts`) — one place for
  logos/marks.
- **i18n** (`src/i18n/translation.json`) — the product name shown to users is a
  translation key, not a hardcoded string in 109 files. Override the key.
- **LLM config / base URL** — default the model to our `epure serve` endpoint
  through config, not by editing call sites.
- **Library entry points** (`index.ts`, `tsconfig.lib.json`) — the canvas is
  packaged for embedding; we consume it as a library where we can, instead of
  editing it in place.

Edits here are small and at points that change slowly upstream, so conflicts
are rare and trivial when they happen.

### Tier 3 — Patching upstream files (last resort, must be logged)

If a change genuinely cannot be done in Tier 1 or 2, it is a single, minimal,
commented edit, and it is recorded in `exeaon/PATCHES.md` with the file, the
reason, and what to re-check after a merge. A patch we forgot about is a patch
that silently breaks on the next merge. Keep this list short; a growing Tier-3
list is a design smell to fix by moving the change into an overlay.

## Branding without touching 109 files

The product is renamed at the **display layer**, not the code layer:

1. The user-visible name comes from the i18n key → override the key (Tier 2).
2. Logos/marks come from `acp-brand-marks.ts` → point at our assets (Tier 2).
3. Theme colours come from Tailwind tokens → an overlay theme (Tier 1).

The string `OpenHands` stays in internal identifiers, package names, and code
comments, because renaming those buys nothing a user sees and costs a conflict
in every merge. We rename what ships to the eye, not what lives in the source.

## Merge cadence and gate

- **Small and frequent beats big and rare.** `gh repo sync` / merge
  `upstream/main` on a schedule, so each merge is a small diff we understand.
- **A merge is gated by CI**, same as any change. Green tests + our smoke
  (the model endpoint answers, the agent loop runs) before a merge lands on our
  `main`.
- **Merge onto a branch first** (`merge/upstream-YYYY-MM-DD`), run the gate,
  then fast-forward `main`. Never merge straight to `main`.
- After each merge, re-check the short `exeaon/PATCHES.md` list. If it is empty,
  there is nothing to re-check, which is the goal.

## Why this keeps us free

The orchestration layer (OpenHands, and the frameworks we bolt on) stays
replaceable and up to date. The proprietary core — the Exeaon runtime, the
compressed artifacts, the registry — lives entirely in the overlay and in
separate repos, so it is never entangled with upstream and never at risk from a
merge. We get their improvements for free and keep our moat clean.
