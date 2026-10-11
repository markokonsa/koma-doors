import { useSyncExternalStore } from "react";
import { isPageId, type PageId } from "./pages";

export interface Route {
  page: PageId;
  /** Optional second path segment, e.g. the project id in "#/projects/tc". */
  param?: string;
}

// Tiny hash router: "#/" is home, "#/notes" is a page, "#/projects/tc" is a page with a param.
// useSyncExternalStore needs a stable snapshot, so the hash is the snapshot and parsing happens outside.
function readHash() {
  return window.location.hash;
}

function parse(hash: string): Route | null {
  const [id = "", param] = hash.replace(/^#\/?/, "").split("/");
  return isPageId(id) ? { page: id, param: param ? decodeURIComponent(param) : undefined } : null;
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): Route | null {
  const hash = useSyncExternalStore(subscribe, readHash);
  return parse(hash);
}

export function navigate(page: PageId | null, param?: string) {
  window.location.hash = page ? `/${page}${param ? `/${encodeURIComponent(param)}` : ""}` : "/";
}
