import { Plus, Workflow } from "lucide-react";
import { useDoorsState } from "../doors/store";
import { openProjectDialog } from "../lib/ui";
import { navigate } from "../router";
import { cn } from "@/lib/utils";
import { ProjectTile } from "./ProjectTile";

export function Sidebar({ currentProjectId }: { currentProjectId: string | undefined }) {
  const { projects, doors } = useDoorsState();
  return (
    <nav aria-label="Projects" className="flex w-[248px] shrink-0 flex-col gap-1 border-r border-line-soft bg-bg-sunk px-3 py-5">
      <div className="flex items-center justify-between px-2 pb-3">
        <span className="eyebrow">Projects</span>
        <button className="icon-btn size-7" onClick={() => openProjectDialog({})} aria-label="Add project">
          <Plus size={14} />
        </button>
      </div>

      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
        {projects.map((p) => {
          const active = p.id === currentProjectId;
          const count = doors.filter((d) => d.projectId === p.id).length;
          return (
            <button
              key={p.id}
              onClick={() => navigate({ name: "project", projectId: p.id })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 shrink-0 items-center gap-3 rounded-sm px-2.5 text-left transition-colors",
                active ? "bg-bg-raise text-ink" : "text-ink-dim hover:bg-bg-soft hover:text-ink",
              )}
            >
              <ProjectTile project={p} active={active} />
              <span className="flex-1 truncate text-[14px] font-medium">{p.title}</span>
              <span className="font-mono text-[11px] text-ink-dim">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-1.5 border-t border-line-soft px-2 pt-4">
        <span className="eyebrow">Workflows</span>
        <button
          onClick={() => navigate({ name: "flow" })}
          className="flex h-8 items-center gap-2 text-left text-[13px] text-ink transition-colors hover:text-brand-hover"
        >
          <Workflow size={14} className="text-brand" aria-hidden="true" />
          Open KOMA/flow builder
        </button>
      </div>
    </nav>
  );
}
