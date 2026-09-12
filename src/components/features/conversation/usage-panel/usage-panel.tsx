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

const DEFAULT_STANDARD_CONTEXT_WINDOW = 131072; // 128k standard

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

  // Token counts
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const cacheHitTokens = usage?.cache_read_tokens ?? 0;
  const cacheWriteTokens = usage?.cache_write_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  // Context window calculations
  const perTurn = (usage?.per_turn_token && usage.per_turn_token > 0)
    ? usage.per_turn_token
    : inputTokens;

  const rawWindow = usage?.context_window ?? 0;
  const isWindowReported = rawWindow > 0;
  const effectiveWindow = isWindowReported ? rawWindow : DEFAULT_STANDARD_CONTEXT_WINDOW;
  const usagePercentage = Math.min(100, Math.max(0, (perTurn / effectiveWindow) * 100));
  const roundedPercent = usagePercentage < 0.1 && usagePercentage > 0 ? "<0.1" : usagePercentage.toFixed(1);
  const remainingPercent = Math.max(0, 100 - usagePercentage).toFixed(1);

  // Percentiles
  const inputPercentNum = totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0;
  const outputPercentNum = totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0;
  const inputShare = inputPercentNum.toFixed(1);
  const outputShare = outputPercentNum.toFixed(1);

  const totalInputActivity = inputTokens + cacheHitTokens;
  const cacheHitRatio = totalInputActivity > 0
    ? ((cacheHitTokens / totalInputActivity) * 100).toFixed(1)
    : "0.0";

  // Context health tone
  const toneBadge =
    usagePercentage > 90
      ? "text-red-300 bg-red-950/60 border-red-500/40"
      : usagePercentage > 70
        ? "text-amber-300 bg-amber-950/60 border-amber-500/40"
        : "text-[#FFD026] bg-[#241F14] border-[#FFD026]/40";

  const progressGradient =
    usagePercentage > 90
      ? "from-amber-500 to-red-500"
      : usagePercentage > 70
        ? "from-[#FFD026] to-amber-500"
        : "from-[#FFD026] via-[#FFAE00] to-[#FF7A00]";

  return (
    <main
      data-testid="usage-panel"
      className="h-full overflow-y-auto custom-scrollbar-always flex flex-col gap-4 p-4 bg-[#0D0B08] text-[#EDE7D8]"
    >
      {/* SECTION 1: Context Window Capacity & Headroom */}
      <div className="rounded-xl border border-[#2B2316] bg-[#14110C] p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#FFD026]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Active Context Window
            </span>
          </div>
          <div className={cn("px-2.5 py-0.5 rounded-full border text-xs font-semibold flex items-center gap-1.5", toneBadge)}>
            <span className="font-bold">{roundedPercent}% capacity</span>
            <span className="text-[10px] opacity-80">({remainingPercent}% free)</span>
          </div>
        </div>

        {/* Progress Gauge Bar */}
        <div className="space-y-1.5">
          <div className="relative h-2.5 w-full rounded-full bg-[#0A0907] overflow-hidden border border-[#2E2517] p-0.5">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                progressGradient,
              )}
              style={{ width: `${Math.max(2, usagePercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#A89F8D] font-mono">
            <span>
              Held: <strong className="text-white font-bold">{perTurn.toLocaleString()}</strong> tokens
            </span>
            <span>
              Limit: <strong className="text-white font-bold">{effectiveWindow.toLocaleString()}</strong> {!isWindowReported && "(128k)"}
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
      <div className="rounded-xl border border-[#2B2316] bg-[#14110C] p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[#FF7A00]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Token Distribution
            </span>
          </div>
          <div className="text-xs font-mono text-[#A89F8D]">
            Total: <span className="text-[#FFD026] font-bold font-mono text-sm">{totalTokens.toLocaleString()}</span>
          </div>
        </div>

        {/* Proportional Distribution Visual Bar */}
        {totalTokens > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-[#0A0907] border border-[#2B2316]">
              <div
                className="bg-[#3B82F6] h-full transition-all duration-300"
                style={{ width: `${Math.max(1, inputPercentNum)}%` }}
              />
              <div
                className="bg-[#10B981] h-full transition-all duration-300"
                style={{ width: `${outputPercentNum}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium px-0.5">
              <span className="text-[#60A5FA]">Input: {inputShare}%</span>
              <span className="text-[#34D399]">Output: {outputShare}%</span>
            </div>
          </div>
        )}

        {/* 4-Card Token Metrics Grid - HIGH CONTRAST BRIGHT NUMBERS */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Input Tokens */}
          <div className="rounded-xl border border-[#2B2316] bg-[#0E0C09] p-3 flex flex-col justify-between hover:border-[#3B82F6]/40 transition-colors">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 font-medium text-[11px] text-[#A89F8D]">
                <ArrowDownLeft className="size-3 text-[#3B82F6]" />
                Input
              </span>
              <span className="text-[10px] font-bold text-[#60A5FA] bg-[#1E3A8A]/40 px-1 py-0.5 rounded border border-[#3B82F6]/30 font-mono">{inputShare}%</span>
            </div>
            <div className="text-lg font-extrabold font-mono text-white">
              {inputTokens.toLocaleString()}
            </div>
          </div>

          {/* Output Tokens */}
          <div className="rounded-xl border border-[#2B2316] bg-[#0E0C09] p-3 flex flex-col justify-between hover:border-[#10B981]/40 transition-colors">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 font-medium text-[11px] text-[#A89F8D]">
                <ArrowUpRight className="size-3 text-[#10B981]" />
                Output
              </span>
              <span className="text-[10px] font-bold text-[#34D399] bg-[#064E3B]/40 px-1 py-0.5 rounded border border-[#10B981]/30 font-mono">{outputShare}%</span>
            </div>
            <div className="text-lg font-extrabold font-mono text-white">
              {outputTokens.toLocaleString()}
            </div>
          </div>

          {/* Cache Read / Hit */}
          <div className="rounded-xl border border-[#2B2316] bg-[#0E0C09] p-3 flex flex-col justify-between hover:border-[#FFD026]/40 transition-colors">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 font-medium text-[11px] text-[#A89F8D]">
                <Database className="size-3 text-[#FFD026]" />
                Cache Hit
              </span>
              <span className="text-[10px] font-bold text-[#FFD026] bg-[#451A03]/40 px-1 py-0.5 rounded border border-[#FFD026]/30 font-mono">{cacheHitRatio}%</span>
            </div>
            <div className="text-lg font-extrabold font-mono text-white">
              {cacheHitTokens.toLocaleString()}
            </div>
          </div>

          {/* Cache Write */}
          <div className="rounded-xl border border-[#2B2316] bg-[#0E0C09] p-3 flex flex-col justify-between hover:border-[#A855F7]/40 transition-colors">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 font-medium text-[11px] text-[#A89F8D]">
                <Sparkles className="size-3 text-[#A855F7]" />
                Cache Write
              </span>
            </div>
            <div className="text-lg font-extrabold font-mono text-white">
              {cacheWriteTokens.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Cost & Budget */}
      <div className="rounded-xl border border-[#2B2316] bg-[#14110C] p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-[#10B981]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Session Cost
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#0E0C09] text-[#A89F8D] border border-[#2B2316]">
            {metrics.max_budget_per_task ? `Limit: $${metrics.max_budget_per_task.toFixed(2)}` : "No limit"}
          </span>
        </div>

        <div className="flex items-baseline justify-between rounded-xl border border-[#2B2316] bg-[#0E0C09] p-3.5">
          <span className="text-xs text-[#A89F8D] font-medium">Total Accumulated Cost</span>
          <div className="text-xl font-extrabold font-mono text-[#10B981]">
            ${(metrics.cost ?? 0).toFixed(4)}
          </div>
        </div>
      </div>

      <ProviderBalanceCard />
    </main>
  );
}
