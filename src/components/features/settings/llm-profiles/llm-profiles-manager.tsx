import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandButton } from "#/components/features/settings/brand-button";
import { RenameProfileModal } from "./rename-profile-modal";
import { DeleteProfileModal } from "./delete-profile-modal";
import { ProfilesBody } from "./profiles-body";
import { ModelOriginSections } from "./model-origin-sections";
import ProfilesService, {
  ProfileInfo,
  type SaveProfileRequest,
} from "#/api/profiles-service/profiles-service.api";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { useCloudModels } from "#/hooks/query/use-cloud-models";
import { useLocalGgufModels } from "#/hooks/query/use-local-gguf-models";
import { sanitizeProfileName } from "#/utils/format-model-name";
import { useProviderConnections } from "#/hooks/query/use-provider-connections";
import { useActivateLlmProfile } from "#/hooks/mutation/use-activate-llm-profile";
import { useSaveLlmProfile } from "#/hooks/mutation/use-save-llm-profile";
import { useCanManageOrgProfiles } from "#/hooks/use-can-manage-org-profiles";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { I18nKey } from "#/i18n/declaration";

interface LlmProfilesManagerProps {
  onAddProfile?: () => void;
  onEditProfile?: (profile: ProfileInfo) => void;
}

export function LlmProfilesManager({
  onAddProfile,
  onEditProfile,
}: LlmProfilesManagerProps) {
  const { t } = useTranslation("openhands");
  const { data, isLoading, error } = useLlmProfiles();
  const activateProfile = useActivateLlmProfile();
  const saveProfile = useSaveLlmProfile();
  // Cloud members are view-only; only owners/admins (and all local users) may
  // add, edit, rename, duplicate, delete, or activate profiles.
  const canManage = useCanManageOrgProfiles();
  // Provider connections exist only on the local agent-server; used to label
  // profiles that link to a shared connection.
  const { data: connections } = useProviderConnections();
  const [profileToRename, setProfileToRename] = useState<ProfileInfo | null>(
    null,
  );
  const [profileToDelete, setProfileToDelete] = useState<ProfileInfo | null>(
    null,
  );

  const allProfiles = data?.profiles ?? [];
  const active = data?.active_profile ?? null;

  // A model picked from the Cloud / On-device sections auto-registers a profile
  // named after it. Hide those from "Your models" so they don't duplicate the
  // catalog rows above (which already show the active/Default state); only
  // genuinely user-added profiles (Groq, custom keys, the seeded Exeaon ones)
  // remain here.
  const { data: cloudModels } = useCloudModels();
  const gguf = useLocalGgufModels();
  const catalogNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of cloudModels ?? []) names.add(sanitizeProfileName(m.name));
    if (gguf.hasTauri)
      for (const m of gguf.models)
        names.add(sanitizeProfileName(m.displayName));
    return names;
  }, [cloudModels, gguf.hasTauri, gguf.models]);
  const profiles = useMemo(
    () => allProfiles.filter((p) => !catalogNames.has(p.name)),
    [allProfiles, catalogNames],
  );

  const connectionList = useMemo(() => connections ?? [], [connections]);

  const connectionNamesById = useMemo(
    () => Object.fromEntries(connectionList.map((c) => [c.id, c.display_name])),
    [connectionList],
  );

  const handleActivate = async (name: string) => {
    try {
      await activateProfile.mutateAsync(name);
      displaySuccessToast(t(I18nKey.SETTINGS$PROFILE_ACTIVATED, { name }));
    } catch (error) {
      console.error("Failed to activate profile:", error);
      displayErrorToast(t(I18nKey.ERROR$GENERIC));
    }
  };

  const handleEdit = (profile: ProfileInfo) => {
    onEditProfile?.(profile);
  };

  const handleDuplicate = async (profile: ProfileInfo) => {
    try {
      // Fetch the full config with encrypted secrets so the API key is
      // preserved on the duplicate (same approach as the edit flow).
      const detail = await ProfilesService.getProfile(
        profile.name,
        "encrypted",
      );

      // Find an available name: "{name}-copy", then "{name}-copy-1", etc.
      const existingNames = new Set(profiles.map((p) => p.name));
      let newName = `${profile.name}-copy`;
      let counter = 1;
      while (existingNames.has(newName)) {
        newName = `${profile.name}-copy-${counter}`;
        counter += 1;
      }

      await saveProfile.mutateAsync({
        name: newName,
        request: {
          llm: detail.config as SaveProfileRequest["llm"],
          include_secrets: true,
        },
      });

      displaySuccessToast(
        t(I18nKey.SETTINGS$PROFILE_DUPLICATED, { name: newName }),
      );
    } catch (err) {
      console.error("Failed to duplicate profile:", err);
      displayErrorToast(t(I18nKey.ERROR$GENERIC));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <ModelOriginSections />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-medium text-[var(--cool-grey-50)]">
              Your models
            </h2>
            {onAddProfile && canManage ? (
              <BrandButton
                testId="add-llm-profile"
                type="button"
                variant="secondary"
                className="ml-auto"
                onClick={onAddProfile}
              >
                Add model
              </BrandButton>
            ) : null}
          </div>

          <ProfilesBody
            isLoading={isLoading}
            loadError={error ?? null}
            profiles={profiles}
            active={active}
            canManage={canManage}
            connectionNamesById={connectionNamesById}
            onActivate={handleActivate}
            onEdit={handleEdit}
            onRename={setProfileToRename}
            onDuplicate={handleDuplicate}
            onDelete={setProfileToDelete}
            isActivating={activateProfile.isPending}
          />
        </div>
      </div>

      <RenameProfileModal
        profile={profileToRename}
        onClose={() => setProfileToRename(null)}
      />
      <DeleteProfileModal
        profile={profileToDelete}
        onClose={() => setProfileToDelete(null)}
      />
    </>
  );
}
