import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, Play, RotateCw, Save, Settings2, X } from "lucide-react";
import { KomaMark } from "../components/KomaMark";
import { embeddedBuilderUrl, getBuilderUrl, saveNewFlowFile } from "../doors/flows";
import { runDoor } from "../doors/runs";
import { doorsStore, findProject, useDoorsState } from "../doors/store";
import type { FlowDoor } from "../doors/types";
import { inApp, openTarget, readTextFile, writeTextFile } from "../lib/native";
import { basename } from "../lib/time";
import { toast, toastError } from "../lib/toast";
import { navigate } from "../router";

/** Messages from the builder (see src/lib/workflow/bridge.ts in KOMA/flow). */
type BuilderMessage = { type: "koma-flow:ready" } | { type: "koma-flow:save"; name: string; fileName: string; source: string };

type Bridge = "connecting" | "ready" | "unsupported";

/**
 * KOMA/flow embedded. With a flow door, its exported .mjs is loaded into the builder and saved back to
 * the same file; without one, saving creates a new flow door.
 */
export function FlowPage({ doorId, currentProjectId }: { doorId?: string; currentProjectId?: string }) {
  const { projects, doors } = useDoorsState();
  const door = doors.find((d): d is FlowDoor => d.id === doorId && d.kind === "flow");
  const builderBase = door?.file ? getBuilderUrl() : (door?.url ?? getBuilderUrl());
  const src = useMemo(() => embeddedBuilderUrl(builderBase), [builderBase]);
  const origin = new URL(src).origin;

  const frame = useRef<HTMLIFrameElement>(null);
  const [reloads, setReloads] = useState(0);
  const [bridge, setBridge] = useState<Bridge>("connecting");
  const [pending, setPending] = useState<{ name: string; fileName: string; source: string } | null>(null);
  const [panel, setPanel] = useState(false);
  const [title, setTitle] = useState(door?.title ?? "");
  const [projectId, setProjectId] = useState(door?.projectId ?? currentProjectId ?? projects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  // Latest values for the message handler without re-subscribing.
  const latest = useRef({ door, origin });
  latest.current = { door, origin };

  useEffect(() => {
    setTitle(door?.title ?? "");
    setPanel(false);
    setPending(null);
  }, [door?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = (message: unknown) => frame.current?.contentWindow?.postMessage(message, origin);

  useEffect(() => {
    setBridge("connecting");
    const timer = setTimeout(() => setBridge((b) => (b === "connecting" ? "unsupported" : b)), 10_000);

    const onMessage = async (e: MessageEvent) => {
      const { door: current, origin: expected } = latest.current;
      if (e.origin !== expected || e.source !== frame.current?.contentWindow) return;
      const msg = e.data as Partial<BuilderMessage> | null;

      if (msg?.type === "koma-flow:ready") {
        setBridge("ready");
        if (!current?.file || !inApp) return;
        try {
          const source = await readTextFile(current.file);
          if (source == null) toast(`${current.file} is missing; save from the builder to recreate it.`);
          else post({ type: "koma-flow:load", source, name: current.title });
        } catch (err) {
          toastError(err);
        }
      } else if (msg?.type === "koma-flow:save" && typeof msg.source === "string") {
        const saved = { name: msg.name || "workflow", fileName: msg.fileName || "workflow.mjs", source: msg.source };
        try {
          if (current?.file) {
            await writeTextFile(current.file, saved.source);
            toast(`Saved ${basename(current.file)}`, "info");
          } else if (current) {
            // A builder-link door without a file: give it one.
            const file = await saveNewFlowFile(current.projectId, saved.fileName, saved.source);
            doorsStore.updateDoor({ ...current, file });
            toast(`Saved ${basename(file)}; the card now runs this flow`, "info");
          } else {
            setPending(saved);
            setTitle(saved.name);
            setPanel(true);
          }
        } catch (err) {
          toastError(err);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [src, reloads]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestSave = () => {
    setError(null);
    post({ type: "koma-flow:request-save" });
  };

  const createDoor = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError("Give the door a name.");
    if (!findProject(projectId)) return setError("Pick a project.");
    if (!pending) return setError("Save from the builder first.");
    try {
      const file = await saveNewFlowFile(projectId, pending.fileName, pending.source);
      doorsStore.addDoor({ kind: "flow", title: t, projectId, file });
      navigate({ name: "project", projectId });
    } catch (err) {
      toastError(err);
    }
  };

  const updateDoor = (e: FormEvent) => {
    e.preventDefault();
    if (!door) return;
    const t = title.trim();
    if (!t) return setError("Give the door a name.");
    doorsStore.updateDoor({ ...door, title: t, projectId });
    setPanel(false);
  };

  const backTo = door?.projectId ?? currentProjectId;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-line-soft bg-bg-sunk px-4">
          <button className="icon-btn" onClick={() => navigate({ name: "project", projectId: backTo })} aria-label="Back to project">
            <ArrowLeft size={14} />
          </button>
          <button className="icon-btn" onClick={() => setReloads((n) => n + 1)} aria-label="Reload builder">
            <RotateCw size={13} />
          </button>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-medium">{door?.title ?? "New flow"}</span>
            <span className="truncate font-mono text-[11px] text-ink-dim" title={door?.file}>
              {door?.file ? door.file : door ? "builder link (no file yet)" : "save from the builder to make a door"}
            </span>
          </div>
          <span className="flex-1" />
          <span className="hidden items-center gap-2 font-mono text-[11px] text-ink-dim xl:inline-flex">
            <span className={bridge === "ready" ? "size-1.5 rounded-full bg-brand" : "size-1.5 rounded-full bg-ink-faint"} />
            {bridge === "ready" ? `connected · ${new URL(src).host}` : bridge === "connecting" ? "connecting…" : "not connected"}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => openTarget(builderBase).catch(toastError)}>
            <ExternalLink /> Browser
          </button>
          {door && (
            <button className="icon-btn" onClick={() => setPanel((p) => !p)} aria-label="Door settings">
              <Settings2 size={14} />
            </button>
          )}
          {door?.file && (
            <button className="btn btn-ghost btn-sm" onClick={() => runDoor(door, findProject(door.projectId)).catch(toastError)}>
              <Play /> Run
            </button>
          )}
          <button className="btn btn-primary btn-sm" disabled={bridge !== "ready"} onClick={requestSave}>
            <Save /> {door ? "Save flow" : "Save as door"}
          </button>
        </div>

        {bridge === "unsupported" && (
          <div role="status" className="border-b border-line-soft bg-bg-raise px-5 py-2.5 text-[13px] text-ink-dim">
            The builder at <code className="font-mono text-ink">{new URL(src).host}</code> didn't answer. It needs the KOMA Home bridge
            (<code className="font-mono text-ink">src/lib/workflow/bridge.ts</code>); deploy it, or point Settings → Flow builder at your local
            dev server.
          </div>
        )}

        <div className="flex h-11 shrink-0 items-center gap-3.5 border-b border-line-soft bg-[#121514] px-[18px]">
          <span className="text-[15px]">
            <KomaMark suffix="/flow" />
          </span>
          <span className="ml-auto font-mono text-[11px] text-ink-dim">web content · {new URL(src).host}</span>
        </div>
        <iframe
          ref={frame}
          key={`${src}#${reloads}`}
          src={src}
          title="KOMA/flow"
          allow="clipboard-read; clipboard-write"
          className="dot-grid min-h-0 w-full flex-1 border-0"
        />
      </div>

      {panel && (
        <aside aria-label={door ? "Door settings" : "Save as door"} className="flex w-[360px] shrink-0 flex-col border-l border-line-soft bg-bg-soft">
          <form onSubmit={door ? updateDoor : createDoor} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-2 border-b border-line px-6 pb-[18px] pt-6">
              <div className="flex items-center justify-between">
                <span className="eyebrow">{door ? "Flow door" : "Save as door"}</span>
                <button type="button" className="icon-btn size-7 border-0" onClick={() => setPanel(false)} aria-label="Close panel">
                  <X size={14} />
                </button>
              </div>
              <h2 className="display text-[26px]">{title || "New flow door"}</h2>
              <p className="text-[14px] leading-relaxed text-ink-dim">
                {door
                  ? "Clicking the card runs this flow; the pencil reopens it here."
                  : "The flow is saved as a runnable .mjs. Clicking the card runs it, the pencil reopens it in the builder."}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="flow-title" className="label">
                  Name
                </label>
                <input id="flow-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="flow-project" className="label">
                  Project
                </label>
                <select id="flow-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field">
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              {(door?.file || pending) && (
                <div className="flex flex-col gap-2">
                  <span className="label">File</span>
                  <div className="break-all rounded-sm border border-line-soft bg-bg-deep p-3 font-mono text-[11.5px] leading-[1.7] text-ink-dim">
                    {door?.file ?? `scripts/${projectId}/${pending?.fileName}`}
                  </div>
                  <span className="text-[13px] leading-relaxed text-ink-dim">
                    Runs with bun if installed, else node. Supabase keys come from the project's environment (Edit project).
                  </span>
                </div>
              )}
              {error && (
                <p role="alert" className="text-[14px] text-danger">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-2 border-t border-line px-6 py-4">
              {door && (
                <button
                  type="button"
                  className="btn btn-danger flex-1"
                  onClick={() => {
                    doorsStore.removeDoor(door.id);
                    navigate({ name: "project", projectId: door.projectId });
                  }}
                >
                  Delete door
                </button>
              )}
              <button type="submit" className="btn btn-primary flex-1">
                {door ? "Save" : "Create door"}
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}
