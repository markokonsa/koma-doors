import type { AppId } from "../apps";

/** What a door does when its card is clicked. */
export type DoorKind = "launch" | "script" | "flow" | "link" | "note" | "task" | "list";

/** One step of a project opener (launch door). Steps run in order and stop at the first failure. */
export type LaunchStep =
  /** Open a folder in a desktop app; `path` defaults to the project folder. */
  | { id: string; kind: "app"; app: AppId; path?: string }
  /** A shell command run in the project folder. `background` keeps it running (dev servers);
   *  `waitPort` makes the next step wait until something listens on that localhost port. */
  | { id: string; kind: "shell"; cmd: string; background?: boolean; waitPort?: number }
  /** Open a URL in the default browser. */
  | { id: string; kind: "url"; url: string };

/** Outgoing webhooks of a runnable door: each URL gets a JSON POST when that happens. */
export interface DoorWebhooks {
  onStart?: string;
  onComplete?: string;
  /** Sent once all retries have failed. */
  onError?: string;
  /** Extra request headers, e.g. Authorization. */
  headers?: Record<string, string>;
}

/** Re-run a failed opener/script/flow `count` more times, waiting `delay` ("5s", "1m") in between. */
export interface DoorRetry {
  count: number;
  delay: string;
}

interface DoorBase {
  id: string;
  projectId: string;
  title: string;
  /** Epoch ms of the last time the door was opened or run. */
  lastRunAt?: number;
  /** Openers, scripts and flows with a file only. */
  webhooks?: DoorWebhooks;
  retry?: DoorRetry;
}

/** Door kinds that run (and so can have webhooks and retries). */
export const RUNNABLE_KINDS = ["launch", "script", "flow"] as const;

export interface LaunchDoor extends DoorBase {
  kind: "launch";
  steps: LaunchStep[];
}
/** A JavaScript file run with `node`, in the project folder. */
export interface ScriptDoor extends DoorBase {
  kind: "script";
  /** Absolute path (or ~/…) of the .mjs/.js file. */
  file: string;
}
/**
 * A workflow built in KOMA/flow. `file` is its exported .mjs: clicking the card runs it (bun, or node),
 * Edit reopens it in the builder. A flow door without a file just opens the builder at `url`.
 */
export interface FlowDoor extends DoorBase {
  kind: "flow";
  file?: string;
  url?: string;
}
/** A URL (opens in the browser) or a local path (opens with the OS handler). */
export interface LinkDoor extends DoorBase {
  kind: "link";
  target: string;
}
export interface NoteDoor extends DoorBase {
  kind: "note";
  text: string;
}

export interface TaskDoor extends DoorBase {
  kind: "task";
  text: string;
}

export type Door = LaunchDoor | ScriptDoor | FlowDoor | LinkDoor | NoteDoor;

/** `Omit` that keeps the union: a draft of any door kind, without its id. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type DoorDraft = DistributiveOmit<Door, "id">;

export interface Project {
  id: string;
  title: string;
  description?: string;
  /** Local folder: working directory for scripts and shell steps, default for "open in app". */
  path?: string;
}

export const FLOW_BUILDER_URL = "https://workflows.konsa.ee/";

export const KIND_META: Record<DoorKind, { num: string; label: string; tag: string; desc: string }> = {
  launch: { num: "01",   label: "Project opener", tag: "LAUNCH", desc: "Open an editor, start local services, open the app." },
  script: { num: "02", label: "JS script", tag: "JS", desc: "A .js file run with node. Edit it here, run it from the card." },
  flow: { num: "03", label: "Flow", tag: "FLOW", desc: "A workflow built in KOMA/flow, saved as a one-click door." },
  link: { num: "04", label: "Link", tag: "LINK", desc: "Bitbucket, Jira, dashboards, a local folder: any URL or path." },
  note: { num: "05", label: "Note", tag: "NOTE", desc: "Plain text you keep next to the project." },
  task: { num: "06", label: "Task", tag: "TASK", desc: "A task you need to complete." },
  list: { num: "07", label: "List", tag: "LIST", desc: "A list of items you need to complete." },
};

export const DOOR_KINDS = Object.keys(KIND_META) as DoorKind[];
