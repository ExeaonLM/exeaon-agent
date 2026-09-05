import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Plus, X, Trash2, CheckCircle2, Play } from "lucide-react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminal } from "#/hooks/use-terminal";
import { RUNTIME_INACTIVE_STATES } from "#/types/agent-state";
import { cn } from "#/utils/utils";
import { WaitingForRuntimeMessage } from "../chat/waiting-for-runtime-message";
import { useAgentState } from "#/hooks/use-agent-state";
import { useCommandStore } from "#/stores/command-store";
import { EmptyTerminalMessage } from "./empty-terminal-message";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import AgentServerRuntimeService from "#/api/runtime-service/agent-server-runtime-service";

interface TerminalTab {
  id: string;
  name: string;
  isAgent?: boolean;
}

interface UserTerminalProps {
  tabId: string;
  isActive: boolean;
}

function InteractiveUserTerminal({ tabId, isActive }: UserTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { data: conversation } = useActiveConversation();

  const conversationUrl = conversation?.conversation_url;
  const sessionApiKey = conversation?.session_api_key;
  const workingDir = conversation?.workspace?.working_dir?.trim();

  const inputBufferRef = useRef<string>("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isExecutingRef = useRef<boolean>(false);

  const PROMPT = "\x1b[38;2;16,185,129mexeaon@workspace\x1b[0m:\x1b[38;2;96,165,250m~\x1b[0m$ ";

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      scrollback: 5000,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: {
        background: "#0a0a0d",
        foreground: "#e4e4e7",
        cursor: "#10b981",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch {
      // ignore
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[38;2;16,185,129mExeaon Interactive Terminal Session\x1b[0m");
    term.writeln("Type commands below. Type \x1b[33mclear\x1b[0m or \x1b[33mcc\x1b[0m to reset screen.\n");
    term.write(PROMPT);

    const handleKey = (e: { key: string; domEvent: KeyboardEvent }) => {
      if (isExecutingRef.current) return;

      const { key, domEvent } = e;

      if (domEvent.keyCode === 13) {
        // Enter key
        const command = inputBufferRef.current.trim();
        term.writeln("");

        if (!command) {
          term.write(PROMPT);
          return;
        }

        historyRef.current.push(command);
        historyIndexRef.current = historyRef.current.length;
        inputBufferRef.current = "";

        if (command === "clear" || command === "cls" || command === "cc" || command === "reset") {
          term.clear();
          term.write(PROMPT);
          return;
        }

        isExecutingRef.current = true;
        term.write("\x1b[90mRunning...\x1b[0m\r\n");

        AgentServerRuntimeService.executeCommand(
          conversationUrl,
          sessionApiKey,
          command,
          workingDir,
          60,
        )
          .then((res) => {
            if (res.stdout) {
              const formatted = res.stdout.replaceAll("\n", "\r\n").trim();
              term.writeln(formatted);
            }
            if (res.stderr) {
              const formattedErr = res.stderr.replaceAll("\n", "\r\n").trim();
              term.writeln(`\x1b[31m${formattedErr}\x1b[0m`);
            }
            if (res.exit_code !== 0 && !res.stderr) {
              term.writeln(`\x1b[31mProcess exited with code ${res.exit_code}\x1b[0m`);
            }
          })
          .catch((err) => {
            term.writeln(`\x1b[31mError: ${err.message || err}\x1b[0m`);
          })
          .finally(() => {
            isExecutingRef.current = false;
            term.write(PROMPT);
          });
      } else if (domEvent.keyCode === 8) {
        // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (domEvent.keyCode === 38) {
        // Up arrow (history back)
        if (historyRef.current.length > 0 && historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          const prev = historyRef.current[historyIndexRef.current];
          // Clear current typed text
          while (inputBufferRef.current.length > 0) {
            term.write("\b \b");
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          }
          inputBufferRef.current = prev;
          term.write(prev);
        }
      } else if (domEvent.keyCode === 40) {
        // Down arrow (history forward)
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          const next = historyRef.current[historyIndexRef.current];
          while (inputBufferRef.current.length > 0) {
            term.write("\b \b");
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          }
          inputBufferRef.current = next;
          term.write(next);
        } else {
          historyIndexRef.current = historyRef.current.length;
          while (inputBufferRef.current.length > 0) {
            term.write("\b \b");
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          }
        }
      } else if (key.length === 1 && !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey) {
        inputBufferRef.current += key;
        term.write(key);
      }
    };

    term.onKey(handleKey);

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [tabId, conversationUrl, sessionApiKey, workingDir]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // ignore
        }
      }, 50);
    }
  }, [isActive]);

  return (
    <div
      className={cn(
        "h-full w-full p-3 bg-[#0a0a0d]",
        !isActive && "hidden",
      )}
    >
      <div ref={containerRef} className="h-full w-full font-mono" />
    </div>
  );
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

  const agentTerminalRef = useTerminal();

  const handleAddTab = () => {
    const newId = `term-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newId,
      name: `Terminal ${tabs.length + 1}`,
      isAgent: false,
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
            <span>{activeTabId === "agent-1" ? "Agent Stream" : "Interactive Shell"}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTabId === "agent-1") {
                clearTerminal();
              }
            }}
            className="p-1 rounded-md hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
            title="Clear Terminal Output"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      {isRuntimeInactive && <WaitingForRuntimeMessage className="pt-16" />}

      {/* Agent Shell Viewport */}
      <div
        className={cn(
          "flex-1 min-h-0 p-3 bg-[#0a0a0d]",
          (activeTabId !== "agent-1" || hideTerminalSurface) && "hidden",
        )}
      >
        <div ref={agentTerminalRef} className="h-full w-full font-mono" />
      </div>

      {/* Empty State for Agent Shell */}
      {activeTabId === "agent-1" && !isRuntimeInactive && !hasOutput && <EmptyTerminalMessage />}

      {/* User Interactive Terminal Tabs */}
      {tabs
        .filter((t) => !t.isAgent)
        .map((t) => (
          <InteractiveUserTerminal
            key={t.id}
            tabId={t.id}
            isActive={t.id === activeTabId}
          />
        ))}
    </div>
  );
}

export default Terminal;
