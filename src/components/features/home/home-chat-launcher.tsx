import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { CustomChatInput } from "#/components/features/chat/custom-chat-input";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { isCloudAppServerBackend } from "#/api/backend-registry/active-store";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useLocalWorkspaces } from "#/hooks/query/use-local-workspaces";
import { useModelInterceptor } from "#/hooks/chat/use-model-interceptor";
import { useLlmConfigured } from "#/hooks/use-llm-configured";
import { HOME_PROMPT_DRAFT_KEY } from "#/hooks/chat/use-draft-persistence";
import { useChatAttachmentUpload } from "#/hooks/chat/use-chat-attachment-upload";
import { useConversationStore } from "#/stores/conversation-store";
import type { WorkspaceMode } from "#/api/conversation-metadata-store";
import { setPendingTaskAttachments } from "#/stores/pending-task-attachments-store";
import { enqueueHomeTaskPendingMessage } from "#/utils/enqueue-home-task-pending-message";
import { sendMessageWithAttachments } from "#/utils/send-message-with-attachments";
import { useNavigation } from "#/context/navigation-context";
import { useIsCreatingConversation } from "#/hooks/use-is-creating-conversation";
import { Branch, GitRepository } from "#/types/git";
import { Provider } from "#/types/settings";
import { LocalWorkspace } from "#/types/workspace";
import { I18nKey } from "#/i18n/declaration";
import {
  displayErrorToast,
  TOAST_OPTIONS,
} from "#/utils/custom-toast-handlers";
import { getWorkspacesUnsupportedMessage } from "#/utils/workspaces-compatibility";
import type { PluginSpec } from "#/api/conversation-service/agent-server-conversation-service.types";
import { PluginPickerModal } from "#/components/features/plugins/plugin-picker-modal";
import { PinnedAutomationsDashboard } from "./featured-automations/pinned-automations-dashboard";
import { RunningAutomationsList } from "./featured-automations/running-automations-list";
import { HomeHeaderTitle } from "./home-header/home-header-title";
import { Plus, Folder, Puzzle } from "lucide-react";
import { OpenWorkspaceDialog } from "./open-workspace-dialog";
import { OpenRepositoryDialog } from "./open-repository-dialog";
import { HomeGitControlBarPreview } from "./home-git-control-bar-preview";
import { WorkspacePicker } from "./workspace-picker";
import { ConnectGitHubButton } from "./connect-github-button";
import { WorkspaceModeSelector } from "#/components/features/chat/workspace-mode-selector";
import { useHomeStore } from "#/stores/home-store";
import {
  isNativeDialogAvailable,
  pickWorkspaceFolderNative,
} from "#/utils/pick-workspace-folder";

export function HomeChatLauncher() {
  const { t } = useTranslation("openhands");
  const { backend } = useActiveBackend();
  const { navigate } = useNavigation();
  // The Exeaon agent runtime is ALWAYS the local sovereign engine, even when a
  // cloud backend is "active" for identity/billing (the Exeaon gateway is not an
  // OpenHands app-server — see isCloudAppServerBackend, the seam for a future
  // real cloud app-server; false today). Gate the local-workspace flow on the
  // runtime, not on backend.kind: otherwise signing into Exeaon Cloud
  // (kind:"cloud") hides the workspace picker even though the agent still writes
  // to a local folder on this machine.
  const isLocal = !isCloudAppServerBackend();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingWorkspace, setPendingWorkspace] =
    useState<LocalWorkspace | null>(null);
  const [pendingRepository, setPendingRepository] =
    useState<GitRepository | null>(null);
  const [pendingBranch, setPendingBranch] = useState<Branch | null>(null);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>("local_repo");
  const [selectedPlugins, setSelectedPlugins] = useState<PluginSpec[]>([]);
  const [isPluginPickerOpen, setIsPluginPickerOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  const { mutateAsync: createConversation, isPending } =
    useCreateConversation();
  const isCreatingElsewhere = useIsCreatingConversation();
  const isCreating = isPending || isCreatingElsewhere;
  const { isConfigured: isLlmConfigured, isLoading: isLlmConfigLoading } =
    useLlmConfigured();
  // Block sending entirely when there's no usable LLM; the banner above the
  // launcher (rendered by the home route) explains it and offers setup.
  const llmBlocked = !isLlmConfigLoading && !isLlmConfigured;
  const { images, files, imagesMarkedUploadAsFile, clearAllFiles } =
    useConversationStore();
  const { handleUpload } = useChatAttachmentUpload();
  const { error: workspacesError } = useLocalWorkspaces({ enabled: isLocal });
  const workspacesUnsupportedMessage = isLocal
    ? getWorkspacesUnsupportedMessage(workspacesError, t)
    : null;

  const recentWorkspaces = useHomeStore((state) => state.recentWorkspaces);
  const addRecentWorkspace = useHomeStore((state) => state.addRecentWorkspace);

  // Default a new chat to the most-recent workspace (like Claude: a new chat
  // opens in your last workspace). Runs once, and only when the user hasn't
  // already picked one — so clearing to a scratch workspace isn't undone.
  const didInitWorkspaceRef = useRef(false);
  useEffect(() => {
    if (didInitWorkspaceRef.current || !isLocal) return;
    if (pendingWorkspace) {
      didInitWorkspaceRef.current = true;
      return;
    }
    if (recentWorkspaces.length > 0) {
      setPendingWorkspace(recentWorkspaces[0]);
      setWorkspaceMode("local_repo");
      didInitWorkspaceRef.current = true;
    }
  }, [isLocal, pendingWorkspace, recentWorkspaces]);

  const selectWorkspace = (workspace: LocalWorkspace | null) => {
    setPendingWorkspace(workspace);
    setPendingRepository(null);
    setPendingBranch(null);
    setPendingProvider(null);
    setWorkspaceMode("local_repo");
    if (workspace) addRecentWorkspace(workspace);
  };

  // "Open folder…" opens the native OS picker (folder create + rename come free
  // from the OS). Falls back to the in-app browser when the native dialog isn't
  // available — e.g. web dev, or before the Tauri side is rebuilt with the
  // dialog plugin.
  const handleOpenFolder = async () => {
    if (isNativeDialogAvailable()) {
      try {
        const workspace = await pickWorkspaceFolderNative();
        if (workspace) selectWorkspace(workspace);
        return;
      } catch {
        // Native dialog failed to open — fall through to the in-app browser.
      }
    }
    setIsDialogOpen(true);
  };

  const hasSelection = isLocal
    ? !!pendingWorkspace
    : !!pendingRepository && !!pendingBranch;

  const handleSubmit = (message: string) => {
    const trimmed = message.trim();
    const hasAttachments = images.length > 0 || files.length > 0;
    if ((!trimmed && !hasAttachments) || isCreating) return;

    // Safety net: the input is disabled when there's no usable LLM, but never
    // create a conversation that can't run (it would fail with a cryptic
    // API-key error on the first turn).
    if (llmBlocked) return;

    const attachmentSnapshot = {
      images: [...images],
      files: [...files],
    };

    // Workspace/repo are optional — match the "Start from scratch" flow which
    // creates a conversation with no working dir and no repo. Build the
    // payload from whatever is selected.
    // When attachments are present the first user message is sent afterward
    // via sendMessageWithAttachments / flushPendingTaskAttachments. Passing
    // query here would create a duplicate text-only initial_message.
    let variables: Parameters<typeof createConversation>[0] = {
      query: hasAttachments ? undefined : trimmed || undefined,
      entryPoint: "home_chat_launcher",
    };
    if (isLocal && pendingWorkspace) {
      // Bump this workspace to the top of the recent list so the next new chat
      // defaults to it.
      addRecentWorkspace(pendingWorkspace);
      variables = {
        ...variables,
        workingDir: pendingWorkspace.path,
        workspaceMode,
      };
    } else if (!isLocal && pendingRepository && pendingBranch) {
      variables = {
        ...variables,
        repository: {
          name: pendingRepository.full_name,
          gitProvider: pendingRepository.git_provider,
          branch: pendingBranch.name,
        },
      };
    }

    // Explicitly-attached plugins are additive on top of any ambient set and
    // are resolved from git at run time. Omitted entirely when none selected so
    // nothing attaches unless the user picked it.
    if (selectedPlugins.length > 0) {
      variables = { ...variables, plugins: selectedPlugins };
    }

    // Loading toast gives the user a clear signal that the request is in
    // flight; dismissed precisely once the mutation resolves.
    const toastId = toast.loading(
      t(I18nKey.HOME$CREATING_CONVERSATION),
      TOAST_OPTIONS,
    );

    void (async () => {
      try {
        const data = await createConversation(variables);
        toast.dismiss(toastId);
        try {
          sessionStorage.removeItem(HOME_PROMPT_DRAFT_KEY);
        } catch {
          // sessionStorage not available
        }
        const targetConversationId = data.conversation_id;
        const isTaskConversation = targetConversationId.startsWith("task-");

        if (hasAttachments) {
          // Cloud sandboxes provision asynchronously; uploads and the first
          // message must target the runtime URL, not the bundled local server.
          const shouldDeferAttachments = !isLocal || isTaskConversation;

          if (shouldDeferAttachments) {
            const taskId =
              data.task_id ??
              (isTaskConversation
                ? targetConversationId.slice("task-".length)
                : null);

            if (!taskId) {
              displayErrorToast(null);
              return;
            }

            setPendingTaskAttachments(taskId, {
              content: trimmed,
              images: attachmentSnapshot.images,
              files: attachmentSnapshot.files,
              imagesMarkedUploadAsFile: [...imagesMarkedUploadAsFile],
            });
            clearAllFiles();
            await enqueueHomeTaskPendingMessage({
              conversationId: targetConversationId,
              text: trimmed,
              images: attachmentSnapshot.images,
              imagesMarkedUploadAsFile,
            });
            navigate(`/conversations/${targetConversationId}`);
            return;
          } else {
            try {
              await sendMessageWithAttachments({
                conversationId: targetConversationId,
                content: trimmed,
                images: attachmentSnapshot.images,
                files: attachmentSnapshot.files,
                imagesMarkedUploadAsFile,
                t,
              });
              clearAllFiles();
            } catch (error) {
              displayErrorToast(error instanceof Error ? error.message : null);
              return;
            }
          }
        }

        if (isTaskConversation && trimmed) {
          await enqueueHomeTaskPendingMessage({
            conversationId: targetConversationId,
            text: trimmed,
            images: [],
            imagesMarkedUploadAsFile: [],
          });
        }

        navigate(`/conversations/${targetConversationId}`);
      } catch (error) {
        toast.dismiss(toastId);
        displayErrorToast(error instanceof Error ? error.message : null);
      }
    })();
  };

  // Without this wrapper a `/model NAME` typed here would become the first
  // user message of the new conversation. The interceptor activates the
  // profile globally (null conversationId path) so the next conversation
  // launches with it.
  const handleSubmitWithModelGuard = useModelInterceptor(null, handleSubmit);

  return (
    <div
      data-testid="home-chat-launcher"
      className="flex w-full flex-col items-center pt-[max(4rem,28vh)] pb-10"
    >
      <div className="flex w-full max-w-[800px] flex-col gap-4 md:px-4">
        <div className="flex w-full justify-center">
          <HomeHeaderTitle />
        </div>

        <div className="w-full">
          <CustomChatInput
            onSubmit={handleSubmitWithModelGuard}
            onFilesPaste={handleUpload}
            disabled={isCreating || llmBlocked}
          />
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2">
          {isLocal ? (
            <>
              <WorkspacePicker
                value={pendingWorkspace}
                onChange={selectWorkspace}
                onOpenFolder={handleOpenFolder}
                disabled={isCreating}
                unsupportedMessage={workspacesUnsupportedMessage}
              />
              {pendingWorkspace && (
                <WorkspaceModeSelector
                  value={workspaceMode}
                  // The Exeaon runtime is always local, so the mode reads
                  // "Local Repo"/"New Worktree" — never "Cloud Repo", which
                  // would wrongly imply work runs in the cloud when signed in.
                  backendKind="local"
                  onChange={setWorkspaceMode}
                />
              )}
              <ConnectGitHubButton />
            </>
          ) : (
            hasSelection && (
              <HomeGitControlBarPreview
                workspace={pendingWorkspace}
                repository={pendingRepository}
                branch={pendingBranch}
                provider={pendingProvider}
                workspaceMode={workspaceMode}
                backendKind={backend.kind}
                onRepoClick={() => setIsDialogOpen(true)}
                onWorkspaceModeChange={setWorkspaceMode}
              />
            )
          )}
          {/* One "+" menu instead of a row of buttons: Add folder (workspace)
              + Plugins. Cleaner, and not the OpenHands two-button layout. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPlusMenuOpen((o) => !o)}
              disabled={isCreating}
              aria-label="Add"
              className="flex size-9 items-center justify-center rounded-full border border-[var(--oh-border)] text-[var(--oh-muted)] transition-colors hover:border-[#F3CE49]/50 hover:text-[var(--oh-fg)] disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
            {plusMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPlusMenuOpen(false)}
                />
                <div className="absolute left-0 top-full z-50 mt-2 flex w-52 flex-col gap-0.5 rounded-xl border border-[var(--oh-border)] bg-[#141413] p-1.5 shadow-2xl">
                  {/* Local uses the dedicated workspace picker; only cloud needs
                      the repository entry here. */}
                  {!isLocal && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        setIsDialogOpen(true);
                      }}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--oh-foreground)] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                    >
                      <Folder className="size-4 text-[var(--oh-muted)]" />
                      <span>Add repository</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setIsPluginPickerOpen(true);
                    }}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-[var(--oh-foreground)] transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <span className="flex items-center gap-2.5">
                      <Puzzle className="size-4 text-[var(--oh-muted)]" />
                      Plugins
                    </span>
                    {selectedPlugins.length > 0 && (
                      <span className="text-[11px] font-semibold text-[#F3CE49]">
                        {selectedPlugins.length}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 flex w-full flex-col gap-8">
          {/* Recommended flows templates hidden -- they were OpenHands' default
              catalog (GitHub/Slack "@openhands" agents), off-brand for Exeaon.
              The user's own pinned/running flows stay. */}
          <PinnedAutomationsDashboard />
          <RunningAutomationsList />
        </div>
      </div>

      {isLocal ? (
        <OpenWorkspaceDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onConfirm={(workspace) => selectWorkspace(workspace)}
        />
      ) : (
        <OpenRepositoryDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onConfirm={({ repository, branch, provider }) => {
            setPendingRepository(repository);
            setPendingBranch(branch);
            setPendingProvider(provider ?? repository.git_provider);
            setPendingWorkspace(null);
            setWorkspaceMode("local_repo");
          }}
        />
      )}

      {isPluginPickerOpen && (
        <PluginPickerModal
          selected={selectedPlugins}
          onChange={setSelectedPlugins}
          onClose={() => setIsPluginPickerOpen(false)}
        />
      )}
    </div>
  );
}
