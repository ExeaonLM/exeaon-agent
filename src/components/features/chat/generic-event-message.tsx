import React from "react";
import { useTranslation } from "react-i18next";
import ArrowDown from "#/icons/angle-down-solid.svg?react";
import ArrowUp from "#/icons/angle-up-solid.svg?react";
import { SuccessIndicator } from "./success-indicator";
import { ObservationResultStatus } from "#/components/conversation-events/chat/event-content-helpers/get-observation-result";
import { MarkdownRenderer } from "../markdown/markdown-renderer";
import { cn } from "#/utils/utils";
import { I18nKey } from "#/i18n/declaration";

interface GenericEventMessageProps {
  title: React.ReactNode;
  details: string | React.ReactNode;
  success?: ObservationResultStatus;
  initiallyExpanded?: boolean;
  /** Where to place the expand/collapse chevron relative to the title. */
  chevronPosition?: "before" | "after";
  /** Extra content rendered at the end of the title row (right side). */
  titleTrailing?: React.ReactNode;
  /** Optional icon rendered before the title text. */
  titleIcon?: React.ReactNode;
}

export function GenericEventMessage({
  title,
  details,
  success,
  initiallyExpanded = false,
  chevronPosition = "after",
  titleTrailing,
  titleIcon,
}: GenericEventMessageProps) {
  const { t } = useTranslation("openhands");
  const [showDetails, setShowDetails] = React.useState(initiallyExpanded);

  const chevron = details ? (
    <button
      type="button"
      onClick={() => setShowDetails((prev) => !prev)}
      className="cursor-pointer text-left"
      aria-label={
        showDetails ? t(I18nKey.BUTTON$COLLAPSE) : t(I18nKey.BUTTON$EXPAND)
      }
    >
      {showDetails ? (
        <ArrowUp
          className={cn(
            "h-4 w-4 inline fill-[var(--oh-muted)]",
            chevronPosition === "after" ? "ml-2" : "mr-2",
          )}
        />
      ) : (
        <ArrowDown
          className={cn(
            "h-4 w-4 inline fill-[var(--oh-muted)]",
            chevronPosition === "after" ? "ml-2" : "mr-2",
          )}
        />
      )}
    </button>
  ) : null;

  return (
    <div className="flex flex-col gap-2 my-1.5 p-3 rounded-xl border border-white/[0.07] bg-[#141419]/70 backdrop-blur-sm text-sm w-full transition-all hover:border-white/[0.12] shadow-sm">
      <div className="flex items-center justify-between font-normal text-zinc-300">
        <div className="flex items-center gap-1.5">
          {chevronPosition === "before" && chevron}
          {titleIcon}
          <span className="font-medium text-xs text-zinc-200">{title}</span>
          {chevronPosition === "after" && chevron}
        </div>

        <div className="flex items-center gap-2">
          {titleTrailing}
          {success && <SuccessIndicator status={success} />}
        </div>
      </div>

      {showDetails && (
        <div className="mt-1 pt-2 border-t border-white/[0.06] font-mono text-xs text-zinc-300">
          {typeof details === "string" ? (
            <MarkdownRenderer>{details}</MarkdownRenderer>
          ) : (
            details
          )}
        </div>
      )}
    </div>
  );
}
