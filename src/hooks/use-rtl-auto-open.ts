import { useEffect, useRef } from "react";
import { useRtlSimState } from "./use-rtl-sim-state";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptionalConversationId } from "./use-conversation-id";
import { setConversationState } from "#/utils/conversation-local-storage";

/**
 * When an RTL simulation produces waveforms in the Computing field, auto-open
 * the RTL waveform viewer. Fires once per conversation; the user can switch away
 * freely after.
 */
export function useRtlAutoOpen() {
  const { active } = useRtlSimState();
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
    if (active && engineeringField === "computing" && !opened.current) {
      opened.current = true;
      setSelectedTab("rtl");
      setIsRightPanelShown(true);
      setHasRightPanelToggled(true);
      if (conversationId) {
        setConversationState(conversationId, {
          rightPanelShown: true,
          selectedTab: "rtl",
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
