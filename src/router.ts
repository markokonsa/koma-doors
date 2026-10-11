import { useSyncExternalStore } from "react";

/**
 * Hash routes:
 *   #/p/<projectId>   a project's doors (#/ = the last or first project)
 *   #/script/<doorId> script editor
 *   #/flow/<doorId>   a flow door, embedded
 *   #/flow            the KOMA/flow builder, to make a new flow door
 *   #/settings
 */
export type Route =
  | { name: "project"; projectId?: string }
  | { name: "script"; doorId: string }
  | { name: "flow"; doorId?: string }
  | { name: "settings" };

function parse(hash: string): Route {
  const [name = "", id] = hash.replace(/^#\/?/, "").split("/").map((s) => decodeURIComponent(s));
  if (name === "p") return { name: "project", projectId: id || undefined };
  if (name === "script" && id) return { name: "script", doorId: id };
  if (name === "flow") return { name: "flow", doorId: id || undefined };
  if (name === "settings") return { name: "settings" };
  return { name: "project" };
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): Route {
  // The hash string is the stable snapshot; parse outside the store.
  return parse(useSyncExternalStore(subscribe, () => window.location.hash));
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case "project":
      return route.projectId ? `#/p/${encodeURIComponent(route.projectId)}` : "#/";
    case "script":
      return `#/script/${encodeURIComponent(route.doorId)}`;
    case "flow":
      return route.doorId ? `#/flow/${encodeURIComponent(route.doorId)}` : "#/flow";
    case "settings":
      return "#/settings";
  }
}

export function navigate(route: Route) {
  window.location.hash = routeHash(route);
}
