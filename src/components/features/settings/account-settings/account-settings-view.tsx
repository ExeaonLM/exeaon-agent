import React from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Laptop,
  Cloud,
  Zap,
  LogOut,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { BrandButton } from "#/components/features/settings/brand-button";
import { BrandBadge } from "#/components/shared/badge";
import { useActiveBackend } from "#/contexts/active-backend-context";

export function AccountSettingsView() {
  const { backend } = useActiveBackend();
  const [isCloudConnected, setIsCloudConnected] = React.useState(true);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Profile & Identity Section */}
      <section className="flex flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-tr from-[#FFD026] to-[#FF7A00] text-black font-semibold text-base shadow-[0_0_15px_rgba(255,208,38,0.3)]">
              E
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Elliot</span>
                <BrandBadge className="px-2 py-0.5 text-[10px] bg-[#FFD026]/10 text-[#FFD026] border border-[#FFD026]/30">
                  Pro
                </BrandBadge>
              </div>
              <span className="text-xs text-[var(--oh-muted)]">
                elliotakpalu@gmail.com
              </span>
            </div>
          </div>

          <BrandButton
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={() => setIsCloudConnected((prev) => !prev)}
          >
            <LogOut className="size-3.5 mr-1 text-[var(--oh-muted)]" />
            {isCloudConnected ? "Log out" : "Sign in"}
          </BrandButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[var(--oh-border)] text-xs">
          <div>
            <span className="text-[var(--oh-muted)] block mb-1">Organization ID</span>
            <code className="bg-black/40 px-2 py-1 rounded text-white font-mono text-[11px] select-all border border-white/5">
              5124348d-27bd-4c15-aac7-eb3a024c1421
            </code>
          </div>
          <div>
            <span className="text-[var(--oh-muted)] block mb-1">Role</span>
            <span className="text-white font-medium">Owner / Administrator</span>
          </div>
        </div>
      </section>

      {/* Claude-Style Usage & Quota Bar */}
      <section className="flex flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#FFD026]" />
            <h3 className="text-sm font-medium text-white">Usage & Plan Limits</h3>
          </div>
          <span className="text-xs text-[var(--oh-muted)]">
            Resets in <strong className="text-white font-medium">5 days</strong>
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--oh-muted)]">High-Speed GPU Inferences</span>
            <span className="text-white font-medium">18% used (450 / 2,500 requests)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#FFD026] to-[#FF7A00] rounded-full transition-all duration-500"
              style={{ width: "18%" }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-[var(--oh-border)]">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--oh-muted)]">Context & Token Budget</span>
            <span className="text-white font-medium">320k / 2.0M tokens</span>
          </div>
          <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden border border-white/5">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-500"
              style={{ width: "16%" }}
            />
          </div>
        </div>
      </section>

      {/* Active Engine Connections */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-white">Execution Connections</h3>

        {/* Local Sovereign Engine Connection */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Laptop className="size-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Local Sovereign Engine</span>
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
              </div>
              <span className="text-xs text-[var(--oh-muted)] font-mono">http://127.0.0.1:18000</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--oh-muted)] bg-black/30 px-2.5 py-1 rounded-md border border-white/5">
            <Lock className="size-3 text-[var(--oh-muted)]" />
            <span>Default Connection</span>
          </div>
        </div>

        {/* Exeaon Cloud Cluster Connection */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Cloud className="size-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Exeaon GPU Cluster</span>
                <span className="size-2 rounded-full bg-sky-400" />
                <span className="text-[11px] text-sky-400 font-medium">A100-80GB Online</span>
              </div>
              <span className="text-xs text-[var(--oh-muted)] font-mono">https://cloud.exeaon.dev</span>
            </div>
          </div>

          <BrandBadge className="px-2 py-0.5 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/30">
            Cluster GPU
          </BrandBadge>
        </div>
      </section>
    </div>
  );
}
