export function SettingsPage() {
  return (
    <div className="prose">
      <p>
        Cards live in <code>src/cards.ts</code>. Each card has an <code>action</code>:
      </p>
      <ul>
        <li>
          <code>{`{ type: "link", url }`}</code> opens the default browser.
        </li>
        <li>
          <code>{`{ type: "path", path }`}</code> opens a file, folder or app (<code>~/</code> is your home
          folder). Allowed locations are set in <code>src-tauri/capabilities/default.json</code>.
        </li>
        <li>
          <code>{`{ type: "page", page }`}</code> shows an in-app page registered in{" "}
          <code>src/pages/index.ts</code>.
        </li>
      </ul>
      <p>Keyboard: number keys 1–9 open the matching card, Escape goes back home.</p>
    </div>
  );
}
