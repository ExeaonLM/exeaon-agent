import React, { useState } from "react";
import { Terminal as TerminalIcon, Plus, X, Trash2, CheckCircle2 } from "lucide-react";
import { useTerminal } from "#/hooks/use-terminal";
import "@xterm/xterm/css/xterm.css";
import { RUNTIME_INACTIVE_STATES } from "#/types/agent-state";
import { cn } from "#/utils/utils";
import { WaitingForRuntimeMessage } from "../chat/waiting-for-runtime-message";
import { useAgentState } from "#/hooks/use-agent-state";
import { useCommandStore } from "#/stores/command-store";
import { EmptyTerminalMessage } from "./empty-terminal-message";

interface TerminalTab {
  id: string;
  name: string;
  isAgent?: boolean;
}

function Terminal() {
  const { curAgentState } = useAgentState();
  const commands = useCommandStore((state) => state.commands);
  const clearTerminal = useCommandStore((state) => state.clearTerminal);

  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "agent-1", name: "Agent Shell", isAgent: true },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("agent-1");

  const isRuntimeInactive = RUNTIME_INACTIVE_STATES.includes(curAgentState);
  const hasOutput = commands.length > 0;
  const hideTerminalSurface = isRuntimeInactive || !hasOutput;

  const ref = useTerminal();

  const handleAddTab = () => {
    const newId = `term-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newId,
      name: `Terminal ${tabs.length + 1}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#0c0c0f]">
      {/* Terminal Toolbar & Tab Bar */}
      <div className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-[#121216] px-2 text-xs select-none">
        {/* Tab List */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-[#1e1e24] text-zinc-100 shadow-sm border border-white/[0.06]"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                )}
              >
                <TerminalIcon className="size-3.5 text-zinc-400" />
                <span className="truncate max-w-[120px]">{tab.name}</span>
                {tabs.length > 1 && !tab.isAgent && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleAddTab}
            className="p-1 rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 transition-colors"
            title="New Terminal Tab"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 text-[11px]">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Agent Terminal</span>
          </div>

          <button
            type="button"
            onClick={clearTerminal}
            className="p-1 rounded-md hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
            title="Clear Terminal Output"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      {isRuntimeInactive && <WaitingForRuntimeMessage className="pt-16" />}

      {!isRuntimeInactive && !hasOutput && <EmptyTerminalMessage />}

      <div
        className={cn(
          "flex-1 min-h-0 p-3 bg-[#0a0a0d]",
          hideTerminalSurface &&
            "pointer-events-none absolute inset-0 h-0 w-0 overflow-hidden p-0 opacity-0",
        )}
      >
        <div ref={ref} className="h-full w-full font-mono" />
      </div>
    </div>
  );
}

export default Terminal;

