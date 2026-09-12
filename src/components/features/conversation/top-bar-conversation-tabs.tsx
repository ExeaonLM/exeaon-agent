import { useRef, useState } from "react";
import { Gauge, MoreHorizontal } from "lucide-react";
import DocumentIcon from "#/icons/document.svg?react";
import { cn } from "#/utils/utils";
import { ChatActionTooltip } from "../chat/chat-action-tooltip";
import { useConversationStore, ConversationTab } from "#/stores/conversation-store";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useUnifiedVSCodeUrl } from "#/hooks/query/use-unified-vscode-url";
import { useIsArchivedConversation } from "#/hooks/use-is-archived-conversation";
import { setConversationState } from "#/utils/conversation-local-storage";
import { UsageModal } from "./usage-modal";
import { TopBarMoreViewsMenu } from "./top-bar-more-views-menu";

export function TopBarConversationTabs() {
  const { conversationId } = useConversationId();
  const isArchived = useIsArchivedConversation();
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isMoreViewsOpen, setIsMoreViewsOpen] = useState(false);
  const moreViewsButtonRef = useRef<HTMLButtonElement>(null);
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

  // Files is the primary view and stays inline; the secondary views
  // (Changes / Terminal / Browser / VSCode) live in the three-dot overflow so
  // the header strip stays minimal.
  const filesActive = isRightPanelShown && selectedTab === "files";
  const moreViewsActive =
    isRightPanelShown &&
    (selectedTab === "commits" ||
      selectedTab === "terminal" ||
      selectedTab === "browser");

  return (
    <>
      <div className="flex items-center gap-0.5">
        <ChatActionTooltip tooltip="Files" ariaLabel="Files">
          <button
            type="button"
            onClick={() => handleTabClick("files")}
            disabled={isArchived}
            aria-label="Files"
            aria-pressed={filesActive}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md transition-colors duration-100 cursor-pointer",
              filesActive
                ? "bg-[#241F14] text-[#FFD026]"
                : "text-[#8C8370] hover:bg-[#1C1811] hover:text-[#EDE7D8]",
              isArchived && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            <DocumentIcon className="size-3.5 shrink-0" />
          </button>
        </ChatActionTooltip>

        {/* More views: Changes / Terminal / Browser / VSCode */}
        <div className="relative inline-flex items-center self-center">
          <ChatActionTooltip tooltip="More views" ariaLabel="More views">
            <button
              ref={moreViewsButtonRef}
              type="button"
              onClick={() => {
                if (isArchived) return;
                setIsMoreViewsOpen((open) => !open);
              }}
              disabled={isArchived}
              aria-label="More views"
              aria-haspopup="menu"
              aria-expanded={isMoreViewsOpen}
              aria-pressed={moreViewsActive}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-md transition-colors duration-100 cursor-pointer",
                isMoreViewsOpen || moreViewsActive
                  ? "bg-[#241F14] text-[#FFD026]"
                  : "text-[#8C8370] hover:bg-[#1C1811] hover:text-[#EDE7D8]",
                isArchived && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              <MoreHorizontal className="size-3.5 shrink-0" />
            </button>
          </ChatActionTooltip>
          {isMoreViewsOpen ? (
            <TopBarMoreViewsMenu
              anchorRef={moreViewsButtonRef}
              onClose={() => setIsMoreViewsOpen(false)}
              selectedTab={selectedTab}
              isRightPanelShown={isRightPanelShown}
              onSelectTab={handleTabClick}
              hasVSCode={hasVSCode}
              onOpenVSCode={handleVSCodeClick}
            />
          ) : null}
        </div>

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

