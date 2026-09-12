import React, { useEffect, useRef, useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useIsArchivedConversation } from "#/hooks/use-is-archived-conversation";
import { I18nKey } from "#/i18n/declaration";
import { Provider } from "#/types/settings";
import { cn } from "#/utils/utils";
import {
  formControlBorderClassName,
  formControlMutedHoverClassName,
  formControlTransitionClassName,
} from "#/utils/form-control-classes";
import { ChatActionTooltip } from "../chat/chat-action-tooltip";
import { ConversationGitActionsMenu } from "./conversation-git-actions-menu";

/** Compact icon-only button matching the top-bar tab icon sizing. */
const GIT_ACTIONS_BUTTON_CLASSNAME = cn(
  "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center",
  "rounded-md text-[#8C8370] hover:bg-[#1C1811] hover:text-[#EDE7D8] transition-colors duration-100",
  "disabled:cursor-not-allowed disabled:opacity-30",
);

interface ConversationGitActionsToggleProps {
  className?: string;
}

/**
 * Header control left of overview: opens the shared git-actions dropdown
 * (commit / pull / push / create PR / new branch) as chat prompts.
 */
export function ConversationGitActionsToggle({
  className,
}: ConversationGitActionsToggleProps) {
  const { t } = useTranslation("openhands");
  const isArchivedConversation = useIsArchivedConversation();
  const { data: conversation } = useActiveConversation();
  const [isGitMenuOpen, setIsGitMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const gitProvider =
    (conversation?.git_provider as Provider | undefined) ?? "github";

  useEffect(() => {
    if (!isGitMenuOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGitMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGitMenuOpen]);

  const label = t(I18nKey.CONVERSATION$OVERVIEW_DIFF_GIT_ACTIONS);

  const button = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        if (isArchivedConversation) {
          return;
        }
        setIsGitMenuOpen((open) => !open);
      }}
      disabled={isArchivedConversation}
      className={cn(
        GIT_ACTIONS_BUTTON_CLASSNAME,
        isGitMenuOpen && "bg-white/10 text-[var(--oh-foreground)]",
        isArchivedConversation &&
          "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-[var(--oh-muted)]",
        className,
      )}
      aria-expanded={isGitMenuOpen}
      aria-haspopup="menu"
      aria-disabled={isArchivedConversation}
      data-testid="conversation-git-actions-toggle"
    >
      <GitCommitHorizontal className="size-3.5 shrink-0" aria-hidden />
    </button>
  );

  return (
    <div className="relative inline-flex items-center self-center">
      <ChatActionTooltip
        tooltip={isArchivedConversation ? t(I18nKey.CONVERSATION$UNAVAILABLE_FOR_ARCHIVES) : label}
        ariaLabel={label}
      >
        {button}
      </ChatActionTooltip>
      {isGitMenuOpen ? (
        <ConversationGitActionsMenu
          anchorRef={buttonRef}
          gitProvider={gitProvider}
          onClose={() => setIsGitMenuOpen(false)}
        />
      ) : null}
    </div>
  );
}
