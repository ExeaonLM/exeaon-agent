import { useEffect, useRef } from "react";
import { useRoboticsSimState } from "./use-robotics-sim-state";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptionalConversationId } from "./use-conversation-id";
import { setConversationState } from "#/utils/conversation-local-storage";

/**
 * When a MuJoCo simulation actually starts (a model is loaded) in the Robotics
 * field, auto-open the Robotics 3D viewer so the sim is on screen. Fires once
 * per conversation; the user can switch away freely after.
 */
export function useRoboticsAutoOpen() {
  const { active } = useRoboticsSimState();
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
    if (active && engineeringField === "robotics" && !opened.current) {
      opened.current = true;
      setSelectedTab("robotics");
      setIsRightPanelShown(true);
      setHasRightPanelToggled(true);
      if (conversationId) {
        setConversationState(conversationId, {
          rightPanelShown: true,
          selectedTab: "robotics",
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
