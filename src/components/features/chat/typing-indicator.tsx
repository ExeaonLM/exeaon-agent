import { Trans } from "react-i18next";
import type { OHEvent } from "#/stores/use-event-store";
import type { UserRejectObservation } from "#/types/agent-server/core";
import {
  isACPToolCallEvent,
  isActionEvent,
  isAgentErrorEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import {
  getACPToolCallTitleKey,
  stripRedundantTitlePrefix,
} from "#/components/conversation-events/chat/event-content-helpers/get-acp-tool-call-content";
import {
  getActionEventTitleDescriptor,
  getActionSummaryTitle,
  type EventTitleDescriptor,
} from "#/components/conversation-events/chat/event-content-helpers/get-action-event-title";
import { MonoComponent } from "./mono-component";
import { PathComponent } from "./path-component";

const THINKING_ACTIVITY: EventTitleDescriptor = {
  kind: "translation",
  key: "ACTION_MESSAGE$THINK",
  values: {},
};

const LIVE_ACTION_KINDS = new Set([
  "ExecuteBashAction",
  "TerminalAction",
  "FileEditorAction",
  "StrReplaceEditorAction",
  "MCPToolAction",
  "InvokeSkillAction",
  "TaskAction",
  "ThinkAction",
  "TaskTrackerAction",
  "GrepAction",
  "GlobAction",
  "BrowserNavigateAction",
  "BrowserClickAction",
  "BrowserTypeAction",
  "BrowserGetStateAction",
  "BrowserGetContentAction",
  "BrowserScrollAction",
  "BrowserGoBackAction",
  "BrowserListTabsAction",
  "BrowserSwitchTabAction",
  "BrowserCloseTabAction",
]);

const getLiveActionTitle = (event: OHEvent): EventTitleDescriptor | null => {
  if (!isActionEvent(event)) return null;

  const summary = getActionSummaryTitle(event);
  if (summary) {
    return { kind: "text", text: summary };
  }

  return LIVE_ACTION_KINDS.has(event.action.kind)
    ? getActionEventTitleDescriptor(event)
    : null;
};

const isUserRejectObservation = (
  event: OHEvent,
): event is UserRejectObservation =>
  event.source === "environment" && "rejection_reason" in event;

export const deriveLiveActivity = (
  events: readonly OHEvent[],
): EventTitleDescriptor => {
  const resolvedActionIds = new Set<string>();
  const resolvedToolCallIds = new Set<string>();

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.isFromPlanningAgent) {
      continue;
    }

    if (isObservationEvent(event) || isUserRejectObservation(event)) {
      resolvedActionIds.add(event.action_id);
      resolvedToolCallIds.add(event.tool_call_id);
      continue;
    }

    if (isAgentErrorEvent(event)) {
      resolvedToolCallIds.add(event.tool_call_id);
      continue;
    }

    if (isACPToolCallEvent(event)) {
      const isInProgress =
        event.status === "pending" || event.status === "in_progress";
      if (!isInProgress) {
        resolvedToolCallIds.add(event.tool_call_id);
        continue;
      }
      if (resolvedToolCallIds.has(event.tool_call_id)) {
        continue;
      }

      const title = stripRedundantTitlePrefix(event);
      return title
        ? {
            kind: "translation",
            key: getACPToolCallTitleKey(event),
            values: { title },
          }
        : THINKING_ACTIVITY;
    }

    if (
      isActionEvent(event) &&
      !resolvedActionIds.has(event.id) &&
      !resolvedToolCallIds.has(event.tool_call_id)
    ) {
      return getLiveActionTitle(event) ?? THINKING_ACTIVITY;
    }
  }

  return THINKING_ACTIVITY;
};

interface TypingIndicatorProps {
  readonly events: readonly OHEvent[];
}

export function TypingIndicator({ events }: TypingIndicatorProps) {
  const activity = deriveLiveActivity(events);

  return (
    <div
      className="flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-[#2B2316] bg-[#120F0A]/95 backdrop-blur-md px-3.5 py-1.5 text-xs text-[#E0D8C3] shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(255,208,38,0.08)]"
      data-testid="live-activity-chip"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD026] opacity-75 duration-1000" />
        <span className="relative inline-flex size-2 rounded-full bg-[#FFD026] shadow-[0_0_8px_rgba(255,208,38,0.8)]" />
      </span>
      <span className="min-w-0 truncate font-medium text-[#F5F5F5] tracking-wide">
        {activity.kind === "text" ? (
          activity.text
        ) : (
          <Trans
            ns="openhands"
            i18nKey={activity.key}
            values={activity.values}
            components={{
              path: <PathComponent />,
              cmd: <MonoComponent />,
            }}
          />
        )}
      </span>
    </div>
  );
}
