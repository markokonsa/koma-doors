import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  text: string;
  kind: "error" | "info";
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, kind: Toast["kind"] = "error") {
  const id = nextId++;
  toasts = [...toasts, { id, text, kind }];
  emit();
  setTimeout(() => dismissToast(id), 4500);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Show any thrown value as an error toast. */
export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : String(e));

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}
