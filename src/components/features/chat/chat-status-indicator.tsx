import { cn } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import DebugStackframeDot from "#/icons/debug-stackframe-dot.svg?react";

interface ChatStatusIndicatorProps {
  status: string;
  statusColor: string;
}

function ChatStatusIndicator({
  status,
  statusColor,
}: ChatStatusIndicatorProps) {
  return (
    <div
      data-testid="chat-status-indicator"
      className={cn(
        "max-w-full rounded-full px-2.5 py-1 bg-[#120F0A]/90 border border-[#2B2316] backdrop-blur-md flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex items-center gap-1.5"
        >
          <span className="flex-shrink-0 animate-[pulse_1.2s_ease-in-out_infinite]">
            <DebugStackframeDot className="w-3.5 h-3.5" color={statusColor || "#FFD026"} />
          </span>
          <span className="font-medium text-[11px] leading-[16px] text-[#E0D8C3] normal-case break-words whitespace-normal">
            {status}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default ChatStatusIndicator;
