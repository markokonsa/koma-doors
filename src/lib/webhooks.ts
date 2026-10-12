// Outgoing webhooks. Inside the app requests go through the Tauri HTTP plugin (no CORS; allowed URLs are
// in src-tauri/capabilities/default.json); in the browser preview through window.fetch.
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { inApp } from "./native";

export async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const send = inApp ? tauriFetch : window.fetch.bind(window);
  const res = await send(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
