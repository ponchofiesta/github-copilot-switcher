import * as vscode from "vscode";

export type AuthProviderId = "github" | "github-enterprise";

export interface ProviderAccounts {
  providerId: AuthProviderId;
  providerLabel: string;
  accounts: readonly vscode.AuthenticationSessionAccountInformation[];
}

export interface AvailableAccounts {
  personal: ProviderAccounts;
  work: ProviderAccounts;
  hasAnyAccounts: boolean;
}

const PROVIDER_METADATA: Record<
  AuthProviderId,
  { profile: "personal" | "work"; providerLabel: string }
> = {
  github: { profile: "personal", providerLabel: "GitHub" },
  "github-enterprise": { profile: "work", providerLabel: "GitHub Enterprise" },
};

export async function getAvailableAccounts(): Promise<AvailableAccounts> {
  const personalAccounts = await getAccountsForProvider("github");
  const workAccounts = await getAccountsForProvider("github-enterprise");

  return {
    personal: personalAccounts,
    work: workAccounts,
    hasAnyAccounts:
      personalAccounts.accounts.length > 0 || workAccounts.accounts.length > 0,
  };
}

export function getSignedInAccountLabels(
  providerAccounts: ProviderAccounts,
): string[] {
  return providerAccounts.accounts.map((account) => account.label);
}

async function getAccountsForProvider(
  providerId: AuthProviderId,
): Promise<ProviderAccounts> {
  const metadata = PROVIDER_METADATA[providerId];

  try {
    const accounts = await vscode.authentication.getAccounts(providerId);

    return {
      providerId,
      providerLabel: metadata.providerLabel,
      accounts,
    };
  } catch {
    return {
      providerId,
      providerLabel: metadata.providerLabel,
      accounts: [],
    };
  }
}
