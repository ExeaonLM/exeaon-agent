import {
  Gauge,
  Sparkles,
  Zap,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  Coins,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { ConversationTabEmptyState } from "#/components/features/conversation/conversation-tab-empty-state";
import { useLiveConversationMetrics } from "#/hooks/use-live-conversation-metrics";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { CompactContextButton } from "./compact-context-button";
import { ProviderBalanceCard } from "./provider-balance-card";
import { cn } from "#/utils/utils";

const DEFAULT_FALLBACK_CONTEXT_WINDOW = 131072; // 128k standard

export function UsagePanel() {
  const { t } = useTranslation("openhands");
  const metrics = useLiveConversationMetrics();
  const { data: conversation } = useActiveConversation();
  const isAcp = conversation?.agent_kind === "acp";

  const { usage } = metrics;
  const hasMetrics = metrics.cost !== null || usage !== null;

  if (!hasMetrics) {
    return (
      <ConversationTabEmptyState icon={<Gauge />}>
        {t(I18nKey.CONVERSATION$NO_METRICS)}
      </ConversationTabEmptyState>
    );
  }

  // Context window calculations
  const perTurn = usage?.per_turn_token ?? 0;
  const rawWindow = usage?.context_window ?? 0;
  const isWindowReported = rawWindow > 0;
  const effectiveWindow = isWindowReported ? rawWindow : DEFAULT_FALLBACK_CONTEXT_WINDOW;
  const usagePercentage = Math.min(100, Math.max(0, (perTurn / effectiveWindow) * 100));
  const roundedPercent = usagePercentage < 0.1 && usagePercentage > 0 ? "<0.1" : usagePercentage.toFixed(1);
  const remainingPercent = Math.max(0, 100 - usagePercentage).toFixed(1);

  // Token breakdown calculations
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const cacheHitTokens = usage?.cache_read_tokens ?? 0;
  const cacheWriteTokens = usage?.cache_write_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  // Percentiles
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
      ? "from-amber-500 to-red-500"
      : usagePercentage > 70
        ? "from-[#FFD026] to-amber-500"
        : "from-[#FFD026] to-[#FF9E00]";

  return (
    <main
      data-testid="usage-panel"
      className="h-full overflow-y-auto custom-scrollbar-always flex flex-col gap-3.5 p-4 bg-[#0E0C09] text-[#EDE7D8]"
    >
      {/* SECTION 1: Context Window Capacity & Headroom */}
      <div className="rounded-xl border border-[#262016] bg-[#14110C] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#FFD026]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#EDE7D8]">
              Active Context Window
            </span>
          </div>
          <div className={cn("px-2.5 py-0.5 rounded-full border text-xs font-semibold flex items-center gap-1.5", toneColor)}>
            <span>{roundedPercent}% used</span>
            <span className="text-[10px] opacity-70">({remainingPercent}% free)</span>
          </div>
        </div>

        {/* Progress Gauge Bar */}
        <div className="space-y-1.5">
          <div className="relative h-2 w-full rounded-full bg-[#1F1B12] overflow-hidden border border-[#2B2316]/60 p-0.5">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                barColor,
              )}
              style={{ width: `${Math.max(1.5, usagePercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#8C8370] font-mono">
            <span>
              Held: <strong className="text-[#EDE7D8]">{perTurn.toLocaleString()}</strong>
            </span>
            <span>
              Limit: <strong className="text-[#EDE7D8]">{effectiveWindow.toLocaleString()}</strong> {!isWindowReported && "(128k)"}
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
      <div className="rounded-xl border border-[#262016] bg-[#14110C] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[#FF7A00]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#EDE7D8]">
              Token Distribution
            </span>
          </div>
          <div className="text-xs font-mono text-[#8C8370]">
            Total: <span className="text-[#FFD026] font-bold">{totalTokens.toLocaleString()}</span>
          </div>
        </div>

        {/* Proportional Distribution Visual Bar */}
        {totalTokens > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-[#1F1B12] border border-[#2B2316]/50">
              <div
                className="bg-[#3880F6] h-full transition-all duration-300"
                style={{ width: `${inputShare}%` }}
              />
              <div
                className="bg-[#10B981] h-full transition-all duration-300"
                style={{ width: `${outputShare}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#736A58] px-0.5">
              <span className="text-[#3880F6]">Input: {inputShare}%</span>
              <span className="text-[#10B981]">Output: {outputShare}%</span>
            </div>
          </div>
        )}

        {/* 4-Card Token Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Input Tokens */}
          <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
              <span className="flex items-center gap-1 font-medium text-[11px]">
                <ArrowDownLeft className="size-3 text-[#3880F6]" />
                Input
              </span>
              <span className="text-[10px] font-semibold text-[#3880F6] font-mono">{inputShare}%</span>
            </div>
            <div className="text-sm font-bold font-mono text-[#EDE7D8]">
              {inputTokens.toLocaleString()}
            </div>
          </div>

          {/* Output Tokens */}
          <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
              <span className="flex items-center gap-1 font-medium text-[11px]">
                <ArrowUpRight className="size-3 text-[#10B981]" />
                Output
              </span>
              <span className="text-[10px] font-semibold text-[#10B981] font-mono">{outputShare}%</span>
            </div>
            <div className="text-sm font-bold font-mono text-[#EDE7D8]">
              {outputTokens.toLocaleString()}
            </div>
          </div>

          {/* Cache Read / Hit */}
          <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
              <span className="flex items-center gap-1 font-medium text-[11px]">
                <Database className="size-3 text-[#FFD026]" />
                Cache Hit
              </span>
              <span className="text-[10px] font-semibold text-[#FFD026] font-mono">{cacheHitRatio}%</span>
            </div>
            <div className="text-sm font-bold font-mono text-[#EDE7D8]">
              {cacheHitTokens.toLocaleString()}
            </div>
          </div>

          {/* Cache Write */}
          <div className="rounded-lg border border-[#241F16] bg-[#100E0A] p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#8C8370] mb-1">
              <span className="flex items-center gap-1 font-medium text-[11px]">
                <Sparkles className="size-3 text-[#A855F7]" />
                Cache Write
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#EDE7D8]">
              {cacheWriteTokens.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Cost & Budget */}
      <div className="rounded-xl border border-[#262016] bg-[#14110C] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-[#10B981]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#EDE7D8]">
              Session Cost
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1B12] text-[#8C8370] border border-[#2B2316]">
            {metrics.max_budget_per_task ? `Limit: $${metrics.max_budget_per_task.toFixed(2)}` : "No limit"}
          </span>
        </div>

        <div className="flex items-baseline justify-between rounded-lg border border-[#241F16] bg-[#100E0A] p-3">
          <span className="text-xs text-[#8C8370]">Total Accumulated Cost</span>
          <div className="text-lg font-bold font-mono text-[#10B981]">
            ${(metrics.cost ?? 0).toFixed(4)}
          </div>
        </div>
      </div>

      <ProviderBalanceCard />
    </main>
  );
}
