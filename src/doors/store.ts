import { useSyncExternalStore } from "react";
import { SEED_DOORS, SEED_PROJECTS, migrateLegacyCards } from "./seeds";
import type { Door, DoorDraft, Project } from "./types";

export interface DoorsState {
  projects: Project[];
  doors: Door[];
}

const KEY = "koma-home:doors:v1";

function load(): DoorsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DoorsState>;
      if (Array.isArray(saved.projects) && Array.isArray(saved.doors)) return saved as DoorsState;
    }
  } catch {
    /* storage unavailable or corrupt: start from the seeds */
  }
  return { projects: SEED_PROJECTS, doors: [...SEED_DOORS, ...migrateLegacyCards(SEED_PROJECTS)] };
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: DoorsState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep working in memory */
  }
  listeners.forEach((l) => l());
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
