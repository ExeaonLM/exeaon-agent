import { ArrowUp } from "lucide-react";
import { cn } from "#/utils/utils";

export interface ChatSendButtonProps {
  buttonClassName: string;
  handleSubmit: () => void;
  disabled: boolean;
}

export function ChatSendButton({
  buttonClassName,
  handleSubmit,
  disabled,
}: ChatSendButtonProps) {
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
    >
      <ArrowUp
        className="w-4 h-4"
        color={disabled ? "var(--oh-muted)" : "#0A0805"}
      />
    </button>
  );
}
