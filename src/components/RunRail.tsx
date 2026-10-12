import { useEffect, useRef } from "react";
import { Square, Trash2 } from "lucide-react";
import { clearFinishedRuns, selectRun, stopRun, useRuns, type LogLine, type Run, type RunStep } from "../doors/runs";
import { ago, duration } from "../lib/time";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<Run["status"], string> = { running: "live", done: "done", failed: "failed", stopped: "stopped" };

export function RunStatus({ status }: { status: Run["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px]",
        status === "running" ? "text-brand-hover" : status === "failed" ? "text-danger" : "text-ink-dim",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "running" ? "bg-brand animate-pulse" : status === "failed" ? "bg-danger" : "bg-ink-faint",
        )}
      />
      {STATUS_TEXT[status]}
    </span>
  );
}

function StepRow({ step }: { step: RunStep }) {
  const done = step.status === "done";
  const live = step.status === "run" || step.status === "bg";
  const fail = step.status === "fail";
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-sm border text-[10px] font-semibold",
          done && "border-brand bg-brand text-on-brand",
          live && "border-brand",
          fail && "border-danger bg-danger text-on-brand",
          !done && !live && !fail && "border-line-strong",
        )}
      >
        {done ? "✓" : fail ? "!" : live ? <span className="size-1.5 animate-pulse rounded-full bg-brand" /> : ""}
      </span>
      <span className={cn("flex-1 truncate", step.status === "wait" || step.status === "skip" ? "text-ink-dim" : "text-ink")}>{step.label}</span>
      <span className="font-mono text-[11px] text-ink-dim">
        {step.ms != null ? duration(step.ms) : step.status === "bg" ? "running" : live ? "…" : step.status === "skip" ? "skipped" : ""}
      </span>
    </div>
  );
}

const LOG_COLOR: Record<LogLine["kind"], string> = {
  cmd: "text-ink",
  out: "text-ink-dim",
  err: "text-danger",
  ok: "text-brand-hover",
  info: "text-ink-faint",
};

/** Monospace log that follows new output unless you've scrolled up. */
export function RunLog({ lines, empty, className }: { lines: LogLine[]; empty?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={cn("overflow-auto bg-bg-deep px-4 py-3 font-mono text-[11.5px] leading-[1.7] select-text", className)}
    >
      {lines.length === 0 && <span className="text-ink-faint">{empty ?? "No output yet."}</span>}
      {lines.map((l) => (
        <div key={l.id} className={cn("whitespace-pre-wrap break-words", LOG_COLOR[l.kind])}>
          {l.text || " "}
        </div>
      ))}
    </div>
  );
}

/** Right-hand panel: the selected run's steps and live output, plus recent runs. */
export function RunRail() {
  const { runs, selectedId } = useRuns();
  const run = runs.find((r) => r.id === selectedId) ?? runs[0];
  const others = runs.filter((r) => r !== run).slice(0, 5);

  return (
    <aside aria-label="Run output" className="hidden w-[300px] shrink-0 flex-col border-l border-line-soft bg-bg-sunk lg:flex xl:w-[340px]">
      {!run ? (
        <div className="flex flex-1 flex-col gap-3 p-5">
          <span className="eyebrow">Runs</span>
          <p className="text-[14px] leading-relaxed text-ink-dim">
            Click a project opener or a script and its steps and output show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 border-b border-line-soft px-5 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">
                {run.status === "running" ? "Now running" : "Last run"}
                {run.attempts > 1 ? ` · attempt ${run.attempt}/${run.attempts}` : ""}
              </span>
              <RunStatus status={run.status} />
            </div>
            <span className="display text-[22px]">{run.title}</span>
            <span className="truncate font-mono text-[11px] text-ink-dim" title={run.subtitle}>
              {run.subtitle}
            </span>
          </div>
          {run.steps.length > 0 && (
            <div className="flex flex-col gap-2.5 border-b border-line-soft px-5 py-4">
              {run.steps.map((s, i) => (
                <StepRow key={i} step={s} />
              ))}
            </div>
          )}
          <RunLog lines={run.log} className="min-h-0 flex-1" />
          {others.length > 0 && (
            <div className="flex flex-col border-t border-line-soft px-3 py-2">
              {others.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRun(r.id)}
                  className="flex h-8 items-center gap-2 rounded-sm px-2 text-left text-[13px] text-ink-dim hover:bg-bg-soft hover:text-ink"
                >
                  <span className="flex-1 truncate">{r.title}</span>
                  <RunStatus status={r.status} />
                  <span className="w-16 text-right font-mono text-[10.5px]">{ago(r.startedAt)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 border-t border-line-soft px-5 py-3.5">
            <button className="btn btn-ghost btn-sm flex-1" disabled={run.status !== "running"} onClick={() => void stopRun(run.id)}>
              <Square /> Stop
            </button>
            <button className="btn btn-ghost btn-sm flex-1" disabled={runs.every((r) => r.status === "running")} onClick={clearFinishedRuns}>
              <Trash2 /> Clear
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
