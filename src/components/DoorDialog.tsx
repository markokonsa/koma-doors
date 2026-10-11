import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, FolderSearch, Plus, Trash2, X } from "lucide-react";
import { open as pickPath } from "@tauri-apps/plugin-dialog";
import { APPS, APP_IDS, type AppId } from "../apps";
import { doorsStore, findProject, newId } from "../doors/store";
import { SCRIPT_TEMPLATES, SCRIPT_TEMPLATE_IDS, scriptFileName, type ScriptTemplateId } from "../doors/templates";
import { DOOR_KINDS, FLOW_BUILDER_URL, KIND_META, type Door, type DoorDraft, type DoorKind, type LaunchStep } from "../doors/types";
import { inApp, readTextFile, scriptsDir, writeTextFile } from "../lib/native";
import { toastError } from "../lib/toast";
import { closeOverlays } from "../lib/ui";
import { navigate } from "../router";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";

const DEFAULT_TITLE: Record<DoorKind, string> = {
  launch: "Open workspace",
  script: "",
  flow: "",
  link: "",
  note: "",
};

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}

function StepEditor({ steps, onChange }: { steps: LaunchStep[]; onChange: (s: LaunchStep[]) => void }) {
  const update = (i: number, step: LaunchStep) => onChange(steps.map((s, j) => (j === i ? step : s)));
  const move = (i: number, by: number) => {
    const next = [...steps];
    const [s] = next.splice(i, 1);
    if (s) next.splice(i + by, 0, s);
    onChange(next);
  };
  const changeKind = (i: number, kind: LaunchStep["kind"]) => {
    const id = steps[i]!.id;
    update(i, kind === "app" ? { id, kind, app: "cursor" } : kind === "url" ? { id, kind, url: "http://localhost:3000" } : { id, kind, cmd: "" });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <span className="label">Steps · run in order, stop at the first failure</span>
      <ol className="flex flex-col rounded-sm border border-line">
        {steps.length === 0 && <li className="px-3.5 py-4 text-[14px] text-ink-dim">No steps yet.</li>}
        {steps.map((step, i) => (
          <li key={step.id} className="flex flex-col gap-2 border-b border-line-soft px-3.5 py-3 last:border-b-0">
            <div className="flex items-center gap-2.5">
              <span className="w-5 font-mono text-[11px] text-ink-dim">{String(i + 1).padStart(2, "0")}</span>
              <select
                aria-label={`Step ${i + 1} type`}
                value={step.kind}
                onChange={(e) => changeKind(i, e.target.value as LaunchStep["kind"])}
                className="field h-9 w-[140px] font-mono text-[11px] uppercase tracking-[0.08em] text-brand-hover"
              >
                <option value="app">Open app</option>
                <option value="shell">Shell</option>
                <option value="url">Open URL</option>
              </select>
              {step.kind === "app" && (
                <>
                  <select
                    aria-label="App"
                    value={step.app}
                    onChange={(e) => update(i, { ...step, app: e.target.value as AppId })}
                    className="field h-9 w-[150px]"
                  >
                    {APP_IDS.map((id) => (
                      <option key={id} value={id}>
                        {APPS[id].label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Folder"
                    value={step.path ?? ""}
                    onChange={(e) => update(i, { ...step, path: e.target.value || undefined })}
                    placeholder="project folder"
                    className="field field-mono h-9 flex-1"
                  />
                </>
              )}
              {step.kind === "shell" && (
                <input
                  aria-label="Command"
                  value={step.cmd}
                  onChange={(e) => update(i, { ...step, cmd: e.target.value })}
                  placeholder="supabase start"
                  className="field field-mono h-9 flex-1"
                />
              )}
              {step.kind === "url" && (
                <input
                  aria-label="URL"
                  value={step.url}
                  onChange={(e) => update(i, { ...step, url: e.target.value })}
                  placeholder="http://localhost:3000"
                  className="field field-mono h-9 flex-1"
                />
              )}
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                <ArrowUp size={13} />
              </button>
              <button type="button" className="icon-btn" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                <ArrowDown size={13} />
              </button>
              <button type="button" className="icon-btn" onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label="Remove step">
                <X size={13} />
              </button>
            </div>
            {step.kind === "shell" && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[30px] text-[13px] text-ink-dim">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!step.background}
                    onChange={(e) => update(i, { ...step, background: e.target.checked || undefined, waitPort: e.target.checked ? step.waitPort : undefined })}
                    className="size-4 accent-brand"
                  />
                  Keeps running (dev server)
                </label>
                {step.background && (
                  <label className="flex items-center gap-2">
                    Wait for port
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={step.waitPort ?? ""}
                      onChange={(e) => update(i, { ...step, waitPort: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="3000"
                      className="field field-mono h-8 w-24"
                    />
                  </label>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-sm self-start border-dashed border-line-strong text-ink-dim hover:text-ink"
        onClick={() => onChange([...steps, { id: newId(), kind: "shell", cmd: "" }])}
      >
        <Plus /> Add step
      </button>
    </div>
  );
}

/** Create or edit a door. Opening it with an existing door edits that door. */
export function DoorDialog({ projectId, door, kind: initialKind }: { projectId: string; door?: Door; kind?: DoorKind }) {
  const editing = !!door;
  const project = findProject(projectId);
  const [kind, setKind] = useState<DoorKind>(door?.kind ?? initialKind ?? "script");
  const [title, setTitle] = useState(door?.title ?? DEFAULT_TITLE[door?.kind ?? initialKind ?? "script"]);
  const [steps, setSteps] = useState<LaunchStep[]>(door?.kind === "launch" ? door.steps : [{ id: newId(), kind: "app", app: "cursor" }]);
  const [file, setFile] = useState(door?.kind === "script" ? door.file : "");
  const [fileTouched, setFileTouched] = useState(editing);
  const [dir, setDir] = useState("");
  const [template, setTemplate] = useState<ScriptTemplateId>("blank");
  const [url, setUrl] = useState(door?.kind === "flow" ? door.url : FLOW_BUILDER_URL);
  const [target, setTarget] = useState(door?.kind === "link" ? door.target : "");
  const [text, setText] = useState(door?.kind === "note" ? door.text : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // New scripts go to <app data>/scripts/<project>/<title>.mjs unless you pick a file.
  useEffect(() => {
    if (kind !== "script" || editing || !inApp) return;
    scriptsDir(projectId).then(setDir, toastError);
  }, [kind, editing, projectId]);
  useEffect(() => {
    if (!fileTouched && dir) setFile(`${dir}/${scriptFileName(title)}`);
  }, [dir, title, fileTouched]);

  const pickKind = (k: DoorKind) => {
    setKind(k);
    setError(null);
    if (!title || title === DEFAULT_TITLE[kind]) setTitle(DEFAULT_TITLE[k]);
  };

  const browse = async (directory: boolean, set: (path: string) => void) => {
    try {
      const picked = await pickPath({
        directory,
        multiple: false,
        defaultPath: project?.path,
        filters: directory ? undefined : [{ name: "JavaScript", extensions: ["mjs", "js", "cjs"] }],
      });
      if (typeof picked === "string") set(picked);
    } catch (e) {
      toastError(e);
    }
  };

  const draft = (): DoorDraft | string => {
    const t = title.trim();
    if (!t) return "Give the door a name.";
    const base = { projectId, title: t, lastRunAt: door?.lastRunAt };
    switch (kind) {
      case "launch": {
        const clean = steps.filter((s) => (s.kind === "shell" ? s.cmd.trim() : s.kind === "url" ? s.url.trim() : true));
        if (!clean.length) return "Add at least one step.";
        return { ...base, kind, steps: clean };
      }
      case "script":
        if (!inApp) return "Script doors need the desktop app.";
        if (!file.trim()) return "Choose where the script file lives.";
        return { ...base, kind, file: file.trim() };
      case "flow":
        if (!/^https?:\/\//.test(url.trim())) return "Paste the flow's URL from KOMA/flow.";
        return { ...base, kind, url: url.trim() };
      case "link":
        if (!target.trim()) return "Add a URL or a folder.";
        return { ...base, kind, target: target.trim() };
      case "note":
        return { ...base, kind, text };
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const d = draft();
    if (typeof d === "string") return setError(d);
    try {
      if (door) {
        doorsStore.updateDoor({ ...d, id: door.id } as Door);
        closeOverlays();
        return;
      }
      if (d.kind === "script" && (await readTextFile(d.file)) == null) {
        await writeTextFile(d.file, SCRIPT_TEMPLATES[template].body(d.title));
      }
      const created = doorsStore.addDoor(d);
      closeOverlays();
      if (created.kind === "script") navigate({ name: "script", doorId: created.id });
    } catch (err) {
      toastError(err);
    }
  };

  const remove = () => {
    if (!door) return;
    if (!confirmDelete) return setConfirmDelete(true);
    doorsStore.removeDoor(door.id);
    closeOverlays();
    navigate({ name: "project", projectId });
  };

  return (
    <Modal label={editing ? `Edit ${door.title}` : "New door"} onClose={closeOverlays} className="h-[min(700px,80vh)] w-[960px]" top="8vh">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-line px-7 py-5">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="eyebrow">
              {project?.title ?? "Project"} · {editing ? "edit door" : "new door"}
            </span>
            <h1 className="display text-[30px]">{editing ? door.title : "What does this door open?"}</h1>
          </div>
          <button type="button" className="icon-btn size-9" onClick={closeOverlays} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div role="radiogroup" aria-label="Door type" className="flex w-[280px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-line p-5">
            {DOOR_KINDS.map((k) => {
              const on = k === kind;
              const m = KIND_META[k];
              return (
                <button
                  type="button"
                  key={k}
                  role="radio"
                  aria-checked={on}
                  disabled={editing && !on}
                  onClick={() => pickKind(k)}
                  className={cn(
                    "flex gap-3.5 rounded-sm border p-3.5 text-left transition-colors disabled:opacity-40",
                    on ? "border-brand bg-brand-soft" : "border-line hover:bg-bg-raise",
                  )}
                >
                  <span className={cn("pt-0.5 font-mono text-[11px]", on ? "text-brand-hover" : "text-ink-dim")}>{m.num}</span>
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-[18px] font-semibold uppercase leading-tight tracking-[0.02em]">{m.label}</span>
                    <span className="text-[13px] leading-snug text-ink-dim">{m.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 py-6">
            <Field label="Name" htmlFor="door-title">
              <input
                id="door-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "script" ? "Reset DB + seed" : kind === "link" ? "Jira board" : "Name"}
                className="field"
              />
            </Field>

            {kind === "launch" && <StepEditor steps={steps} onChange={setSteps} />}

            {kind === "script" && (
              <>
                <Field label="Script file" htmlFor="door-file">
                  <div className="flex gap-2">
                    <input
                      id="door-file"
                      value={file}
                      onChange={(e) => {
                        setFileTouched(true);
                        setFile(e.target.value);
                      }}
                      placeholder="~/Work/project/scripts/task.mjs"
                      className="field field-mono"
                    />
                    {inApp && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          void browse(false, (p) => {
                            setFileTouched(true);
                            setFile(p);
                          })
                        }
                      >
                        <FolderSearch /> Existing…
                      </button>
                    )}
                  </div>
                </Field>
                {!editing && (
                  <div className="flex flex-col gap-2">
                    <span className="label">Starts from (if the file doesn't exist yet)</span>
                    <div className="grid grid-cols-3 gap-2">
                      {SCRIPT_TEMPLATE_IDS.map((id) => (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={template === id}
                          onClick={() => setTemplate(id)}
                          className={cn(
                            "rounded-sm border p-3 text-left text-[14px] transition-colors",
                            template === id ? "border-brand bg-brand-soft" : "border-line hover:bg-bg-raise",
                          )}
                        >
                          {SCRIPT_TEMPLATES[id].label}
                          <span className="mt-1 block font-mono text-[11px] text-ink-dim">{SCRIPT_TEMPLATES[id].hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[13px] leading-relaxed text-ink-dim">
                  Runs as <code className="font-mono text-ink">node &lt;file&gt;</code> in {project?.path ? <code className="font-mono text-ink">{project.path}</code> : "the project folder"}, through your login shell so PATH matches your terminal.
                </p>
              </>
            )}

            {kind === "flow" && (
              <>
                <Field label="Flow URL" htmlFor="door-url">
                  <input id="door-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={FLOW_BUILDER_URL} className="field field-mono" />
                </Field>
                <p className="text-[13px] leading-relaxed text-ink-dim">
                  Clicking the card opens this flow inside the app. Don't have one yet?{" "}
                  <button
                    type="button"
                    className="text-brand-hover underline-offset-4 hover:underline"
                    onClick={() => {
                      closeOverlays();
                      navigate({ name: "flow" });
                    }}
                  >
                    Build it in KOMA/flow
                  </button>{" "}
                  and use Save as door there.
                </p>
              </>
            )}

            {kind === "link" && (
              <Field label="URL or folder" htmlFor="door-target">
                <div className="flex gap-2">
                  <input
                    id="door-target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="https://bitbucket.org/…  or  ~/Work/project"
                    className="field field-mono"
                  />
                  {inApp && (
                    <button type="button" className="btn btn-ghost" onClick={() => void browse(true, setTarget)}>
                      <FolderSearch /> Folder…
                    </button>
                  )}
                </div>
              </Field>
            )}

            {kind === "note" && (
              <Field label="Note" htmlFor="door-text">
                <textarea id="door-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="field" />
              </Field>
            )}

            {error && (
              <p role="alert" className="text-[14px] text-danger">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-bg-sunk px-7 py-4">
          {editing && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <Trash2 /> {confirmDelete ? "Click again to delete" : "Delete"}
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn btn-ghost" onClick={closeOverlays}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {editing ? "Save door" : kind === "script" ? "Create & edit script" : "Create door"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
