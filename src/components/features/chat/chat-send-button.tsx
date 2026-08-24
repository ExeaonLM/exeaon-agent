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
          : "cursor-pointer border-[#F3CE49] bg-[#F3CE49] hover:bg-[#e6c040]",
        buttonClassName,
      )}
      data-name="arrow-up-circle-fill"
      data-testid="submit-button"
      onClick={handleSubmit}
      disabled={disabled}
    >
      <ArrowUp
        className="w-4 h-4"
        color={disabled ? "var(--oh-muted)" : "#0B0A08"}
      />
    </button>
  );
}
