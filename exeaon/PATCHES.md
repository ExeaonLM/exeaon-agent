# Upstream patches (Tier 3) — keep this short

Edits to upstream files that could not be done in the overlay or at a designed
extension point. Each one is a merge liability, so each is logged here with what
to re-check after merging `upstream/main`. An empty list is the goal.

| File | Reason | Re-check after merge |
|---|---|---|
| `src/root.tsx` | Document title + description must show the Exeaon brand. One-line import of `BRAND` from `src/exeaon/brand.ts`; the values live in the overlay, not hardcoded here. | If upstream changes the `meta` export near line 225, re-apply `{ title: BRAND.name }` / `{ content: BRAND.tagline }` and keep the import. |

If this table grows past a handful of rows, that is a signal to move changes
into `exeaon/` (Tier 1) or a real extension point (Tier 2) instead.
