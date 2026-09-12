import { cn } from "#/utils/utils";
import { dropdownMenuListGapClassName } from "#/utils/dropdown-classes";

/** Match conversation panel filter and other sidebar menus in Dark Void theme */
export const NEW_CONVERSATION_DROPDOWN_SURFACE = cn(
  "z-50 flex flex-col rounded-xl border border-[#2B2316] bg-[#0E0C09]/95 backdrop-blur-md p-1.5 text-white shadow-2xl min-w-[210px]",
  dropdownMenuListGapClassName,
);
