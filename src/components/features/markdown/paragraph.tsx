import React from "react";
import { ExtraProps } from "react-markdown";

export function paragraph({
  children,
}: React.ClassAttributes<HTMLParagraphElement> &
  React.HTMLAttributes<HTMLParagraphElement> &
  ExtraProps) {
  return (
    <p className="py-1.5 leading-relaxed text-[var(--cool-grey-300)] first:pt-0 last:pb-0 font-normal">
      {children}
    </p>
  );
}
