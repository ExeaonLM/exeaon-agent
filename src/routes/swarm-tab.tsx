import { useConversationStore } from "#/stores/conversation-store";
import { SwarmGraph } from "#/components/features/conversation/swarm-graph";
import { ResearchWarRoom } from "#/components/features/conversation/research-war-room";

/**
 * Unified right-panel field viewer. One tab that adapts to the active
 * engineering field: Research shows the sources/claims/originality war-room;
 * every other field (cyber + default) shows the live operative graph. Robotics
 * and RTL keep their own dedicated tabs — their visualizations are different in
 * kind (3D sim, waveforms), not just content.
 */
export default function SwarmTab() {
  const engineeringField = useConversationStore((s) => s.engineeringField);
  if (engineeringField === "research") return <ResearchWarRoom />;
  return <SwarmGraph />;
}
