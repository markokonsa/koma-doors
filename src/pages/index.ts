import type { ComponentType } from "react";
import { SettingsPage } from "./SettingsPage";
import { ProjectsPage } from "./ProjectsPage";

/** Props every page receives; `param` is the optional route segment after the page id. */
export interface PageProps {
  param?: string;
}

// Register in-app pages here, then point a card at them with { type: "page", page: "<id>" }.
export const PAGES = {
  settings: { title: "Settings", component: SettingsPage },
  projects: { title: "Projects", component: ProjectsPage },
} satisfies Record<string, { title: string; component: ComponentType<PageProps> }>;

export type PageId = keyof typeof PAGES;

export function isPageId(id: string): id is PageId {
  return Object.prototype.hasOwnProperty.call(PAGES, id);
}
