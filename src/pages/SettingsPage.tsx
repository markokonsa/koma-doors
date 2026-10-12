import { useState, type ReactNode } from "react";
import { FolderOpen, FolderSearch, RotateCcw } from "lucide-react";
import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { getBuilderUrl, setBuilderUrl } from "../doors/flows";
import { getDataFilePath, moveDataFile } from "../doors/store";
import { FLOW_BUILDER_URL } from "../doors/types";
import { inApp, openTarget } from "../lib/native";
import { toast, toastError } from "../lib/toast";

function Block({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <span className="eyebrow">
        {num} · {title}
      </span>
      <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink-dim [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink">
        {children}
      </div>
    </section>
  );
}

function DataLocation() {
  const [path, setPath] = useState(getDataFilePath());
  const folder = path ? path.replace(/\/[^/]*$/, "") : null;

  if (!inApp) return <p>In the browser preview, data is kept in this browser's localStorage.</p>;

  const move = async (dir: string | null) => {
    try {
      const next = await moveDataFile(dir);
      setPath(next);
      toast(`Now using ${next}`, "info");
    } catch (e) {
      toastError(e);
    }
  };

  const choose = async () => {
    const picked = await pickFolder({ directory: true, multiple: false, title: "Keep doors.json in…" }).catch(toastError);
    if (typeof picked === "string") await move(picked);
  };

  return (
    <>
      <p>
        Projects and doors are saved in one JSON file on this computer. Dev and release builds share it. Edits made to the file outside the
        app are picked up when the window regains focus.
      </p>
      <div className="break-all rounded-sm border border-line-soft bg-bg-deep p-3 font-mono text-[12px] text-ink select-text">{path ?? "…"}</div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost btn-sm" disabled={!folder} onClick={() => folder && openTarget(folder).catch(toastError)}>
          <FolderOpen /> Show in Finder
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => void choose()}>
          <FolderSearch /> Use another folder…
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => void move(null)}>
          <RotateCcw /> Back to default
        </button>
      </div>
      <p className="text-[13px]">
        Pick an iCloud Drive or Dropbox folder (or a git repo) to back up and sync doors between Macs. If that folder already has a{" "}
        <code>doors.json</code>, the app switches to it; otherwise your current doors are copied there.
      </p>
    </>
  );
}

function BuilderAddress() {
  const [value, setValue] = useState(getBuilderUrl());
  const save = () => {
    try {
      const url = new URL(value.trim()).toString();
      setBuilderUrl(url);
      setValue(getBuilderUrl());
      toast(`Flow builder: ${url}`, "info");
    } catch {
      toast("That isn't a URL.");
    }
  };
  return (
    <>
      <p>
        Flow doors keep the <code>.mjs</code> KOMA/flow exports. Clicking the card runs it (with <code>bun</code> if installed, else{" "}
        <code>node</code>; <code>@supabase/supabase-js</code> is installed once on first run); the pencil reopens it in the builder and
        Save flow writes it back. Supabase keys come from each project's environment (Edit project).
      </p>
      <div className="flex gap-2">
        <input aria-label="Flow builder address" value={value} onChange={(e) => setValue(e.target.value)} className="field field-mono" />
        <button className="btn btn-ghost" onClick={save}>
          Save
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setBuilderUrl(null);
            setValue(FLOW_BUILDER_URL);
          }}
        >
          Default
        </button>
      </div>
      <p className="text-[13px]">Use your local dev server (e.g. http://localhost:3000) to try builder changes before deploying them.</p>
    </>
  );
}

export function SettingsPage() {
  return (
    <div className="flex max-w-[760px] flex-col gap-7 px-9 py-7">
      <header className="flex flex-col gap-2">
        <span className="eyebrow">KOMA Home</span>
        <h1 className="display text-[44px]">How doors work</h1>
      </header>
      <Block num="01" title="Doors">
        <p>
          Every project has doors: <b className="text-ink">project openers</b> (open Cursor, run <code>supabase start</code>, start the dev
          server, open the app), <b className="text-ink">JS scripts</b>, <b className="text-ink">flows</b> from KOMA/flow,{" "}
          <b className="text-ink">links</b> and <b className="text-ink">notes</b>.
        </p>
      </Block>
      <Block num="02" title="Where your data lives">
        <DataLocation />
      </Block>
      <Block num="03" title="Scripts & shell steps">
        <p>
          They run through your login shell (<code>$SHELL -lc</code>) in the project folder, so PATH matches your terminal. Scripts run as{" "}
          <code>node &lt;file&gt;</code>; new ones are saved in the app's data folder under <code>scripts/&lt;project&gt;/</code>.
        </p>
        <p>
          Environment: <code>DOOR_PROJECT_DIR</code>, <code>DOOR_PROJECT_ID</code>, <code>DOOR_TITLE</code>, <code>DOOR_FILE</code>.
          Steps marked “keeps running” stay up until you press Stop or quit the app.
        </p>
      </Block>
      <Block num="04" title="Flows">
        <BuilderAddress />
      </Block>
      <Block num="05" title="Keyboard">
        <p>
          <code>⌘K</code> open any door · <code>⌘N</code> new door · <code>⌘1–9</code> run the project's automations ·{" "}
          <code>Esc</code> close or go back.
        </p>
      </Block>
      <Block num="06" title="In code">
        <p>
          Colors and type are Tailwind tokens in <code>src/input.css</code>. First-run projects are in <code>src/doors/seeds.ts</code>, apps
          for “open in app” in <code>src/apps.ts</code>, script templates in <code>src/doors/templates.ts</code>.
        </p>
      </Block>
    </div>
  );
}
