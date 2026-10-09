import { education, industry, profile, research, skills, stats, works, type Role, type Work } from "@/data/resume";

function Slug({ n, text }: { n: string; text: string }) {
  return (
    <div className="slug" data-reveal>
      <span className="slug-n">SC {n}</span>
      <span className="slug-line" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function RolePanel({ n, slug, r, kicker }: { n: string; slug: string; r: Role; kicker: string }) {
  return (
    <>
      <Slug n={n} text={slug} />
      <p className="kicker mono" data-reveal>
        {kicker}
      </p>
      <h2 className="panel-title" data-split>
        {r.org}
      </h2>
      <p className="panel-role" data-reveal>
        {r.role} <span className="mono dim">· {r.period}</span>
      </p>
      <p className="panel-summary" data-reveal>
        {r.summary}
      </p>
      <ul className="points">
        {r.points.map((p) => (
          <li key={p} data-reveal>
            {p}
          </li>
        ))}
      </ul>
      <div className="tags" data-reveal>
        {r.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
    </>
  );
}

function WorkPanel({ n, slug, w }: { n: string; slug: string; w: Work }) {
  return (
    <>
      <Slug n={n} text={slug} />
      <p className="kicker mono accent" data-reveal>
        {w.venue}
      </p>
      <h2 className="panel-title" data-split>
        {w.title}
      </h2>
      <p className="panel-summary" data-reveal>
        {w.full}
      </p>
      <div className="figs" data-reveal>
        {w.figures.map((f) => (
          <div key={f.l}>
            <span className="fig-n">{f.n}</span>
            <span className="mono dim">{f.l}</span>
          </div>
        ))}
      </div>
      <ul className="points">
        {w.points.map((p) => (
          <li key={p} data-reveal>
            {p}
          </li>
        ))}
      </ul>
      {w.links && (
        <div className="links mono" data-reveal>
          {w.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="ulink">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/** A long section whose text panel sticks while the camera works the station. */
function Stage({ id, side, children }: { id: string; side: "left" | "right"; children: React.ReactNode }) {
  return (
    <section id={id} className={`stage stage-${side}`} data-chapter>
      <div className="panel">{children}</div>
    </section>
  );
}

export default function Sections() {
  return (
    <main className="film-main">
      {/* 00 — Fade in */}
      <section id="top" className="scene scene-hero" data-chapter>
        <div className="hero-top mono" data-hero-fade>
          <span>A portfolio in ten scenes</span>
          <span className="hide-sm">{profile.location}</span>
        </div>
        <h1 className="hero-name" aria-label={profile.name}>
          <span className="hero-line" data-hero-split>
            Yuhao
          </span>
          <span className="hero-line hero-line-2" data-hero-split>
            Cheng<em className="hero-dot">.</em>
          </span>
        </h1>
        <div className="hero-foot" data-hero-fade>
          <p className="hero-role">
            ML systems &amp; research engineer — <em>M.S. Computer Science, UIUC</em>
          </p>
          <a href="#prologue" className="scroll-cue mono">
            <span className="scroll-cue-bar" aria-hidden="true" />
            Scroll to begin
          </a>
        </div>
      </section>

      {/* 01 — Prologue */}
      <section id="prologue" className="scene scene-prologue" data-chapter>
        <div className="panel panel-wide">
          <Slug n="01" text="Prologue — the whole set, from above" />
          <p className="statement" data-split>
            {profile.tagline}
          </p>
          <p className="statement-sub" data-reveal>
            Seven sets below, one for each chapter: a campus, an evaluation pipeline, a GPU cluster, a dashboard
            studio, an inference farm, a benchmark gallery and a retrieval funnel.
          </p>
          <dl className="stats">
            {stats.map((s) => (
              <div className="stat" key={s.label} data-reveal>
                <dt className="stat-value">
                  <span data-count={s.value}>0</span>
                  <span className="stat-suffix">{s.suffix}</span>
                </dt>
                <dd className="stat-label">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 02 — Education */}
      <Stage id="education" side="left">
        <Slug n="02" text="Ext. Main Quad, Urbana-Champaign" />
        <p className="kicker mono" data-reveal>
          Education
        </p>
        <h2 className="panel-title" data-split>
          University of Illinois Urbana-Champaign
        </h2>
        <div className="edu">
          {education.map((e) => (
            <div className="edu-row" key={e.degree} data-reveal>
              <div>
                <p className="mono dim">{e.period}</p>
                <h3 className="edu-degree">{e.degree}</h3>
              </div>
            </div>
          ))}
        </div>
      </Stage>

      <Stage id="timan" side="right">
        <RolePanel n="03" slug="Int. Evaluation pipeline — 2026" kicker="Research" r={research[0]} />
      </Stage>
      <Stage id="ibm" side="left">
        <RolePanel n="04" slug="Int. GPU cluster — 4 nodes, 16 GPUs" kicker="Research" r={research[1]} />
      </Stage>
      <Stage id="visibilityx" side="right">
        <RolePanel n="05" slug="Int. Dashboard studio — summer 2025" kicker="Industry" r={industry[0]} />
      </Stage>
      <Stage id="hiabr" side="left">
        <RolePanel n="06" slug="Int. Inference farm — SDXL on 8 GPUs" kicker="Industry" r={industry[1]} />
      </Stage>
      <Stage id="vgi" side="right">
        <WorkPanel n="07" slug="Int. Gallery — 25 of 27 tasks on the wall" w={works[0]} />
      </Stage>
      <Stage id="pir" side="left">
        <WorkPanel n="08" slug="Int. Retrieval funnel — ongoing" w={works[1]} />
      </Stage>

      {/* 09 — Toolkit */}
      <section id="toolkit" className="scene scene-toolkit" data-chapter>
        <div className="panel panel-full">
          <Slug n="09" text="Montage — the toolkit" />
          <div className="marquee" aria-hidden="true">
            <div className="marquee-track" data-marquee>
              {Array.from({ length: 2 }).map((_, k) => (
                <span key={k}>
                  Train <i>·</i> Serve <i>·</i> Measure <i>·</i> Ship <i>·</i> Train <i>·</i> Serve <i>·</i> Measure{" "}
                  <i>·</i> Ship <i>·</i>{" "}
                </span>
              ))}
            </div>
          </div>
          <div className="skills">
            {skills.map((g, gi) => (
              <div className="skill-col" key={g.group} data-reveal>
                <p className="mono dim skill-head">
                  <span>{String(gi + 1).padStart(2, "0")}</span> {g.group}
                </p>
                <ul>
                  {g.items.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10 — Fade out */}
      <section id="contact" className="scene scene-contact" data-chapter>
        <div className="panel panel-contact">
          <Slug n="10" text="Fade out" />
          <h2 className="contact-title" data-split>
            Let&rsquo;s make the <em>next scene</em> together.
          </h2>
          <p className="contact-sub" data-reveal>
            Open to ML systems, infrastructure and research engineering roles — from Dec 2026.
          </p>
          <a href={`mailto:${profile.email}`} className="contact-mail" data-reveal data-magnetic>
            {profile.email}
          </a>
          <nav className="contact-links mono" data-reveal aria-label="Elsewhere">
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="ulink">
              GitHub ↗
            </a>
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="ulink">
              LinkedIn ↗
            </a>
            <a href={profile.resume} target="_blank" rel="noopener noreferrer" className="ulink">
              Résumé (PDF) ↗
            </a>
            <a href="/photography" className="ulink">
              Photography →
            </a>
          </nav>
        </div>
        <footer className="credits mono dim">
          <span>© {new Date().getFullYear()} {profile.name}</span>
          <span>Built with three.js &amp; GSAP · VGI-Bench imagery from the paper</span>
        </footer>
      </section>
    </main>
  );
}
