import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { runDoor } from "../doors/runs";
import { useDoorsState } from "../doors/store";
import { KIND_META } from "../doors/types";
import { toastError } from "../lib/toast";
import { closeOverlays, openDoorDialog, openProjectDialog } from "../lib/ui";
import { navigate } from "../router";
import { cn } from "@/lib/utils";
import { editDoor } from "./DoorCards";
import { Modal } from "./Modal";

interface Item {
  id: string;
  group: "Doors" | "Projects" | "Actions";
  tag: string;
  title: string;
  meta: string;
  accent?: boolean;
  run: () => void;
  edit?: () => void;
}

/** ⌘K: search every door in every project, plus projects and app actions. */
export function Launcher({ currentProjectId }: { currentProjectId?: string }) {
  const { projects, doors } = useDoorsState();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    const all: Item[] = [
      ...doors.map<Item>((d) => ({
        id: d.id,
        group: "Doors",
        tag: KIND_META[d.kind].tag,
        title: d.title,
        meta: byId.get(d.projectId)?.title ?? "",
        accent: d.kind === "flow",
        run: () => {
          closeOverlays();
          runDoor(d, byId.get(d.projectId)).catch(toastError);
        },
        edit: () => {
          closeOverlays();
          editDoor(d);
        },
      })),
      ...projects.map<Item>((p) => ({
        id: `p:${p.id}`,
        group: "Projects",
        tag: "PROJ",
        title: p.title,
        meta: `${doors.filter((d) => d.projectId === p.id).length} doors`,
        run: () => {
          closeOverlays();
          navigate({ name: "project", projectId: p.id });
        },
      })),
      ...(currentProjectId
        ? [
            {
              id: "a:new-door",
              group: "Actions" as const,
              tag: "NEW",
              title: "New door…",
              meta: byId.get(currentProjectId)?.title ?? "",
              accent: true,
              run: () => openDoorDialog({ projectId: currentProjectId }),
            },
          ]
        : []),
      { id: "a:new-project", group: "Actions", tag: "NEW", title: "New project…", meta: "", accent: true, run: () => openProjectDialog({}) },
      {
        id: "a:flow",
        group: "Actions",
        tag: "FLOW",
        title: "Build a flow in KOMA/flow",
        meta: "workflows.konsa.ee",
        accent: true,
        run: () => {
          closeOverlays();
          navigate({ name: "flow" });
        },
      },
      {
        id: "a:settings",
        group: "Actions",
        tag: "APP",
        title: "Settings",
        meta: "",
        run: () => {
          closeOverlays();
          navigate({ name: "settings" });
        },
      },
    ];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((it) => {
      const hay = `${it.title} ${it.meta} ${it.tag}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [projects, doors, q, currentProjectId]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const current = items[sel];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && current.edit) current.edit();
      else current.run();
    }
  };

  let index = 0;
  const groups = (["Doors", "Projects", "Actions"] as const)
    .map((g) => ({ g, list: items.filter((it) => it.group === g) }))
    .filter((x) => x.list.length);

  return (
    <Modal label="Open a door" onClose={closeOverlays} className="w-[680px]" top="13vh">
      <div className="flex h-[60px] items-center gap-3 border-b border-line px-[18px]">
        <Search size={18} className="text-ink-dim" aria-hidden="true" />
        <input
          autoFocus
          aria-label="Search doors"
          role="combobox"
          aria-expanded="true"
          aria-controls="launcher-list"
          aria-activedescendant={current ? `launcher-${current.id}` : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Run a door, open a project…"
          className="h-10 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-faint"
        />
        <kbd className="rounded-sm border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">esc</kbd>
      </div>

      <div ref={listRef} id="launcher-list" role="listbox" className="flex max-h-[min(470px,55vh)] flex-col gap-0.5 overflow-y-auto p-2">
        {groups.map(({ g, list }) => (
          <div key={g} role="group" aria-label={g} className="flex flex-col gap-0.5">
            <div className="eyebrow px-2.5 pb-1.5 pt-3">{g}</div>
            {list.map((it) => {
              const i = index++;
              const on = i === sel;
              return (
                <button
                  key={it.id}
                  id={`launcher-${it.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={on}
                  tabIndex={-1}
                  onMouseMove={() => setSel(i)}
                  onClick={it.run}
                  className={cn("flex h-12 shrink-0 items-center gap-3.5 rounded-sm px-3 text-left", on ? "bg-bg-raise shadow-[inset_2px_0_0_var(--color-brand)]" : "")}
                >
                  <span className={cn("tag w-[52px] justify-center", it.accent && "tag-brand")}>{it.tag}</span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
                    <span className="truncate text-[15px] font-medium">{it.title}</span>
                    <span className="truncate font-mono text-[11px] text-ink-dim">{it.meta}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-3 py-8 text-center text-[14px] text-ink-dim">
            No door matches.{" "}
            {currentProjectId && (
              <button className="text-brand-hover hover:underline" onClick={() => openDoorDialog({ projectId: currentProjectId })}>
                Create one
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex h-11 items-center gap-5 border-t border-line bg-bg-sunk px-[18px] font-mono text-[11px] text-ink-dim">
        <span>
          <span className="text-ink">↵</span> run
        </span>
        <span>
          <span className="text-ink">⌘↵</span> edit door
        </span>
        <span>
          <span className="text-ink">↑↓</span> move
        </span>
        <span className="ml-auto truncate">{current ? `${current.meta ? `${current.meta} / ` : ""}${current.title}` : ""}</span>
      </div>
    </Modal>
  );
}
