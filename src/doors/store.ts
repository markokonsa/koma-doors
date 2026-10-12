// Projects and doors, saved as one JSON file on this computer (see `dataFile` in src-tauri/src/runner.rs).
// In the desktop app the file is the source of truth; in a plain browser (pnpm dev) localStorage is.
import { useSyncExternalStore } from "react";
import { dataFile, inApp, readTextFile, setDataFile, writeTextFile } from "../lib/native";
import { toast } from "../lib/toast";
import { SEED_DOORS, SEED_PROJECTS, migrateLegacyCards } from "./seeds";
import type { Door, DoorDraft, Project } from "./types";

export interface DoorsState {
  projects: Project[];
  doors: Door[];
}

interface DataFileV1 extends DoorsState {
  version: 1;
}

/** localStorage key used before the JSON file existed, and still in browser mode. */
const LOCAL_KEY = "koma-home:doors:v1";
const SAVE_DELAY_MS = 250;

function fromLocalStorage(): DoorsState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<DoorsState>;
    return Array.isArray(saved.projects) && Array.isArray(saved.doors) ? (saved as DoorsState) : null;
  } catch {
    return null;
  }
}

function seeds(): DoorsState {
  return { projects: SEED_PROJECTS, doors: [...SEED_DOORS, ...migrateLegacyCards(SEED_PROJECTS)] };
}

function parseFile(text: string): DoorsState {
  const data = JSON.parse(text) as Partial<DataFileV1>;
  if (!Array.isArray(data.projects) || !Array.isArray(data.doors)) throw new Error("missing projects or doors");
  return { projects: data.projects, doors: data.doors };
}

const serialize = (s: DoorsState) => `${JSON.stringify({ version: 1, ...s } satisfies DataFileV1, null, 2)}\n`;

let state: DoorsState = fromLocalStorage() ?? seeds();
const listeners = new Set<() => void>();

// ---- the data file ------------------------------------------------------------------------------

let filePath: string | null = null;
/** Text last read from or written to the file; tells our own writes apart from outside edits. */
let lastSynced: string | null = null;
/** Set when the file couldn't be parsed: we stop saving rather than overwrite it. */
let readOnly = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> = Promise.resolve();

function emit() {
  listeners.forEach((l) => l());
}

async function writeNow() {
  saveTimer = undefined;
  if (!filePath || readOnly) return;
  const text = serialize(state);
  if (text === lastSynced) return;
  const path = filePath;
  saving = saving
    .then(() => writeTextFile(path, text))
    .then(() => {
      lastSynced = text;
    })
    .catch((e: unknown) => toast(`Couldn't save your doors: ${e instanceof Error ? e.message : String(e)}`));
  await saving;
}

function scheduleSave() {
  if (!inApp) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep working in memory */
    }
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void writeNow(), SAVE_DELAY_MS);
}

/** Write pending changes right away (e.g. before the window hides). */
export function flushDoors() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    return writeNow();
  }
  return saving;
}

/** Load the file into the store; if there is none yet, create it from what we have. */
async function loadFile(path: string) {
  filePath = path;
  readOnly = false;
  const text = await readTextFile(path);
  if (text == null) {
    // First launch with the file (or a new location): migrate localStorage / seeds into it.
    lastSynced = null;
    await writeNow();
    return;
  }
  try {
    state = parseFile(text);
    lastSynced = text;
    emit();
  } catch (e) {
    readOnly = true;
    toast(`${path} couldn't be read (${e instanceof Error ? e.message : String(e)}). Changes won't be saved until it's fixed.`);
  }
}

/** Call once before rendering. In the desktop app this reads (or creates) the data file. */
export async function hydrateDoors() {
  if (!inApp) return;
  try {
    await loadFile(await dataFile());
  } catch (e) {
    toast(`Couldn't open the data file: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  // Pick up edits made outside the app (another editor, git pull, sync) when the window regains focus,
  // and don't lose a pending save when it's hidden or closed.
  window.addEventListener("focus", () => void reloadIfChanged());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushDoors();
  });
}

async function reloadIfChanged() {
  if (!filePath || saveTimer) return;
  await saving;
  try {
    const text = await readTextFile(filePath);
    if (text == null || text === lastSynced) return;
    state = parseFile(text);
    lastSynced = text;
    readOnly = false;
    emit();
  } catch {
    /* leave the in-memory copy alone; the next save will report problems */
  }
}

/** The file in use, or null in browser mode. */
export const getDataFilePath = () => filePath;

/**
 * Keep the data in `folder/doors.json` (null = back to the app data folder). If that file already
 * exists it's loaded (e.g. a synced copy from another Mac); otherwise the current data is written there.
 */
export async function moveDataFile(folder: string | null) {
  await flushDoors();
  const path = await setDataFile(folder ? `${folder.replace(/\/$/, "")}/doors.json` : null);
  await loadFile(path);
  emit();
  return path;
}

// ---- reading and changing ----------------------------------------------------------------------

function commit(next: DoorsState) {
  state = next;
  scheduleSave();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** All projects and doors; re-renders on change. */
export function useDoorsState(): DoorsState {
  return useSyncExternalStore(subscribe, () => state);
}

export const getDoorsState = () => state;

export const newId = () => crypto.randomUUID();

function slug(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

export const doorsStore = {
  addProject(draft: Omit<Project, "id">): Project {
    const taken = new Set(state.projects.map((p) => p.id));
    let id = slug(draft.title);
    for (let n = 2; taken.has(id); n++) id = `${slug(draft.title)}-${n}`;
    const project = { ...draft, id };
    commit({ ...state, projects: [...state.projects, project] });
    return project;
  },
  updateProject(project: Project) {
    commit({ ...state, projects: state.projects.map((p) => (p.id === project.id ? project : p)) });
  },
  /** Removes the project and its doors. */
  removeProject(id: string) {
    commit({ projects: state.projects.filter((p) => p.id !== id), doors: state.doors.filter((d) => d.projectId !== id) });
  },
  addDoor(draft: DoorDraft): Door {
    const door = { ...draft, id: newId() } as Door;
    commit({ ...state, doors: [...state.doors, door] });
    return door;
  },
  updateDoor(door: Door) {
    commit({ ...state, doors: state.doors.map((d) => (d.id === door.id ? door : d)) });
  },
  removeDoor(id: string) {
    commit({ ...state, doors: state.doors.filter((d) => d.id !== id) });
  },
  markRun(id: string) {
    commit({ ...state, doors: state.doors.map((d) => (d.id === id ? { ...d, lastRunAt: Date.now() } : d)) });
  },
};

export function findProject(id: string | undefined) {
  return state.projects.find((p) => p.id === id);
}

export function findDoor(id: string | undefined) {
  return state.doors.find((d) => d.id === id);
}
