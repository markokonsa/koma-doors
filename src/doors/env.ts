// Per-project environment variables: Supabase URL/keys for flows, anything else scripts need.
// Saved in <app data>/project-env.json on purpose, NOT in doors.json: that file may be moved to
// iCloud or a git repo, and keys shouldn't travel with it.
import { useSyncExternalStore } from "react";
import { appDataDir, inApp, readTextFile, writeTextFile } from "../lib/native";
import { toastError } from "../lib/toast";

export type EnvVars = Record<string, string>;
type EnvByProject = Record<string, EnvVars>;

const LOCAL_KEY = "koma-home:project-env";
const EMPTY: EnvVars = {};

let env: EnvByProject = {};
let file: string | null = null;
const listeners = new Set<() => void>();

export async function hydrateProjectEnv() {
  try {
    if (!inApp) {
      env = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as EnvByProject;
      return;
    }
    file = `${await appDataDir()}/project-env.json`;
    const text = await readTextFile(file);
    if (text) env = JSON.parse(text) as EnvByProject;
  } catch (e) {
    toastError(e);
  }
}

export function getProjectEnv(projectId: string | undefined): EnvVars {
  return (projectId && env[projectId]) || EMPTY;
}

export function useProjectEnv(projectId: string | undefined): EnvVars {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => getProjectEnv(projectId),
  );
}

export async function setProjectEnv(projectId: string, vars: EnvVars) {
  const next = { ...env };
  if (Object.keys(vars).length) next[projectId] = vars;
  else delete next[projectId];
  env = next;
  listeners.forEach((l) => l());
  const text = `${JSON.stringify(env, null, 2)}\n`;
  if (!inApp) {
    try {
      localStorage.setItem(LOCAL_KEY, text);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  if (file) await writeTextFile(file, text);
}

/** `KEY=value` per line; `#` comments, blank lines and a leading `export ` are fine; quotes are stripped. */
export function parseEnv(text: string): EnvVars {
  const vars: EnvVars = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    vars[key] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

export function formatEnv(vars: EnvVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}
