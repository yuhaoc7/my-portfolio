import type { ReactNode } from "react";
import { education, industry, profile, research, skills, stats, works, type Role, type Work } from "@/data/resume";

/**
 * The page's content, one block per section. Each block is drawn onto the
 * sheet as its own tile, so a block should stay well under ~5000px tall.
 */
export type SheetSection = { id: string; label: string; side: string; node: ReactNode };

const VGI_SHOTS = ["maze", "gears", "hanoi-tower", "rolling-dice", "jigsaw-puzzle", "light-reflection", "rope-untangle", "polyform-tiling"];

function Rail({ n, label, side }: { n: number; label: string; side: string }) {
  return (
    <div className="sx-rail">
      <span>
        <b>{String(n).padStart(2, "0")}</b> {label}
      </span>
      <span className="sx-rail-line" aria-hidden="true" />
      <span>{side}</span>
    </div>
  );
}

function Points({ points }: { points: string[] }) {
  return (
    <ol className="sx-cards">
      {points.map((p, i) => (
        <li key={p} className="sx-card">
          <span className="sx-card-n">{String(i + 1).padStart(2, "0")}</span>
          <p>{p}</p>
        </li>
      ))}
    </ol>
  );
}

function RoleBlock({ r }: { r: Role }) {
  return (
    <>
      <h2 className="sx-title">{r.org}</h2>
      <p className="sx-meta">
        {r.role} <span>· {r.period}</span>
      </p>
      <p className="sx-summary">{r.summary}</p>
      <Points points={r.points} />
      <div className="sx-tags">
        {r.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </>
  );
}

function WorkBlock({ w, shots }: { w: Work; shots?: string[] }) {
  return (
    <>
      <h2 className="sx-title">{w.title}</h2>
      <p className="sx-meta">
        {w.full} <span>· {w.venue}</span>
      </p>
      <div className="sx-figs">
        {w.figures.map((f) => (
          <div key={f.l}>
            <span className="sx-fig">{f.n}</span>
            <span className="sx-mono">{f.l}</span>
          </div>
        ))}
      </div>
      {shots && (
        <div className="sx-shots">
          {shots.map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={s} src={`/media/vgi/${s}.webp`} alt={`VGI-Bench task: ${s.replace(/-/g, " ")}`} width={240} height={240} />
          ))}
        </div>
      )}
      <Points points={w.points} />
      {w.links && (
        <div className="sx-links">
          {w.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </>
  );
}

export const SECTIONS: SheetSection[] = [
  {
    id: "top",
    label: "Fade in",
    side: profile.location,
    node: (
      <div className="sx-hero">
        <p className="sx-mono sx-hero-top">
          <span>A portfolio on one sheet</span>
          <span>{profile.coords}</span>
        </p>
        <h1 className="sx-hero-name">
          Yuhao
          <br />
          Cheng<em>.</em>
        </h1>
        <p className="sx-hero-role">
          ML systems &amp; research engineer — <em>M.S. Computer Science, UIUC</em>
        </p>
        <p className="sx-mono sx-hero-cue">↓ Scroll — the sheet runs on</p>
      </div>
    ),
  },
  {
    id: "prologue",
    label: "Prologue",
    side: "Overview",
    node: (
      <>
        <p className="sx-statement">{profile.tagline}</p>
        <dl className="sx-stats">
          {stats.map((s) => (
            <div className="sx-card" key={s.label}>
              <dt>
                {s.value.toLocaleString()}
                <span>{s.suffix}</span>
              </dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  {
    id: "education",
    label: "UIUC",
    side: "Education",
    node: (
      <>
        <h2 className="sx-title">University of Illinois Urbana-Champaign</h2>
        <ol className="sx-cards">
          {education.map((e) => (
            <li key={e.degree} className="sx-card">
              <span className="sx-card-n">{e.period}</span>
              <p className="sx-degree">{e.degree}</p>
            </li>
          ))}
        </ol>
      </>
    ),
  },
  { id: "timan", label: "TIMAN", side: "Research", node: <RoleBlock r={research[0]} /> },
  { id: "ibm", label: "IBM–Illinois", side: "Research", node: <RoleBlock r={research[1]} /> },
  { id: "visibilityx", label: "visibilityx.ai", side: "Industry", node: <RoleBlock r={industry[0]} /> },
  { id: "hiabr", label: "HiABR", side: "Industry", node: <RoleBlock r={industry[1]} /> },
  { id: "vgi", label: "VGI-Bench", side: "Publication", node: <WorkBlock w={works[0]} shots={VGI_SHOTS} /> },
  { id: "pir", label: "PIR-Arena", side: "Publication", node: <WorkBlock w={works[1]} /> },
  {
    id: "toolkit",
    label: "Toolkit",
    side: "Skills",
    node: (
      <>
        <h2 className="sx-title">Train · Serve · Measure · Ship</h2>
        <div className="sx-skills">
          {skills.map((g, gi) => (
            <div className="sx-card" key={g.group}>
              <span className="sx-card-n">
                {String(gi + 1).padStart(2, "0")} {g.group}
              </span>
              <ul>
                {g.items.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "contact",
    label: "Fade out",
    side: "Contact",
    node: (
      <div className="sx-contact">
        <h2 className="sx-title">
          Let&rsquo;s make the <em>next scene</em> together.
        </h2>
        <p className="sx-summary">Open to ML systems, infrastructure and research engineering roles — from Dec 2026.</p>
        <a className="sx-mail" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
        <div className="sx-links">
          <a href={profile.github} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
          <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn ↗
          </a>
          <a href={profile.resume} target="_blank" rel="noopener noreferrer">
            Résumé (PDF) ↗
          </a>
          <a href="/photography">Photography →</a>
        </div>
        <p className="sx-mono sx-credits">
          © {new Date().getFullYear()} {profile.name} · Drawn with the HTML-in-Canvas API &amp; three.js
        </p>
      </div>
    ),
  },
];

export function SectionBlock({ s, n }: { s: SheetSection; n: number }) {
  return (
    <section className="sx-section" id={`sheet-${s.id}`} aria-label={s.label}>
      <Rail n={n} label={s.label} side={s.side} />
      {s.node}
    </section>
  );
}
