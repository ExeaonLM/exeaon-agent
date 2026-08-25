import { AppWindow, Brain, Shield, Sparkles, User, Wrench } from "lucide-react";
import KeyIcon from "#/icons/key.svg?react";
import MemoryIcon from "#/icons/memory_icon.svg?react";
import CircuitIcon from "#/icons/u-circuit.svg?react";
import RobotIcon from "#/icons/u-robot.svg?react";

export interface SettingsNavItem {
  icon: React.ReactElement;
  to: string;
  text: string;
  /** Short grey subline under the page title (`settings.tsx`). */
  subtitle: string;
}

export const OSS_NAV_ITEMS: SettingsNavItem[] = [
  {
    icon: <RobotIcon width={16} height={16} />,
    to: "/settings/agents",
    text: "Agent Profiles",
    subtitle: "Create and manage reusable agent setups",
  },
  {
    icon: <CircuitIcon width={16} height={16} />,
    to: "/settings/llm",
    text: "Models",
    subtitle: "Exeaon cluster models & capabilities",
  },
  {
    icon: <Sparkles className="size-4" strokeWidth={2} aria-hidden />,
    to: "/settings/skills",
    text: "Skills",
    subtitle: "Microagent capabilities, knowledge packages and tool integrations",
  },
  {
    icon: <Wrench className="size-4" strokeWidth={2} aria-hidden />,
    to: "/settings/tools",
    text: "Agent Tools",
    subtitle: "Inspect registered runtime tools, schemas and system protocols",
  },
  {
    icon: <MemoryIcon width={16} height={16} />,
    to: "/settings/condenser",
    text: "Compactor",
    subtitle: "Configure automatic conversation compaction",
  },
  {
    icon: <Brain className="size-4" strokeWidth={2} aria-hidden />,
    to: "/settings/agent-context",
    text: "Context",
    subtitle: "Persistent memory, instructions & workspace rules",
  },
  {
    icon: <Shield className="size-4" strokeWidth={2} aria-hidden />,
    to: "/settings/verification",
    text: "Validation",
    subtitle: "Validation workflows and security boundaries",
  },
  {
    icon: <AppWindow className="size-4" strokeWidth={2} aria-hidden />,
    to: "/settings/app",
    text: "Appearance",
    subtitle: "Themes, UI customizations, and workspace display",
  },
  {
    icon: <User className="size-4" strokeWidth={2} aria-hidden />,
    to: "/settings/account",
    text: "Account & Cloud",
    subtitle: "Organization, usage quotas, and execution clusters",
  },
  {
    icon: <KeyIcon width={16} height={16} />,
    to: "/settings/secrets",
    text: "Secrets",
    subtitle: "Manage API keys and environment variables",
  },
];
