import React from "react";
import { useTranslation } from "react-i18next";

import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useNavigation } from "#/context/navigation-context";
import { useIsCreatingConversation } from "#/hooks/use-is-creating-conversation";
import {
  useAddWorkspaces,
  useAddWorkspaceParents,
  useRemoveWorkspace,
  useRemoveWorkspaceParent,
} from "#/hooks/mutation/use-local-workspaces-mutations";
import { useLocalWorkspaces } from "#/hooks/query/use-local-workspaces";
import { useResolvedWorkspaces } from "#/hooks/query/use-resolved-workspaces";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import {
  dropdownMenuRowClassName,
  dropdownMenuListClassName,
  dropdownMenuRowIconWrapperClassName,
} from "#/utils/dropdown-classes";
import { getWorkspacesUnsupportedMessage } from "#/utils/workspaces-compatibility";
import RepoIcon from "#/icons/repo.svg?react";

import { FolderBrowserModal } from "#/components/features/home/workspace-dropdown/folder-browser-modal";
import { ManageWorkspacesModal } from "#/components/features/home/workspace-dropdown/manage-workspaces-modal";

import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { Divider } from "#/ui/divider";
import { NEW_CONVERSATION_DROPDOWN_SURFACE } from "./new-conversation-dropdown-styles";
import { usePopoverFixedPlacement } from "#/hooks/use-popover-fixed-placement";

import { Folder, FolderPlus, FolderCog, FolderX } from "lucide-react";

export type LocalNewConversationMenuTriggerProps = {
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  disabled?: boolean;
};

export interface LocalNewConversationMenuProps {
  trigger: (props: LocalNewConversationMenuTriggerProps) => React.ReactNode;
  /** Root wrapper class (e.g. `relative` + alignment in header row) */
  className?: string;
  /** Panel positioning / dimensions when using absolute placement (sidebar) */
  popoverClassName: string;
  /** Optional test id for the popover surface */
  popoverTestId?: string;
  /**
   * Use `position: fixed` from the trigger rect so the menu is not clipped by
   * sidebar overflow (conversation panel header).
   */
  useFixedPlacement?: boolean;
}

/**
 * Workspace/repo picker + launch flow for local agent-server backends.
 * Shared by the sidebar "+ New conversation" control and the conversation
 * panel "new thread folder" control.
 */
export function LocalNewConversationMenu({
  trigger,
  className,
  popoverClassName,
  popoverTestId = "new-conversation-popover",
  useFixedPlacement = false,
}: LocalNewConversationMenuProps) {
  const { t } = useTranslation("openhands");
  const { navigate } = useNavigation();

  const [open, setOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const triggerWrapRef = React.useRef<HTMLSpanElement>(null);
  const fixedBox = usePopoverFixedPlacement(triggerWrapRef, {
    open,
    enabled: useFixedPlacement,
  });

  const { data: workspacesData, error: workspacesError } = useLocalWorkspaces();
  const workspaceParents = workspacesData?.workspaceParents ?? [];
  const { mutate: addWorkspaces } = useAddWorkspaces();
  const { mutate: removeWorkspace } = useRemoveWorkspace();
  const { mutate: addWorkspaceParents } = useAddWorkspaceParents();
  const { mutate: removeWorkspaceParent } = useRemoveWorkspaceParent();
  const { workspaces } = useResolvedWorkspaces();
  const workspacesUnsupportedMessage = getWorkspacesUnsupportedMessage(
    workspacesError,
    t,
  );
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);

  const { mutate: createConversation, isPending } = useCreateConversation();
  const isCreatingElsewhere = useIsCreatingConversation();
  const isCreating = isPending || isCreatingElsewhere;

  React.useEffect(() => {
    if (!open || browserOpen || manageOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, browserOpen, manageOpen]);

  React.useEffect(() => {
    if (!open || browserOpen || manageOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, browserOpen, manageOpen]);

  const launch = (workingDir?: string) => {
    if (isCreating) return;
    createConversation(
      { workingDir, entryPoint: "sidebar_local_menu" },
      {
        onSuccess: (data) => {
          setOpen(false);
          navigate(`/conversations/${data.conversation_id}`);
        },
      },
    );
  };

  const itemClass = cn(
    dropdownMenuRowClassName,
    "hover:bg-[#1A1610] text-[#EDE7D8] hover:text-[#FFF4B8]",
  );

  const keepPopoverOpenOnMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const toggleOpen = React.useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const showPopover = open && (!useFixedPlacement || fixedBox !== null);
  const workspaceActionsDisabled = Boolean(workspacesUnsupportedMessage);

  const fixedStyle: React.CSSProperties | undefined =
    useFixedPlacement && fixedBox
      ? {
          position: "fixed",
          top: fixedBox.top,
          left: fixedBox.left,
          width: fixedBox.width,
        }
      : undefined;

  const addWorkspacesButton = (
    <button
      type="button"
      data-testid="add-workspaces-button"
      disabled={workspaceActionsDisabled}
      onMouseDown={keepPopoverOpenOnMouseDown}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (workspaceActionsDisabled) return;
        setBrowserOpen(true);
      }}
      className={cn(itemClass, "text-[#FFD026] hover:text-[#FFF4B8] font-medium")}
    >
      <FolderPlus className="size-3.5 shrink-0 text-[#FFD026]" />
      <span>{t(I18nKey.HOME$ADD_WORKSPACES)}</span>
    </button>
  );

  const addWorkspacesControl = workspacesUnsupportedMessage ? (
    <StyledTooltip content={workspacesUnsupportedMessage} placement="top">
      <span className="block">{addWorkspacesButton}</span>
    </StyledTooltip>
  ) : (
    addWorkspacesButton
  );

  return (
    <div
      className={cn(!useFixedPlacement && "relative", className)}
      ref={popoverRef}
    >
      <span ref={triggerWrapRef} className="inline-flex">
        {trigger({
          onClick: toggleOpen,
          "aria-expanded": open,
          "aria-haspopup": "menu",
          disabled: isCreating,
        })}
      </span>

      {showPopover && (
        <div
          data-testid={popoverTestId}
          className={cn(
            NEW_CONVERSATION_DROPDOWN_SURFACE,
            !useFixedPlacement &&
              cn("absolute top-full mt-1", popoverClassName),
          )}
          style={fixedStyle}
        >
          <ul
            className={cn(
              "max-h-[40vh] overflow-y-auto sm:max-h-[280px] custom-scrollbar divide-y divide-[#1A1610]/40",
              dropdownMenuListClassName,
            )}
          >
            <li>
              <button
                type="button"
                disabled={isCreating}
                data-testid="launch-no-workspace"
                onClick={() => launch()}
                className={itemClass}
              >
                <FolderX className="size-3.5 shrink-0 text-[#8C8370]" />
                <span className="text-[#8C8370]">
                  {t(I18nKey.HOME$NO_WORKSPACE_OPTION)}
                </span>
              </button>
            </li>
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  disabled={isCreating}
                  data-testid="launch-workspace"
                  data-workspace-path={w.path}
                  onClick={() => launch(w.path)}
                  className={itemClass}
                >
                  <Folder className="size-3.5 shrink-0 text-[#FFD026]" />
                  <span className="truncate">{w.name}</span>
                </button>
              </li>
            ))}
          </ul>

          <div
            className={cn("flex flex-col pt-1 border-t border-[#201B12]", dropdownMenuListClassName)}
            data-testid="new-conversation-menu-footer"
          >
            {addWorkspacesControl}
            {(workspaces.length > 0 || workspaceParents.length > 0) && (
              <button
                type="button"
                data-testid="manage-workspaces-button"
                onMouseDown={keepPopoverOpenOnMouseDown}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setManageOpen(true);
                }}
                className={cn(itemClass, "text-[#A89F8D] hover:text-[#EDE7D8]")}
              >
                <FolderCog className="size-3.5 shrink-0 text-[#A89F8D]" />
                <span>{t(I18nKey.HOME$MANAGE_WORKSPACES)}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <FolderBrowserModal
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onAdd={(items) => addWorkspaces(items)}
        onAddParent={(items) => addWorkspaceParents(items)}
      />

      <ManageWorkspacesModal
        isOpen={manageOpen}
        workspaces={workspaces}
        workspaceParents={workspaceParents}
        onClose={() => setManageOpen(false)}
        onRemove={(path) => removeWorkspace(path)}
        onRemoveParent={(path) => removeWorkspaceParent(path)}
      />
    </div>
  );
}
