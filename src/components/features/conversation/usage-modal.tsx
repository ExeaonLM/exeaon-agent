import React from "react";
import {
  Gauge,
  Sparkles,
  Zap,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  Coins,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalCloseButton } from "#/components/shared/modals/modal-close-button";
import { useLiveConversationMetrics } from "#/hooks/use-live-conversation-metrics";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { CompactContextButton } from "./usage-panel/compact-context-button";
import { ProviderBalanceCard } from "./usage-panel/provider-balance-card";
import { cn } from "#/utils/utils";

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_FALLBACK_CONTEXT_WINDOW = 131072; // 128k standard

export function UsageModal({ isOpen, onClose }: UsageModalProps) {
  const { t } = useTranslation("openhands");
  const metrics = useLiveConversationMetrics();
  const { data: conversation } = useActiveConversation();
  const isAcp = conversation?.agent_kind === "acp";

  if (!isOpen) return null;

  const { usage } = metrics;
  const hasMetrics = metrics.cost !== null || usage !== null;

  // Context window calculations
  const perTurn = usage?.per_turn_token ?? 0;
  const rawWindow = usage?.context_window ?? 0;
  const isWindowReported = rawWindow > 0;
  const effectiveWindow = isWindowReported ? rawWindow : DEFAULT_FALLBACK_CONTEXT_WINDOW;
  const usagePercentage = Math.min(100, Math.max(0, (perTurn / effectiveWindow) * 100));
  const roundedPercent = usagePercentage < 0.1 && usagePercentage > 0 ? "<0.1" : usagePercentage.toFixed(1);
  const remainingTokens = Math.max(0, effectiveWindow - perTurn);
  const remainingPercent = Math.max(0, 100 - usagePercentage).toFixed(1);

  // Token breakdown calculations
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const cacheHitTokens = usage?.cache_read_tokens ?? 0;
  const cacheWriteTokens = usage?.cache_write_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  // Percentiles / Proportions
  const inputShare = totalTokens > 0 ? ((inputTokens / totalTokens) * 100).toFixed(1) : "0.0";
  const outputShare = totalTokens > 0 ? ((outputTokens / totalTokens) * 100).toFixed(1) : "0.0";
  const cacheHitRatio = (inputTokens + cacheHitTokens) > 0 
    ? ((cacheHitTokens / (inputTokens + cacheHitTokens)) * 100).toFixed(1)
    : "0.0";

  // Context health tone
  const toneColor =
    usagePercentage > 90
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : usagePercentage > 70
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
        : "text-[#FFD026] bg-[#FFD026]/10 border-[#FFD026]/30";

  const barColor =
    usagePercentage > 90
      ? "from-amber-500 to-red-500 shadow-red-500/20"
      : usagePercentage > 70
        ? "from-[#FFD026] to-amber-500 shadow-amber-500/20"
        : "from-[#FFD026] to-[#FF9E00] shadow-[#FFD026]/20";

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        className={cn(
          "relative flex flex-col w-[580px] max-w-[94vw] max-h-[90vh]",
          "bg-[#0E0C09] border border-[#262016] rounded-2xl shadow-2xl overflow-hidden",
          "animate-in fade-in zoom-in-95 duration-150 select-none",
        )}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#201B12] bg-[#14110C]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#241F14] border border-[#FFD026]/40 text-[#FFD026] shadow-sm shadow-[#FFD026]/10">
              <Gauge className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[#EDE7D8]">
                  Token &amp; Context Analytics
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#1F1B12] border border-[#332A1B] text-[#FFD026]">
                  <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-[#8C8370]">
                Real-time token utilization, context headroom &amp; session cost
              </p>
            </div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {!hasMetrics ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-2xl bg-[#18140E] border border-[#2A241A] flex items-center justify-center mb-3">
                <Gauge className="size-6 text-[#736A58]" />
              </div>
              <p className="text-sm font-medium text-[#EDE7D8] mb-1">
                {t(I18nKey.CONVERSATION$NO_METRICS)}
              </p>
              <p className="text-xs text-[#8C8370] max-w-[280px]">
                Metrics will populate as the agent processes messages and generates tool calls.
              </p>
            </div>
          ) : (
            <>
              {/* SECTION 1: Context Window Capacity & Headroom */}
              <div className="rounded-xl border border-[#262016] bg-[#14110C] p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-[#FFD026]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#EDE7D8]">
                      Active Context Window
                    </span>
                  </div>
                  <div className={cn("px-2.5 py-0.5 rounded-full border text-xs font-semibold flex items-center gap-1.5", toneColor)}>
                    <span>{roundedPercent}% capacity</span>
                    <span className="text-[10px] opacity-70">({remainingPercent}% free)</span>
                  </div>
                </div>

                {/* Progress Gauge Bar */}
                <div className="space-y-1.5">
                  <div className="relative h-2.5 w-full rounded-full bg-[#1F1B12] overflow-hidden border border-[#2B2316]/60 p-0.5">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r transition-all duration-500 shadow-sm",
                        barColor,
                      )}
                      style={{ width: `${Math.max(1.5, usagePercentage)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#8C8370] font-mono">
                    <span>
                      Held: <strong className="text-[#EDE7D8] font-semibold">{perTurn.toLocaleString()}</strong> tokens
                    </span>
                    <span>
                      Limit: <strong className="text-[#EDE7D8] font-semibold">{effectiveWindow.toLocaleString()}</strong> {!isWindowReported && "(128k standard)"}
                    </span>
                  </div>
                </div>

                {/* Context Compactor CTA */}
                <CompactContextButton
                  fillPercent={usagePercentage}
                  perTurnToken={perTurn}
                />
              </div>

              {/* SECTION 2: Token Breakdown Grid with Percentiles */}
              <div className="rounded-xl border border-[#262016] bg-[#14110C] p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-[#FF7A00]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#EDE7D8]">
                      Token Distribution
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#8C8370]">
                    Total: <span className="text-[#FFD026] font-bold font-mono">{totalTokens.toLocaleString()}</span> tokens
                  </div>
                </div>

                {/* Proportional Distribution Visual Bar */}
                {totalTokens > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex h-2 w-full rounded-full overflow-hidden bg-[#1F1B12] border border-[#2B2316]/50">
                      <div
                        className="bg-[#3880F6] h-full transition-all duration-300"
                        style={{ width: `${inputShare}%` }}
                        title={`Input: ${inputShare}%`}
                      />
                      <div
                        className="bg-[#10B981] h-full transition-all duration-300"
                        style={{ width: `${outputShare}%` }}
                        title={`Output: ${outputShare}%`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#736A58] px-0.5">
                      <span className="flex items-center gap-1 text-[#3880F6]">
                        <span className="size-1.5 rounded-full bg-[#3880F6]" /> Input ({inputShare}%)
                      </span>
                      <span className="flex items-center gap-1 text-[#10B981]">
                        <span className="size-1.5 rounded-full bg-[#10B981]" /> Output ({outputShare}%)
                      </span>
                    </div>
                  </div>
                )}

                {/* 4-Card Token Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Input Tokens */}
                  <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <ArrowDownLeft className="size-3.5 text-[#3880F6]" />
                        Prompt Input
                      </span>
                      <span className="text-[10px] font-semibold text-[#3880F6] font-mono">{inputShare}%</span>
                    </div>
                    <div className="text-base font-bold font-mono text-[#EDE7D8]">
                      {inputTokens.toLocaleString()}
                    </div>
                  </div>

                  {/* Output Tokens */}
                  <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <ArrowUpRight className="size-3.5 text-[#10B981]" />
                        Completions
                      </span>
                      <span className="text-[10px] font-semibold text-[#10B981] font-mono">{outputShare}%</span>
                    </div>
                    <div className="text-base font-bold font-mono text-[#EDE7D8]">
                      {outputTokens.toLocaleString()}
                    </div>
                  </div>

                  {/* Cache Read / Hit */}
                  <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Database className="size-3.5 text-[#FFD026]" />
                        Cache Hits
                      </span>
                      <span className="text-[10px] font-semibold text-[#FFD026] font-mono">{cacheHitRatio}% hit</span>
                    </div>
                    <div className="text-base font-bold font-mono text-[#EDE7D8]">
                      {cacheHitTokens.toLocaleString()}
                    </div>
                  </div>

                  {/* Cache Write */}
                  <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Sparkles className="size-3.5 text-[#A855F7]" />
                        Cache Writes
                      </span>
                      <span className="text-[10px] text-[#595243] font-mono">tokens</span>
                    </div>
                    <div className="text-base font-bold font-mono text-[#EDE7D8]">
                      {cacheWriteTokens.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Cost & Budget Efficiency */}
              <div className="rounded-xl border border-[#262016] bg-[#14110C] p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="size-4 text-[#10B981]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#EDE7D8]">
                      Session Cost &amp; Budget
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#1F1B12] text-[#8C8370] border border-[#2B2316]">
                    {metrics.max_budget_per_task ? `Limit: $${metrics.max_budget_per_task.toFixed(2)}` : "No limit set"}
                  </span>
                </div>

                <div className="flex items-baseline justify-between rounded-lg border border-[#241F16] bg-[#100E0A] p-3.5">
                  <div className="space-y-0.5">
                    <span className="text-xs text-[#8C8370] font-medium">Accumulated Session Cost</span>
                    {isAcp && (
                      <p className="text-[11px] text-[#736A58]">
                        CLI subscription estimate
                      </p>
                    )}
                  </div>
                  <div className="text-xl font-bold font-mono text-[#10B981]">
                    ${(metrics.cost ?? 0).toFixed(4)}
                  </div>
                </div>
              </div>

              {/* SECTION 4: Provider Balance Card */}
              <ProviderBalanceCard />
            </>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
}
