// Thin wrappers around the Rust commands in src-tauri/src/runner.rs and the opener plugin.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

/** True inside the Tauri window; false when the UI runs in a plain browser (pnpm dev). */
export const inApp = isTauri();

export function requireApp(what: string) {
  if (!inApp) throw new Error(`${what} only works in the desktop app`);
}

export async function expandHome(path: string): Promise<string> {
  if (!path.startsWith("~/") || !inApp) return path;
  const home = await homeDir();
  return `${home.replace(/\/$/, "")}/${path.slice(2)}`;
}

export const isUrl = (target: string) => /^[a-z][a-z0-9+.-]*:/i.test(target);

/** Open a URL in the default browser, or a local file/folder with the OS handler. */
export async function openTarget(target: string) {
  if (isUrl(target)) {
    if (inApp) await openUrl(target);
    else window.open(target, "_blank", "noopener");
    return;
  }
  requireApp("Opening local files");
  await openPath(await expandHome(target));
}

export const runProcess = (procId: string, script: string, cwd?: string, env?: Record<string, string>) =>
  invoke<void>("run_process", { procId, script, cwd, env });
export const killProcess = (procId: string) => invoke<void>("kill_process", { procId });
export const waitForPort = (port: number, timeoutMs: number) => invoke<boolean>("wait_for_port", { port, timeoutMs });
export const readTextFile = (path: string) => invoke<string | null>("read_text_file", { path });
export const writeTextFile = (path: string, contents: string) => invoke<void>("write_text_file", { path, contents });
export const scriptsDir = (projectId: string) => invoke<string>("scripts_dir", { projectId });
/** The JSON file projects and doors are saved in. */
export const dataFile = () => invoke<string>("data_file");
/** Use another data file (null = the default in the app data folder); returns the file now in use. */
export const setDataFile = (path: string | null) => invoke<string>("set_data_file", { path });

export interface ProcessLog {
  procId: string;
  stream: "stdout" | "stderr";
  line: string;
}
export interface ProcessExit {
  procId: string;
  code: number | null;
}

export const onProcessLog = (cb: (e: ProcessLog) => void) => listen<ProcessLog>("door://log", (e) => cb(e.payload));
export const onProcessExit = (cb: (e: ProcessExit) => void) => listen<ProcessExit>("door://exit", (e) => cb(e.payload));
