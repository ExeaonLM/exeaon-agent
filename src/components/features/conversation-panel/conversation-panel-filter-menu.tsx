import React from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Bot,
  CalendarArrowDown,
  Clock3,
  ClockArrowDown,
  Eye,
  EyeOff,
  Folder,
  GitBranch,
  SlidersHorizontal,
  MessageCircle,
  MousePointerClick,
  Star,
  Tag,
  Trash2,
  Workflow,
} from "lucide-react";
import { I18nKey } from "#/i18n/declaration";
import type { BackendKind } from "#/api/backend-registry/types";
import { cn } from "#/utils/utils";
import {
  dropdownInstantColorClassName,
  dropdownMenuListClassName,
} from "#/utils/dropdown-classes";
import {
  UNNAMED_AUTOMATION_FACET,
  type AutomationFilterMode,
  type ConversationSortField,
  type OrganizeMode,
  type ThreadScope,
} from "./conversation-panel-list-helpers";
import { MenuSeparator } from "./menu-separator";
import { MenuRow } from "./menu-row";
import { MenuSubmenuRow } from "./menu-submenu-row";

const capitalizeLabel = (label: string) =>
  label.length > 0 ? label.charAt(0).toUpperCase() + label.slice(1) : label;

export interface ConversationPanelFilterMenuProps {
  filterMenuOpen: boolean;
  setFilterMenuOpen: (open: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  backendKind: BackendKind;
  organizeMode: OrganizeMode;
  setOrganizeMode: (mode: OrganizeMode) => void;
  conversationSort: ConversationSortField;
  setConversationSort: (sort: ConversationSortField) => void;
  threadScope: ThreadScope;
  setThreadScope: (scope: ThreadScope) => void;
  automationFilterMode: AutomationFilterMode;
  setAutomationFilterMode: (mode: AutomationFilterMode) => void;
  selectedAutomationNames: string[];
  onToggleAutomationName: (name: string) => void;
  automationNameFacets: string[];
  showOlderConversations: boolean;
  showArchivedConversations: boolean;
  toggleShowArchivedConversations: () => void;
  toggleShowOlderConversations: () => void;
  showRepoBranchMetadata: boolean;
  toggleShowRepoBranchMetadata: () => void;
  showLlmProfiles: boolean;
  toggleShowLlmProfiles: () => void;
  showTagsMetadata: boolean;
  toggleShowTagsMetadata: () => void;
  showHoverMetadata: boolean;
  toggleShowHoverMetadata: () => void;
  totalConversationsCount: number;
  onRequestDeleteAll: () => void;
}

export function ConversationPanelFilterMenu({
  filterMenuOpen,
  setFilterMenuOpen,
  menuRef,
  backendKind,
  organizeMode,
  setOrganizeMode,
  conversationSort,
  setConversationSort,
  threadScope,
  setThreadScope,
  automationFilterMode,
  setAutomationFilterMode,
  selectedAutomationNames,
  onToggleAutomationName,
  automationNameFacets,
  showOlderConversations,
  showArchivedConversations,
  toggleShowArchivedConversations,
  toggleShowOlderConversations,
  showRepoBranchMetadata,
  toggleShowRepoBranchMetadata,
  showLlmProfiles,
  toggleShowLlmProfiles,
  showTagsMetadata,
  toggleShowTagsMetadata,
  showHoverMetadata,
  toggleShowHoverMetadata,
  totalConversationsCount,
  onRequestDeleteAll,
}: ConversationPanelFilterMenuProps) {
  const { t } = useTranslation("openhands");

  const groupedLabel =
    backendKind === "local"
      ? t(I18nKey.CONVERSATION_PANEL$BY_WORKSPACE)
      : t(I18nKey.CONVERSATION_PANEL$BY_REPOSITORY);

  const closeMenu = () => setFilterMenuOpen(false);
  const metadataShownCount = [
    showRepoBranchMetadata,
    showLlmProfiles,
    showTagsMetadata,
    showHoverMetadata,
  ].filter(Boolean).length;

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuContentRef = React.useRef<HTMLDivElement>(null);

  // When the menu opens, move keyboard focus into it so screen-reader /
  // keyboard-only users can interact with the options immediately. When
  // it closes, return focus to the trigger so Tab order picks up where
  // the user left off.
  const wasOpenRef = React.useRef(filterMenuOpen);
  React.useEffect(() => {
    if (filterMenuOpen) {
      const firstItem =
        menuContentRef.current?.querySelector<HTMLButtonElement>(
          '[role="menuitem"], [role="menuitemradio"]',
        );
      firstItem?.focus();
    } else if (wasOpenRef.current) {
      // Only return focus on a real open→close transition (not the
      // mount-with-open=false case).
      triggerRef.current?.focus();
    }
    wasOpenRef.current = filterMenuOpen;
  }, [filterMenuOpen]);

  // Roving Arrow Up/Down + Escape across the menu items. Tab still works
  // natively; Escape closes the menu and returns focus to the trigger
  // (via the effect above).
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setFilterMenuOpen(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const container = menuContentRef.current;
    if (!container) return;
    const items = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"], [role="menuitemradio"]',
      ),
    ).filter((el) => !el.disabled);
    if (items.length === 0) return;
    const currentIdx = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const start = currentIdx === -1 ? 0 : currentIdx;
    const nextIdx = (start + delta + items.length) % items.length;
    event.preventDefault();
    items[nextIdx]?.focus();
  };

  return (
    <div ref={menuRef} className="relative shrink-0 pr-0.5">
      <button
        ref={triggerRef}
        type="button"
        data-testid="older-conversations-filter-toggle"
        aria-label={t(I18nKey.CONVERSATION_PANEL$FILTER_LABEL)}
        aria-haspopup="menu"
        aria-expanded={filterMenuOpen}
        onClick={() => setFilterMenuOpen(!filterMenuOpen)}
        className={cn(
          "relative inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--oh-muted)] hover:text-white hover:bg-[var(--oh-surface-raised)]",
          dropdownInstantColorClassName,
        )}
      >
        <SlidersHorizontal
          className="lucide lucide-sliders-horizontal shrink-0"
          width={14}
          height={14}
          strokeWidth={2}
          aria-hidden
        />
        {automationFilterMode !== "all" ? (
          <span
            aria-hidden
            data-testid="automation-filter-active-indicator"
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--oh-accent)]"
          />
        ) : null}
      </button>

      {filterMenuOpen ? (
        <div
          ref={menuContentRef}
          role="menu"
          aria-orientation="vertical"
          aria-label={t(I18nKey.CONVERSATION_PANEL$FILTER_LABEL)}
          // `role="menu"` is an interactive ARIA role, so the container
          // must be focusable to satisfy jsx-a11y. `-1` keeps it out of
          // the natural Tab order (the menu items themselves are
          // `<button>`s and tabbable on their own) but still allows the
          // open-effect to focus it / its children programmatically.
          tabIndex={-1}
          data-testid="older-conversations-filter-menu"
          onKeyDown={handleMenuKeyDown}
          // No overflow/scroll on the container: the collapsed rows keep it
          // short, and a scroll context would clip the flyout submenus.
          className={cn(
            "absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-[#2B2316] bg-[#0E0C09]/95 backdrop-blur-md p-1.5 text-[#EDE7D8] shadow-2xl",
            dropdownMenuListClassName,
          )}
        >
          {/* Group by */}
          <MenuSubmenuRow
            icon={Folder}
            testId="filter-group-by"
            label={t(I18nKey.CONVERSATION_PANEL$ORGANIZE)}
            value={
              organizeMode === "grouped"
                ? groupedLabel
                : t(I18nKey.CONVERSATION_PANEL$CHRONOLOGICAL)
            }
            onCloseMenu={closeMenu}
            options={[
              {
                label: groupedLabel,
                icon: Folder,
                selected: organizeMode === "grouped",
                onSelect: () => setOrganizeMode("grouped"),
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$CHRONOLOGICAL),
                icon: Clock3,
                selected: organizeMode === "chronological",
                onSelect: () => setOrganizeMode("chronological"),
              },
            ]}
          />

          {/* Sort by */}
          <MenuSubmenuRow
            icon={ClockArrowDown}
            testId="filter-sort-by"
            label={t(I18nKey.CONVERSATION_PANEL$SORT_BY)}
            value={
              conversationSort === "updated"
                ? t(I18nKey.CONVERSATION_PANEL$SORT_UPDATED)
                : t(I18nKey.CONVERSATION_PANEL$SORT_CREATED)
            }
            onCloseMenu={closeMenu}
            options={[
              {
                label: t(I18nKey.CONVERSATION_PANEL$SORT_UPDATED),
                icon: ClockArrowDown,
                selected: conversationSort === "updated",
                onSelect: () => setConversationSort("updated"),
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$SORT_CREATED),
                icon: CalendarArrowDown,
                selected: conversationSort === "created",
                onSelect: () => setConversationSort("created"),
              },
            ]}
          />

          {/* Show (thread scope) */}
          <MenuSubmenuRow
            icon={MessageCircle}
            testId="filter-show"
            label={t(I18nKey.CONVERSATION_PANEL$SHOW)}
            value={
              threadScope === "all"
                ? t(I18nKey.CONVERSATION_PANEL$ALL_THREADS)
                : t(I18nKey.CONVERSATION_PANEL$RELEVANT_THREADS)
            }
            onCloseMenu={closeMenu}
            options={[
              {
                label: t(I18nKey.CONVERSATION_PANEL$ALL_THREADS),
                icon: MessageCircle,
                selected: threadScope === "all",
                onSelect: () => setThreadScope("all"),
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$RELEVANT_THREADS),
                icon: Star,
                selected: threadScope === "relevant",
                onSelect: () => setThreadScope("relevant"),
              },
            ]}
          />

          <MenuRow
            icon={Archive}
            label={t(I18nKey.CONVERSATION_PANEL$SHOW_ARCHIVED)}
            selected={showArchivedConversations}
            testId="toggle-show-archived"
            onClick={() => {
              toggleShowArchivedConversations();
              setFilterMenuOpen(false);
            }}
          />

          <MenuSeparator />

          {/* Automations */}
          <MenuSubmenuRow
            icon={Workflow}
            testId="filter-automations"
            label={t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS)}
            value={
              automationFilterMode === "all"
                ? t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS_ALL)
                : automationFilterMode === "hide-automations"
                  ? t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS_HIDE)
                  : t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS_ONLY)
            }
            onCloseMenu={closeMenu}
            options={[
              {
                label: t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS_ALL),
                icon: MessageCircle,
                selected: automationFilterMode === "all",
                testId: "automation-filter-all",
                onSelect: () => setAutomationFilterMode("all"),
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS_HIDE),
                icon: EyeOff,
                selected: automationFilterMode === "hide-automations",
                testId: "automation-filter-hide",
                onSelect: () => setAutomationFilterMode("hide-automations"),
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$AUTOMATIONS_ONLY),
                icon: Workflow,
                selected: automationFilterMode === "only-automations",
                testId: "automation-filter-only",
                onSelect: () => setAutomationFilterMode("only-automations"),
              },
            ]}
          />
          {automationFilterMode === "only-automations"
            ? automationNameFacets.map((facet) => (
                <MenuRow
                  key={facet}
                  icon={Tag}
                  label={
                    facet === UNNAMED_AUTOMATION_FACET
                      ? t(I18nKey.CONVERSATION_PANEL$AUTOMATION_UNNAMED)
                      : facet
                  }
                  selected={selectedAutomationNames.includes(facet)}
                  testId={`automation-name-filter-${facet}`}
                  // Multi-select name rows keep the menu open so several names
                  // can be toggled in one visit.
                  onClick={() => onToggleAutomationName(facet)}
                />
              ))
            : null}

          <MenuSeparator />

          {/* Display (metadata toggles — multi-select, keeps the flyout open) */}
          <MenuSubmenuRow
            icon={Eye}
            testId="filter-display"
            label={t(I18nKey.CONVERSATION_PANEL$METADATA)}
            value={String(metadataShownCount)}
            onCloseMenu={closeMenu}
            options={[
              {
                label: t(I18nKey.CONVERSATION_PANEL$REPO_BRANCH),
                icon: GitBranch,
                selected: showRepoBranchMetadata,
                testId: "toggle-repo-branch-metadata",
                keepOpen: true,
                onSelect: toggleShowRepoBranchMetadata,
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$LLM_MODEL),
                icon: Bot,
                selected: showLlmProfiles,
                testId: "toggle-llm-profiles",
                keepOpen: true,
                onSelect: toggleShowLlmProfiles,
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$TAGS),
                icon: Tag,
                selected: showTagsMetadata,
                testId: "toggle-tags-metadata",
                keepOpen: true,
                onSelect: toggleShowTagsMetadata,
              },
              {
                label: t(I18nKey.CONVERSATION_PANEL$HOVER_METADATA),
                icon: MousePointerClick,
                selected: showHoverMetadata,
                testId: "toggle-hover-metadata",
                keepOpen: true,
                onSelect: toggleShowHoverMetadata,
              },
            ]}
          />

          <MenuSeparator />
          <MenuRow
            testId="toggle-older-conversations"
            icon={showOlderConversations ? EyeOff : Eye}
            label={
              showOlderConversations
                ? capitalizeLabel(t(I18nKey.CONVERSATION$HIDE))
                : capitalizeLabel(t(I18nKey.CONVERSATION$SHOW_ALL))
            }
            onClick={() => {
              toggleShowOlderConversations();
              setFilterMenuOpen(false);
            }}
          />

          <MenuSeparator />
          <MenuRow
            testId="delete-all-conversations"
            icon={Trash2}
            label={capitalizeLabel(t(I18nKey.CONVERSATION$DELETE_ALL))}
            disabled={totalConversationsCount === 0}
            onClick={() => {
              if (totalConversationsCount === 0) return;
              onRequestDeleteAll();
              setFilterMenuOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
