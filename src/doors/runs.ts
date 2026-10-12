// Runs doors and keeps their live state (steps + log) for the run rail and the script console.
import { useSyncExternalStore } from "react";
import { APPS } from "../apps";
import { navigate } from "../router";
import {
  appDataDir,
  expandHome,
  inApp,
  killProcess,
  onProcessExit,
  onProcessLog,
  openTarget,
  requireApp,
  runProcess,
  waitForPort,
} from "../lib/native";
import { basename, duration, parseDuration } from "../lib/time";
import { postJson } from "../lib/webhooks";
import { getProjectEnv } from "./env";
import { FLOW_RUNNER } from "./flows";
import { doorsStore, newId } from "./store";
import type { Door, FlowDoor, LaunchDoor, LaunchStep, Project, ScriptDoor } from "./types";

export type StepStatus = "wait" | "run" | "bg" | "done" | "fail" | "skip";
export interface RunStep {
  label: string;
  status: StepStatus;
  startedAt?: number;
  ms?: number;
}
export type LogKind = "cmd" | "out" | "err" | "ok" | "info";
export interface LogLine {
  id: number;
  text: string;
  kind: LogKind;
}
export type RunStatus = "running" | "done" | "failed" | "stopped";
export interface Run {
  id: string;
  doorId: string;
  title: string;
  subtitle: string;
  status: RunStatus;
  steps: RunStep[];
  log: LogLine[];
  startedAt: number;
  endedAt?: number;
  /** 1-based; above 1 after a retry. */
  attempt: number;
  attempts: number;
}

const MAX_RUNS = 20;
const MAX_LOG = 800;
/** How long a background step may take to open its port. */
const PORT_TIMEOUT_MS = 180_000;

interface Snapshot {
  runs: Run[];
  selectedId: string | null;
}
let snap: Snapshot = { runs: [], selectedId: null };
const listeners = new Set<() => void>();
let logSeq = 0;

function set(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
}

export function useRuns(): Snapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snap,
  );
}

const getRun = (id: string) => snap.runs.find((r) => r.id === id);

function patch(runId: string, fn: (r: Run) => Run) {
  set({ runs: snap.runs.map((r) => (r.id === runId ? fn(r) : r)) });
}

function log(runId: string, text: string, kind: LogKind) {
  patch(runId, (r) => {
    const log = [...r.log, { id: logSeq++, text, kind }];
    return { ...r, log: log.length > MAX_LOG ? log.slice(-MAX_LOG) : log };
  });
}

function setStep(runId: string, index: number, update: Partial<RunStep>) {
  patch(runId, (r) => ({
    ...r,
    steps: r.steps.map((s, i) => {
      if (i !== index) return s;
      const next = { ...s, ...update };
      if ((update.status === "done" || update.status === "fail") && s.startedAt) next.ms = Date.now() - s.startedAt;
      return next;
    }),
  }));
}

function finish(runId: string, status: RunStatus) {
  const run = getRun(runId);
  if (!run || run.status !== "running") return;
  patch(runId, (r) => ({ ...r, status, endedAt: Date.now() }));
}

export function selectRun(id: string) {
  set({ selectedId: id });
}

/** Drop finished runs from the rail. */
export function clearFinishedRuns() {
  const runs = snap.runs.filter((r) => r.status === "running");
  set({ runs, selectedId: runs[0]?.id ?? null });
}

/** The newest run of a door, running or not. */
export function latestRun(runs: Run[], doorId: string) {
  return runs.find((r) => r.doorId === doorId);
}

// ---- process plumbing ---------------------------------------------------------------------------

const procRun = new Map<string, string>(); // proc id → run id
const procExit = new Map<string, (code: number | null) => void>();
const runProcs = new Map<string, Set<string>>(); // run id → live proc ids
const loopDone = new Set<string>(); // runs whose steps have all been started

let ready: Promise<unknown> | null = null;
function wire() {
  ready ??= Promise.all([
    onProcessLog((e) => {
      const runId = procRun.get(e.procId);
      // stderr is red, except flow progress ("✓ node …") and our own notes ("… installing").
      if (runId) log(runId, e.line, e.stream === "stdout" ? "out" : e.line.startsWith("✓") ? "ok" : e.line.startsWith("…") ? "info" : "err");
    }),
    onProcessExit((e) => {
      const runId = procRun.get(e.procId);
      procRun.delete(e.procId);
      const resolve = procExit.get(e.procId);
      procExit.delete(e.procId);
      if (runId) {
        runProcs.get(runId)?.delete(e.procId);
        settleIfIdle(runId);
      }
      resolve?.(e.code);
    }),
  ]);
  return ready;
}
if (inApp) void wire();

/** A run whose steps all started finishes once its last background process exits. */
function settleIfIdle(runId: string) {
  if (!loopDone.has(runId) || (runProcs.get(runId)?.size ?? 0) > 0) return;
  patch(runId, (r) => ({ ...r, steps: r.steps.map((s) => (s.status === "bg" ? { ...s, status: "done" as const } : s)) }));
  finish(runId, "done");
}

async function startProcess(runId: string, script: string, cwd?: string, env?: Record<string, string>) {
  await wire();
  const procId = newId();
  const exited = new Promise<number | null>((resolve) => procExit.set(procId, resolve));
  procRun.set(procId, runId);
  if (!runProcs.has(runId)) runProcs.set(runId, new Set());
  runProcs.get(runId)!.add(procId);
  try {
    await runProcess(procId, script, cwd, env);
  } catch (e) {
    procRun.delete(procId);
    procExit.delete(procId);
    runProcs.get(runId)?.delete(procId);
    throw e;
  }
  // Wrapped so awaiting startProcess waits for the start only, not for the exit.
  return { exited };
}

/** Stop a run and every process it started. */
export async function stopRun(runId: string) {
  const run = getRun(runId);
  if (!run || run.status !== "running") return;
  patch(runId, (r) => ({
    ...r,
    status: "stopped",
    endedAt: Date.now(),
    steps: r.steps.map((s) => (s.status === "run" || s.status === "bg" || s.status === "wait" ? { ...s, status: "skip" as const } : s)),
  }));
  log(runId, "■ stopped", "info");
  await Promise.all([...(runProcs.get(runId) ?? [])].map((id) => killProcess(id).catch(() => undefined)));
}

// ---- running doors ------------------------------------------------------------------------------

type Outcome = "ok" | "failed" | "stopped";

function createRun(door: Door, subtitle: string, steps: RunStep[]): Run {
  const attempts = 1 + Math.max(0, Math.min(10, door.retry?.count ?? 0));
  const run: Run = {
    id: newId(),
    doorId: door.id,
    title: door.title,
    subtitle,
    status: "running",
    steps,
    log: [],
    startedAt: Date.now(),
    attempt: 1,
    attempts,
  };
  const keep = snap.runs.filter((r) => r.status === "running");
  const rest = snap.runs.filter((r) => r.status !== "running");
  set({ runs: [run, ...keep, ...rest].slice(0, Math.max(MAX_RUNS, keep.length + 1)), selectedId: run.id });
  doorsStore.markRun(door.id);
  return run;
}

async function doorEnv(door: Door, project: Project | undefined): Promise<Record<string, string>> {
  // The project's own variables first (Supabase keys etc.), then the door's.
  const env: Record<string, string> = { ...getProjectEnv(project?.id), DOOR_ID: door.id, DOOR_TITLE: door.title };
  if (project) env.DOOR_PROJECT_ID = project.id;
  if (project?.path) env.DOOR_PROJECT_DIR = await expandHome(project.path);
  return env;
}

export function stepLabel(step: LaunchStep): string {
  switch (step.kind) {
    case "app":
      return `${APPS[step.app].label}${step.path ? ` · ${step.path}` : ""}`;
    case "url":
      return `open ${step.url}`;
    case "shell":
      return step.cmd;
  }
}

/** Open, run or show a door. Errors are thrown for the caller to report. */
export async function runDoor(door: Door, project: Project | undefined): Promise<void> {
  const running = snap.runs.find((r) => r.doorId === door.id && r.status === "running");
  if (running) {
    selectRun(running.id);
    return;
  }
  switch (door.kind) {
    case "note":
      return;
    case "link":
      await openTarget(door.target);
      doorsStore.markRun(door.id);
      return;
    case "flow":
      if (door.file) return runFlow({ ...door, file: door.file }, project);
      doorsStore.markRun(door.id);
      navigate({ name: "flow", doorId: door.id });
      return;
    case "script":
      return runScript(door, project);
    case "launch":
      return runLaunch(door, project);
  }
}

// ---- webhooks -----------------------------------------------------------------------------------

type HookEvent = "start" | "complete" | "error";
const HOOK_URL: Record<HookEvent, "onStart" | "onComplete" | "onError"> = { start: "onStart", complete: "onComplete", error: "onError" };

/** POST the door's webhook for this event, if it has one. Never throws; the result goes to the run log. */
function sendWebhook(event: HookEvent, door: Door, project: Project | undefined, runId: string, error?: string) {
  const url = door.webhooks?.[HOOK_URL[event]];
  const run = getRun(runId);
  if (!url || !run) return;
  const took = run.endedAt ? duration(run.endedAt - run.startedAt) : undefined;
  const where = `${project ? `${project.title} / ` : ""}${door.title}`;
  const body = {
    event,
    // Plain-text summary, so Slack/Discord-style incoming webhooks show something useful as is.
    text:
      event === "start"
        ? `▶ ${where} started`
        : event === "complete"
          ? `✓ ${where} finished${took ? ` in ${took}` : ""}`
          : `✗ ${where} failed${run.attempts > 1 ? ` after ${run.attempts} attempts` : ""}: ${error ?? "error"}`,
    door: { id: door.id, title: door.title, kind: door.kind },
    project: project ? { id: project.id, title: project.title } : null,
    run: {
      id: run.id,
      status: event === "start" ? "running" : event === "complete" ? "done" : "failed",
      attempt: run.attempt,
      attempts: run.attempts,
      startedAt: new Date(run.startedAt).toISOString(),
      endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
      durationMs: run.endedAt ? run.endedAt - run.startedAt : null,
    },
    error: error ?? null,
    /** The last lines of output. */
    log: run.log.slice(-30).map((l) => l.text),
  };
  postJson(url, body, door.webhooks?.headers)
    .then(() => log(runId, `↗ ${event} webhook sent`, "info"))
    .catch((e: unknown) => log(runId, `↗ ${event} webhook failed: ${e instanceof Error ? e.message : String(e)}`, "err"));
}

// ---- attempts -----------------------------------------------------------------------------------

const isRunning = (runId: string) => getRun(runId)?.status === "running";

/** Wait, but give up as soon as the run is stopped. */
async function waitUnlessStopped(runId: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until && isRunning(runId)) await new Promise((r) => setTimeout(r, Math.min(250, until - Date.now())));
  return isRunning(runId);
}

/**
 * Run `attempt` up to 1 + retry.count times. Webhooks: start once, complete on success, error once the
 * last attempt has failed. Processes left by a failed attempt are stopped before the next one.
 */
async function withRetries(
  door: Door,
  project: Project | undefined,
  run: Run,
  resetSteps: () => RunStep[],
  attempt: () => Promise<{ outcome: Outcome; error?: string }>,
  onSuccess: () => void,
) {
  const delayMs = parseDuration(door.retry?.delay) ?? 5_000;
  sendWebhook("start", door, project, run.id);
  let lastError = "failed";
  for (let n = 1; n <= run.attempts; n++) {
    if (n > 1) {
      log(run.id, `↻ attempt ${n}/${run.attempts} in ${duration(delayMs)}`, "info");
      await Promise.all([...(runProcs.get(run.id) ?? [])].map((id) => killProcess(id).catch(() => undefined)));
      if (!(await waitUnlessStopped(run.id, delayMs))) return;
      patch(run.id, (r) => ({ ...r, attempt: n, steps: resetSteps() }));
    }
    const { outcome, error } = await attempt();
    if (outcome === "stopped" || !isRunning(run.id)) return;
    if (outcome === "ok") {
      onSuccess();
      sendWebhook("complete", door, project, run.id);
      return;
    }
    lastError = error ?? lastError;
  }
  // Nothing can Stop a failed run, so don't leave its background processes behind.
  await Promise.all([...(runProcs.get(run.id) ?? [])].map((id) => killProcess(id).catch(() => undefined)));
  finish(run.id, "failed");
  sendWebhook("error", door, project, run.id, lastError);
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---- scripts and flows --------------------------------------------------------------------------

/** Run one file through the login shell as a single-step run. */
async function runFile(
  door: Door & { file: string },
  project: Project | undefined,
  opts: { label: string; command: string; script: string; env?: Record<string, string>; hint?: string },
) {
  const steps = () => [{ label: opts.label, status: "run" as const, startedAt: Date.now() }];
  const run = createRun(door, door.file, steps());
  const attempt = async (): Promise<{ outcome: Outcome; error?: string }> => {
    log(run.id, `$ ${opts.command} ${door.file}`, "cmd");
    if (opts.hint) log(run.id, opts.hint, "info");
    try {
      const env = { ...(await doorEnv(door, project)), ...opts.env, DOOR_FILE: await expandHome(door.file) };
      const { exited } = await startProcess(run.id, opts.script, project?.path, env);
      const code = await exited;
      if (!isRunning(run.id)) return { outcome: "stopped" };
      setStep(run.id, 0, { status: code === 0 ? "done" : "fail" });
      log(run.id, code === 0 ? "✓ exit 0" : `✗ exit ${code ?? "signal"}`, code === 0 ? "ok" : "err");
      return code === 0 ? { outcome: "ok" } : { outcome: "failed", error: `exit ${code ?? "signal"}` };
    } catch (e) {
      setStep(run.id, 0, { status: "fail" });
      log(run.id, message(e), "err");
      return { outcome: "failed", error: message(e) };
    }
  };
  await withRetries(door, project, run, steps, attempt, () => finish(run.id, "done"));
}

async function runScript(door: ScriptDoor, project: Project | undefined) {
  requireApp("Running scripts");
  await runFile(door, project, { label: `node ${basename(door.file)}`, command: "node", script: 'exec node "$DOOR_FILE"' });
}

async function runFlow(door: FlowDoor & { file: string }, project: Project | undefined) {
  requireApp("Running flows");
  const env = getProjectEnv(project?.id);
  await runFile(door, project, {
    label: `flow ${basename(door.file)}`,
    command: "bun || node",
    script: FLOW_RUNNER,
    env: { DOOR_DEPS: `${await appDataDir()}/scripts` },
    hint: env.SUPABASE_ANON_KEY ? undefined : "… no SUPABASE_ANON_KEY for this project: add it under Edit project → Environment if the flow uses Supabase.",
  });
}

// ---- project openers ----------------------------------------------------------------------------

async function runLaunch(door: LaunchDoor, project: Project | undefined) {
  requireApp("Project openers");
  const where = project?.path ?? "no project folder";
  const steps = () => door.steps.map((s): RunStep => ({ label: stepLabel(s), status: "wait" }));
  const run = createRun(door, `${door.steps.length} step${door.steps.length === 1 ? "" : "s"} · ${where}`, steps());
  const env = await doorEnv(door, project);

  const attempt = async (): Promise<{ outcome: Outcome; error?: string }> => {
    for (const [i, step] of door.steps.entries()) {
      if (!isRunning(run.id)) return { outcome: "stopped" };
      setStep(run.id, i, { status: "run", startedAt: Date.now() });
      try {
        if (step.kind === "url") {
          log(run.id, `$ open ${step.url}`, "cmd");
          await openTarget(step.url);
          setStep(run.id, i, { status: "done" });
        } else if (step.kind === "app") {
          const app = APPS[step.app];
          const path = step.path || project?.path;
          if (!path) throw new Error(`Set the project folder first, or give this step a path`);
          log(run.id, `$ open -a "${app.appName}" ${path}`, "cmd");
          const { exited } = await startProcess(run.id, 'open -a "$DOOR_APP" "$DOOR_PATH"', undefined, {
            ...env,
            DOOR_APP: app.appName,
            DOOR_PATH: await expandHome(path),
          });
          const code = await exited;
          if (code !== 0) throw new Error(`Could not open ${app.label} (exit ${code})`);
          setStep(run.id, i, { status: "done" });
        } else {
          log(run.id, `$ ${step.cmd}`, "cmd");
          const { exited } = await startProcess(run.id, step.cmd, project?.path, env);
          if (!step.background) {
            const code = await exited;
            if (!isRunning(run.id)) return { outcome: "stopped" };
            if (code !== 0) throw new Error(`exit ${code ?? "signal"}`);
            setStep(run.id, i, { status: "done" });
          } else if (step.waitPort) {
            log(run.id, `… waiting for localhost:${step.waitPort}`, "info");
            const result = await Promise.race([
              waitForPort(step.waitPort, PORT_TIMEOUT_MS).then((up) => (up ? "up" : "timeout")),
              exited.then(() => "exited" as const),
            ]);
            if (!isRunning(run.id)) return { outcome: "stopped" };
            if (result === "exited") throw new Error(`stopped before localhost:${step.waitPort} opened`);
            if (result === "timeout") throw new Error(`localhost:${step.waitPort} did not open in time`);
            log(run.id, `✓ localhost:${step.waitPort} is up`, "ok");
            setStep(run.id, i, { status: "bg" });
          } else {
            setStep(run.id, i, { status: "bg" });
          }
        }
      } catch (e) {
        if (!isRunning(run.id)) return { outcome: "stopped" };
        setStep(run.id, i, { status: "fail" });
        log(run.id, `✗ ${message(e)}`, "err");
        patch(run.id, (r) => ({ ...r, steps: r.steps.map((s) => (s.status === "wait" ? { ...s, status: "skip" as const } : s)) }));
        return { outcome: "failed", error: `${stepLabel(step)}: ${message(e)}` };
      }
    }
    return { outcome: "ok" };
  };

  // Success = every step started; the run stays "live" while background steps (dev servers) keep running.
  await withRetries(door, project, run, steps, attempt, () => {
    loopDone.add(run.id);
    settleIfIdle(run.id);
  });
}
