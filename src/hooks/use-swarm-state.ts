import { useMemo } from "react";
import { useEventStore } from "#/stores/use-event-store";
import { useConversationStore } from "#/stores/conversation-store";
import {
  isActionEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import { textFromContent } from "#/components/features/chat/tool-visualizers/text-content";

function safeExtractText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof content === "object") {
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content).trim();
}

export type SwarmOperativeStatus = "running" | "done" | "error";

export type CyberNodeKind =
  | "swarm"
  | "recon"
  | "web"
  | "cloud"
  | "audit"
  | "auth"
  | "vpn"
  | "terminal"
  | "tool";

export interface SwarmOperative {
  /** Stable node id (action event id). */
  id: string;
  /** Sub-agent type or tool name, e.g. "cyber-operative", "recon-httpx", "web-nuclei". */
  subagent: string;
  /** The mission prompt or tool parameters / target. */
  mission: string;
  status: SwarmOperativeStatus;
  /** The operative or tool's returned result (once finished). */
  result?: string;
  /** 1-based summon/execution order, for stable layout + labels. */
  index: number;
  /** Node kind/category for ComfyUI style visual differentiation */
  kind: CyberNodeKind;
  /** Full action command or parameter payload for inspection */
  details?: string;
  /** Timestamp when action was issued */
  timestamp?: string;
}

export interface SwarmState {
  operatives: SwarmOperative[];
  running: number;
  done: number;
  error: number;
  /** True once at least one operative or cyber tool has been executed. */
  active: boolean;
  /** Cyber field or swarm active flag */
  isCyberField: boolean;
}

function classifyCyberTool(toolName: string): { kind: CyberNodeKind; name: string } | null {
  const cleanName = toolName.replace(/^(cyber[-_]unified[-_]|mcp[-_])/, "").toLowerCase();

  if (
    cleanName.startsWith("recon-") ||
    [
      "nmap",
      "httpx",
      "subfinder",
      "dnsx",
      "amass",
      "assetfinder",
      "katana",
      "waybackurls",
      "gowitness",
      "tlsx",
      "cero",
      "uncover",
      "shuffledns",
      "alterx",
    ].some((t) => cleanName.includes(t))
  ) {
    return { kind: "recon", name: cleanName };
  }

  if (
    cleanName.startsWith("web-") ||
    [
      "nuclei",
      "ffuf",
      "dalfox",
      "sqlmap",
      "commix",
      "sslscan",
      "wpscan",
      "arjun",
      "smuggler",
      "nextjs",
    ].some((t) => cleanName.includes(t))
  ) {
    return { kind: "web", name: cleanName };
  }

  if (
    cleanName.startsWith("cloud-") ||
    [
      "trivy",
      "prowler",
      "kubeaudit",
      "checkov",
      "scout",
      "kube-bench",
      "kube-hunter",
    ].some((t) => cleanName.includes(t))
  ) {
    return { kind: "cloud", name: cleanName };
  }

  if (
    cleanName.startsWith("code-") ||
    ["semgrep", "gitleaks", "trufflehog"].some((t) => cleanName.includes(t))
  ) {
    return { kind: "audit", name: cleanName };
  }

  if (
    cleanName.startsWith("auth-") ||
    [
      "hydra",
      "hashcat",
      "crackmapexec",
      "bloodhound",
      "caldera",
      "msfconsole",
    ].some((t) => cleanName.includes(t))
  ) {
    return { kind: "auth", name: cleanName };
  }

  if (cleanName.includes("vpn") || cleanName.includes("wireguard")) {
    return { kind: "vpn", name: cleanName };
  }

  return null;
}

/**
 * Derives the live cyber activity & swarm state from the conversation event stream.
 * Indexes:
 *  1. Swarm multi-agent operatives (`TaskAction` / `TaskObservation`)
 *  2. MCP Cyber Unified tool executions (`recon-*`, `web-*`, `cloud-*`, etc.)
 *  3. Terminal bash commands executed under Cyber field
 * Drives the live ComfyUI-style cyber pipeline graph in real-time.
 */
export function useSwarmState(): SwarmState {
  const events = useEventStore((s) => s.events);
  const engineeringField = useConversationStore((s) => s.engineeringField);
  const isCyberField = engineeringField === "cyber";

  return useMemo(() => {
    const byId = new Map<string, SwarmOperative>();
    let index = 0;

    for (const event of events) {
      if (!isActionEvent(event)) continue;
      const eid = String(event.id);
      if (byId.has(eid)) continue;

      // 1. Swarm Operatives (TaskAction)
      if (event.action?.kind === "TaskAction") {
        index += 1;
        const action = event.action as {
          subagent_type?: string;
          prompt?: string;
        };
        const prompt = (action.prompt ?? "").trim();
        byId.set(eid, {
          id: eid,
          subagent: action.subagent_type ?? "cyber-operative",
          mission: prompt,
          status: "running",
          index,
          kind: "swarm",
          details: prompt,
          timestamp: event.timestamp,
        });
        continue;
      }

      // 2. MCP Cyber Tool Executions
      const eventRecord = event as unknown as Record<string, unknown>;
      const actionRecord = event.action as unknown as
        | Record<string, unknown>
        | undefined;
      const toolName =
        event.tool_name ||
        (typeof actionRecord?.kind === "string" ? actionRecord.kind : "");
      const toolClass = classifyCyberTool(toolName);
      if (toolClass) {
        index += 1;
        const toolCallRecord = eventRecord.tool_call as
          | { function?: { arguments?: unknown } }
          | undefined;
        const data =
          actionRecord?.data || toolCallRecord?.function?.arguments;
        let missionSummary = "";
        let detailsStr = "";

        if (typeof data === "object" && data !== null) {
          const dataRecord = data as Record<string, unknown>;
          missionSummary = String(
            dataRecord.target ||
            dataRecord.url ||
            dataRecord.domain ||
            dataRecord.command ||
            dataRecord.query ||
            dataRecord.host ||
            "",
          );
          detailsStr = JSON.stringify(data, null, 2);
        } else if (typeof data === "string") {
          missionSummary = data;
          detailsStr = data;
        }

        if (!missionSummary) {
          missionSummary = event.summary || toolClass.name;
        }

        byId.set(eid, {
          id: eid,
          subagent: toolClass.name,
          mission: missionSummary.trim(),
          status: "running",
          index,
          kind: toolClass.kind,
          details: detailsStr || missionSummary,
          timestamp: event.timestamp,
        });
        continue;
      }

      // 3. Bash & Terminal Commands (Under Cyber Field or matching security utilities)
      if (
        event.action?.kind === "ExecuteBashAction" ||
        event.action?.kind === "TerminalAction"
      ) {
        const cmd = String(actionRecord?.command ?? "").trim();
        const firstToken = cmd.split(/[\s;]/)[0].replace(/^.*[/\\]/, "").replace(/\.(exe|bat|cmd|sh)$/i, "");
        const cmdClass = classifyCyberTool(firstToken);

        if (cmdClass || isCyberField) {
          index += 1;
          byId.set(eid, {
            id: eid,
            subagent: cmdClass ? cmdClass.name : (firstToken || "bash"),
            mission: cmd,
            status: "running",
            index,
            kind: cmdClass ? cmdClass.kind : "terminal",
            details: cmd,
            timestamp: event.timestamp,
          });
        }
      }
    }

    // Resolve Observations
    for (const event of events) {
      if (!isObservationEvent(event)) continue;
      const eventRecord = event as unknown as Record<string, unknown>;
      const actionId = String(eventRecord.action_id ?? "");
      const op = byId.get(actionId);
      if (!op) continue;

      if (event.observation?.kind === "TaskObservation") {
        const obs = event.observation as {
          is_error?: boolean;
          content?: unknown;
        };
        op.status = obs.is_error ? "error" : "done";
        op.result = safeExtractText(obs.content);
      } else if (
        event.observation?.kind === "ExecuteBashObservation" ||
        event.observation?.kind === "TerminalObservation"
      ) {
        const obs = event.observation as {
          exit_code?: number;
          is_error?: boolean;
          content?: unknown;
        };
        op.status =
          (obs.exit_code === 0 || !obs.is_error) ? "done" : "error";
        op.result = safeExtractText(obs.content);
      } else {
        const obs = event.observation as
          | { is_error?: boolean; content?: unknown; output?: unknown }
          | undefined;
        const hasErr = Boolean(obs?.is_error || eventRecord.error);
        op.status = hasErr ? "error" : "done";
        const resText = safeExtractText(obs?.content);
        op.result =
          resText ||
          (typeof obs === "string" ? obs : typeof obs?.output === "string" ? obs.output : JSON.stringify(obs ?? ""));
      }
    }

    const operatives = Array.from(byId.values()).sort(
      (a, b) => a.index - b.index,
    );

    return {
      operatives,
      running: operatives.filter((o) => o.status === "running").length,
      done: operatives.filter((o) => o.status === "done").length,
      error: operatives.filter((o) => o.status === "error").length,
      active: operatives.length > 0,
      isCyberField,
    };
  }, [events, isCyberField]);
}
