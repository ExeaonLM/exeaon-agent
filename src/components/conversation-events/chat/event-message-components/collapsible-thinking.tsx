import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { I18nKey } from "#/i18n/declaration";
import { MarkdownRenderer } from "../../../features/markdown/markdown-renderer";

interface CollapsibleThinkingProps {
  /** The thinking / reasoning content to display when expanded. */
  content: string;
}

/**
 * Renders agent thinking or extended reasoning content inside a collapsible
 * section. Collapsed by default so the chat stays compact.
 */
export function CollapsibleThinking({ content }: CollapsibleThinkingProps) {
  const { t } = useTranslation("openhands");
  const [expanded, setExpanded] = React.useState(false);

  if (!content.trim()) {
    return null;
  }

  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <div
      className="my-2 w-full rounded-xl border border-[#2B2316]/80 bg-[#120F0A]/60 px-3.5 py-2 text-sm backdrop-blur-sm transition-all"
      data-testid="collapsible-thinking"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={
          expanded ? t(I18nKey.THINKING$COLLAPSE) : t(I18nKey.THINKING$EXPAND)
        }
        data-testid="collapsible-thinking-toggle"
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[#FFD026] opacity-80 group-hover:opacity-100 transition-opacity" />
          <span className="font-medium text-xs text-[#B8A88A] group-hover:text-[#F5F5F5] transition-colors">
            {t(I18nKey.THINKING$TITLE)}
          </span>
        </div>
        <Chevron className="size-3.5 text-[#B8A88A] group-hover:text-[#F5F5F5] transition-colors flex-shrink-0" />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="mt-2 border-t border-[#2B2316]/60 pt-2 pl-2 text-[#D1C7B7]"
            data-testid="collapsible-thinking-content"
          >
            <MarkdownRenderer>{content}</MarkdownRenderer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
