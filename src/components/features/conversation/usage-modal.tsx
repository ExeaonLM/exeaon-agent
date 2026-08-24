import React from "react";
import { Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalCloseButton } from "#/components/shared/modals/modal-close-button";
import { useLiveConversationMetrics } from "#/hooks/use-live-conversation-metrics";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { CostSection } from "./metrics-modal/cost-section";
import { UsageSection } from "./metrics-modal/usage-section";
import { CompactContextButton } from "./usage-panel/compact-context-button";
import { ContextMeter } from "./usage-panel/context-meter";
import { ProviderBalanceCard } from "./usage-panel/provider-balance-card";
import { getContextWindowUsagePercentage } from "#/utils/format-token-count";
import { cn } from "#/utils/utils";

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsageModal({ isOpen, onClose }: UsageModalProps) {
  const { t } = useTranslation("openhands");
  const metrics = useLiveConversationMetrics();
  const { data: conversation } = useActiveConversation();
  const isAcp = conversation?.agent_kind === "acp";

  if (!isOpen) return null;

  const { usage } = metrics;
  const hasMetrics = metrics.cost !== null || usage !== null;

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        className={cn(
          "relative flex flex-col w-[540px] max-w-[92vw] max-h-[85vh]",
          "bg-[#12100C] border border-[#2A241A] rounded-2xl shadow-2xl overflow-hidden",
          "animate-in fade-in zoom-in-95 duration-150",
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#241F16] bg-[#16130E]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#241F14] border border-[#FFD026]/30 text-[#FFD026]">
              <Gauge className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#EDE7D8]">
                {t(I18nKey.CONVERSATION$TOKEN_USAGE)}
              </h2>
              <p className="text-[11px] text-[#8C8370]">
                Live context window &amp; session metrics
              </p>
            </div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {!hasMetrics ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Gauge className="size-10 text-[#595243] mb-2 stroke-[1.5]" />
              <p className="text-sm text-[#8C8370]">
                {t(I18nKey.CONVERSATION$NO_METRICS)}
              </p>
            </div>
          ) : (
            <>
              {/* Context Fill Meter */}
              {usage !== null && (
                <div className="rounded-xl border border-[#2A241A] bg-[#18140F] p-4">
                  <div className="grid gap-3">
                    <ContextMeter
                      perTurnToken={usage.per_turn_token}
                      contextWindow={usage.context_window}
                    />
                    <CompactContextButton
                      fillPercent={getContextWindowUsagePercentage(
                        usage.per_turn_token,
                        usage.context_window,
                      )}
                      perTurnToken={usage.per_turn_token}
                    />
                  </div>
                </div>
              )}

              {/* Tokens & Cost Card */}
              <div className="rounded-xl border border-[#2A241A] bg-[#18140F] p-4">
                <div className="grid gap-3">
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#A89F8D]">
                      {t(I18nKey.CONVERSATION$TOKEN_USAGE)}
                    </span>
                  </div>
                  {isAcp && (
                    <span className="text-xs text-[#8C8370]">
                      {t(I18nKey.CONVERSATION$PLAN_USAGE_NOTE)}
                    </span>
                  )}
                  {usage !== null && <UsageSection usage={usage} />}
                  <CostSection
                    cost={metrics.cost}
                    maxBudgetPerTask={metrics.max_budget_per_task}
                  />
                </div>
              </div>

              {/* Balance card */}
              <ProviderBalanceCard />
            </>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
}
