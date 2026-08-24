# `exeaon/` — the overlay

Everything in this directory is **ours**. Upstream OpenHands never edits it, so
merging upstream can never conflict here. This is the mechanism that lets Exeaon
Agent stay a living fork — pulling OpenHands' improvements forever — while we
bolt on our runtime and the other frameworks.

Read `MERGE_STRATEGY.md` first: it is the discipline that keeps upstream merges
from disrupting our system, which is the whole point of doing it this way.

| File | What |
|---|---|
| `MERGE_STRATEGY.md` | how we merge upstream without pain — the core rule |
| `brand.ts` | single source of truth for identity + default model endpoint |
| `adapters/README.md` | how Goose, NeMo+AI-Q, LangGraph, CrewAI plug in |
| `PATCHES.md` | the short, logged list of unavoidable upstream edits |

The proprietary core — the Exeaon runtime, the compressed artifacts, the model
registry — lives in separate repos, not here. This overlay is only the seam
between the open-source agent surface and that core.
