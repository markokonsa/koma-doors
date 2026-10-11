import type { ReactNode } from "react";

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
          <b className="text-ink">links</b> and <b className="text-ink">notes</b>. Projects and doors are saved on this computer.
        </p>
      </Block>
      <Block num="02" title="Scripts & shell steps">
        <p>
          They run through your login shell (<code>$SHELL -lc</code>) in the project folder, so PATH matches your terminal. Scripts run as{" "}
          <code>node &lt;file&gt;</code>; new ones are saved in the app's data folder under <code>scripts/&lt;project&gt;/</code>.
        </p>
        <p>
          Environment: <code>DOOR_PROJECT_DIR</code>, <code>DOOR_PROJECT_ID</code>, <code>DOOR_TITLE</code>, <code>DOOR_FILE</code>.
          Steps marked “keeps running” stay up until you press Stop or quit the app.
        </p>
      </Block>
      <Block num="03" title="Flows">
        <p>
          KOMA/flow (<code>workflows.konsa.ee</code>) opens inside the app. Build a flow, then Save as door to pin it to a project.
        </p>
      </Block>
      <Block num="04" title="Keyboard">
        <p>
          <code>⌘K</code> open any door · <code>⌘N</code> new door · <code>⌘1–9</code> run the project's automations ·{" "}
          <code>Esc</code> close or go back.
        </p>
      </Block>
      <Block num="05" title="In code">
        <p>
          Colors and type are Tailwind tokens in <code>src/input.css</code>. First-run projects are in <code>src/doors/seeds.ts</code>, apps
          for “open in app” in <code>src/apps.ts</code>, script templates in <code>src/doors/templates.ts</code>.
        </p>
      </Block>
    </div>
  );
}
