import { X } from "lucide-react";
import { dismissToast, useToasts } from "../lib/toast";

export function Toasts() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : undefined}
          className="flex max-w-[560px] items-center gap-3 rounded-sm border border-line-strong bg-bg-raise py-2.5 pl-4 pr-2 text-[14px] shadow-[0_12px_40px_rgb(0_0_0/0.5)] animate-in slide-in-from-bottom-2 fade-in"
        >
          <span className={t.kind === "error" ? "size-1.5 shrink-0 rounded-full bg-danger" : "size-1.5 shrink-0 rounded-full bg-brand"} />
          <span className="flex-1">{t.text}</span>
          <button className="icon-btn size-7 border-0" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
