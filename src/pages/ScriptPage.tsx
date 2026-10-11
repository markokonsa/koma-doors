import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Play, Save, Settings2, Square } from "lucide-react";
import { RunLog, RunStatus } from "../components/RunRail";
import { latestRun, runDoor, stopRun, useRuns } from "../doors/runs";
import { findProject, useDoorsState } from "../doors/store";
import { SCRIPT_TEMPLATES } from "../doors/templates";
import type { ScriptDoor } from "../doors/types";
import { expandHome, inApp, readTextFile, runProcess, writeTextFile } from "../lib/native";
import { ago, duration } from "../lib/time";
import { toast, toastError } from "../lib/toast";
import { openDoorDialog } from "../lib/ui";
import { navigate } from "../router";

/** Plain textarea editor with a line-number gutter. Tab indents two spaces. */
function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split("\n").length;
  return (
    <div className="flex min-h-0 flex-1 bg-bg-deep font-mono text-[13.5px] leading-[1.75]">
      <div ref={gutter} aria-hidden="true" className="w-14 shrink-0 select-none overflow-hidden py-[18px] pr-4 text-right text-[#5d615c]">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        aria-label="Script source"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: a, selectionEnd: b } = el;
            const next = `${value.slice(0, a)}  ${value.slice(b)}`;
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
          }
          // ⌘S / ⌘↵ bubble up to the page.
        }}
        className="min-w-0 flex-1 resize-none whitespace-pre bg-transparent py-[18px] pr-6 text-ink outline-none"
      />
    </div>
  );
}

export function ScriptPage({ doorId }: { doorId: string }) {
  const { doors } = useDoorsState();
  const door = doors.find((d): d is ScriptDoor => d.id === doorId && d.kind === "script");
  const project = findProject(door?.projectId);
  const { runs } = useRuns();
  const run = door ? latestRun(runs, door.id) : undefined;

  const [source, setSource] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const dirty = source != null && source !== saved;

  useEffect(() => {
    if (!door || !inApp) return;
    let cancelled = false;
    readTextFile(door.file)
      .then((text) => {
        if (cancelled) return;
        setMissing(text == null);
        const initial = text ?? SCRIPT_TEMPLATES.blank.body(door.title);
        setSource(initial);
        setSaved(text);
      })
      .catch(toastError);
    return () => {
      cancelled = true;
    };
    // Reload only when the door or its file changes, not on every title edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [door?.id, door?.file]);

  const save = useCallback(async () => {
    if (!door || source == null) return false;
    try {
      await writeTextFile(door.file, source);
      setSaved(source);
      setMissing(false);
      return true;
    } catch (e) {
      toastError(e);
      return false;
    }
  }, [door, source]);

  const runIt = useCallback(async () => {
    if (!door) return;
    if (dirty && !(await save())) return;
    runDoor(door, project).catch(toastError);
  }, [door, project, dirty, save]);

  const openInCursor = async () => {
    if (!door) return;
    try {
      // Fire-and-forget: output isn't interesting here.
      await runProcess(crypto.randomUUID(), 'open -a "Cursor" "$DOOR_FILE"', undefined, { DOOR_FILE: await expandHome(door.file) });
    } catch (e) {
      toastError(e);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      void save().then((ok) => ok && toast("Saved", "info"));
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void runIt();
    }
  };

  if (!door) {
    return (
      <div className="flex flex-col items-start gap-4 p-9">
        <span className="eyebrow">Script not found</span>
        <button className="btn btn-ghost" onClick={() => navigate({ name: "project" })}>
          Back to projects
        </button>
      </div>
    );
  }

  const running = run?.status === "running";

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <div className="flex items-center gap-5 border-b border-line-soft px-7 py-5">
        <span className="tag">JS</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-ink-dim">
            <button className="hover:text-ink" onClick={() => navigate({ name: "project", projectId: door.projectId })}>
              {project?.title ?? "Project"}
            </button>
            <span aria-hidden="true">/</span>
            <span>Automations</span>
          </nav>
          <h1 className="display truncate text-[30px]">{door.title}</h1>
          <span className="truncate font-mono text-[12px] text-ink-dim" title={door.file}>
            {door.file} · {missing ? "not saved yet" : dirty ? "unsaved changes" : "saved"}
          </span>
        </div>
        <button className="icon-btn size-10" onClick={() => openDoorDialog({ projectId: door.projectId, door })} aria-label="Door settings">
          <Settings2 size={15} />
        </button>
        <button className="btn btn-ghost" onClick={() => void openInCursor()}>
          Open in Cursor
        </button>
        <button className="btn btn-ghost" disabled={!dirty} onClick={() => void save()}>
          <Save /> Save · ⌘S
        </button>
        {running ? (
          <button className="btn btn-primary" onClick={() => run && void stopRun(run.id)}>
            <Square fill="currentColor" /> Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void runIt()}>
            <Play fill="currentColor" /> Run · ⌘↵
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {!inApp ? (
            <p className="p-7 text-ink-dim">Scripts can be edited and run in the desktop app.</p>
          ) : source == null ? (
            <p className="p-7 text-ink-dim">Loading…</p>
          ) : (
            <CodeEditor value={source} onChange={setSource} />
          )}
          <div className="flex h-[220px] shrink-0 flex-col border-t border-line bg-bg-sunk">
            <div className="flex h-9 shrink-0 items-center gap-4 border-b border-line-soft px-4">
              <span className="eyebrow text-ink">Output</span>
              {run && (
                <span className="font-mono text-[11px] text-ink-dim">
                  {ago(run.startedAt)}
                  {run.endedAt ? ` · ${duration(run.endedAt - run.startedAt)}` : ""}
                </span>
              )}
              {run && (
                <span className="ml-auto">
                  <RunStatus status={run.status} />
                </span>
              )}
            </div>
            <RunLog lines={run?.log ?? []} empty="Run the script to see its output." className="min-h-0 flex-1" />
          </div>
        </div>

        <aside aria-label="Script context" className="hidden w-[320px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-line-soft p-6 xl:flex">
          <section className="flex flex-col gap-3">
            <span className="eyebrow">01 · How it runs</span>
            <dl className="flex flex-col gap-2 font-mono text-[12px]">
              {[
                ["command", "node <file>"],
                ["cwd", project?.path ?? "home folder"],
                ["shell", "your login shell"],
                ["trigger", "card click · ⌘K"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-dim">{k}</dt>
                  <dd className="truncate text-right" title={v}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="flex flex-col gap-3">
            <span className="eyebrow">02 · Environment</span>
            <div className="flex flex-wrap gap-1.5">
              {["DOOR_PROJECT_DIR", "DOOR_PROJECT_ID", "DOOR_TITLE", "DOOR_FILE", "DOOR_ID"].map((v) => (
                <span key={v} className="chip text-[11px]">
                  {v}
                </span>
              ))}
            </div>
            <span className="text-[13px] leading-relaxed text-ink-dim">
              Plus everything your shell profile exports. Use <code className="font-mono text-ink">.mjs</code> for top-level{" "}
              <code className="font-mono text-ink">await</code>.
            </span>
          </section>
          <section className="flex flex-col gap-3">
            <span className="eyebrow">03 · Keys</span>
            <div className="flex flex-col gap-1.5 font-mono text-[12px] text-ink-dim">
              <span>
                <span className="text-ink">⌘S</span> save
              </span>
              <span>
                <span className="text-ink">⌘↵</span> save &amp; run
              </span>
              <span>
                <span className="text-ink">Esc</span> back to project
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
