import { useMemo } from "react";
import { useEventStore } from "#/stores/use-event-store";
import {
  isActionEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import { textFromContent } from "#/components/features/chat/tool-visualizers/text-content";

export interface ResearchSource {
  url: string;
  title: string;
  note: string;
}
export interface ResearchClaim {
  claim: string;
  evidence: string;
  falsification: string;
}

export interface ResearchState {
  active: boolean;
  sources: ResearchSource[];
  claims: ResearchClaim[];
  originality: number | null;
  flaggedSpans: string[];
  /** Whether an integrity_report has been produced (final scorecard). */
  reported: boolean;
}

const EMPTY: ResearchState = {
  active: false,
  sources: [],
  claims: [],
  originality: null,
  flaggedSpans: [],
  reported: false,
};

// The observation's `tool_name` is the TOOL name (e.g. "record_source"), which
// may or may not carry the "exeaon-field-research" server prefix depending on
// the agent-server build. Match on the tool names themselves (like the robotics
// viewer matches "step"/"reset") plus the server substring, so the war-room
// fills whether the name is prefixed or bare.
const RESEARCH_TOOL_PATTERNS = [
  "field-research",
  "record_source",
  "log_claim",
  "check_originality",
  "integrity_report",
  "humanize_review",
  "research_status",
  "read_document",
  "reset_research",
];

function isResearchTool(toolName: string): boolean {
  if (!toolName) return false;
  const lower = toolName.toLowerCase();
  return RESEARCH_TOOL_PATTERNS.some((p) => lower.includes(p));
}

function parse(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const v = JSON.parse(t);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/**
 * Derives the live research state from the `research` MCP's tool observations
 * (record_source / log_claim / check_originality / integrity_report), keyed by
 * tool_name. Drives the Research war-room viewer.
 */
export function useResearchState(): ResearchState {
  const events = useEventStore((s) => s.events);

  return useMemo(() => {
    const state: ResearchState = {
      ...EMPTY,
      sources: [],
      claims: [],
      flaggedSpans: [],
    };
    let sawAny = false;
    const seenUrls = new Set<string>();

    const addSource = (src: unknown) => {
      if (!src || typeof src !== "object") return;
      const s = src as Partial<ResearchSource>;
      const url = (s.url ?? "").toString();
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      state.sources.push({
        url,
        title: (s.title ?? "").toString(),
        note: (s.note ?? "").toString(),
      });
    };

    // The tool_name is on the ACTION event; the paired OBSERVATION carries the
    // result and references its action via `action_id` (=== the action's `id`).
    // An observation has no tool_name of its own, so map the research-tool
    // action ids first, then read the observations that answer them.
    const researchActionIds = new Set<string>();
    for (const event of events) {
      if (!isActionEvent(event)) continue;
      const toolName = (event as { tool_name?: string }).tool_name ?? "";
      if (isResearchTool(toolName)) {
        researchActionIds.add(String((event as { id?: unknown }).id ?? ""));
      }
    }

    for (const event of events) {
      if (!isObservationEvent(event)) continue;
      const actionId = String(
        (event as { action_id?: unknown }).action_id ?? "",
      );
      if (!researchActionIds.has(actionId)) continue;

      const obs = event.observation as {
        content?: Parameters<typeof textFromContent>[0];
      };
      const payload = parse(textFromContent(obs.content ?? []));
      if (!payload) continue;
      sawAny = true;

      // integrity_report — authoritative lists.
      if (Array.isArray(payload.sources)) {
        seenUrls.clear();
        state.sources = [];
        (payload.sources as unknown[]).forEach(addSource);
        state.reported = true;
      }
      if (Array.isArray(payload.claims)) {
        state.claims = (payload.claims as ResearchClaim[]).map((c) => ({
          claim: (c.claim ?? "").toString(),
          evidence: (c.evidence ?? "").toString(),
          falsification: (c.falsification ?? "").toString(),
        }));
      }

      // record_source — single source object.
      if (payload.source && typeof payload.source === "object") {
        addSource(payload.source);
      }
      // log_claim — single claim object.
      if (payload.claim && typeof payload.claim === "object") {
        const c = payload.claim as Partial<ResearchClaim>;
        state.claims.push({
          claim: (c.claim ?? "").toString(),
          evidence: (c.evidence ?? "").toString(),
          falsification: (c.falsification ?? "").toString(),
        });
      }

      // check_originality (or integrity_report) — originality score.
      if (typeof payload.originality === "number") {
        state.originality = payload.originality;
      }
      if (Array.isArray(payload.flaggedSpans)) {
        state.flaggedSpans = (payload.flaggedSpans as unknown[]).map((s) =>
          String(s),
        );
      }
    }

    state.active =
      state.sources.length > 0 ||
      state.claims.length > 0 ||
      state.originality !== null;
    if (!sawAny) return EMPTY;
    return state;
  }, [events]);
}
