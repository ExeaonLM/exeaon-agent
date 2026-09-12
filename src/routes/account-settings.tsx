import React from "react";
import { AccountSettingsView } from "#/components/features/settings/account-settings/account-settings-view";

export const handle = {
  title: "Account & Cloud",
  subtitle: "Manage your Exeaon identity, organization, usage limits, and remote execution",
};

export default function AccountSettingsRoute() {
  return <AccountSettingsView />;
}
