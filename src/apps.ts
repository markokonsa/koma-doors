/**
 * Apps a project card can open a folder in. `command` is the name of an allow-listed shell command in
 * src-tauri/capabilities/default.json and `appName` the macOS app name it passes to `open -a`;
 * keep both in sync with that file.
 */
export const APPS = {
  cursor: { label: "Cursor", appName: "Cursor", command: "open-in-cursor" },
  vscode: { label: "VS Code", appName: "Visual Studio Code", command: "open-in-vscode" },
  terminal: { label: "Terminal", appName: "Terminal", command: "open-in-terminal" },
} as const;

export type AppId = keyof typeof APPS;

export const APP_IDS = Object.keys(APPS) as AppId[];
