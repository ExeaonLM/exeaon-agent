import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechToText } from "#/hooks/use-speech-to-text";
import { focusContentEditableAtEnd } from "#/components/features/chat/utils/chat-input.utils";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { cn } from "#/utils/utils";

/**
 * Dictation (STT) mic for the composer — Voice v1. Appends each finalized
 * transcript into the contentEditable input and fires a native `input` event so
 * the composer's existing onInput handler (handleInput/syncCanSubmit/draft) runs
 * exactly as if the user typed. Renders nothing where the Web Speech API is
 * unavailable.
 */
export function MicButton({
  chatInputRef,
  disabled,
}: {
  chatInputRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
}) {
  const insert = React.useCallback(
    (text: string) => {
      const el = chatInputRef.current;
      if (!el) return;
      const existing = el.innerText ?? "";
      el.innerText = existing.trim() ? `${existing.trimEnd()} ${text}` : text;
      focusContentEditableAtEnd(el);
      // Let React's onInput (change detection, send-enable, draft) run.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [chatInputRef],
  );

  const { supported, listening, toggle } = useSpeechToText(insert);
  if (!supported) return null;

  return (
    <StyledTooltip
      content={listening ? "Stop dictation" : "Dictate"}
      placement="top"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        aria-label={listening ? "Stop dictation" : "Dictate"}
        aria-pressed={listening}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded",
          "text-[var(--oh-muted)] transition-colors hover:text-[var(--oh-foreground)]",
          "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          listening && "text-[#FFD026] animate-pulse",
        )}
      >
        {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </button>
    </StyledTooltip>
  );
}
