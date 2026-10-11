import { PROJECT_LOGOS } from "../icons";
import type { Project } from "../doors/types";
import { cn } from "@/lib/utils";

function monogram(title: string) {
  const words = title.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Square project marker: the project's logo if it has one, else a monogram. */
export function ProjectTile({ project, active, size = 26 }: { project: Project; active?: boolean; size?: number }) {
  const logo = PROJECT_LOGOS[project.id];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-sm border font-display font-semibold tracking-[0.03em]",
        active ? "border-brand text-ink" : "border-line-strong text-ink-dim",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), background: logo?.background }}
    >
      {logo ? <img src={logo.src} alt="" draggable={false} className="size-full object-contain" /> : monogram(project.title)}
    </span>
  );
}
