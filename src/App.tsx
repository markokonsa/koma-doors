import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ExternalLink, FolderOpen, ChevronRight } from "lucide-react";
import { GROUPS, type DashboardCard } from "./cards";
import { runAction } from "./actions";
import { PAGES } from "./pages";
import { navigate, useRoute } from "./router";

function greeting(h: number) {
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const ACTION_ICON = { link: ExternalLink, path: FolderOpen, app: FolderOpen, page: ChevronRight } as const;

function Card({ card, index, onError }: { card: DashboardCard; index: number; onError: (m: string) => void }) {
  const Icon = card.icon;
  const Hint = card.action.type == "action" ? 
   undefined :
    ACTION_ICON[card.action.type];
  return (
    <button
      className="card"
      style={{ "--accent": card.accent } as CSSProperties}
      onClick={() => runAction(card.action).catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)))}
      title={card.description}
    >
      <span className="card-icon">
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <span className="card-body">
        <span className="card-title">{card.title}</span>
        <span className="card-desc">{card.description}</span>
      </span>
      <span className="card-hint" aria-hidden="true">
        {index < 9 && <kbd>{index + 1}</kbd>}
        {Hint && <Hint size={16} />}
      </span>
    </button>
  );
}

export function App() {
  const route = useRoute();
  const [error, setError] = useState<string | null>(null);
  const allCards = useMemo(() => GROUPS.flatMap((g) => g.cards), []);

  // 1–9 open cards on the home screen; Escape returns home from a page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (e.key === "Escape") navigate(null);
        return;
      }
      if (e.key === "Escape") return navigate(null);
      if (route || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      const card = n >= 1 && n <= 9 ? allCards[n - 1] : undefined;
      if (card) runAction(card.action).catch((err: unknown) => setError(String(err)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route, allCards]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  if (route) {
    const page = PAGES[route.page];
    const Page = page.component;
    return (
      <main className="shell">
        <header className="page-head">
          <button className="back" onClick={() => navigate(null)}>
            <ArrowLeft size={16} /> Home
          </button>
          <h1>{page.title}</h1>
        </header>
        <section className="page-body">
          <Page param={route.param} />
        </section>
      </main>
    );
  }

  let index = 0;
  return (
    <main className="shell">
   
      <header className="sticky top-0 left-0 w-full flex flex-row items-center justify-center">
      <div className="brand mx-auto flex flex-row justify-center items-center">
          <img src="/koma.png" alt="KOMA" width={80} height={80} />
      </div>
      </header>

    


      {GROUPS.map((group) => (
        <section key={group.title} className="group w-full">
          <div className="flex flex-row items-center justify-between">
          <h2>{group.title}</h2>
          </div>
          <div className="grid">
            {group.cards.map((card) => (
              <Card key={card.id} card={card} index={index++} onError={setError} />
            ))}
          </div>
        </section>
      ))}


      {error && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
    </main>

  );
}
