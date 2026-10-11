import { useState, type FormEvent } from "react";
import { FolderSearch, Trash2, X } from "lucide-react";
import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { doorsStore, getDoorsState } from "../doors/store";
import type { Project } from "../doors/types";
import { inApp } from "../lib/native";
import { toastError } from "../lib/toast";
import { closeOverlays } from "../lib/ui";
import { navigate } from "../router";
import { Modal } from "./Modal";

export function ProjectDialog({ project }: { project?: Project }) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [path, setPath] = useState(project?.path ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const doorCount = project ? getDoorsState().doors.filter((d) => d.projectId === project.id).length : 0;

  const browse = async () => {
    try {
      const picked = await pickFolder({ directory: true, multiple: false, defaultPath: path || undefined });
      if (typeof picked !== "string") return;
      setPath(picked);
      if (!title.trim()) setTitle(picked.split("/").filter(Boolean).pop() ?? "");
    } catch (e) {
      toastError(e);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError("Give the project a name.");
    const fields = { title: t, description: description.trim() || undefined, path: path.trim() || undefined };
    if (project) {
      doorsStore.updateProject({ ...project, ...fields });
      closeOverlays();
    } else {
      const created = doorsStore.addProject(fields);
      closeOverlays();
      navigate({ name: "project", projectId: created.id });
    }
  };

  const remove = () => {
    if (!project) return;
    if (!confirmDelete) return setConfirmDelete(true);
    doorsStore.removeProject(project.id);
    closeOverlays();
    navigate({ name: "project" });
  };

  return (
    <Modal label={project ? `Edit ${project.title}` : "New project"} onClose={closeOverlays} className="w-[560px]">
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex items-center gap-4 border-b border-line px-6 py-5">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="eyebrow">{project ? "Edit project" : "New project"}</span>
            <h1 className="display text-[28px]">{project ? project.title : "Add a project"}</h1>
          </div>
          <button type="button" className="icon-btn size-9" onClick={closeOverlays} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="project-title" className="label">
              Name
            </label>
            <input id="project-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kindly" className="field" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="project-path" className="label">
              Folder
            </label>
            <div className="flex gap-2">
              <input
                id="project-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="~/Work/kindly"
                className="field field-mono"
              />
              {inApp && (
                <button type="button" className="btn btn-ghost" onClick={() => void browse()}>
                  <FolderSearch /> Choose…
                </button>
              )}
            </div>
            <span className="text-[13px] text-ink-dim">Scripts and shell steps run here; “open in Cursor” opens it.</span>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="project-desc" className="label">
              Description
            </label>
            <input id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="field" />
          </div>
          {error && (
            <p role="alert" className="text-[14px] text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-bg-sunk px-6 py-4">
          {project && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <Trash2 /> {confirmDelete ? `Delete with ${doorCount} door${doorCount === 1 ? "" : "s"}?` : "Delete"}
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn btn-ghost" onClick={closeOverlays}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {project ? "Save" : "Add project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
