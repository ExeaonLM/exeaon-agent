import React from "react";
import { Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { NavigationLink } from "#/components/shared/navigation-link";
import { ExecutionStatus } from "#/types/agent-server/core/base/common";
import { SandboxStatus } from "#/api/conversation-service/agent-server-conversation-service.types";
import { RepositorySelection } from "#/api/open-hands.types";
import { cn } from "#/utils/utils";
import { ConversationCardFooter } from "./conversation-card/conversation-card-footer";
import { I18nKey } from "#/i18n/declaration";
import { useBackendScopedPath } from "#/hooks/use-backend-scoped-path";
import { sanitizeConversationTitle } from "#/utils/sanitize-conversation-title";

interface CompactConversationRowProps {
  conversationId: string;
  title: string;
  selectedRepository: RepositorySelection | null;
  executionStatus?: ExecutionStatus | null;
  sandboxStatus?: SandboxStatus | null;
  lastUpdatedAt: string;
  createdAt?: string;
  workspaceWorkingDir?: string | null;
  isActive?: boolean;
  onClose?: () => void;
  showRepositoryMetadata?: boolean;
  llmModel?: string | null;
  showLlmProfiles?: boolean;
  agentKind?: "openhands" | "acp" | null;
  acpServer?: string | null;
  tags?: Record<string, string> | null;
  showTags?: boolean;
}

/**
 * Minimal one-row presentation of a conversation used by the collapsed
 * sidebar. The row itself is a clean chat icon; hovering it shows a
 * floating preview with the conversation's title, repo and timestamp.
 */
export function CompactConversationRow({
  conversationId,
  title,
  selectedRepository,
  executionStatus,
  sandboxStatus,
  lastUpdatedAt,
  createdAt,
  workspaceWorkingDir,
  isActive = false,
  onClose,
  showRepositoryMetadata = true,
  llmModel = null,
  showLlmProfiles = false,
  agentKind = null,
  acpServer = null,
  tags = null,
  showTags = false,
}: CompactConversationRowProps) {
  const { t } = useTranslation("openhands");
  const backendScopedPath = useBackendScopedPath();
  const disableAnimation = import.meta.env.MODE === "test";

  const preview = (
    <div className="w-[260px] p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-white truncate" title={title}>
          {sanitizeConversationTitle(title) || t(I18nKey.CONVERSATION$UNTITLED)}
        </span>
      </div>
      <ConversationCardFooter
        selectedRepository={selectedRepository}
        lastUpdatedAt={lastUpdatedAt}
        createdAt={createdAt}
        executionStatus={executionStatus}
        workspaceWorkingDir={workspaceWorkingDir}
        showRepositoryMetadata={showRepositoryMetadata}
        llmModel={llmModel}
        showAgentChip={showLlmProfiles}
        agentKind={agentKind}
        acpServer={acpServer}
        tags={tags}
        showTags={showTags}
      />
    </div>
  );

  return (
    <Tooltip
      content={preview}
      placement="right"
      closeDelay={100}
      className="bg-[var(--oh-surface)] text-white border border-[var(--oh-border-subtle)] shadow-xl p-0"
      disableAnimation={disableAnimation}
    >
      <NavigationLink
        to={backendScopedPath(`/conversations/${conversationId}`)}
        onClick={onClose}
        data-testid="compact-conversation-row"
        data-conversation-id={conversationId}
        aria-label={title || conversationId}
        className={({ isActive: navActive }) =>
          cn(
            "flex items-center justify-center w-10 h-9 mx-auto rounded-md",
            "transition-colors cursor-pointer",
            navActive || isActive
              ? "bg-tertiary text-white"
              : "hover:bg-[var(--oh-surface-raised)] text-[#8C8275] hover:text-[#EDEDED]",
          )
        }
      >
        <MessageSquare className="size-4" />
      </NavigationLink>
    </Tooltip>
  );
}
