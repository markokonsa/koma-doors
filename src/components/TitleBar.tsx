import { Search, Settings } from "lucide-react";
import { inApp } from "../lib/native";
import { openLauncher } from "../lib/ui";
import { navigate } from "../router";
import { KomaMark } from "./KomaMark";

/** Custom title bar (the window uses an overlay title bar on macOS). Empty areas drag the window. */
export function TitleBar() {
  return (
    <header
      data-tauri-drag-region
      className="relative flex h-11 shrink-0 items-center gap-4 border-b border-line-soft bg-bg-sunk pr-3"
      style={{ paddingLeft: inApp ? 84 : 16 }}
    >
      <span data-tauri-drag-region className="text-[18px]">
        <KomaMark suffix="/home" />
      </span>
      <button
        onClick={() => openLauncher()}
        className="absolute left-1/2 flex h-[30px] w-[min(420px,40vw)] -translate-x-1/2 items-center gap-2.5 rounded-sm border border-line bg-bg-soft px-3 text-[13px] text-ink-dim transition-colors hover:border-line-strong"
      >
        <Search size={14} aria-hidden="true" />
        <span className="flex-1 truncate text-left">Open a door in any project…</span>
        <kbd className="font-mono text-[11px]">⌘K</kbd>
      </button>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      <button className="icon-btn border-0" onClick={() => navigate({ name: "settings" })} aria-label="Settings">
        <Settings size={16} />
      </button>
    </header>
  );
}
