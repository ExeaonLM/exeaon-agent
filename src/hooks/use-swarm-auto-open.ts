import { useEffect, useRef } from "react";
import { useSwarmState } from "./use-swarm-state";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptionalConversationId } from "./use-conversation-id";
import { setConversationState } from "#/utils/conversation-local-storage";

/**
 * When a cyber swarm actually starts (first operative summoned) in Swarm mode,
 * auto-open the Swarm war-room tab so the fan-out is on screen — the demo money
 * shot. Fires once per conversation; the user can switch away freely after.
 */
export function useSwarmAutoOpen() {
  const { active } = useSwarmState();
  const engineeringField = useConversationStore((s) => s.engineeringField);
  const cyberSwarm = useConversationStore((s) => s.cyberSwarm);
  const setSelectedTab = useConversationStore((s) => s.setSelectedTab);
  const setIsRightPanelShown = useConversationStore(
    (s) => s.setIsRightPanelShown,
  );
  const setHasRightPanelToggled = useConversationStore(
    (s) => s.setHasRightPanelToggled,
  );
  const { conversationId } = useOptionalConversationId();
  const opened = useRef(false);

  useEffect(() => {
    if (
      active &&
      (cyberSwarm || engineeringField === "cyber") &&
      !opened.current
    ) {
      opened.current = true;
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
    active,
    cyberSwarm,
    engineeringField,
    conversationId,
    setSelectedTab,
    setIsRightPanelShown,
    setHasRightPanelToggled,
  ]);
}
