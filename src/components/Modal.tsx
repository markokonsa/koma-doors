import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Centered dialog over a dimmed backdrop. Escape and a backdrop click close it. */
export function Modal({
  label,
  onClose,
  className,
  top = "12vh",
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  top?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Keep autoFocus if a field took it; otherwise focus the first field, or the dialog itself.
    if (!ref.current?.contains(document.activeElement)) {
      const first = ref.current?.querySelector<HTMLElement>("input, textarea, select");
      (first ?? ref.current)?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in duration-150">
      <div className="absolute inset-0 bg-bg-deep/70" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 max-w-[calc(100vw-48px)] flex flex-col overflow-hidden rounded-lg border border-line-strong bg-bg-soft shadow-[0_30px_80px_rgb(0_0_0/0.55)] outline-none",
          className,
        )}
        style={{ top }}
      >
        {children}
      </div>
    </div>
  );
}
