import { useMemo } from "react";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useConversationStateStore } from "#/stores/conversation-state-store";
import { AgentState } from "#/types/agent-state";
import { ExecutionStatus } from "#/types/agent-server/core/base/common";

/**
 * Maps agent execution status to AgentState
 */
function mapExecutionStatusToAgentState(
  status: ExecutionStatus | null,
  hasActiveConversation: boolean = false,
): AgentState {
  if (!status) {
    return hasActiveConversation ? AgentState.LOADING : AgentState.INIT;
  }

  switch (status) {
    case ExecutionStatus.IDLE:
      return AgentState.AWAITING_USER_INPUT;
    case ExecutionStatus.RUNNING:
      return AgentState.RUNNING;
    case ExecutionStatus.PAUSED:
      return AgentState.PAUSED;
    case ExecutionStatus.WAITING_FOR_CONFIRMATION:
      return AgentState.AWAITING_USER_CONFIRMATION;
    case ExecutionStatus.FINISHED:
      return AgentState.FINISHED;
    case ExecutionStatus.ERROR:
      return AgentState.ERROR;
    case ExecutionStatus.STUCK:
      return AgentState.ERROR; // Map STUCK to ERROR for now
    default:
      return hasActiveConversation ? AgentState.LOADING : AgentState.INIT;
  }
}

export interface UseAgentStateResult {
  curAgentState: AgentState;
  executionStatus?: ExecutionStatus | null;
}

/**
 * Returns the current agent state from conversation execution status.
 */
export function useAgentState(): UseAgentStateResult {
  const { conversationId } = useOptionalConversationId();
  const liveExecutionStatus = useConversationStateStore(
    (state) => state.execution_status,
  );
  const fallbackExecutionStatus =
    useActiveConversation().data?.execution_status ?? null;

  const executionStatus = liveExecutionStatus ?? fallbackExecutionStatus;
  const curAgentState = useMemo(
    () =>
      mapExecutionStatusToAgentState(executionStatus, Boolean(conversationId)),
    [executionStatus, conversationId],
  );

  return { curAgentState, executionStatus };
}
