import React from "react";
import { useTranslation } from "react-i18next";
import { Folder, Trash2, FolderKanban, FolderTree } from "lucide-react";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalCloseButton } from "#/components/shared/modals/modal-close-button";
import {
  MODAL_MAX_WIDTH_VIEWPORT,
  modalWidthClassName,
} from "#/components/shared/modals/modal-body";
import { ConfirmationModal } from "#/components/shared/modals/confirmation-modal";
import { I18nKey } from "#/i18n/declaration";
import { LocalWorkspace, LocalWorkspaceParent } from "#/types/workspace";
import { cn } from "#/utils/utils";

interface ManageWorkspacesModalProps {
  isOpen: boolean;
  workspaces: LocalWorkspace[];
  workspaceParents?: LocalWorkspaceParent[];
  onClose: () => void;
  onRemove: (path: string) => void;
  onRemoveParent?: (path: string) => void;
}

type PendingRemoval =
  | { type: "workspace"; path: string; text: string }
  | { type: "parent"; path: string; text: string };

export function ManageWorkspacesModal({
  isOpen,
  workspaces,
  workspaceParents = [],
  onClose,
  onRemove,
  onRemoveParent,
}: ManageWorkspacesModalProps) {
  const { t } = useTranslation("openhands");
  const [pendingRemoval, setPendingRemoval] =
    React.useState<PendingRemoval | null>(null);

  if (!isOpen) return null;

  // Workspaces from a parent are read-only here; users remove the parent.
  const staticWorkspaces = workspaces.filter((w) => !w.parentPath);
  const dynamicWorkspacesByParent = new Map<string, LocalWorkspace[]>();
  workspaces.forEach((w) => {
    if (!w.parentPath) return;
    const list = dynamicWorkspacesByParent.get(w.parentPath) ?? [];
    list.push(w);
    dynamicWorkspacesByParent.set(w.parentPath, list);
  });

  const hasContent = staticWorkspaces.length > 0 || workspaceParents.length > 0;

  const handleConfirmRemoval = () => {
    if (!pendingRemoval) return;

    if (pendingRemoval.type === "workspace") {
      onRemove(pendingRemoval.path);
    } else {
      onRemoveParent?.(pendingRemoval.path);
    }

    setPendingRemoval(null);
  };

  return (
    <>
      <ModalBackdrop
        onClose={onClose}
        aria-label={t(I18nKey.HOME$MANAGE_WORKSPACES)}
      >
        <div
          data-testid="manage-workspaces-modal"
          className={cn(
            "flex flex-col bg-[#0D0B08] text-[#EDE7D8] border border-[#2B2316] rounded-2xl shadow-2xl overflow-hidden",
            modalWidthClassName("lg"),
            MODAL_MAX_WIDTH_VIEWPORT,
            "max-h-[75vh]",
            "animate-in fade-in zoom-in-95 duration-150 select-none",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#241F16] bg-[#14110C] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-xl bg-[#241F14] border border-[#FFD026]/40 text-[#FFD026] shadow-sm shadow-[#FFD026]/10">
                <FolderKanban className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-white">
                  {t(I18nKey.HOME$MANAGE_WORKSPACES)}
                </h2>
                <p className="text-[11px] text-[#8C8370]">
                  View and manage attached workspaces and parent roots
                </p>
              </div>
            </div>
            <ModalCloseButton onClose={onClose} />
          </div>

          {/* List */}
          <div
            className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3"
            data-testid="manage-workspaces-list"
          >
            {!hasContent && (
              <div className="px-6 py-12 text-center">
                <Folder className="size-10 text-[#595243] mx-auto mb-2 opacity-50" />
                <p className="text-xs text-[#8C8370]">
                  {t(I18nKey.HOME$MANAGE_WORKSPACES_EMPTY)}
                </p>
              </div>
            )}

            {staticWorkspaces.length > 0 && (
              <div className="rounded-xl border border-[#262016] bg-[#120F0A] overflow-hidden">
                <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-[#8C8370] font-bold border-b border-[#241F16] bg-[#14110C]">
                  Direct Workspaces
                </div>
                <ul className="divide-y divide-[#1F1B12]">
                  {staticWorkspaces.map((workspace) => (
                    <li
                      key={workspace.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A1610] transition-colors"
                      data-testid={`manage-workspaces-row-${workspace.name}`}
                    >
                      <Folder className="size-4 shrink-0 text-[#FFD026]" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-white truncate">
                          {workspace.name}
                        </span>
                        <span className="text-[11px] font-mono text-[#8C8370] truncate">
                          {workspace.path}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingRemoval({
                            type: "workspace",
                            path: workspace.path,
                            text: t(I18nKey.HOME$REMOVE_WORKSPACE_CONFIRMATION, {
                              name: workspace.name,
                            }),
                          })
                        }
                        aria-label={t(I18nKey.HOME$REMOVE_WORKSPACE)}
                        data-testid={`manage-workspaces-remove-${workspace.name}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                        <span>{t(I18nKey.HOME$REMOVE_WORKSPACE)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {workspaceParents.length > 0 && (
              <div data-testid="manage-workspaces-parents-section" className="rounded-xl border border-[#262016] bg-[#120F0A] overflow-hidden">
                <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-[#8C8370] font-bold border-b border-[#241F16] bg-[#14110C] flex items-center gap-1.5">
                  <FolderTree className="size-3 text-[#3880F6]" />
                  {t(I18nKey.HOME$WORKSPACE_PARENTS)}
                </div>
                <ul className="divide-y divide-[#1F1B12]">
                  {workspaceParents.map((parent) => {
                    const children =
                      dynamicWorkspacesByParent.get(parent.path) ?? [];
                    return (
                      <li
                        key={parent.id}
                        className="p-3 hover:bg-[#16130E] transition-colors"
                        data-testid={`manage-workspaces-parent-row-${parent.name}`}
                      >
                        <div className="flex items-center gap-3">
                          <FolderTree className="size-4 shrink-0 text-[#3880F6]" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-semibold text-white truncate">
                              {parent.name}
                            </span>
                            <span className="text-[11px] font-mono text-[#8C8370] truncate">
                              {parent.path}
                            </span>
                          </div>
                          {onRemoveParent && (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingRemoval({
                                  type: "parent",
                                  path: parent.path,
                                  text: t(
                                    I18nKey.HOME$REMOVE_WORKSPACE_PARENT_CONFIRMATION,
                                    {
                                      name: parent.name,
                                      count: children.length,
                                    },
                                  ),
                                })
                              }
                              aria-label={t(
                                I18nKey.HOME$REMOVE_WORKSPACE_PARENT,
                              )}
                              data-testid={`manage-workspaces-remove-parent-${parent.name}`}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                              <span>
                                {t(I18nKey.HOME$REMOVE_WORKSPACE_PARENT)}
                              </span>
                            </button>
                          )}
                        </div>
                        {children.length > 0 && (
                          <ul className="mt-2 pl-6 space-y-1 border-l border-[#241F16] ml-2">
                            {children.map((child) => (
                              <li
                                key={child.id}
                                className="flex items-center gap-2 text-xs text-[#A89F8D]"
                                data-testid={`manage-workspaces-child-${child.name}`}
                              >
                                <Folder className="size-3 shrink-0 text-[#FFD026]/70" />
                                <span className="truncate">{child.name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2.5 px-6 py-3.5 border-t border-[#241F16] bg-[#14110C]">
            <button
              type="button"
              onClick={onClose}
              data-testid="manage-workspaces-done"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#FFD026] text-black hover:bg-[#FFE066] transition-all shadow-md shadow-[#FFD026]/20 cursor-pointer"
            >
              {t(I18nKey.HOME$DONE)}
            </button>
          </div>
        </div>
      </ModalBackdrop>

      {pendingRemoval && (
        <ConfirmationModal
          text={pendingRemoval.text}
          onConfirm={handleConfirmRemoval}
          onCancel={() => setPendingRemoval(null)}
        />
      )}
    </>
  );
}
