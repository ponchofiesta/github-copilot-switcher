# GitHub Copilot Switcher

This extension adds a status bar entry and commands to switch the GitHub Copilot profile between `Personal` and `Work` by directly updating the user setting `github.copilot.advanced` in the VS Code user settings file.

## Behavior

- `Personal` writes `"github.copilot.advanced": {}`.
- `Work` writes `"github.copilot.advanced": { "authProvider": "github-enterprise" }`.
- Before switching, the extension checks whether relevant GitHub accounts are signed in through VS Code authentication.
- The quick pick shows the signed-in accounts for `github` and `github-enterprise` and only offers switch targets that currently have at least one signed-in account.

## Commands

- `Copilot Switcher: Switch Profile`
- `Copilot Switcher: Switch to Personal`
- `Copilot Switcher: Switch to Work`

## Notes

- The quick pick shows accounts for visibility, but the underlying Copilot setting can only choose the auth provider, not a specific account.
- The extension writes the unsupported setting directly into the user `settings.json`, because the standard VS Code configuration update API rejects unregistered settings.
