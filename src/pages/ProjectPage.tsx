import type { ReactNode } from "react";
import { FolderSearch, Pencil, Plus } from "lucide-react";
import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { AutomationCard, LaunchCard, LinkCard, NoteCard } from "../components/DoorCards";
import { doorsStore, useDoorsState } from "../doors/store";
import { DOOR_KINDS, KIND_META, type Door, type FlowDoor, type Project, type ScriptDoor } from "../doors/types";
import { inApp } from "../lib/native";
import { toastError } from "../lib/toast";
import { openDoorDialog, openProjectDialog } from "../lib/ui";

/** Scripts and flows of a project, in the order ⌘1–⌘9 run them. */
export function automationDoors(doors: Door[], projectId: string) {
  return doors.filter((d): d is ScriptDoor | FlowDoor => d.projectId === projectId && (d.kind === "script" || d.kind === "flow"));
}

export async function chooseProjectFolder(project: Project) {
  try {
    const picked = await pickFolder({ directory: true, multiple: false, title: `Folder for ${project.title}` });
    if (typeof picked === "string") doorsStore.updateProject({ ...project, path: picked });
  } catch (e) {
    toastError(e);
  }
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="eyebrow">{label}</span>
        {hint && <span className="font-mono text-[11px] text-ink-dim">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function ProjectPage({ project }: { project: Project | undefined }) {
  const { doors } = useDoorsState();

  if (!project) {
    return (
      <div className="flex flex-col items-start gap-4 p-9">
        <span className="eyebrow">No project</span>
        <p className="text-ink-dim">Add a project from the sidebar to start collecting doors.</p>
        <button className="btn btn-primary" onClick={() => openProjectDialog({})}>
          <Plus /> New project
        </button>
      </div>
    );
  }

  const mine = doors.filter((d) => d.projectId === project.id);
  const launch = mine.filter((d) => d.kind === "launch");
  const autos = automationDoors(doors, project.id);
  const links = mine.filter((d) => d.kind === "link");
  const notes = mine.filter((d) => d.kind === "note");

  return (
    <div className="flex flex-col gap-7 px-9 py-7">
      <header className="flex items-end gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="eyebrow">Project</span>
          <h1 className="display truncate text-[44px]">{project.title}</h1>
          {project.path ? (
            <span className="truncate font-mono text-[12px] text-ink-dim" title={project.path}>
              {project.path}
            </span>
          ) : inApp ? (
            <button
              onClick={() => void chooseProjectFolder(project)}
              className="inline-flex items-center gap-2 self-start font-mono text-[12px] text-brand-hover hover:text-ink"
            >
              <FolderSearch size={13} /> Set project folder
            </button>
          ) : (
            <span className="font-mono text-[12px] text-ink-dim">{project.description}</span>
          )}
        </div>
        <button className="icon-btn size-10" onClick={() => openProjectDialog({ project })} aria-label="Edit project">
          <Pencil size={15} />
        </button>
        <button className="btn btn-ghost" onClick={() => openDoorDialog({ projectId: project.id })}>
          <Plus /> New door
        </button>
      </header>

      {mine.length === 0 && (
        <div className="flex flex-col gap-4 rounded-sm border border-dashed border-line-strong p-6">
          <div className="flex flex-col gap-1">
            <span className="display text-[22px]">No doors yet</span>
            <span className="text-[14px] text-ink-dim">Pick what the first one should open.</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {DOOR_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => openDoorDialog({ projectId: project.id, kind })}
                className="door flex flex-col gap-1 p-3.5"
              >
                <span className="font-display text-[17px] font-semibold uppercase tracking-[0.02em]">{KIND_META[kind].label}</span>
                <span className="text-[13px] leading-snug text-ink-dim">{KIND_META[kind].desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {launch.length > 0 && (
        <Section label="Launch">
          <div className="flex flex-col gap-3">
            {launch.map((d) => (
              <LaunchCard key={d.id} door={d} project={project} />
            ))}
          </div>
        </Section>
      )}

      {autos.length > 0 && (
        <Section label="Automations" hint="JS scripts & saved flows">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {autos.map((d, i) => (
              <AutomationCard key={d.id} door={d} project={project} shortcut={i < 9 ? i + 1 : undefined} />
            ))}
          </div>
        </Section>
      )}

      {links.length > 0 && (
        <Section label="Links">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            {links.map((d) => (
              <LinkCard key={d.id} door={d} project={project} />
            ))}
          </div>
        </Section>
      )}

      {notes.length > 0 && (
        <Section label="Notes">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {notes.map((d) => (
              <NoteCard key={d.id} door={d} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
