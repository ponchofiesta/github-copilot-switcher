import * as vscode from "vscode";
import { getSignedInAccountLabels, type AvailableAccounts } from "./auth";
import { PROFILE_LABELS, type CopilotProfile } from "./config";

type SwitchableProfile = Exclude<CopilotProfile, "custom">;

interface ProfileQuickPickItem extends vscode.QuickPickItem {
  kind?: vscode.QuickPickItemKind;
  profile?: SwitchableProfile;
}

export async function showProfileQuickPick(
  accounts: AvailableAccounts,
  currentProfile: CopilotProfile,
): Promise<SwitchableProfile | undefined> {
  const items = buildQuickPickItems(accounts, currentProfile);

  if (items.every((item) => item.kind === vscode.QuickPickItemKind.Separator)) {
    return undefined;
  }

  const quickPick = vscode.window.createQuickPick<ProfileQuickPickItem>();
  quickPick.title = "Switch GitHub Copilot Profile";
  quickPick.placeholder =
    "Signed-in accounts are shown for reference. Select a profile to apply.";
  quickPick.items = items;
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  return new Promise<SwitchableProfile | undefined>((resolve) => {
    let settled = false;

    const disposeAndResolve = (value: SwitchableProfile | undefined) => {
      if (settled) {
        return;
      }

      settled = true;
      quickPick.dispose();
      resolve(value);
    };

    quickPick.onDidAccept(() => {
      const [selected] = quickPick.selectedItems;
      if (selected?.profile) {
        disposeAndResolve(selected.profile);
        return;
      }

      quickPick.selectedItems = [];
    });

    quickPick.onDidHide(() => disposeAndResolve(undefined));
    quickPick.show();
  });
}

export function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  item.command = "github-copilot-switcher.switchProfile";
  item.tooltip = "Switch GitHub Copilot profile";
  return item;
}

function buildQuickPickItems(
  accounts: AvailableAccounts,
  currentProfile: CopilotProfile,
): ProfileQuickPickItem[] {
  const personalLabels = getSignedInAccountLabels(accounts.personal);
  const workLabels = getSignedInAccountLabels(accounts.work);
  const items: ProfileQuickPickItem[] = [];

  items.push({
    label: "Signed-in accounts",
    kind: vscode.QuickPickItemKind.Separator,
  });
  if (personalLabels.length > 0) {
    items.push({
      label: `${accounts.personal.providerLabel}: ${personalLabels.join(", ")}`,
      kind: vscode.QuickPickItemKind.Separator,
    });
  }
  if (workLabels.length > 0) {
    items.push({
      label: `${accounts.work.providerLabel}: ${workLabels.join(", ")}`,
      kind: vscode.QuickPickItemKind.Separator,
    });
  }
  items.push({
    label: "Switch profile",
    kind: vscode.QuickPickItemKind.Separator,
  });

  if (personalLabels.length > 0) {
    items.push({
      label: withCurrentMarker("Personal", currentProfile === "personal"),
      description: accounts.personal.providerLabel,
      detail: personalLabels.join(", "),
      profile: "personal",
    });
  }

  if (workLabels.length > 0) {
    items.push({
      label: withCurrentMarker("Work", currentProfile === "work"),
      description: accounts.work.providerLabel,
      detail: workLabels.join(", "),
      profile: "work",
    });
  }

  if (currentProfile === "custom") {
    items.push({
      label: "Current setting: Custom",
      description: "github.copilot.advanced contains additional values",
      detail: "Selecting Personal or Work will overwrite the custom object.",
    });
  }

  return items;
}

function withCurrentMarker(label: string, isCurrent: boolean): string {
  return isCurrent ? `$(check) ${label}` : label;
}

export function formatSwitchMessage(profile: SwitchableProfile): string {
  return `GitHub Copilot profile switched to ${PROFILE_LABELS[profile]}. It may take some seconds for changes to take effect.`;
}
