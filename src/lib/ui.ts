// Which overlay is open. Kept outside React state so cards, the sidebar and the launcher can all open them.
import { useSyncExternalStore } from "react";
import type { Door, DoorKind, Project } from "../doors/types";

export interface UiState {
  launcher: boolean;
  doorDialog: { projectId: string; door?: Door; kind?: DoorKind } | null;
  projectDialog: { project?: Project } | null;
}

let ui: UiState = { launcher: false, doorDialog: null, projectDialog: null };
const listeners = new Set<() => void>();

function set(next: Partial<UiState>) {
  ui = { ...ui, ...next };
  listeners.forEach((l) => l());
}

export function useUi() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ui,
  );
}

export const getUi = () => ui;
export const openLauncher = (open = true) => set({ launcher: open });
export const openDoorDialog = (d: UiState["doorDialog"]) => set({ doorDialog: d, launcher: false });
export const openProjectDialog = (d: UiState["projectDialog"]) => set({ projectDialog: d, launcher: false });
export const closeOverlays = () => set({ launcher: false, doorDialog: null, projectDialog: null });
export const anyOverlayOpen = () => ui.launcher || !!ui.doorDialog || !!ui.projectDialog;
