import { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  GitBranch,
  Link as LinkIcon,
  SquareTerminal,
  StickyNote,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { CardAction } from "./cards";
import type { AppId } from "./apps";
import { TallinnCardIcon, UlemisteCityIcon, type IconComponent } from "./icons";

/** The kinds of card a project page can hold. Users add these from the project page. */
export type ProjectCardKind = "link" | "repository" | "note" | "path" | "app" | "workflow";

export interface ProjectCard {
  id: string;
  kind: ProjectCardKind;
  title: string;
  /** URL for link/repository/workflow, path for path, text body for note. */
  value: string;
  /** Only for kind "app": which app opens the folder in `value`. */
  app?: AppId;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  /** A Lucide icon or an image icon from src/icons. */
  icon: IconComponent;
  accent: string;
  /** Cards every install starts with; user edits are stored separately. */
  cards?: ProjectCard[];
}

// Edit this list to add projects. Each one shows up on the home page and gets its own page.
export const PROJECTS: Project[] = [
  {
    id: "PR0340",
    title: "Ülemiste City",
    description: "Ülemiste City project",
    icon: UlemisteCityIcon,
    accent: "#000078",
  },
  {
    id: "tc",
    title: "Tallinn Card",
    description: "Tallinn Card project",
    icon: TallinnCardIcon,
    accent: "#ff0000",
  },
];

export function findProject(id: string | undefined): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export const KIND_META: Record<
  ProjectCardKind,
  { label: string; icon: LucideIcon; accent: string; valueLabel: string; placeholder: string }
> = {
  link: { label: "Link", icon: LinkIcon, accent: "#60a5fa", valueLabel: "URL", placeholder: "https://…" },
  repository: { label: "Repository", icon: GitBranch, accent: "#a5b4fc", valueLabel: "Repository URL", placeholder: "https://github.com/org/repo" },
  note: { label: "Note", icon: StickyNote, accent: "#fbbf24", valueLabel: "Note", placeholder: "Write something…" },
  path: { label: "Open path", icon: FolderOpen, accent: "#f472b6", valueLabel: "Path", placeholder: "~/Work/my-project" },
  app: { label: "Open in app", icon: SquareTerminal, accent: "#c084fc", valueLabel: "Folder", placeholder: "~/Work/my-project" },
  workflow: { label: "Workflow", icon: Workflow, accent: "#3ecf8e", valueLabel: "Workflow URL", placeholder: "https://workflows.konsa.ee/…" },
};

/** Notes are edited in place; every other kind maps to an action the app already knows. */
export function cardAction(card: ProjectCard): CardAction | null {
  switch (card.kind) {
    case "note":
      return null;
    case "path":
      return { type: "path", path: card.value };
    case "app":
      return { type: "app", app: card.app ?? "cursor", path: card.value };
    default:
      return { type: "link", url: card.value };
  }
}

const key = (projectId: string) => `koma-home:project-cards:${projectId}`;

function load(project: Project): ProjectCard[] {
  try {
    const raw = localStorage.getItem(key(project.id));
    if (raw) return JSON.parse(raw) as ProjectCard[];
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  return project.cards ?? [];
}

/** A project's cards, persisted per project on this device. Remount (key by project id) when the project changes. */
export function useProjectCards(project: Project) {
  const [cards, setCards] = useState<ProjectCard[]>(() => load(project));

  useEffect(() => {
    try {
      localStorage.setItem(key(project.id), JSON.stringify(cards));
    } catch {
      /* storage unavailable */
    }
  }, [project.id, cards]);

  const add = useCallback(
    (card: Omit<ProjectCard, "id">) => setCards((c) => [...c, { ...card, id: crypto.randomUUID() }]),
    [],
  );
  const update = useCallback(
    (id: string, patch: Partial<ProjectCard>) =>
      setCards((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [],
  );
  const remove = useCallback((id: string) => setCards((c) => c.filter((x) => x.id !== id)), []);

  return { cards, add, update, remove };
}
