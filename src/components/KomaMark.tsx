import { cn } from "@/lib/utils";

/** The KOMA wordmark with the skewed comma: KO,MA */
export function KomaMark({ suffix, className }: { suffix?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", className)}>
      <span className="font-display font-semibold tracking-[0.03em] leading-none" aria-label="KOMA">
        <span aria-hidden="true">
          KO
          <i className="koma-comma" />
          MA
        </span>
      </span>
      {suffix && <span className="font-mono text-[12px] tracking-[0.04em] text-ink-dim">{suffix}</span>}
    </span>
  );
}
