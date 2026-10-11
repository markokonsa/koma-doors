import { useEffect } from "react";
import { DoorDialog } from "./components/DoorDialog";
import { Launcher } from "./components/Launcher";
import { ProjectDialog } from "./components/ProjectDialog";
import { RunRail } from "./components/RunRail";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { Toasts } from "./components/Toasts";
import { runDoor } from "./doors/runs";
import { useDoorsState } from "./doors/store";
import { toastError } from "./lib/toast";
import { anyOverlayOpen, getUi, openDoorDialog, openLauncher, useUi } from "./lib/ui";
import { FlowPage } from "./pages/FlowPage";
import { ProjectPage, automationDoors } from "./pages/ProjectPage";
import { ScriptPage } from "./pages/ScriptPage";
import { SettingsPage } from "./pages/SettingsPage";
import { navigate, useRoute } from "./router";

const LAST_PROJECT = "koma-home:last-project";

function rememberedProject() {
  try {
    return localStorage.getItem(LAST_PROJECT) ?? undefined;
  } catch {
    return undefined;
  }
}

export function App() {
  const route = useRoute();
  const ui = useUi();
  const { projects, doors } = useDoorsState();

  // The project shown in the sidebar as current: the route's, the door's, or the last one opened.
  const routeDoor = route.name === "script" || route.name === "flow" ? doors.find((d) => d.id === route.doorId) : undefined;
  const wanted = route.name === "project" ? route.projectId : routeDoor?.projectId;
  const project =
    projects.find((p) => p.id === wanted) ?? projects.find((p) => p.id === rememberedProject()) ?? projects[0];
  const currentProjectId = route.name === "settings" || (route.name === "flow" && !routeDoor) ? wanted : project?.id;

  useEffect(() => {
    if (route.name !== "project" || !project) return;
    try {
      localStorage.setItem(LAST_PROJECT, project.id);
    } catch {
      /* storage unavailable */
    }
  }, [route.name, project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openLauncher(!getUi().launcher);
        return;
      }
      if (anyOverlayOpen()) return;
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === "Escape" && !typing && route.name !== "project") {
        navigate({ name: "project", projectId: project?.id });
      } else if (mod && e.key.toLowerCase() === "n" && project) {
        e.preventDefault();
        openDoorDialog({ projectId: project.id });
      } else if (mod && !e.shiftKey && /^[1-9]$/.test(e.key) && route.name === "project" && project) {
        const door = automationDoors(doors, project.id)[Number(e.key) - 1];
        if (door) {
          e.preventDefault();
          runDoor(door, project).catch(toastError);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route.name, project, doors]);

  let page;
  switch (route.name) {
    case "script":
      page = <ScriptPage doorId={route.doorId} />;
      break;
    case "flow":
      page = <FlowPage doorId={route.doorId} currentProjectId={project?.id} />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    default:
      page = <ProjectPage project={project} />;
  }

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar currentProjectId={currentProjectId} />
        <main className="min-w-0 flex-1 overflow-y-auto">{page}</main>
        {route.name === "project" && <RunRail />}
      </div>

      {ui.launcher && <Launcher currentProjectId={project?.id} />}
      {ui.doorDialog && <DoorDialog key={ui.doorDialog.door?.id ?? "new"} {...ui.doorDialog} />}
      {ui.projectDialog && <ProjectDialog key={ui.projectDialog.project?.id ?? "new"} {...ui.projectDialog} />}
      <Toasts />
    </div>
  );
}
