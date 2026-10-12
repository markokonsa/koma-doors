import type { AppId } from "../apps";
import type { Door, Project } from "./types";
import { FLOW_BUILDER_URL } from "./types";

// First-run content. After that, everything lives in the in-app store (src/doors/store.ts).
export const SEED_PROJECTS: Project[] = [
  { id: "default", title: "OMA", description: "Company tools and sites" }
];

export const SEED_DOORS: Door[] = [
  { id: "seed-flow", projectId: "oma", kind: "flow", title: "KOMA/flow builder", url: FLOW_BUILDER_URL },
  { id: "seed-konsa", projectId: "oma", kind: "link", title: "konsa.ee", target: "https://konsa.ee" },
  { id: "seed-work", projectId: "oma", kind: "link", title: "Work folder", target: "~/Work" },
];

/** Cards saved by the previous version of the app (one localStorage key per project). */
interface LegacyCard {
  id: string;
  kind: "link" | "repository" | "note" | "path" | "app" | "workflow";
  title: string;
  value: string;
  app?: AppId;
}

export function migrateLegacyCards(projects: Project[]): Door[] {
  const doors: Door[] = [];
  for (const p of projects) {
    let cards: LegacyCard[] = [];
    try {
      const raw = localStorage.getItem(`koma-home:project-cards:${p.id}`);
      if (raw) cards = JSON.parse(raw) as LegacyCard[];
    } catch {
      continue;
    }
    for (const c of cards) {
      const base = { id: c.id, projectId: p.id, title: c.title };
      switch (c.kind) {
        case "note":
          doors.push({ ...base, kind: "note", text: c.value });
          break;
        case "workflow":
          doors.push({ ...base, kind: "flow", url: c.value });
          break;
        case "app":
          doors.push({ ...base, kind: "launch", steps: [{ id: `${c.id}-1`, kind: "app", app: c.app ?? "cursor", path: c.value }] });
          break;
        default:
          doors.push({ ...base, kind: "link", target: c.value });
      }
    }
  }
  return doors;
}
