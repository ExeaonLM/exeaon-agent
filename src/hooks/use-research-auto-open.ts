import { useEffect, useRef } from "react";
import { useResearchState } from "./use-research-state";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptionalConversationId } from "./use-conversation-id";
import { setConversationState } from "#/utils/conversation-local-storage";
import { useAgentState } from "./use-agent-state";
import { AgentState } from "#/types/agent-state";

/**
 * When the Research field starts producing state (first source/claim logged),
 * auto-open the Research war-room. Fires once per conversation.
 */
export function useResearchAutoOpen() {
  const { active } = useResearchState();
  const { curAgentState } = useAgentState();
  const isAgentActive =
    curAgentState === AgentState.RUNNING ||
    curAgentState === AgentState.LOADING;

  const engineeringField = useConversationStore((s) => s.engineeringField);
  const setSelectedTab = useConversationStore((s) => s.setSelectedTab);
  const setIsRightPanelShown = useConversationStore(
    (s) => s.setIsRightPanelShown,
  );
  const setHasRightPanelToggled = useConversationStore(
    (s) => s.setHasRightPanelToggled,
  );
  const { conversationId } = useOptionalConversationId();
  const lastConversationIdRef = useRef(conversationId);
  const opened = useRef(false);

  useEffect(() => {
    if (conversationId !== lastConversationIdRef.current) {
      lastConversationIdRef.current = conversationId;
      opened.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    if (
      isAgentActive &&
      active &&
      engineeringField === "research" &&
      !opened.current
    ) {
      opened.current = true;
      // The Research war-room now lives inside the unified field viewer tab
      // ("swarm"), which renders the war-room when the field is research.
      setSelectedTab("swarm");
      setIsRightPanelShown(true);
      setHasRightPanelToggled(true);
      if (conversationId) {
        setConversationState(conversationId, {
          rightPanelShown: true,
          selectedTab: "swarm",
        });
      }
    }
  }, [
    isAgentActive,
    active,
    engineeringField,
    conversationId,
    setSelectedTab,
    setIsRightPanelShown,
    setHasRightPanelToggled,
  ]);
}
