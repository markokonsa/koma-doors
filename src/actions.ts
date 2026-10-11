import { isTauri } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { Command } from "@tauri-apps/plugin-shell";
import { APPS } from "./apps";
import type { CardAction } from "./cards";
import { navigate } from "./router";

async function expandHome(path: string): Promise<string> {
  if (!path.startsWith("~/")) return path;
  const home = await homeDir();
  return `${home.replace(/\/$/, "")}/${path.slice(2)}`;
}

/** Run a card's action. Works in the Tauri window and (links/pages only) in a plain browser. */
export async function runAction(action: CardAction): Promise<void> {
  switch (action.type) {
    case "page":
      navigate(action.page, action.param);
      return;
    case "link":
      if (isTauri()) await openUrl(action.url);
      else window.open(action.url, "_blank", "noopener");
      return;
    case "path":
      if (!isTauri()) throw new Error("Opening local files only works in the desktop app");
      await openPath(await expandHome(action.path));
      return;
    case "app": {
      if (!isTauri()) throw new Error("Opening apps only works in the desktop app");
      const app = APPS[action.app];
      // Args must match the scope in src-tauri/capabilities/default.json exactly.
      const result = await Command.create(app.command, ["-a", app.appName, await expandHome(action.path)]).execute();
      if (result.code !== 0) throw new Error(result.stderr.trim() || `Could not open ${app.label}`);
      return;
    }
  }
}
