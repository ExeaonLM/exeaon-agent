import { ConversationName } from "./conversation-name";
import { ConversationGitActionsToggle } from "./conversation-git-actions-toggle";
import { ConversationOverviewToggle } from "./conversation-overview-toggle";
import { TopBarConversationTabs } from "./top-bar-conversation-tabs";

export function ConversationNameWithStatus() {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center min-w-0">
        <ConversationName />
      </div>
      <div className="mr-2 flex shrink-0 items-center gap-1.5">
        <TopBarConversationTabs />
        <ConversationGitActionsToggle />
        <ConversationOverviewToggle />
      </div>
    </div>
  );
}
