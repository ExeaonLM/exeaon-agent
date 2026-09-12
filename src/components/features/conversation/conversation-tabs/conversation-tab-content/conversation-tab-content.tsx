import { lazy, useMemo } from "react";
import { TabWrapper } from "./tab-wrapper";
import { TabContainer } from "./tab-container";
import { TabContentArea } from "./tab-content-area";
import { ConversationTabContentCrossfade } from "./conversation-tab-content-crossfade";
import { useConversationStore } from "#/stores/conversation-store";
import { useConversationId } from "#/hooks/use-conversation-id";
import SwarmTab from "#/routes/swarm-tab";
import RoboticsTab from "#/routes/robotics-tab";
import RtlTab from "#/routes/rtl-tab";

import FilesTab from "#/routes/files-tab";

// Lazy load tab components with heavy deps (xterm, browser sandbox, etc.).
// Lightweight tabs (swarm, files, usage, planner, tasklist) render instantly.
const CommitsTab = lazy(() => import("#/routes/commits-tab"));
const BrowserTab = lazy(() => import("#/routes/browser-tab"));
const PlannerTab = lazy(() => import("#/routes/planner-tab"));
const TaskListTab = lazy(() => import("#/routes/task-list-tab"));
const UsageTab = lazy(() => import("#/routes/usage-tab"));
const Terminal = lazy(() => import("#/components/features/terminal/terminal"));

const TAB_CONFIG = {
  tasklist: { component: TaskListTab },
  files: { component: FilesTab },
  commits: { component: CommitsTab },
  browser: { component: BrowserTab },
  terminal: { component: Terminal },
  planner: { component: PlannerTab },
  usage: { component: UsageTab },
  swarm: { component: SwarmTab },
  robotics: { component: RoboticsTab },
  rtl: { component: RtlTab },
};

// Only browser genuinely needs the remote sandbox ready before rendering.
// All other tabs render client-side or manage their own queries and should
// never be blocked by the global agent-loading overlay.
const BACKEND_DEPENDENT_TABS = new Set(["browser"]);

export function ConversationTabContent({
  tabKey,
}: {
  tabKey?: import("#/stores/conversation-store").ConversationTab | null;
} = {}) {
  const { selectedTab: storeSelectedTab, shouldShownAgentLoading } =
    useConversationStore();
  const selectedTab = tabKey ?? storeSelectedTab;
  const { conversationId } = useConversationId();

  const activeTab = useMemo(
    () =>
      TAB_CONFIG[selectedTab as keyof typeof TAB_CONFIG] ?? TAB_CONFIG.files,
    [selectedTab],
  );

  const ActiveComponent = activeTab.component;

  const tabWrapperKey =
    selectedTab === "terminal"
      ? `${selectedTab}-${conversationId}${tabKey ? "-split" : ""}`
      : `${selectedTab ?? "files"}${tabKey ? "-split" : ""}`;

  // Only gate the loading overlay for tabs that actually need the backend.
  // Terminal, swarm, usage, planner, tasklist all render instantly.
  const effectiveLoading =
    shouldShownAgentLoading &&
    BACKEND_DEPENDENT_TABS.has(selectedTab ?? "files");

  return (
    <TabContainer>
      <TabContentArea>
        <ConversationTabContentCrossfade
          showAgentLoading={effectiveLoading}
          tabKey={tabWrapperKey}
        >
          <TabWrapper key={tabWrapperKey}>
            <ActiveComponent />
          </TabWrapper>
        </ConversationTabContentCrossfade>
      </TabContentArea>
    </TabContainer>
  );
}
