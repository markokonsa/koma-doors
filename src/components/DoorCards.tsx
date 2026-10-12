import type { ReactNode } from "react";
import { ArrowUpRight, FolderOpen, Pencil, Play } from "lucide-react";
import { latestRun, runDoor, stepLabel, useRuns } from "../doors/runs";
import { doorsStore } from "../doors/store";
import { KIND_META, type Door, type FlowDoor, type LaunchDoor, type LinkDoor, type NoteDoor, type Project, type ScriptDoor } from "../doors/types";
import { isUrl } from "../lib/native";
import { ago, basename } from "../lib/time";
import { toastError } from "../lib/toast";
import { openDoorDialog } from "../lib/ui";
import { navigate } from "../router";
import { cn } from "@/lib/utils";

function useIsRunning(doorId: string) {
  const { runs } = useRuns();
  return latestRun(runs, doorId)?.status === "running";
}

const open = (door: Door, project: Project) => runDoor(door, project).catch(toastError);

/** Scripts edit in the script editor, flows in the builder; everything else in the door dialog. */
export function editDoor(door: Door) {
  if (door.kind === "script") navigate({ name: "script", doorId: door.id });
  else if (door.kind === "flow") navigate({ name: "flow", doorId: door.id });
  else openDoorDialog({ projectId: door.projectId, door });
}

function EditButton({ door }: { door: Door }) {
  return (
    <button
      onClick={() => editDoor(door)}
      aria-label={`Edit ${door.title}`}
      className="icon-btn absolute right-2.5 top-2.5 z-10 size-7 bg-bg-raise opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Pencil size={13} />
    </button>
  );
}

function CardShell({ door, running, className, children, onOpen }: { door: Door; running: boolean; className?: string; children: ReactNode; onOpen: () => void }) {
  return (
    <div className="door group" data-running={running}>
      <button onClick={onOpen} className={cn("flex w-full text-left", className)} title={door.title}>
        {children}
      </button>
      <EditButton door={door} />
    </div>
  );
}

function Status({ running, lastRunAt }: { running: boolean; lastRunAt?: number }) {
  return (
    <span className={cn("whitespace-nowrap font-mono text-[11px]", running ? "text-brand-hover" : "text-ink-dim")}>
      {running ? "● Running" : ago(lastRunAt)}
    </span>
  );
}

export function LaunchCard({ door, project }: { door: LaunchDoor; project: Project }) {
  const running = useIsRunning(door.id);
  return (
    <CardShell door={door} running={running} onOpen={() => open(door, project)} className="items-center gap-6 px-[22px] py-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-brand text-on-brand" aria-hidden="true">
        <Play size={22} fill="currentColor" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="display text-[22px] leading-none">{door.title}</span>
        <span className="flex flex-wrap items-center gap-2">
          {door.steps.length === 0 && <span className="text-[13px] text-ink-dim">No steps yet</span>}
          {door.steps.map((s, i) => (
            <span key={s.id} className="contents">
              {i > 0 && (
                <span className="text-ink-dim" aria-hidden="true">
                  →
                </span>
              )}
              <span className="chip max-w-[260px] truncate">{stepLabel(s)}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1.5 self-end">
        <Status running={running} lastRunAt={door.lastRunAt} />
      </span>
    </CardShell>
  );
}

function flowLabel(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

export function AutomationCard({ door, project, shortcut }: { door: ScriptDoor | FlowDoor; project: Project; shortcut?: number }) {
  const running = useIsRunning(door.id);
  const flow = door.kind === "flow";
  return (
    <CardShell door={door} running={running} onOpen={() => open(door, project)} className="h-[112px] flex-col justify-between px-[18px] py-4">
      <span className="flex w-full items-center justify-between">
        <span className={cn("tag", flow && "tag-brand")}>{KIND_META[door.kind].tag}</span>
        {shortcut != null && <span className="font-mono text-[11px] text-ink-dim">⌘{shortcut}</span>}
      </span>
      <span className="flex w-full flex-col gap-1.5">
        <span className="truncate text-[16px] font-medium text-ink">{door.title}</span>
        <span className="flex justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-ink-dim">{door.kind === "flow" ? (door.file ? basename(door.file) : `builder · ${flowLabel(door.url ?? "")}`) : basename(door.file)}</span>
          <Status running={running} lastRunAt={door.lastRunAt} />
        </span>
      </span>
    </CardShell>
  );
}

function linkMonogram(title: string) {
  return title.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "↗";
}

export function LinkCard({ door, project }: { door: LinkDoor; project: Project }) {
  const local = !isUrl(door.target);
  const Icon = local ? FolderOpen : ArrowUpRight;
  return (
    <CardShell door={door} running={false} onOpen={() => open(door, project)} className="h-14 items-center gap-3 px-3.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-bg-raise font-mono text-[11px] font-medium" aria-hidden="true">
        {linkMonogram(door.title)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium leading-tight">{door.title}</span>
        <span className="truncate font-mono text-[10.5px] text-ink-dim">{local ? door.target : flowLabel(door.target)}</span>
      </span>
      <Icon size={14} className="shrink-0 text-ink-dim" aria-hidden="true" />
    </CardShell>
  );
}

export function NoteCard({ door }: { door: NoteDoor }) {
  return (
    <div className="door group flex flex-col gap-2 p-4 hover:bg-bg-soft">
      <span className="pr-8 text-[15px] font-medium">{door.title}</span>
      <textarea
        aria-label={door.title}
        value={door.text}
        onChange={(e) => doorsStore.updateDoor({ ...door, text: e.target.value })}
        rows={4}
        placeholder="Write something…"
        className="w-full resize-y bg-transparent text-[14px] leading-relaxed text-ink-dim outline-none placeholder:text-ink-faint focus:text-ink"
      />
      <EditButton door={door} />
    </div>
  );
}
