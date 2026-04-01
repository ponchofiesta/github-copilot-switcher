import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

export type CopilotProfile = "personal" | "work" | "custom";

const COPILOT_CONFIGURATION_SECTION = "github.copilot";
const COPILOT_ADVANCED_KEY = "advanced";
const COPILOT_ADVANCED_SETTING = `${COPILOT_CONFIGURATION_SECTION}.${COPILOT_ADVANCED_KEY}`;

export const PROFILE_LABELS: Record<
  Exclude<CopilotProfile, "custom">,
  string
> = {
  personal: "Personal",
  work: "Work",
};

const PROFILE_VALUES: Record<
  Exclude<CopilotProfile, "custom">,
  Record<string, string>
> = {
  personal: {},
  work: { authProvider: "github-enterprise" },
};

export function getProfileValue(
  profile: Exclude<CopilotProfile, "custom">,
): Record<string, string> {
  return { ...PROFILE_VALUES[profile] };
}

export async function getCurrentProfile(): Promise<CopilotProfile> {
  const advanced = await getStoredAdvancedSetting();

  if (isPlainEmptyObject(advanced)) {
    return "personal";
  }

  if (
    advanced.authProvider === "github-enterprise" &&
    Object.keys(advanced).length === 1
  ) {
    return "work";
  }

  return "custom";
}

export async function setProfile(
  profile: Exclude<CopilotProfile, "custom">,
): Promise<void> {
  const settingsPath = getUserSettingsPath();
  const currentContent = await readSettingsFile(settingsPath);
  const edits = modify(
    currentContent,
    [COPILOT_ADVANCED_SETTING],
    getProfileValue(profile),
    {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: detectEol(currentContent),
      },
      isArrayInsertion: false,
      getInsertionIndex: undefined,
    },
  );
  const nextContent = applyEdits(currentContent, edits);

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, nextContent, "utf8");
}

export async function getStatusBarLabel(): Promise<string> {
  const profile = await getCurrentProfile();
  const label = profile === "custom" ? "Custom" : PROFILE_LABELS[profile];

  return `Copilot: ${label}`;
}

function isPlainEmptyObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

async function getStoredAdvancedSetting(): Promise<Record<string, unknown>> {
  const settings = await readUserSettingsObject();
  const dottedValue = settings[COPILOT_ADVANCED_SETTING];

  if (isRecord(dottedValue)) {
    return dottedValue;
  }

  const nestedValue = getNestedAdvancedValue(settings);
  return isRecord(nestedValue) ? nestedValue : {};
}

async function readUserSettingsObject(): Promise<Record<string, unknown>> {
  const settingsPath = getUserSettingsPath();
  const content = await readSettingsFile(settingsPath);
  const errors: ParseError[] = [];
  const parsed = parse(content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    throw new Error(
      "User settings.json contains invalid JSONC and could not be updated.",
    );
  }

  return isRecord(parsed) ? parsed : {};
}

async function readSettingsFile(settingsPath: string): Promise<string> {
  try {
    return await fs.readFile(settingsPath, "utf8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return "{}\n";
    }

    throw error;
  }
}

function getUserSettingsPath(): string {
  const productDirectory = getProductSettingsDirectoryName();

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error(
        "APPDATA is not available, so the VS Code user settings path could not be resolved.",
      );
    }

    return path.join(appData, productDirectory, "User", "settings.json");
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      productDirectory,
      "User",
      "settings.json",
    );
  }

  const configHome =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, productDirectory, "User", "settings.json");
}

function getProductSettingsDirectoryName(): string {
  return vscode.env.appName.replace(/^Visual Studio /, "");
}

function getNestedAdvancedValue(settings: Record<string, unknown>): unknown {
  const github = settings.github;
  if (!isRecord(github)) {
    return undefined;
  }

  const copilot = github.copilot;
  if (!isRecord(copilot)) {
    return undefined;
  }

  return copilot.advanced;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function detectEol(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}
