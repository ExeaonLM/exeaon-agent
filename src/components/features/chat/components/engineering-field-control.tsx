import React from "react";
import {
  Sparkles,
  Shield,
  Bot,
  Cpu,
  MonitorCog,
  FlaskConical,
  Zap,
  Wand2,
  Check,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useConversationStore } from "#/stores/conversation-store";
import { useClickOutsideElement } from "#/hooks/use-click-outside-element";
import { ContextMenu } from "#/ui/context-menu";
import { ContextMenuListItem } from "#/components/features/context-menu/context-menu-list-item";
import { ToolsContextMenuIconText } from "#/components/features/controls/tools-context-menu-icon-text";
import { cn } from "#/utils/utils";
import {
  formControlMutedHoverClassName,
  formControlTransitionClassName,
} from "#/utils/form-control-classes";
import {
  ENGINEERING_FIELDS,
  EXECUTION_MODES,
  fieldMeta,
} from "#/utils/engineering-labs";
import type { ExecutionMode, EngineeringField } from "#/stores/conversation-store";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Shield,
  Bot,
  Cpu,
  MonitorCog,
  FlaskConical,
  Zap,
  Wand2,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className} aria-hidden />;
}

/**
 * Composer control for the Exeaon Engineering Labs field + execution mode.
 * Single unified pill on the bar with a floating side-flyout submenu for modes.
 */
export function EngineeringFieldControl() {
  const {
    engineeringField,
    executionMode,
    cyberSwarm,
    setEngineeringField,
    setExecutionMode,
    setCyberSwarm,
  } = useConversationStore();
  const [open, setOpen] = React.useState(false);
  const [hoveredField, setHoveredField] = React.useState<EngineeringField | null>(null);

  const menuRef = useClickOutsideElement<HTMLDivElement>(() => {
    setOpen(false);
    setHoveredField(null);
  });

  const active = fieldMeta(engineeringField);
  const isGeneral = engineeringField === "none";

  const selectFieldOnly = (id: EngineeringField) => {
    setEngineeringField(id);
    if (id === "none") {
      setOpen(false);
      setHoveredField(null);
    }
  };

  const selectFieldAndMode = (fieldId: EngineeringField, mode: ExecutionMode) => {
    setEngineeringField(fieldId);
    setExecutionMode(mode);
    setOpen(false);
    setHoveredField(null);
  };

  const activeFlyoutField = hoveredField ?? (engineeringField !== "none" ? engineeringField : null);
  const flyoutMeta = activeFlyoutField ? fieldMeta(activeFlyoutField) : null;
  const showFlyout = Boolean(open && flyoutMeta && flyoutMeta.available && flyoutMeta.id !== "none");

  return (
    <div className="relative" ref={menuRef}>
      {/* Single Unified Pill Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Engineering field and mode"
        className={cn(
          "flex items-center gap-1 rounded-[100px] pl-1.5 pr-2 py-0.5 text-2.75 leading-5",
          formControlTransitionClassName,
          isGeneral
            ? cn(
                "border border-transparent text-[var(--oh-muted)] cursor-pointer",
                formControlMutedHoverClassName,
              )
            : "cursor-pointer border border-[#FFD026]/50 bg-[#241F14] text-[#FFD026] hover:bg-[#2E2717]",
        )}
      >
        <Icon name={active.icon} className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap font-normal">
          {isGeneral ? "Field" : active.shortLabel}
        </span>
        {!isGeneral && (
          <span className="ml-0.5 rounded-full bg-black/30 px-1.5 text-[9.5px] font-medium text-[#FFD026]/90">
            {EXECUTION_MODES[executionMode].label}
          </span>
        )}
        {engineeringField === "cyber" && cyberSwarm && (
          <Bot
            className="size-3 shrink-0 text-[#FFD026]"
            aria-label="Swarm active"
          />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-[60] mb-2 flex items-start">
          {/* Main Engineering Field Menu */}
          <div className="w-[230px]">
            <ContextMenu
              testId="engineering-field-menu"
              theme="popover"
              className="w-full shadow-2xl"
            >
              <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--oh-muted)]">
                Engineering field
              </div>
              {ENGINEERING_FIELDS.map((f) => {
                const isSelected = f.id === engineeringField;
                const isHovered = f.id === activeFlyoutField;
                const hasSubmenu = f.available && f.id !== "none";

                return (
                  <ContextMenuListItem
                    key={f.id}
                    testId={`engineering-field-${f.id}`}
                    isDisabled={!f.available}
                    onMouseEnter={() => {
                      if (f.available) setHoveredField(f.id);
                    }}
                    onClick={() => {
                      if (!hasSubmenu) {
                        selectFieldOnly(f.id);
                      } else {
                        setHoveredField(f.id);
                      }
                    }}
                    className={cn(
                      "!w-auto",
                      isHovered && hasSubmenu && "bg-[var(--oh-interactive-hover)]",
                    )}
                  >
                    <ToolsContextMenuIconText
                      icon={<Icon name={f.icon} className="size-4" />}
                      text={
                        <span className="flex items-center gap-1.5">
                          {f.label}
                          {!f.available && (
                            <span className="rounded bg-[var(--oh-border-subtle)] px-1 text-[9px] uppercase text-[var(--oh-muted)]">
                              soon
                            </span>
                          )}
                        </span>
                      }
                      rightIcon={
                        hasSubmenu ? (
                          <ChevronRight
                            className={cn(
                              "size-3.5 text-[var(--oh-muted)]",
                              isSelected && "text-[#FFD026]",
                            )}
                            aria-hidden
                          />
                        ) : isSelected ? (
                          <Check
                            className="size-4 text-[#FFD026]"
                            aria-hidden
                          />
                        ) : undefined
                      }
                    />
                  </ContextMenuListItem>
                );
              })}
            </ContextMenu>
          </div>

          {/* Floating Side Flyout Submenu (In the Air) */}
          {showFlyout && flyoutMeta && (
            <div className="ml-1 w-[210px] shrink-0 animate-in fade-in slide-in-from-left-1 duration-150">
              <ContextMenu
                testId="engineering-mode-flyout"
                theme="popover"
                className="w-full shadow-2xl border border-[var(--oh-border)]"
              >
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--oh-muted)]">
                  Mode
                </div>
                {flyoutMeta.modes.map((m) => {
                  const meta = EXECUTION_MODES[m];
                  const isModeSelected =
                    flyoutMeta.id === engineeringField && m === executionMode;

                  return (
                    <ContextMenuListItem
                      key={m}
                      testId={`engineering-mode-${m}`}
                      onClick={() => selectFieldAndMode(flyoutMeta.id, m)}
                      className="!w-auto"
                    >
                      <ToolsContextMenuIconText
                        icon={<Icon name={meta.icon} className="size-4" />}
                        text={
                          <span className="flex flex-col">
                            <span className="text-xs font-medium">{meta.label}</span>
                            <span className="text-[10px] text-[var(--oh-muted)] leading-tight">
                              {meta.blurb}
                            </span>
                          </span>
                        }
                        rightIcon={
                          isModeSelected ? (
                            <Check
                              className="size-4 text-[#FFD026]"
                              aria-hidden
                            />
                          ) : undefined
                        }
                      />
                    </ContextMenuListItem>
                  );
                })}

                {/* Cyber SWARM toggle — lead summons parallel operatives. */}
                {flyoutMeta.id === "cyber" && (
                  <>
                    <div className="mx-2 my-1 border-t border-[var(--oh-border-subtle)]" />
                    <ContextMenuListItem
                      testId="engineering-cyber-swarm"
                      onClick={() => setCyberSwarm(!cyberSwarm)}
                      className="!w-auto"
                    >
                      <ToolsContextMenuIconText
                        icon={<Bot className="size-4" aria-hidden />}
                        text={
                          <span className="flex flex-col">
                            <span className="text-xs font-medium">Swarm</span>
                            <span className="text-[10px] text-[var(--oh-muted)] leading-tight">
                              Lead summons parallel cyber operatives per engagement.
                            </span>
                          </span>
                        }
                        rightIcon={
                          cyberSwarm ? (
                            <Check className="size-4 text-[#FFD026]" aria-hidden />
                          ) : undefined
                        }
                      />
                    </ContextMenuListItem>
                  </>
                )}
              </ContextMenu>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

