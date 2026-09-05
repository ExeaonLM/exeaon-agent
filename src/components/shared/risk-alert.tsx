import { ReactNode } from "react";
import { cn } from "#/utils/utils";

interface RiskAlertProps {
  className?: string;
  content: ReactNode;
  icon?: ReactNode;
  severity: "high" | "medium" | "low";
  title: string;
}

export function RiskAlert({
  className,
  content,
  icon,
  severity,
  title,
}: RiskAlertProps) {
  // Currently, we are only supporting the high risk alert. If we use want to support other risk levels, we can add them here and use cva to create different variants of this component.
  if (severity === "high") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 bg-[#4A0709] border border-[#FF0006] text-red-200 rounded-xl px-3.5 py-2.5 min-h-[48px] text-xs leading-relaxed",
          className,
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="font-bold shrink-0 text-white">{title}</span>
        <span className="font-normal">{content}</span>
      </div>
    );
  }

  return null;
}
