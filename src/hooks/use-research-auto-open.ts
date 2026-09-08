import { useEffect, useRef } from "react";
import { useResearchState } from "./use-research-state";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptionalConversationId } from "./use-conversation-id";
import { setConversationState } from "#/utils/conversation-local-storage";

/**
 * When the Research field starts producing state (first source/claim logged),
 * auto-open the Research war-room. Fires once per conversation.
 */
export function useResearchAutoOpen() {
  const { active } = useResearchState();
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
    if (active && engineeringField === "research" && !opened.current) {
      opened.current = true;
      setSelectedTab("research");
      setIsRightPanelShown(true);
      setHasRightPanelToggled(true);
      if (conversationId) {
        setConversationState(conversationId, {
          rightPanelShown: true,
          selectedTab: "research",
        });
      }
    }
  }, [
    active,
    engineeringField,
    conversationId,
    setSelectedTab,
    setIsRightPanelShown,
    setHasRightPanelToggled,
  ]);
}
