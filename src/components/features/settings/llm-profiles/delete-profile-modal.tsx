import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { BrandButton } from "#/components/features/settings/brand-button";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { ApiKeyModalBase } from "#/components/features/settings/api-key-modal-base";
import ProfilesService, {
  ProfileInfo,
} from "#/api/profiles-service/profiles-service.api";
import AgentProfilesService, {
  type AgentProfileSaveInput,
} from "#/api/agent-profiles-service/agent-profiles-service.api";
import { mergeAgentProfileSaveInput } from "#/components/features/settings/agent-profiles/merge-agent-profile-save-input";
import { useDeleteLlmProfile } from "#/hooks/mutation/use-delete-llm-profile";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { I18nKey } from "#/i18n/declaration";

/**
 * When a profile is referenced by agent profile(s), the server refuses delete
 * with 409. Repoint every referencing OpenHands agent profile at a fallback LLM
 * profile first, so the delete can proceed. Returns false when there is no other
 * profile to fall back to.
 */
async function reassignReferencingAgentProfiles(
  profileName: string,
): Promise<boolean> {
  const llm = await ProfilesService.listProfiles();
  const fallback = llm.profiles.find((p) => p.name !== profileName);
  if (!fallback) return false;
  const agents = await AgentProfilesService.listProfiles();
  for (const ap of agents.profiles) {
    if (ap.agent_kind === "openhands" && ap.llm_profile_ref === profileName) {
      const detail = await AgentProfilesService.getProfile(ap.name);
      const input = mergeAgentProfileSaveInput(detail.profile, {
        agent_kind: "openhands",
        llm_profile_ref: fallback.name,
      } as AgentProfileSaveInput);
      await AgentProfilesService.saveProfile(ap.name, input);
    }
  }
  return true;
}

interface DeleteProfileModalProps {
  profile: ProfileInfo | null;
  onClose: () => void;
}

export function DeleteProfileModal({
  profile,
  onClose,
}: DeleteProfileModalProps) {
  const { t } = useTranslation("openhands");
  const deleteProfile = useDeleteLlmProfile();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  if (!profile) return null;

  const handleDelete = async () => {
    try {
      await deleteProfile.mutateAsync(profile.name);
      displaySuccessToast(
        t(I18nKey.SETTINGS$PROFILE_DELETED, { name: profile.name }),
      );
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t(I18nKey.ERROR$GENERIC);
      // 409: the profile is referenced by an agent profile. Repoint those to a
      // fallback profile, then retry the delete once — so the user can actually
      // delete it instead of hitting a dead end.
      const referenced = /referenced by/i.test(message);
      if (referenced) {
        try {
          const ok = await reassignReferencingAgentProfiles(profile.name);
          if (!ok) {
            displayErrorToast(
              "Can't delete your only model — add another first.",
            );
            return;
          }
          await deleteProfile.mutateAsync(profile.name);
          displaySuccessToast(
            t(I18nKey.SETTINGS$PROFILE_DELETED, { name: profile.name }),
          );
          onClose();
          return;
        } catch (retryError) {
          displayErrorToast(
            retryError instanceof Error
              ? retryError.message
              : t(I18nKey.ERROR$GENERIC),
          );
          return;
        }
      }
      displayErrorToast(message);
    }
  };

  // Handle close only if not pending to prevent inconsistent state
  const handleClose = () => {
    if (!deleteProfile.isPending) {
      onClose();
    }
  };

  const footer = (
    <>
      <BrandButton
        ref={cancelButtonRef}
        type="button"
        variant="tertiary"
        onClick={handleClose}
        isDisabled={deleteProfile.isPending}
      >
        {t(I18nKey.BUTTON$CANCEL)}
      </BrandButton>
      <BrandButton
        testId="delete-profile-confirm"
        type="button"
        variant="danger"
        onClick={handleDelete}
        isDisabled={deleteProfile.isPending}
        aria-busy={deleteProfile.isPending}
      >
        {deleteProfile.isPending ? (
          <>
            <LoadingSpinner size="small" />
            <span className="sr-only">{t(I18nKey.BUTTON$DELETE)}</span>
          </>
        ) : (
          t(I18nKey.BUTTON$DELETE)
        )}
      </BrandButton>
    </>
  );

  return (
    <ApiKeyModalBase
      isOpen
      title={t(I18nKey.SETTINGS$PROFILE_DELETE_TITLE)}
      footer={footer}
      onClose={handleClose}
      initialFocusRef={cancelButtonRef}
    >
      <p className="text-sm break-all">
        {t(I18nKey.SETTINGS$PROFILE_DELETE_CONFIRMATION, {
          name: profile.name,
        })}
      </p>
    </ApiKeyModalBase>
  );
}
