import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge, Globe, SquareChevronRight } from "lucide-react";
import { LuFileDiff } from "react-icons/lu";
import DocumentIcon from "#/icons/document.svg?react";
import VSCodeIcon from "#/icons/vscode.svg?react";
import { cn } from "#/utils/utils";
import { ChatActionTooltip } from "../chat/chat-action-tooltip";
import { useConversationStore, ConversationTab } from "#/stores/conversation-store";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useUnifiedVSCodeUrl } from "#/hooks/query/use-unified-vscode-url";
import { useIsArchivedConversation } from "#/hooks/use-is-archived-conversation";
import { setConversationState } from "#/utils/conversation-local-storage";
import { UsageModal } from "./usage-modal";

export function TopBarConversationTabs() {
  const { t } = useTranslation("openhands");
  const { conversationId } = useConversationId();
  const isArchived = useIsArchivedConversation();
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const {
    isRightPanelShown,
    setIsRightPanelShown,
    setHasRightPanelToggled,
    selectedTab,
    setSelectedTab,
  } = useConversationStore();

  const { data: vscodeData } = useUnifiedVSCodeUrl();
  const hasVSCode = Boolean(vscodeData?.url);

  const handleTabClick = (tabKey: ConversationTab) => {
    if (isArchived) return;

    if (isRightPanelShown && selectedTab === tabKey) {
      // Toggle off if clicking the already active tab
      setIsRightPanelShown(false);
      setHasRightPanelToggled(false);
      if (conversationId) {
        setConversationState(conversationId, { rightPanelShown: false });
      }
    } else {
      // Open panel and switch to this tab
      setSelectedTab(tabKey);
      setIsRightPanelShown(true);
      setHasRightPanelToggled(true);
      if (conversationId) {
        setConversationState(conversationId, {
          rightPanelShown: true,
          selectedTab: tabKey,
        });
      }
    }
  };

  const handleVSCodeClick = () => {
    if (vscodeData?.url) {
      window.open(vscodeData.url, "_blank", "noopener,noreferrer");
    }
  };

  const tabs: {
    key: ConversationTab;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
  }[] = [
    {
      key: "files",
      label: "Files",
      icon: <DocumentIcon className="size-3.5 shrink-0" />,
      isActive: isRightPanelShown && selectedTab === "files",
    },
    {
      key: "commits",
      label: "Changes",
      icon: <LuFileDiff className="size-3.5 shrink-0" />,
      isActive: isRightPanelShown && selectedTab === "commits",
    },
    {
      key: "terminal",
      label: "Terminal",
      icon: <SquareChevronRight className="size-3.5 shrink-0" />,
      isActive: isRightPanelShown && selectedTab === "terminal",
    },
    {
      key: "browser",
      label: "Browser",
      icon: <Globe className="size-3.5 shrink-0" />,
      isActive: isRightPanelShown && selectedTab === "browser",
    },
  ];

  return (
    <>
      <div className="flex items-center gap-0.5">
        {tabs.map((tab) => (
          <ChatActionTooltip key={tab.key} tooltip={tab.label} ariaLabel={tab.label}>
            <button
              type="button"
              onClick={() => handleTabClick(tab.key)}
              disabled={isArchived}
              aria-label={tab.label}
              aria-pressed={tab.isActive}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-md transition-colors duration-100 cursor-pointer",
                tab.isActive
                  ? "bg-[#241F14] text-[#FFD026]"
                  : "text-[#8C8370] hover:bg-[#1C1811] hover:text-[#EDE7D8]",
                isArchived && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {tab.icon}
            </button>
          </ChatActionTooltip>
        ))}

        {/* Usage Dialog Trigger */}
        <ChatActionTooltip tooltip="Usage & Limits" ariaLabel="Usage & Limits">
          <button
            type="button"
            onClick={() => setIsUsageModalOpen(true)}
            aria-label="Usage & Limits"
            aria-pressed={isUsageModalOpen}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md transition-colors duration-100 cursor-pointer",
              isUsageModalOpen
                ? "bg-[#241F14] text-[#FFD026]"
                : "text-[#8C8370] hover:bg-[#1C1811] hover:text-[#EDE7D8]",
            )}
          >
            <Gauge className="size-3.5 shrink-0" />
          </button>
        </ChatActionTooltip>

        {hasVSCode && (
          <ChatActionTooltip tooltip="Open in VSCode" ariaLabel="Open in VSCode">
            <button
              type="button"
              onClick={handleVSCodeClick}
              className="inline-flex size-6 items-center justify-center rounded-md text-[#8C8370] hover:bg-[#1C1811] hover:text-[#EDE7D8] transition-colors duration-100 cursor-pointer"
            >
              <VSCodeIcon className="size-3.5 shrink-0 text-[#3880F6]" />
            </button>
          </ChatActionTooltip>
        )}
      </div>

      {isUsageModalOpen && (
        <UsageModal
          isOpen={isUsageModalOpen}
          onClose={() => setIsUsageModalOpen(false)}
        />
      )}
    </>
  );
}

