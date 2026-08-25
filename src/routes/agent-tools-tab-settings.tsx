import React, { useState } from "react";
import { Terminal, FileCode, Globe, Sparkles, Layers, ShieldCheck, ChevronDown, ChevronRight, Cpu, Wrench } from "lucide-react";
import { Typography } from "#/ui/typography";
import { ToolParameters } from "#/components/features/conversation-panel/system-message-modal/tool-parameters";
import { Pre } from "#/ui/pre";

interface ToolItemDef {
  name: string;
  category: "execution" | "filesystem" | "network" | "orchestration" | "custom";
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

const REGISTERED_TOOLS: ToolItemDef[] = [
  {
    name: "terminal_command",
    category: "execution",
    description:
      "Executes bash/powershell commands inside the sovereign workspace sandbox. Handles interactive inputs, background daemons, and captures standard output & standard error streams with timeout protection.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute in the workspace directory.",
        },
        timeout_seconds: {
          type: "integer",
          description: "Maximum execution duration before terminating the process.",
        },
        is_background: {
          type: "boolean",
          description: "Whether to run the command as a persistent background daemon.",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "file_editor",
    category: "filesystem",
    description:
      "Performs structured file operations including viewing code with slice ranges, creating new files, surgical contiguous line replacements, and fuzzy diff validation.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The file operation to perform.",
          enum: ["view", "write", "replace_content", "find_by_name", "grep_search"],
        },
        path: {
          type: "string",
          description: "Target absolute or relative file path in the workspace.",
        },
        start_line: {
          type: "integer",
          description: "Optional 1-indexed start line for viewing or replacing content.",
        },
        end_line: {
          type: "integer",
          description: "Optional 1-indexed end line for viewing or replacing content.",
        },
        content: {
          type: "string",
          description: "The text or replacement snippet to write into the file.",
        },
      },
      required: ["action", "path"],
    },
  },
  {
    name: "browser_engine",
    category: "network",
    description:
      "Interacts with web pages, API endpoints, documentation hubs, and external resources. Supports URL fetching, markdown parsing, and web search querying.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The target HTTP/HTTPS URL to fetch or navigate to.",
        },
        query: {
          type: "string",
          description: "Search keywords or semantic query string for web lookup.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "agent_skills",
    category: "orchestration",
    description:
      "Discovers, loads, and invokes microagents and domain-specific knowledge packages dynamically based on active conversation intent.",
    parameters: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          description: "Identifier of the skill to inspect or activate from the skills catalog.",
        },
        scope: {
          type: "string",
          description: "Scope filter for the skill lookup.",
          enum: ["project", "personal", "public"],
        },
      },
      required: ["skill_name"],
    },
  },
  {
    name: "subagent_orchestrator",
    category: "orchestration",
    description:
      "Spawns isolated subagents with specialized system prompts and tool subsets to solve parallel reasoning and research tasks concurrently.",
    parameters: {
      type: "object",
      properties: {
        task_type: {
          type: "string",
          description: "Type of subagent to invoke (e.g., 'research', 'self', 'critic').",
        },
        prompt: {
          type: "string",
          description: "Actionable instructions and objective delegated to the subagent.",
        },
      },
      required: ["task_type", "prompt"],
    },
  },
];

export function AgentToolsTabSettings() {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({
    0: true,
  });

  const toggleIndex = (idx: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div data-testid="agent-tools-tab-settings" className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-raised border border-[var(--oh-border)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-tertiary-light uppercase tracking-wider">
            <Cpu className="size-3.5 text-amber-500" />
            Agent Engine
          </div>
          <div className="text-base font-bold text-foreground">CodeActAgent</div>
          <div className="text-xs text-tertiary-light">Exeaon Sovereign Core Stack</div>
        </div>

        <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-raised border border-[var(--oh-border)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-tertiary-light uppercase tracking-wider">
            <Wrench className="size-3.5 text-amber-500" />
            Active Tools
          </div>
          <div className="text-base font-bold text-foreground">
            {REGISTERED_TOOLS.length} Registered
          </div>
          <div className="text-xs text-tertiary-light">JSON Schema Function Calling</div>
        </div>

        <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-raised border border-[var(--oh-border)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-tertiary-light uppercase tracking-wider">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Sandbox Security
          </div>
          <div className="text-base font-bold text-foreground">Isolated Workspace</div>
          <div className="text-xs text-tertiary-light">Zero-leak boundary enforcement</div>
        </div>
      </div>

      {/* Tools List Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Registered Agent Tools
            </h3>
            <p className="text-xs text-tertiary-light">
              Interactive schemas and parameter definitions available to the agent.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
            OpenAI Tools Spec
          </span>
        </div>

        <div className="flex flex-col divide-y divide-[var(--oh-border)] rounded-xl border border-[var(--oh-border)] bg-surface-raised overflow-hidden">
          {REGISTERED_TOOLS.map((tool, idx) => {
            const isExpanded = !!expandedIndices[idx];
            return (
              <div key={tool.name} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleIndex(idx)}
                  className="flex items-center justify-between w-full px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-surface border border-[var(--oh-border)] text-amber-500">
                      {tool.category === "execution" && <Terminal className="size-4" />}
                      {tool.category === "filesystem" && <FileCode className="size-4" />}
                      {tool.category === "network" && <Globe className="size-4" />}
                      {tool.category === "orchestration" && <Sparkles className="size-4" />}
                      {tool.category === "custom" && <Layers className="size-4" />}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold font-mono text-foreground">
                        {tool.name}
                      </span>
                      <span className="text-xs text-tertiary-light line-clamp-1">
                        {tool.description}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-tertiary text-tertiary-light uppercase tracking-wider font-semibold">
                      {tool.category}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-tertiary-light" />
                    ) : (
                      <ChevronRight className="size-4 text-tertiary-light" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[var(--oh-border)] bg-black/10 flex flex-col gap-3">
                    <p className="text-xs text-tertiary-light leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-tertiary-light uppercase tracking-wider">
                        Parameters Schema
                      </span>
                      <ToolParameters parameters={tool.parameters} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* System Prompt & Instructions Metadata */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            System Prompt & Runtime Protocols
          </h3>
          <p className="text-xs text-tertiary-light">
            Core operating instructions and behavioral protocols provided to the model.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--oh-border)] bg-surface-raised p-4">
          <Pre
            size="small"
            font="mono"
            lineHeight="relaxed"
            padding="medium"
            className="text-[var(--oh-text-tertiary)] max-h-64 overflow-y-auto"
          >
{`You are Exeaon Claw, an expert sovereign AI coding assistant designed to solve complex software engineering tasks autonomously.

Operational Directives:
1. Thoroughly explore repository structure and analyze relevant files before making modifications.
2. Execute focused, single-purpose edits with exact character accuracy.
3. Validate changes by compiling and running tests in the workspace terminal.
4. Provide concise, high-signal explanations accompanied by clickable file links.`}
          </Pre>
        </div>
      </div>
    </div>
  );
}

export default AgentToolsTabSettings;
