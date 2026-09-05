import React, { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "#/utils/utils";
import {
  dropdownMenuRowClassName,
  dropdownMenuRowIconClassName,
} from "#/utils/dropdown-classes";

type IconComponent = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

export interface SubmenuOption {
  label: string;
  selected: boolean;
  onSelect: () => void;
  icon?: IconComponent;
  testId?: string;
  /** Keep the flyout open after selecting (multi-select toggles). */
  keepOpen?: boolean;
}

/**
 * A collapsed menu row in Claude's style: shows its label with the current value
 * right-aligned and a chevron, opening a flyout submenu of options on hover (or
 * click). Keeps the parent menu compact instead of expanding every group inline.
 */
export function MenuSubmenuRow({
  icon: Icon,
  label,
  value,
  options,
  onCloseMenu,
  testId,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  options: SubmenuOption[];
  onCloseMenu: () => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group",
          dropdownMenuRowClassName,
          "text-[var(--oh-foreground)]",
        )}
      >
        <Icon
          className={cn("h-3.5 w-3.5", dropdownMenuRowIconClassName)}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="ml-auto max-w-[45%] shrink-0 truncate text-[var(--oh-muted)]">
          {value}
        </span>
        <ChevronRight
          className="ml-1 h-3.5 w-3.5 shrink-0 text-[var(--oh-muted)]"
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-full top-0 z-50 ml-1 min-w-[190px] rounded-xl border border-[#2B2316] bg-[#0E0C09]/95 p-1.5 shadow-2xl backdrop-blur-md"
        >
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="menuitemradio"
              aria-checked={opt.selected}
              data-testid={opt.testId}
              onClick={() => {
                opt.onSelect();
                if (opt.keepOpen) return;
                setOpen(false);
                onCloseMenu();
              }}
              className={cn(
                "group",
                dropdownMenuRowClassName,
                "text-[var(--oh-foreground)]",
              )}
            >
              {opt.icon ? (
                <opt.icon
                  className={cn("h-3.5 w-3.5", dropdownMenuRowIconClassName)}
                  aria-hidden
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-left">
                {opt.label}
              </span>
              {opt.selected ? (
                <Check
                  className="ml-auto h-3.5 w-3.5 shrink-0 text-white"
                  aria-hidden
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
