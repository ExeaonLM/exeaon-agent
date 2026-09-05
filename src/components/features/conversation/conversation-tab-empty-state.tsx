import type { ReactNode } from "react";
import { cn } from "#/utils/utils";

type ConversationTabEmptyStateProps = {
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * Shared empty state for right-drawer conversation tabs: small muted icon,
 * centered caption, optional action (use {@link BrandButton} variant="secondary").
 */
export function ConversationTabEmptyState({
  icon,
  children,
  action,
  className,
}: ConversationTabEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full h-full p-10 gap-4 text-center",
        className,
      )}
    >
      <div
        className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)]/50 text-[var(--oh-muted)] shadow-sm [&_svg]:size-6 [&_svg]:max-h-6 [&_svg]:max-w-6 [&_svg]:shrink-0"
        aria-hidden
      >
        {icon}
      </div>
      <p className="max-w-xs text-center text-sm font-normal leading-relaxed text-[var(--oh-muted)]">
        {children}
      </p>
      {action ? <div className="flex justify-center pt-1">{action}</div> : null}
    </div>
  );
}
