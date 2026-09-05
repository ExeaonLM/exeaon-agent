import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MCPServer } from "@openhands/typescript-client";
import {
  useConversationStore,
  type EngineeringField,
  type ExecutionMode,
} from "#/stores/conversation-store";
import SettingsService from "#/api/settings-service/settings-service.api";
import {
  MANAGED_MCP_PREFIX,
  allManagedMcpNames,
  buildManagedMcpConfig,
} from "#/utils/engineering-mcp-managed";

interface McpRuntimePaths {
  mcpRoot: string;
  nodePath: string;
  pythonPath: string;
  cyberUnifiedExists: boolean;
  windowsMcpExists: boolean;
  calderaMcpExists: boolean;
  cyborgSimExists: boolean;
}

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Reconcile the agent's global `mcp_config` so exactly the managed field MCP
 * servers for the given (field, mode) — and only those whose build exists on
 * disk — are enabled; every other `exeaon-field-*` server is removed. The
 * user's own MCP servers are never touched.
 *
 * This is the shared worker behind both the reactive hook (fires on field/mode
 * change) AND the launch path (awaited by the home composer BEFORE
 * `createConversation` snapshots settings). The latter is essential: a
 * conversation bakes its `mcp_config` from settings at creation time, so if the
 * managed servers aren't written yet the very first turn launches with NO cyber
 * tools — the model then reports the tools "unavailable" and falls back to the
 * shell. Awaiting this before create closes that race.
 *
 * Desktop-only: it resolves the vendored MCP paths through the
 * `mcp_runtime_paths` Tauri command, so on the web build (no Tauri) it is a
 * no-op and the context directive is the only signal the agent gets. Best-effort
 * throughout — a failure here must never break launching a conversation.
 */
export async function reconcileEngineeringMcp(
  engineeringField: EngineeringField,
  executionMode: ExecutionMode,
): Promise<void> {
  if (!isTauri()) return;

  const paths = await invoke<McpRuntimePaths>("mcp_runtime_paths").catch(
    () => null,
  );
  if (!paths || !paths.mcpRoot) return;

  const managed = buildManagedMcpConfig(engineeringField, executionMode, {
    nodePath: paths.nodePath,
    pythonPath: paths.pythonPath,
    mcpRoot: paths.mcpRoot,
  });

  // Only enable servers whose build/output is actually present.
  const buildExists: Record<string, boolean> = {
    [`${MANAGED_MCP_PREFIX}cyber-unified`]: paths.cyberUnifiedExists,
    [`${MANAGED_MCP_PREFIX}device-windows`]: paths.windowsMcpExists,
    [`${MANAGED_MCP_PREFIX}cyber-caldera`]: paths.calderaMcpExists,
    [`${MANAGED_MCP_PREFIX}cyber-sim`]: paths.cyborgSimExists,
  };

  for (const name of allManagedMcpNames()) {
    const cfg = managed[name];
    const shouldEnable = Boolean(cfg) && buildExists[name] !== false;
    try {
      if (shouldEnable && cfg) {
        const server = {
          transport: "stdio",
          command: cfg.command,
          args: cfg.args ?? [],
          env: cfg.env ?? {},
        } as unknown as MCPServer;
        await SettingsService.createMcpServer(name, server);
      } else {
        // Remove any stale managed server for an inactive field/mode.
        await SettingsService.deleteMcpServer(name).catch(() => {});
      }
    } catch {
      // Reconcile is best-effort; a failure here must never break chat.
    }
  }
}

/**
 * Keeps the agent's `mcp_config` in sync with the active Engineering field +
 * execution mode while a conversation is open. On any change it enables exactly
 * the managed field MCP servers that apply. The FIRST launch is handled at the
 * composer instead (see {@link reconcileEngineeringMcp}); this hook covers
 * mid-conversation field/mode switches.
 */
export function useEngineeringMcpReconcile() {
  const engineeringField = useConversationStore((s) => s.engineeringField);
  const executionMode = useConversationStore((s) => s.executionMode);

  useEffect(() => {
    void reconcileEngineeringMcp(engineeringField, executionMode);
  }, [engineeringField, executionMode]);
}
