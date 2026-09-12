import { ArrowUp, Square } from "lucide-react";
import { cn } from "#/utils/utils";

export interface ChatSendButtonProps {
  buttonClassName?: string;
  handleSubmit: () => void;
  handleStop?: () => void;
  disabled: boolean;
  isRunning?: boolean;
}

export function ChatSendButton({
  buttonClassName,
  handleSubmit,
  handleStop,
  disabled,
  isRunning = false,
}: ChatSendButtonProps) {
  if (isRunning) {
    return (
      <button
        type="button"
        className={cn(
          "flex items-center justify-center rounded-full border size-8 transition-all cursor-pointer",
          "border-red-500/80 bg-red-600 hover:bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.55)] active:scale-95",
          buttonClassName,
        )}
        data-testid="stop-button"
        title="Stop Agent (Interrupt loop)"
        onClick={handleStop}
      >
        <Square className="w-3.5 h-3.5 fill-current text-white" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center rounded-full border size-8 transition-colors",
        disabled
          ? "cursor-not-allowed border-[var(--oh-muted)]"
          : "cursor-pointer border-[#FFD026] bg-[#FFD026] hover:bg-[#FFE066] shadow-[0_0_12px_rgba(255,208,38,0.45)]",
        buttonClassName,
      )}
      data-name="arrow-up-circle-fill"
      data-testid="submit-button"
      onClick={handleSubmit}
      disabled={disabled}
      title="Send Message"
    >
      <ArrowUp
        className="w-4 h-4"
        color={disabled ? "var(--oh-muted)" : "#0A0805"}
      />
    </button>
  );
}

