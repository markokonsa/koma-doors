# KOMA Home

A small Tauri 2 desktop app: a home dashboard of clickable cards.

## Run

Needs Node, pnpm and Rust (`curl https://sh.rustup.rs -sSf | sh`).

```sh
pnpm install
pnpm app          # tauri dev: opens the desktop window with hot reload
pnpm app:build    # release build: .app / .dmg in src-tauri/target/release/bundle
pnpm dev          # just the UI in a browser at http://localhost:1420 (links and pages work, local paths don't)
```

## Customise

- **Cards:** `src/cards.ts`. Each card has a title, description, Lucide icon, accent colour and an action:
  - `{ type: "link", url }` opens the default browser
  - `{ type: "path", path }` opens a file, folder or app; `~/` is your home folder
  - `{ type: "page", page }` shows an in-app page
- **In-app pages:** add a component in `src/pages/` and register it in `src/pages/index.ts`.
- **Which local paths may be opened:** `src-tauri/capabilities/default.json` (currently `$HOME/**` and `/Applications/**`).
- **App icon:** replace `app-icon.png` (1024×1024) and run `pnpm tauri icon app-icon.png`.

Keyboard: 1–9 open the matching card on the home screen, Escape goes back home.
