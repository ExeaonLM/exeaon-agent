import React, { useEffect, useRef } from "react";
import { useChatInputLogic } from "#/hooks/chat/use-chat-input-logic";
import { useFileHandling } from "#/hooks/chat/use-file-handling";
import { useGripResize } from "#/hooks/chat/use-grip-resize";
import { useChatInputEvents } from "#/hooks/chat/use-chat-input-events";
import { useChatSubmission } from "#/hooks/chat/use-chat-submission";
import { useSlashCommand } from "#/hooks/chat/use-slash-command";
import { ChatInputGrip } from "./components/chat-input-grip";
import { ChatInputContainer } from "./components/chat-input-container";
import { HiddenFileInput } from "./components/hidden-file-input";
import { ArrowRight, Pencil, Trash2, ChevronDown, Terminal as TerminalIcon, Square } from "lucide-react";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { matchesPendingConversationId } from "#/utils/pending-task-message-link";
import { useSendMessage } from "#/hooks/use-send-message";
import { useAgentState } from "#/hooks/use-agent-state";
import { AgentState } from "#/types/agent-state";
import { useCommandStore } from "#/stores/command-store";
import { useUnifiedPauseConversation } from "#/hooks/mutation/use-unified-stop-conversation";
import { useConversationStore } from "#/stores/conversation-store";
import { cn } from "#/utils/utils";

export interface CustomChatInputProps {
  disabled?: boolean;
  isNewConversationPending?: boolean;
  hasStartedConversation?: boolean;
  showButton?: boolean;
  onSubmit: (message: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onFilesPaste?: (
    files: File[],
    options?: import("#/hooks/chat/use-chat-attachment-upload").ChatAttachmentUploadOptions,
  ) => void;
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
  buttonClassName?: React.HTMLAttributes<HTMLButtonElement>["className"];
}

export function CustomChatInput({
  disabled = false,
  isNewConversationPending = false,
  hasStartedConversation,
  showButton = true,
  onSubmit,
  onFocus,
  onBlur,
  onFilesPaste,
  className = "",
  buttonClassName = "",
}: CustomChatInputProps) {
  const [canSubmit, setCanSubmit] = React.useState(false);
  const {
    submittedMessage,
    clearAllFiles,
    setShouldHideSuggestions,
    setSubmittedMessage,
    images,
    files,
  } = useConversationStore();

  // Note: we intentionally do NOT disable the input when the conversation is
  // in an ERROR/STUCK execution state. Users should be able to send a follow-up
  // message to recover the conversation; the message will be delivered
  // immediately via the WebSocket if connected, or queued via REST otherwise.
  const isDisabled = disabled;

  // Always call the latest `onSubmit` without making the effect re-run when
  // its identity changes. `onSubmit` (typically `handleSendMessage`) is a
  // fresh function on every parent render, and the parent re-renders
  // whenever the pending-message queue updates synchronously inside
  // `onSubmit` itself. Listing it in the dep array caused the effect to
  // fire twice — once for the original submit and again from the
  // mid-submit re-render, before `setSubmittedMessage(null)` was applied —
  // producing a duplicate "Sending…" bubble.
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Listen to submittedMessage state changes
  useEffect(() => {
    if (!submittedMessage || disabled) {
      return;
    }
    onSubmitRef.current(submittedMessage);
    setSubmittedMessage(null);
  }, [submittedMessage, disabled, setSubmittedMessage]);

  // Custom hooks
  const {
    chatInputRef,
    messageToSend,
    checkIsContentEmpty,
    clearEmptyContentHandler,
    saveDraft,
  } = useChatInputLogic();

  const syncCanSubmit = React.useCallback(() => {
    const text = chatInputRef.current?.innerText ?? "";
    const hasAttachments = images.length > 0 || files.length > 0;
    setCanSubmit(text.trim().length > 0 || hasAttachments);
  }, [chatInputRef, images, files]);

  const {
    fileInputRef,
    chatContainerRef,
    isDragOver,
    handleFileIconClick,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileHandling(onFilesPaste);

  const {
    gripRef,
    isGripVisible,
    isGripDragging,
    canResize,
    handleTopEdgeClick,
    smartResize,
    handleGripMouseDown,
    handleGripTouchStart,
    increaseHeightForEmptyContent,
    resetManualResize,
  } = useGripResize(
    chatInputRef as React.RefObject<HTMLDivElement | null>,
    messageToSend,
  );

  const { handleSubmit } = useChatSubmission(
    chatInputRef as React.RefObject<HTMLDivElement | null>,
    fileInputRef as React.RefObject<HTMLInputElement | null>,
    smartResize,
    onSubmit,
    resetManualResize,
  );
  const handleSubmitAndSync = React.useCallback(() => {
    handleSubmit();
    syncCanSubmit();
  }, [handleSubmit, syncCanSubmit]);

  const { handleInput, handlePaste, handleKeyDown, handleBlur, handleFocus } =
    useChatInputEvents(
      chatInputRef as React.RefObject<HTMLDivElement | null>,
      smartResize,
      increaseHeightForEmptyContent,
      checkIsContentEmpty,
      clearEmptyContentHandler,
      onFocus,
      onBlur,
    );

  const {
    isMenuOpen: isSlashMenuOpen,
    filteredItems: slashItems,
    selectedIndex: slashSelectedIndex,
    updateSlashMenu,
    selectItem: selectSlashItem,
    handleSlashKeyDown,
    closeMenu: closeSlashMenu,
  } = useSlashCommand(chatInputRef as React.RefObject<HTMLDivElement | null>);

  // Cleanup: reset suggestions visibility when component unmounts
  useEffect(
    () => () => {
      setShouldHideSuggestions(false);
      clearAllFiles();
    },
    [setShouldHideSuggestions, clearAllFiles],
  );
  useEffect(() => {
    syncCanSubmit();
  }, [syncCanSubmit, images.length, files.length]);

  const { conversationId } = useOptionalConversationId();
  const pendingMessages = useOptimisticUserMessageStore(
    (state) => state.pendingMessages,
  );
  const removePendingMessage = useOptimisticUserMessageStore(
    (state) => state.removePendingMessage,
  );
  const setMessageToSend = useConversationStore(
    (state) => state.setMessageToSend,
  );
  const { send } = useSendMessage();

  const activePending = React.useMemo(
    () =>
      conversationId
        ? pendingMessages.filter((message) =>
            matchesPendingConversationId(
              conversationId,
              message.conversationId,
            ),
          )
        : [],
    [pendingMessages, conversationId],
  );

  const { curAgentState } = useAgentState();
  const commands = useCommandStore((state) => state.commands);
  const [isTaskExpanded, setIsTaskExpanded] = React.useState(true);
  const unifiedPauseMutation = useUnifiedPauseConversation();

  const isTaskRunning =
    Boolean(conversationId) &&
    (curAgentState === AgentState.RUNNING || curAgentState === AgentState.LOADING);

  const activeCommand = React.useMemo(() => {
    const inputCommands = commands.filter((c) => c.type === "input");
    return (
      inputCommands[inputCommands.length - 1]?.content ||
      "Agent execution in progress..."
    );
  }, [commands]);

  const handleStopRunningTask = async () => {
    if (conversationId) {
      await unifiedPauseMutation.mutateAsync({ conversationId });
    }
  };

  const handleEditPending = (msg: { id: string; text: string }) => {
    removePendingMessage(msg.id);
    setMessageToSend(msg.text);
  };

  const handleSendPendingNow = async (id: string) => {
    const msg = activePending.find((m) => m.id === id);
    if (msg && conversationId) {
      removePendingMessage(id);
      await send({
        message: msg.text,
        conversationId,
      });
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Hidden file input */}
      <HiddenFileInput
        fileInputRef={fileInputRef}
        onChange={handleFileInputChange}
      />

      {/* Running Tasks Bar (Antigravity-Style) */}
      {isTaskRunning && (
        <div className="mb-2 w-full overflow-hidden rounded-xl border border-[var(--oh-border)] bg-[var(--oh-bg-editor-sidebar)]/95 backdrop-blur-md shadow-xl transition-all">
          <div
            onClick={() => setIsTaskExpanded((prev) => !prev)}
            className="flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-[var(--oh-surface-raised)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-xs font-medium text-[var(--cool-grey-100)]">
                1 task running
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-[var(--cool-grey-400)] transition-transform duration-200",
                isTaskExpanded && "rotate-180",
              )}
            />
          </div>

          {isTaskExpanded && (
            <div className="border-t border-[var(--oh-border)] px-3.5 py-2 bg-[var(--oh-surface-raised)]/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 font-mono text-xs text-[var(--cool-grey-200)]">
                <TerminalIcon className="w-3.5 h-3.5 text-[var(--cool-grey-400)] shrink-0" />
                <span className="truncate">{activeCommand}</span>
              </div>
              <button
                type="button"
                onClick={handleStopRunningTask}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:text-red-300 text-[11px] font-medium transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
                title="Stop running command and unlock terminal"
              >
                <Square className="w-3 h-3 fill-current text-red-400" />
                <span>Stop Task</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Queued Messages Bar (Antigravity-Style) */}
      {activePending.length > 0 && (
        <div className="mb-2 w-full overflow-hidden rounded-xl border border-[var(--oh-border)] bg-[var(--oh-bg-editor-sidebar)]/95 backdrop-blur-md shadow-xl transition-all">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--oh-border)] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--cool-grey-100)]">
                Queued Messages
              </span>
              <span className="flex items-center justify-center rounded-full bg-[var(--cool-grey-800)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--cool-grey-200)]">
                {activePending.length}
              </span>
              <span className="text-[11px] text-[var(--cool-grey-400)]">
                · Sends after agent finishes working
              </span>
            </div>
          </div>
          <div className="divide-y divide-[var(--oh-border)] p-1">
            {activePending.map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[var(--cool-grey-200)] hover:bg-[var(--oh-surface-raised)] group transition-colors"
              >
                <span className="truncate flex-1 mr-3 font-normal">{msg.text}</span>
                <div className="flex items-center gap-1 text-[var(--cool-grey-400)]">
                  <button
                    type="button"
                    onClick={() => handleSendPendingNow(msg.id)}
                    className="p-1 rounded hover:bg-[var(--oh-surface-raised)] hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Send now"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditPending(msg)}
                    className="p-1 rounded hover:bg-white/10 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Edit message"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePendingMessage(msg.id)}
                    className="p-1 rounded hover:bg-white/10 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container with grip */}
      <div className="relative w-full">
        <ChatInputGrip
          gripRef={gripRef}
          isGripVisible={isGripVisible}
          isGripDragging={isGripDragging}
          canResize={canResize}
          handleTopEdgeClick={handleTopEdgeClick}
          handleGripMouseDown={handleGripMouseDown}
          handleGripTouchStart={handleGripTouchStart}
        />

        <ChatInputContainer
          chatContainerRef={chatContainerRef}
          isDragOver={isDragOver}
          disabled={isDisabled}
          canSubmit={canSubmit}
          hasStartedConversation={hasStartedConversation}
          isNewConversationPending={isNewConversationPending}
          showButton={showButton}
          buttonClassName={buttonClassName}
          chatInputRef={chatInputRef}
          handleFileIconClick={handleFileIconClick}
          handleSubmit={handleSubmitAndSync}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onInput={() => {
            handleInput();
            updateSlashMenu();
            saveDraft();
            syncCanSubmit();
          }}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (handleSlashKeyDown(e)) return;
            handleKeyDown(e, isDisabled, handleSubmitAndSync);
          }}
          onFocus={handleFocus}
          onBlur={() => {
            handleBlur();
            closeSlashMenu();
            syncCanSubmit();
          }}
          isSlashMenuOpen={isSlashMenuOpen}
          slashItems={slashItems}
          slashSelectedIndex={slashSelectedIndex}
          onSlashSelect={selectSlashItem}
        />
      </div>
    </div>
  );
}
