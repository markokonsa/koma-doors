import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { hydrateProjectEnv } from "./doors/env";
import { hydrateDoors } from "./doors/store";

import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./input.css";

// Load projects and doors from the data file before the first render, so the app never flashes stale data.
void Promise.all([hydrateDoors(), hydrateProjectEnv()]).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
