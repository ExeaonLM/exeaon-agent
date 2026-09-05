import type { MCPConfig } from "@openhands/typescript-client";
import type { MCPServerConfig } from "#/types/mcp-server";
import { getMcpServerEnabled } from "./mcp-config";
import { isManagedMcpName } from "./engineering-mcp-managed";

export function flattenMcpConfig(config: MCPConfig): MCPServerConfig[] {
  return Object.entries(config)
    // System-managed Engineering-field MCP servers (exeaon-field-*) are owned by
    // Exeaon and reconciled by field+mode — never surface them in the user's
    // MCP list, so they can't be edited, disabled, or removed.
    .filter(([settingsKey]) => !isManagedMcpName(settingsKey))
    .map(([settingsKey, server]) =>
    server.transport === "stdio"
      ? {
          id: settingsKey,
          type: "stdio",
          name: settingsKey,
          command: server.command,
          args: server.args ?? undefined,
          env: server.env ?? undefined,
          enabled: getMcpServerEnabled(server),
        }
      : {
          id: settingsKey,
          type: server.transport === "sse" ? "sse" : "shttp",
          name: settingsKey,
          url: server.url,
          headers: server.headers ?? undefined,
          timeout: server.timeout ?? undefined,
          auth: server.auth ?? undefined,
          enabled: getMcpServerEnabled(server),
        },
  );
}
