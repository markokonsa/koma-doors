import { useState, type CSSProperties, type FormEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open as pickPath } from "@tauri-apps/plugin-dialog";
import { FolderSearch, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { APPS, APP_IDS, type AppId } from "../apps";
import { runAction } from "../actions";
import { navigate } from "../router";
import {
  KIND_META,
  PROJECTS,
  cardAction,
  findProject,
  useProjectCards,
  type Project,
  type ProjectCard,
  type ProjectCardKind,
} from "../projects";
import type { PageProps } from "./index";

const KINDS = Object.keys(KIND_META) as ProjectCardKind[];

export function ProjectsPage({ param }: PageProps) {
  const project = findProject(param);
  if (!project) return <ProjectList missing={param} />;
  return <ProjectView key={project.id} project={project} />;
}

function ProjectList({ missing }: { missing?: string }) {
  return (
    <div>
      {missing && <p className="project-empty">No project “{missing}”.</p>}
      <div className="grid">
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            className="card"
            style={{ "--accent": p.accent } as CSSProperties}
            onClick={() => navigate("projects", p.id)}
          >
            <span className="card-icon">
              <p.icon size={22} strokeWidth={1.75} />
            </span>
            <span className="card-body">
              <span className="card-title">{p.title}</span>
              <span className="card-desc">{p.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectView({ project }: { project: Project }) {
  const { cards, add, update, remove } = useProjectCards(project);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = project.icon;

  const open = (card: ProjectCard) => {
    const action = cardAction(card);
    if (!action) return;
    setError(null);
    runAction(action).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const AddCardButton = () => {
    return (
      <Button size="icon" variant="outline" onClick={() => setAdding((a) => !a)}>
        {adding ? <X size={16} /> : <Plus size={16} />}
      </Button>
    );
  };

  if (adding) {
    return (
      <AddCardForm
        onAdd={(card) => {
          add(card);
          setAdding(false);
        }}
      />
    );
  }
  return (
    <div className="project" >
      <header className="project-head">
        <span className="project-icon">
          <Icon size={32} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="project-title">{project.title}</h2>
          <p className="project-desc">{project.description}</p>
        </div>
        {!adding ? <AddCardButton /> : null}
      </header>

    
      {error && (
        <p className="project-error" role="alert">
          {error}
        </p>
      )}

      {cards.length > 0 && !adding &&  (
        <div className="grid project-grid">
          {cards.map((card) => (
            <ProjectCardView
              key={card.id}
              card={card}
              onOpen={() => open(card)}
              onChange={(value) => update(card.id, { value })}
              onRemove={() => remove(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCardView({
  card,
  onOpen,
  onChange,
  onRemove,
}: {
  card: ProjectCard;
  onOpen: () => void;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const meta = KIND_META[card.kind];
  const Icon = meta.icon;
  const isNote = card.kind === "note";

  return (
    <div className="card project-card" style={{ "--accent": meta.accent } as CSSProperties}>
      <span className="card-icon">
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <div className="card-body">
        {isNote ? (
          <>
            <span className="card-title">{card.title}</span>
            <textarea
              className="project-note"
              value={card.value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={meta.placeholder}
              rows={3}
            />
          </>
        ) : (
          <button className="project-card-open" onClick={onOpen} title={card.value}>
            <span className="card-title">{card.title}</span>
            <span className="card-desc">
              {card.kind === "app" ? APPS[card.app ?? "cursor"].label : meta.label} · {card.value}
            </span>
          </button>
        )}
      </div>
      <button className="project-card-remove" onClick={onRemove} aria-label={`Remove ${card.title}`}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function AddCardForm({ onAdd }: { onAdd: (card: Omit<ProjectCard, "id">) => void }) {
  const [kind, setKind] = useState<ProjectCardKind>("link");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [app, setApp] = useState<AppId>("cursor");
  const meta = KIND_META[kind];
  const isNote = kind === "note";

  const browse = async () => {
    const picked = await pickPath({ directory: true, multiple: false, title: "Choose a folder" });
    if (typeof picked !== "string") return;
    setValue(picked);
    const folder = picked.split("/").filter(Boolean).pop() || picked;
    setTitle((t) => t || (kind === "app" ? `${APPS[app].label}: ${folder}` : folder));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const v = value.trim();
    if (!t || (!isNote && !v)) return;
    onAdd({ kind, title: t, value: v, ...(kind === "app" && { app }) });
  };

  return (
    <form className="project-form flex flex-col gap-5 " onSubmit={submit}>
      <div className="project-kinds" role="radiogroup" aria-label="Card type">
        {KINDS.map((k) => {
          const m = KIND_META[k];
          return (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={k === kind}
              className={`project-kind${k === kind ? " active" : ""}`}
              onClick={() => setKind(k)}
              style={{ "height": "32px", width: "auto", fontSize: "16px" } as CSSProperties}
            >
              <m.icon size={15} /> {m.label}
            </button>
          );
        })}
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        autoFocus
      />
      {kind === "app" && (
        <div className="project-kinds" role="radiogroup" aria-label="App">
          {APP_IDS.map((id) => (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={id === app}
              className={`project-kind${id === app ? " active" : ""}`}
              onClick={() => setApp(id)}
            >
              {APPS[id].label}
            </button>
          ))}
        </div>
      )}
      {isNote ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={meta.placeholder}
          rows={3}
        />
      ) : (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`${meta.valueLabel} — ${meta.placeholder}`}
          />
          {(kind === "path" || kind === "app") && isTauri() && (
            <Button type="button" variant="outline" onClick={browse}>
              <FolderSearch /> Browse…
            </Button>
          )}
        </div>
      )}
      <Button type="submit" className="self-start">
        Add {meta.label.toLowerCase()}
      </Button>
    </form>
  );
}
