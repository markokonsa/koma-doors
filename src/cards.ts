import {
  FolderOpen,
  GitBranch,
  Globe,
  Database,
  NotebookPen,
  Settings,
  Workflow,
  DoorClosed,
} from "lucide-react";

import type { AppId } from "./apps";
import type { PageId } from "./pages";
import type { IconComponent } from "./icons";
import { PROJECTS } from "./projects";

/** What happens when a card is clicked. */
export type CardAction =
  /** Open in the default browser. */
  | { type: "link"; url: string }
  /** Open a file, folder or app with the OS default handler. `~/` expands to the home folder. */
  | { type: "path"; path: string }
  /** Show an in-app page (see src/pages/index.ts). */
  | { type: "page"; page: PageId; /** Optional route parameter, e.g. a project id. */ param?: string }
  /** Open a folder in a desktop app via an allow-listed shell command (see src/apps.ts). */
  | { type: "app"; app: AppId; path: string }
  | { type: "action"; action: () => unknown };

export interface DashboardCard {
  id: string;
  title: string;
  description: string;
  icon: IconComponent;
  /** Any CSS color; used for the icon tile and hover glow. */
  accent: string;
  action: CardAction;
}

export interface CardGroup {
  title: string;
  action?: CardAction;
  cards: DashboardCard[];
}

// Edit this list to change the dashboard.
export const GROUPS: CardGroup[] = [

  {
    title: "Projects",
    action: { type: "action", action: function() { console.log("Projects"); } },
    cards: PROJECTS.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      icon: p.icon,
      accent: p.accent,
      action: { type: "page", page: "projects", param: p.id },
    })),
  },
  {
    title: "Company",
    cards: [
      {
        id: "flow",
        title: "KOMA/flow",
        description: "Supabase workflow builder (local dev server)",
        icon: Workflow,
        accent: "#3ecf8e",
        action: { type: "link", url: "https://workflows.konsa.ee" },
      },
      {
        id: "supabase",
        title: "Supabase",
        description: "Project dashboard",
        icon: Database,
        accent: "#6ee7b7",
        action: { type: "link", url: "https://supabase.com/dashboard/projects" },
      }
    ],
  },
  {
    title: "Local",
    cards: [
      {
        id: "work",
        title: "Work folder",
        description: "Open ~/Work in Finder",
        icon: FolderOpen,
        accent: "#fbbf24",
        action: { type: "path", path: "~/Work" },
      },
      {
        id: "konsa",
        title: "konsa.ee",
        description: "KOMA website",
        icon: Globe,
        accent: "#f472b6",
        action: { type: "link", url: "https://konsa.ee" },
      },
    ],
  },
  {
    title: "In this app",
    cards: [
      {
        id: "settings",
        title: "Settings",
        description: "How to customise this dashboard",
        icon: Settings,
        accent: "#94a3b8",
        action: { type: "page", page: "settings" },
      },
    ],
  },
];
