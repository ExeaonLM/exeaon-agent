import { cn } from "#/utils/utils";
import {
  dropdownMenuRowGapClassName,
  dropdownMenuRowIconWrapperClassName,
} from "#/utils/dropdown-classes";

interface ConversationNameContextMenuIconTextProps {
  icon: React.ReactNode;
  text: string;
  className?: string;
  shortcut?: string;
  variant?: "default" | "danger";
}

export function ConversationNameContextMenuIconText({
  icon,
  text,
  className,
  shortcut,
  variant = "default",
}: ConversationNameContextMenuIconTextProps) {
  const isDanger = variant === "danger";

  return (
    <div
      className={cn(
        "flex min-w-0 w-full items-center justify-between",
        dropdownMenuRowGapClassName,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            dropdownMenuRowIconWrapperClassName,
            isDanger ? "text-red-400 group-hover:text-red-300" : "text-[#B8AF9E] group-hover:text-[#FFD026]",
          )}
          aria-hidden
        >
          {icon}
        </span>
        <span
          className={cn(
            "min-w-0 truncate font-medium",
            isDanger ? "text-red-400 group-hover:text-red-300" : "text-[#EDE7D8] group-hover:text-[#FFF4B8]",
          )}
        >
          {text}
        </span>
      </div>
      {shortcut && (
        <kbd className="ml-3 shrink-0 rounded border border-[#2E281F] bg-[#1A1712] px-1.5 py-0.5 text-[10px] font-mono text-[#8C8370] group-hover:text-[#B8AF9E]">
          {shortcut}
        </kbd>
      )}
    </div>
  );
}
