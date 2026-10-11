import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, Lock, RotateCw, Save, X } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { KomaMark } from "../components/KomaMark";
import { doorsStore, findProject, useDoorsState } from "../doors/store";
import { FLOW_BUILDER_URL, type FlowDoor } from "../doors/types";
import { inApp, openTarget } from "../lib/native";
import { toast, toastError } from "../lib/toast";
import { navigate } from "../router";

const FLOW_ORIGIN = new URL(FLOW_BUILDER_URL).origin;

/**
 * KOMA/flow embedded in the app. KOMA/flow can report the page it's on with
 * `parent.postMessage({ type: "koma-flow:location", url: location.href }, "*")`, which keeps the
 * address bar (and so Save as door) in sync; without it, paste the flow's URL into the address bar.
 */
export function FlowPage({ doorId, currentProjectId }: { doorId?: string; currentProjectId?: string }) {
  const { projects, doors } = useDoorsState();
  const door = doors.find((d): d is FlowDoor => d.id === doorId && d.kind === "flow");
  const startUrl = door?.url ?? FLOW_BUILDER_URL;

  const [src, setSrc] = useState(startUrl);
  const [address, setAddress] = useState(startUrl);
  const [reloads, setReloads] = useState(0);
  const [saving, setSaving] = useState(!door);
  const [title, setTitle] = useState(door?.title ?? "");
  const [projectId, setProjectId] = useState(door?.projectId ?? currentProjectId ?? projects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSrc(startUrl);
    setAddress(startUrl);
    setTitle(door?.title ?? "");
    setSaving(!door);
  }, [door?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string; title?: string } | null;
      if (e.origin !== FLOW_ORIGIN || data?.type !== "koma-flow:location" || typeof data.url !== "string") return;
      setAddress(data.url);
      if (data.title) setTitle((t) => t || data.title!);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const go = (e: FormEvent) => {
    e.preventDefault();
    const url = /^https?:\/\//.test(address) ? address : `https://${address}`;
    setAddress(url);
    setSrc(url);
  };

  const popOut = async () => {
    try {
      if (!inApp) return openTarget(address);
      const win = new WebviewWindow(`flow-${Date.now()}`, { url: address, title: "KOMA/flow", width: 1360, height: 860 });
      win.once("tauri://error", (e) => toastError(String(e.payload)));
    } catch (e) {
      toastError(e);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError("Give the door a name.");
    if (!findProject(projectId)) return setError("Pick a project.");
    if (!/^https?:\/\//.test(address)) return setError("The address isn't a URL.");
    if (door) {
      doorsStore.updateDoor({ ...door, title: t, projectId, url: address });
      toast("Door updated", "info");
      setSaving(false);
    } else {
      doorsStore.addDoor({ kind: "flow", title: t, projectId, url: address });
      navigate({ name: "project", projectId });
    }
  };

  let host = address;
  try {
    const u = new URL(address);
    host = u.host;
  } catch {
    /* keep raw */
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-line-soft bg-bg-sunk px-4">
          <button
            className="icon-btn"
            onClick={() => navigate({ name: "project", projectId: door?.projectId ?? currentProjectId })}
            aria-label="Back to project"
          >
            <ArrowLeft size={14} />
          </button>
          <button className="icon-btn" onClick={() => setReloads((n) => n + 1)} aria-label="Reload">
            <RotateCw size={13} />
          </button>
          <form onSubmit={go} className="flex h-8 min-w-0 max-w-[560px] flex-1 items-center gap-2 rounded-sm border border-line bg-bg-soft px-3">
            <Lock size={12} className="shrink-0 text-ink-dim" aria-hidden="true" />
            <input
              aria-label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none"
            />
          </form>
          <span className="hidden items-center gap-2 font-mono text-[11px] text-ink-dim 2xl:inline-flex">
            <span className="size-1.5 rounded-full bg-brand" />
            {host}
          </span>
          <span className="flex-1" />
          <button className="btn btn-ghost btn-sm" onClick={() => void popOut()}>
            <ExternalLink /> Window
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setSaving((s) => !s)}>
            <Save /> {door ? "Door settings" : "Save as door"}
          </button>
        </div>
        <div className="flex h-11 shrink-0 items-center gap-3.5 border-b border-line-soft bg-[#121514] px-[18px]">
          <span className="text-[15px]">
            <KomaMark suffix="/flow" />
          </span>
          <span className="truncate font-mono text-[12px] text-ink-dim">{door?.title ?? "builder"}</span>
          <span className="ml-auto font-mono text-[11px] text-ink-dim">web content · {host}</span>
        </div>
        <iframe
          key={`${src}#${reloads}`}
          src={src}
          title="KOMA/flow"
          allow="clipboard-read; clipboard-write"
          className="dot-grid min-h-0 w-full flex-1 border-0"
        />
      </div>

      {saving && (
        <aside aria-label="Save as door" className="flex w-[360px] shrink-0 flex-col border-l border-line-soft bg-bg-soft">
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-2 border-b border-line px-6 pb-[18px] pt-6">
              <div className="flex items-center justify-between">
                <span className="eyebrow">{door ? "Flow door" : "Save as door"}</span>
                <button type="button" className="icon-btn size-7 border-0" onClick={() => setSaving(false)} aria-label="Close panel">
                  <X size={14} />
                </button>
              </div>
              <h2 className="display text-[26px]">{title || "New flow door"}</h2>
              <p className="text-[14px] leading-relaxed text-ink-dim">
                The flow becomes a card on the project. Clicking it opens the flow right here.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="flow-title" className="label">
                  Name
                </label>
                <input id="flow-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ledger reconcile" className="field" />
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
              <div className="flex flex-col gap-2">
                <span className="label">Flow URL</span>
                <div className="break-all rounded-sm border border-line-soft bg-bg-deep p-3 font-mono text-[11.5px] leading-[1.7] text-ink-dim">
                  {address}
                </div>
                <span className="text-[13px] leading-relaxed text-ink-dim">
                  Taken from the address bar. Open the flow in the builder, then paste its link there if it doesn't update by itself.
                </span>
              </div>
              {error && (
                <p role="alert" className="text-[14px] text-danger">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-2 border-t border-line px-6 py-4">
              {door && (
                <button type="button" className="btn btn-danger flex-1" onClick={() => {
                  doorsStore.removeDoor(door.id);
                  navigate({ name: "project", projectId: door.projectId });
                }}>
                  Delete
                </button>
              )}
              <button type="submit" className="btn btn-primary flex-1">
                {door ? "Update door" : "Save door"}
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}
