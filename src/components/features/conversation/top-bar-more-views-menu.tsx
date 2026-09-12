import React, { useLayoutEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Bot, Check, Globe, SquareChevronRight } from "lucide-react";
import { LuFileDiff } from "react-icons/lu";
import VSCodeIcon from "#/icons/vscode.svg?react";
import { useClickOutsideElement } from "#/hooks/use-click-outside-element";
import { ContextMenu } from "#/ui/context-menu";
import { ContextMenuListItem } from "#/components/features/context-menu/context-menu-list-item";
import { ToolsContextMenuIconText } from "#/components/features/controls/tools-context-menu-icon-text";
import { ConversationTab } from "#/stores/conversation-store";

interface TopBarMoreViewsMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  selectedTab: ConversationTab | null;
  isRightPanelShown: boolean;
  onSelectTab: (tab: ConversationTab) => void;
  hasVSCode: boolean;
  onOpenVSCode: () => void;
}

/**
 * Three-dot overflow for the secondary conversation views (Changes, Terminal,
 * Browser, VSCode). Keeps the header tab strip minimal — Files and Usage stay
 * inline; everything else lives here. Same portaled/anchored pattern as the
 * git-actions menu.
 */
export function TopBarMoreViewsMenu({
  anchorRef,
  onClose,
  selectedTab,
  isRightPanelShown,
  onSelectTab,
  hasVSCode,
  onOpenVSCode,
}: TopBarMoreViewsMenuProps) {
  const menuRef = useClickOutsideElement<HTMLUListElement>(onClose);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>();

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return undefined;
    }

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      setPortalStyle({
        position: "fixed",
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 50,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  const items: {
    key: ConversationTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "commits",
      label: "Changes",
      icon: <LuFileDiff className="size-4" aria-hidden />,
    },
    {
      key: "terminal",
      label: "Terminal",
      icon: <SquareChevronRight className="size-4" aria-hidden />,
    },
    {
      key: "browser",
      label: "Browser",
      icon: <Globe className="size-4" aria-hidden />,
    },
    {
      key: "swarm",
      label: "Swarm",
      icon: <Bot className="size-4" aria-hidden />,
    },
  ];

  const handleSelect = (tab: ConversationTab) => {
    onSelectTab(tab);
    onClose();
  };

  const handleVSCode = () => {
    onOpenVSCode();
    onClose();
  };

  if (!portalStyle) {
    return null;
  }

  return ReactDOM.createPortal(
    <ContextMenu
      ref={menuRef}
      testId="top-bar-more-views-menu"
      theme="popover"
      style={portalStyle}
      className="w-max min-w-[8rem]"
    >
      {items.map((item) => {
        const isActive = isRightPanelShown && selectedTab === item.key;
        return (
          <ContextMenuListItem
            key={item.key}
            testId={`top-bar-more-views-${item.key}`}
            onClick={() => handleSelect(item.key)}
            className="!w-auto whitespace-nowrap"
          >
            <ToolsContextMenuIconText
              icon={item.icon}
              text={item.label}
              rightIcon={
                isActive ? (
                  <Check className="size-4 text-[#FFD026]" aria-hidden />
                ) : undefined
              }
            />
          </ContextMenuListItem>
        );
      })}
      {hasVSCode ? (
        <ContextMenuListItem
          testId="top-bar-more-views-vscode"
          onClick={handleVSCode}
          className="!w-auto whitespace-nowrap"
        >
          <ToolsContextMenuIconText
            icon={<VSCodeIcon className="size-4 text-[#3880F6]" aria-hidden />}
            text="Open in VSCode"
          />
        </ContextMenuListItem>
      ) : null}
    </ContextMenu>,
    document.body,
  );
}
