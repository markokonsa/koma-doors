/**
 * Desktop apps a project opener step can open a folder in (via `open -a <appName> <folder>`).
 * Add an entry to offer another app in the New door dialog.
 */
export const APPS = {
  cursor: { label: "Cursor", appName: "Cursor" },
  vscode: { label: "VS Code", appName: "Visual Studio Code" },
  terminal: { label: "Terminal", appName: "Terminal" }
} as const;

export type AppId = keyof typeof APPS;

export const APP_IDS = Object.keys(APPS) as AppId[];
