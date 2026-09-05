import React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { BrandButton } from "#/components/features/settings/brand-button";
import { AddSkillModal } from "#/components/features/skills/add-skill-modal";
import { SkillCard } from "#/components/features/skills/skill-card";
import { SkillDetailModal } from "#/components/features/skills/skill-detail-modal";
import { SkillFacetRail } from "#/components/features/skills/skill-facet-rail";
import { SkillFiltersModal } from "#/components/features/skills/skill-filters-modal";
import {
  applySkillFilters,
  buildSkillFacetGroups,
  clearSkillFilterFacets,
  countActiveFilters,
  parseSkillFilterState,
  SKILL_FILTER_QUERY_PARAM,
  toggleSkillFilterValue,
  toSkillFilterSearchParams,
  type SkillFacetGroupId,
  type SkillFilterState,
} from "#/components/features/skills/skill-filter";
import { SkillsToolbar } from "#/components/features/skills/skills-toolbar";
import { useSaveSettings } from "#/hooks/mutation/use-save-settings";
import { useSettings } from "#/hooks/query/use-settings";
import { useSkills } from "#/hooks/query/use-skills";
import { I18nKey } from "#/i18n/declaration";
import type { SkillInfo } from "#/types/settings";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import {
  extensionModuleCardGridClassName,
  extensionModuleCardGridContainerClassName,
  extensionModuleEmptyStateClassName,
} from "#/utils/extension-module-card-classes";
import { retrieveAxiosErrorMessage } from "#/utils/retrieve-axios-error-message";
import { cn } from "#/utils/utils";

const SEARCH_URL_SYNC_DELAY_MS = 300;

export function SkillsTabSettings() {
  const { t } = useTranslation("openhands");

  const { mutate: saveSettings } = useSaveSettings();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: skills, isLoading: skillsLoading } = useSkills();

  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = React.useState(
    () => searchParams.get(SKILL_FILTER_QUERY_PARAM) ?? "",
  );
  const lastWrittenQuery = React.useRef(queryInput);

  const [disabledSet, setDisabledSet] = React.useState<Set<string>>(new Set());
  const [hasHydratedInitialSettings, setHasHydratedInitialSettings] =
    React.useState(false);
  const [selectedSkill, setSelectedSkill] = React.useState<SkillInfo | null>(
    null,
  );
  const [showAddSkillModal, setShowAddSkillModal] = React.useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = React.useState(false);

  const isLoading = settingsLoading || skillsLoading || !settings;
  const allSkills = skills ?? [];

  const filter = React.useMemo<SkillFilterState>(
    () => ({ ...parseSkillFilterState(searchParams), query: queryInput }),
    [searchParams, queryInput],
  );

  const groups = React.useMemo(
    () => buildSkillFacetGroups(allSkills, disabledSet, filter),
    [allSkills, disabledSet, filter],
  );

  const visibleSkills = React.useMemo(
    () => applySkillFilters(allSkills, disabledSet, filter),
    [allSkills, disabledSet, filter],
  );

  const activeFilterCount = countActiveFilters(filter);

  React.useEffect(() => {
    if (settingsLoading || !settings) return;
    setDisabledSet(new Set(settings.disabled_skills ?? []));
    setHasHydratedInitialSettings(true);
  }, [settingsLoading, settings?.disabled_skills]);

  React.useEffect(() => {
    if (!hasHydratedInitialSettings) return;
    saveSettings(
      { disabled_skills: Array.from(disabledSet) },
      {
        onError: (error) => {
          const errorMessage = retrieveAxiosErrorMessage(error);
          displayErrorToast(errorMessage || t(I18nKey.ERROR$GENERIC));
        },
      },
    );
  }, [disabledSet, hasHydratedInitialSettings, saveSettings, t]);

  React.useEffect(() => {
    const current = searchParams.get(SKILL_FILTER_QUERY_PARAM) ?? "";
    if (current === lastWrittenQuery.current) return;
    lastWrittenQuery.current = current;
    setQueryInput(current);
  }, [searchParams]);

  React.useEffect(() => {
    const current = searchParams.get(SKILL_FILTER_QUERY_PARAM) ?? "";
    if (current === queryInput) return undefined;

    const timeout = setTimeout(() => {
      lastWrittenQuery.current = queryInput;
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (queryInput) {
            next.set(SKILL_FILTER_QUERY_PARAM, queryInput);
          } else {
            next.delete(SKILL_FILTER_QUERY_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    }, SEARCH_URL_SYNC_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [queryInput, searchParams, setSearchParams]);

  const handleFilterChange = (next: SkillFilterState) => {
    if (next.query !== filter.query) setQueryInput(next.query);

    const facetsChanged =
      toSkillFilterSearchParams({ ...next, query: "" }).toString() !==
      toSkillFilterSearchParams({ ...filter, query: "" }).toString();
    if (facetsChanged) setSearchParams(toSkillFilterSearchParams(next));
  };

  const handleToggleFacet = (groupId: SkillFacetGroupId, value: string) =>
    handleFilterChange(toggleSkillFilterValue(filter, groupId, value));

  const handleClearFacets = () =>
    handleFilterChange(clearSkillFilterFacets(filter));

  const handleToggle = (skillName: string, enabled: boolean) => {
    setDisabledSet((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(skillName);
      } else {
        next.add(skillName);
      }
      return next;
    });
  };

  return (
    <div data-testid="skills-tab-settings" className="flex flex-col gap-6">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Available Skills
          </h3>
          <p className="text-xs text-tertiary-light">
            Enable or configure specialized microagent skills loaded into the workspace.
          </p>
        </div>
        <BrandButton
          type="button"
          variant="secondary"
          testId="skills-add-skill-button"
          className="flex-shrink-0 whitespace-nowrap"
          onClick={() => setShowAddSkillModal(true)}
        >
          {t(I18nKey.SETTINGS$SKILLS_ADD_BUTTON)}
        </BrandButton>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-tertiary animate-pulse"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && allSkills.length === 0 ? (
        <div
          data-testid="skills-empty"
          className={extensionModuleEmptyStateClassName}
        >
          <p className="text-sm text-tertiary-light">
            {t(I18nKey.SETTINGS$SKILLS_NO_SKILLS)}
          </p>
        </div>
      ) : null}

      {!isLoading && allSkills.length > 0 ? (
        <>
          <SkillsToolbar
            search={filter.query}
            onSearchChange={(query) =>
              handleFilterChange({ ...filter, query })
            }
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setIsFiltersModalOpen(true)}
          />

          <div className="flex min-w-0 gap-6">
            <SkillFacetRail
              groups={groups}
              onToggle={handleToggleFacet}
              className="hidden w-[220px] shrink-0 self-start md:flex"
            />

            <section className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-between gap-3 text-xs text-tertiary-light">
                <span data-testid="skills-result-summary">
                  {t(I18nKey.SETTINGS$SKILLS_RESULT_COUNT, {
                    count: visibleSkills.length,
                  })}
                </span>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    data-testid="skills-clear-filters"
                    onClick={handleClearFacets}
                    className="cursor-pointer underline hover:text-white"
                  >
                    {t(I18nKey.SETTINGS$SKILLS_CLEAR_FILTERS)}
                  </button>
                ) : null}
              </div>

              {visibleSkills.length === 0 ? (
                <div
                  data-testid="skills-no-match"
                  className={extensionModuleEmptyStateClassName}
                >
                  <p className="text-sm text-tertiary-light">
                    {t(I18nKey.SETTINGS$SKILLS_NO_MATCH)}
                  </p>
                </div>
              ) : (
                <div
                  className={cn(extensionModuleCardGridContainerClassName)}
                >
                  <div className={extensionModuleCardGridClassName}>
                    {visibleSkills.map((skill) => (
                      <SkillCard
                        key={skill.name}
                        skill={skill}
                        enabled={!disabledSet.has(skill.name)}
                        onOpen={() => setSelectedSkill(skill)}
                        onToggle={(enabled) =>
                          handleToggle(skill.name, enabled)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {isFiltersModalOpen ? (
            <SkillFiltersModal
              groups={groups}
              activeCount={activeFilterCount}
              onToggle={handleToggleFacet}
              onClearAll={handleClearFacets}
              onClose={() => setIsFiltersModalOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          enabled={!disabledSet.has(selectedSkill.name)}
          onToggle={(enabled) => handleToggle(selectedSkill.name, enabled)}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      {showAddSkillModal && (
        <AddSkillModal onClose={() => setShowAddSkillModal(false)} />
      )}
    </div>
  );
}

export default SkillsTabSettings;
