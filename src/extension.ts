import * as vscode from "vscode";
import { getAvailableAccounts } from "./auth";
import {
  getCurrentProfile,
  getStatusBarLabel,
  setProfile,
  type CopilotProfile,
} from "./config";
import {
  createStatusBarItem,
  formatSwitchMessage,
  showProfileQuickPick,
} from "./ui";

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = createStatusBarItem();
  context.subscriptions.push(statusBarItem);

  const refreshStatusBar = async () => {
    try {
      statusBarItem.text = await getStatusBarLabel();
    } catch {
      statusBarItem.text = "Copilot: Error";
    }

    statusBarItem.show();
  };

  const switchProfile = async (
    requestedProfile?: Exclude<CopilotProfile, "custom">,
  ) => {
    const accounts = await getAvailableAccounts();

    if (!accounts.hasAnyAccounts) {
      vscode.window.showInformationMessage(
        "No signed-in GitHub or GitHub Enterprise accounts were found. Sign in through VS Code Accounts before switching Copilot profiles.",
      );
      return;
    }

    const targetProfile =
      requestedProfile ??
      (await showProfileQuickPick(accounts, await getCurrentProfile()));
    if (!targetProfile) {
      return;
    }

    const isAvailable =
      targetProfile === "personal"
        ? accounts.personal.accounts.length > 0
        : accounts.work.accounts.length > 0;

    if (!isAvailable) {
      const providerLabel =
        targetProfile === "personal"
          ? accounts.personal.providerLabel
          : accounts.work.providerLabel;
      vscode.window.showInformationMessage(
        `No signed-in ${providerLabel} account is available for the ${targetProfile === "personal" ? "Personal" : "Work"} profile.`,
      );
      return;
    }

    try {
      await setProfile(targetProfile);
      await refreshStatusBar();
      vscode.window.showInformationMessage(formatSwitchMessage(targetProfile));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.showErrorMessage(
        `Failed to update the VS Code user settings for the Copilot profile. ${message}`,
      );
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-copilot-switcher.switchProfile",
      () => switchProfile(),
    ),
    vscode.commands.registerCommand(
      "github-copilot-switcher.switchToPersonal",
      () => switchProfile("personal"),
    ),
    vscode.commands.registerCommand(
      "github-copilot-switcher.switchToWork",
      () => switchProfile("work"),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("github.copilot.advanced")) {
        void refreshStatusBar();
      }
    }),
    vscode.authentication.onDidChangeSessions((event) => {
      if (
        event.provider.id === "github" ||
        event.provider.id === "github-enterprise"
      ) {
        void refreshStatusBar();
      }
    }),
  );

  void refreshStatusBar();
}

export function deactivate(): void {}
