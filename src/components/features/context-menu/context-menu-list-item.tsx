import { cn } from "#/utils/utils";
import { dropdownMenuRowForegroundClassName } from "#/utils/dropdown-classes";

interface ContextMenuListItemProps {
  testId?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDisabled?: boolean;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
  /** Optional hover handler — used by flyout/submenu rows (e.g. the field picker). */
  onMouseEnter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ContextMenuListItem({
  children,
  testId,
  onClick,
  isDisabled,
  className,
  ref,
  onMouseEnter,
}: React.PropsWithChildren<ContextMenuListItemProps>) {
  return (
    <button
      ref={ref}
      data-testid={testId || "context-menu-list-item"}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={isDisabled}
      className={cn(
        dropdownMenuRowForegroundClassName,
        "text-nowrap",
        className,
      )}
    >
      {children}
    </button>
  );
}
