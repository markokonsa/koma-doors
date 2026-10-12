// Flow doors keep their flow as the .mjs KOMA/flow exports: runnable as is, and reopenable in the builder.
import { FLOW_BUILDER_URL } from "./types";
import { readTextFile, scriptsDir, writeTextFile } from "../lib/native";

const BUILDER_KEY = "koma-home:flow-builder-url";

/** Where the builder is loaded from: workflows.konsa.ee, or e.g. http://localhost:3000 while developing it. */
export function getBuilderUrl(): string {
  try {
    return localStorage.getItem(BUILDER_KEY) || FLOW_BUILDER_URL;
  } catch {
    return FLOW_BUILDER_URL;
  }
}

export function setBuilderUrl(url: string | null) {
  try {
    if (url && url !== FLOW_BUILDER_URL) localStorage.setItem(BUILDER_KEY, url);
    else localStorage.removeItem(BUILDER_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** The builder URL with `embed=koma`, which turns on its KOMA Home bridge. */
export function embeddedBuilderUrl(base = getBuilderUrl()): string {
  const url = new URL(base);
  url.searchParams.set("embed", "koma");
  return url.toString();
}

export function isFlowExport(source: string) {
  return source.includes("\nconst WORKFLOW = ") && source.includes("\nconst DEFAULT_URL = ");
}

/** Save an exported flow into the project's scripts folder without overwriting another file. */
export async function saveNewFlowFile(projectId: string, fileName: string, source: string): Promise<string> {
  const dir = await scriptsDir(projectId);
  const stem = fileName.replace(/\.m?js$/i, "") || "workflow";
  let path = `${dir}/${stem}.mjs`;
  for (let n = 2; (await readTextFile(path)) != null; n++) path = `${dir}/${stem}-${n}.mjs`;
  await writeTextFile(path, source);
  return path;
}

/** Copy an exported flow from anywhere on disk into the project's scripts folder. */
export async function importFlowFile(projectId: string, from: string): Promise<string> {
  const source = await readTextFile(from);
  if (source == null) throw new Error(`${from} doesn't exist`);
  if (!isFlowExport(source)) throw new Error("That file isn't a KOMA/flow export.");
  return saveNewFlowFile(projectId, from.split("/").pop() ?? "workflow.mjs", source);
}

/**
 * Runs an exported flow. Bun installs @supabase/supabase-js on the fly; with node it's installed once
 * into <app data>/scripts, which node finds from any project's scripts folder below it.
 */
export const FLOW_RUNNER = `if command -v bun >/dev/null 2>&1; then exec bun "$DOOR_FILE"; fi
if [ ! -f "$DOOR_DEPS/node_modules/@supabase/supabase-js/package.json" ]; then
  echo "… installing @supabase/supabase-js for flows (first run only)" >&2
  npm install --prefix "$DOOR_DEPS" --no-audit --no-fund --silent @supabase/supabase-js >&2 || exit 1
fi
exec node "$DOOR_FILE"`;
