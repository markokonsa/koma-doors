/** Starting points for new script doors. Scripts are ES modules run with `node`, so top-level await works. */
export const SCRIPT_TEMPLATES = {
  blank: {
    label: "Blank",
    hint: "console.log + env",
    body: (title: string) => `// ${title}
// Runs with node in the project folder when you click the door.
// Env: DOOR_PROJECT_DIR, DOOR_PROJECT_ID, DOOR_TITLE, DOOR_FILE

console.log(\`Hello from \${process.env.DOOR_TITLE}\`);
console.log(\`cwd: \${process.cwd()}\`);
`,
  },
  shell: {
    label: "Shell chain",
    hint: "execSync, one by one",
    body: (title: string) => `// ${title}
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(\`$ \${cmd}\`);
  execSync(cmd, { stdio: "inherit" });
};

run("git status --short");
run("git log --oneline -5");
`,
  },
  http: {
    label: "HTTP call",
    hint: "fetch + JSON",
    body: (title: string) => `// ${title}
const res = await fetch("https://api.github.com/repos/tauri-apps/tauri");
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);

const repo = await res.json();
console.log(\`\${repo.full_name}: \${repo.stargazers_count} stars\`);
`,
  },
} as const;

export type ScriptTemplateId = keyof typeof SCRIPT_TEMPLATES;
export const SCRIPT_TEMPLATE_IDS = Object.keys(SCRIPT_TEMPLATES) as ScriptTemplateId[];

export function scriptFileName(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "script"}.mjs`;
}
