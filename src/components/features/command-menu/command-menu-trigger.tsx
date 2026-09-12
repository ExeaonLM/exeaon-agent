import React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { useCommandMenuStore } from "#/stores/command-menu-store";
import { cn } from "#/utils/utils";
import { SidebarCollapsedIconSlot } from "#/components/features/sidebar/sidebar-collapsed-icon-slot";
import {
  SIDEBAR_ICON_SLOT_CLASS,
  sidebarNavLabelClassName,
  sidebarNavRowClassName,
} from "#/components/features/sidebar/sidebar-layout";

interface CommandMenuTriggerProps {
  collapsed: boolean;
}

const COMMAND_MENU_TRIGGER_TEST_ID = "command-menu-trigger";
const COMMAND_MENU_TRIGGER_ICON_SIZE = 18;

export function CommandMenuTrigger({ collapsed }: CommandMenuTriggerProps) {
  const { t } = useTranslation("openhands");
  const open = useCommandMenuStore((state) => state.open);
  const label = t(I18nKey.COMMAND_MENU$OPEN_LABEL);

  const trigger = (
    <button
      type="button"
      data-testid={COMMAND_MENU_TRIGGER_TEST_ID}
      aria-label={label}
      onClick={open}
      className={cn(
        sidebarNavRowClassName({ collapsed }),
        collapsed
          ? "cursor-pointer"
          : "group justify-between rounded-xl border border-[#2A241A] bg-[#14120D] px-3 py-2 text-[#EDE7D8] shadow-inner hover:border-[#FFD026]/40 hover:bg-[#1A1712] hover:text-[#FFF4B8] transition-all duration-150",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {collapsed ? (
          <SidebarCollapsedIconSlot active={false}>
            <Search
              width={COMMAND_MENU_TRIGGER_ICON_SIZE}
              height={COMMAND_MENU_TRIGGER_ICON_SIZE}
            />
          </SidebarCollapsedIconSlot>
        ) : (
          <span
            className={cn(
              SIDEBAR_ICON_SLOT_CLASS,
              "text-[#A89F8D] group-hover:text-[#FFD026] transition-colors",
            )}
            aria-hidden="true"
          >
            <Search
              width={COMMAND_MENU_TRIGGER_ICON_SIZE}
              height={COMMAND_MENU_TRIGGER_ICON_SIZE}
            />
          </span>
        )}
        <span className={cn(sidebarNavLabelClassName(collapsed), "text-xs font-medium text-[#EDE7D8] group-hover:text-[#FFF4B8]")}>
          {label}
        </span>
      </span>
      {!collapsed ? (
        <kbd className="flex items-center rounded border border-[#2E281F] bg-[#0E0C09] px-1.5 py-0.5 text-[10px] font-mono text-[#A89F8D] group-hover:border-[#FFD026]/30 group-hover:text-[#FFD026] transition-colors">
          {t(I18nKey.COMMAND_MENU$SHORTCUT)}
        </kbd>
      ) : null}
    </button>
  );

  if (collapsed) {
    return (
      <StyledTooltip content={label} placement="right">
        {trigger}
      </StyledTooltip>
    );
  }

  return trigger;
}
