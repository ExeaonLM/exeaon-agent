import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Bug, Code2, Workflow, BookOpen, Boxes } from "lucide-react";
import { I18nKey } from "#/i18n/declaration";

export type Suggestion = { label: I18nKey | string; value: string };

interface SuggestionItemProps {
  suggestion: Suggestion;
  onClick: (value: string) => void;
}

export function SuggestionItem({ suggestion, onClick }: SuggestionItemProps) {
  const { t } = useTranslation("openhands");

  const itemIcon = useMemo(() => {
    switch (suggestion.label) {
      case "INCREASE_TEST_COVERAGE":
        return (
          <Sparkles className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
      case "AUTO_MERGE_PRS":
        return (
          <Bug className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
      case "FIX_README":
        return (
          <Code2 className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
      case "CLEAN_DEPENDENCIES":
        return (
          <Workflow className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
      case "ADD_DOCS":
        return (
          <BookOpen className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
      case "ADD_DOCKERFILE":
        return (
          <Boxes className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
      default:
        return (
          <Sparkles className="size-4 text-[#FFD026] group-hover:scale-110 transition-transform duration-200 shrink-0" />
        );
    }
  }, [suggestion]);

  return (
    <button
      type="button"
      className="group list-none border border-[#2B2316] bg-[#120F0A]/90 hover:bg-[#1C1812] hover:border-[#FFD026]/40 hover:shadow-[0_0_20px_rgba(255,208,38,0.06)] rounded-[14px] transition-all duration-200 flex items-center justify-center cursor-pointer gap-2.5 h-[52px] px-5 min-w-[210px]"
      onClick={() => onClick(suggestion.value)}
    >
      {itemIcon}
      <span
        data-testid="suggestion"
        className="text-[14px] font-medium leading-5 text-[#EDEDED] group-hover:text-white transition-colors cursor-pointer select-none"
      >
        {t(suggestion.label)}
      </span>
    </button>
  );
}

