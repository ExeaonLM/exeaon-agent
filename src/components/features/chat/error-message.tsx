import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import i18n from "#/i18n";
import { MarkdownRenderer } from "../markdown/markdown-renderer";
import { sanitizeLlmErrorMessage } from "#/utils/user-facing-error";

interface ErrorMessageProps {
  errorId?: string;
  defaultMessage: string;
}

export function ErrorMessage({ errorId, defaultMessage }: ErrorMessageProps) {
  const { t } = useTranslation("openhands");
  const [showDetails, setShowDetails] = React.useState(false);

  const cleanMessage = sanitizeLlmErrorMessage(defaultMessage);

  const hasValidTranslationId = !!errorId && i18n.exists(errorId);
  const errorKey = hasValidTranslationId
    ? errorId
    : "CHAT_INTERFACE$AGENT_ERROR_MESSAGE";

  const Chevron = showDetails ? ChevronUp : ChevronDown;

  return (
    <div className="my-2.5 w-full rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm backdrop-blur-sm shadow-[0_2px_12px_rgba(239,68,68,0.08)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-400 font-medium">
          <AlertCircle className="size-4 shrink-0 text-red-400" />
          <span>{t(errorKey)}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-red-500/10"
        >
          <span>{showDetails ? "Hide Details" : "Show Details"}</span>
          <Chevron className="size-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="mt-2.5 border-t border-red-500/20 pt-2.5 text-xs text-red-200/90 leading-relaxed font-sans"
          >
            <MarkdownRenderer>{cleanMessage}</MarkdownRenderer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


