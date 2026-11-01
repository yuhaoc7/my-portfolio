"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { education, industry, research, works } from "@/data/resume";
import type { World } from "./world/World";

/** Board size in CSS pixels; must match BOARD in world/World.ts. */
const PX_W = 600;
const PX_H = 780;
const COLS = 4;

type Booth = {
  id: string;
  name: string;
  hall: string;
  title: string;
  meta?: string;
  summary: string;
  points: string[];
  tags: string[];
  figures?: { n: string; l: string }[];
  links?: { label: string; href: string }[];
};

const BOOTHS: Booth[] = [
  {
    id: "education",
    name: "UIUC",
    hall: "Education",
    title: "University of Illinois Urbana-Champaign",
    summary: "Six years in Urbana-Champaign — computer engineering, then computer science.",
    points: education.map((e) => `${e.degree} · ${e.period}`),
    tags: ["Altgeld Hall", "Main Quad", "Champaign, IL"],
  },
  ...[...research, ...industry].map((r, i) => ({
    id: ["timan", "ibm", "visibilityx", "hiabr"][i],
    name: ["TIMAN", "IBM–Illinois", "visibilityx.ai", "HiABR"][i],
    hall: i < 2 ? "Research" : "Industry",
    title: r.org,
    meta: `${r.role} · ${r.period}`,
    summary: r.summary,
    points: r.points.slice(0, 3),
    tags: r.tags,
  })),
  ...works.map((w, i) => ({
    id: ["vgi", "pir"][i],
    name: w.title,
    hall: `Publication · ${w.venue}`,
    title: w.title,
    meta: w.full,
    summary: w.points[0],
    points: w.points.slice(1),
    tags: [],
    figures: w.figures,
    links: w.links,
  })),
];

export function supportsHTMLInCanvas() {
  if (typeof window === "undefined") return false;
  const ctx = CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>;
  return typeof ctx.drawElementImage === "function" && "requestPaint" in HTMLCanvasElement.prototype;
}

type PaintCanvas = HTMLCanvasElement & { requestPaint?: () => void; onpaint: ((e: Event) => void) | null };
type DrawCtx = CanvasRenderingContext2D & {
  drawElementImage(el: Element, dx: number, dy: number, dw: number, dh: number): unknown;
};

function Board({ b, i }: { b: Booth; i: number }) {
  return (
    <article className="expo-card" aria-label={`Booth ${i + 1}: ${b.name}`}>
      <header className="expo-card-head mono">
        <span className="expo-card-n">Booth {String(i + 1).padStart(2, "0")}</span>
        <span>{b.hall}</span>
      </header>
      <h3 className="expo-card-title">{b.title}</h3>
      {b.meta && <p className="expo-card-meta">{b.meta}</p>}
      <p className="expo-card-summary">{b.summary}</p>
      {b.figures && (
        <div className="expo-card-figs">
          {b.figures.map((f) => (
            <div key={f.l}>
              <span className="expo-card-fig">{f.n}</span>
              <span className="mono">{f.l}</span>
            </div>
          ))}
        </div>
      )}
      <ul className="expo-card-points">
        {b.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <footer className="expo-card-foot">
        {b.tags.length > 0 && (
          <div className="expo-card-tags">
            {b.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        {b.links && (
          <div className="expo-card-links mono">
            {b.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        )}
        <a className="expo-card-story mono" href={`#${b.id}`} data-story>
          Watch the scene →
        </a>
      </footer>
    </article>
  );
}

export default function ExpoMode({
  scene,
  root,
  open,
  startBooth,
  onClose,
}: {
  scene: World;
  root: HTMLElement;
  open: boolean;
  startBooth: number;
  onClose: (story?: string) => void;
}) {
  const [hosts, setHosts] = useState<HTMLElement[]>([]);
  const [mode, setMode] = useState<"canvas" | "css3d" | null>(null);
  const [booth, setBooth] = useState(startBooth);
  const [focus, setFocus] = useState(false);
  const boothRef = useRef(booth);
  boothRef.current = booth;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const n = BOOTHS.length;

  // Build the boards' hosts once: children of a drawable canvas, or CSS 3D objects.
  useEffect(() => {
    const useCanvas = supportsHTMLInCanvas();
    const made: HTMLElement[] = [];
    let cleanup: () => void;
    if (useCanvas) {
      const k = window.innerWidth < 768 ? 1 : 1.5;
      const cw = Math.round(PX_W * k);
      const ch = Math.round(PX_H * k);
      const atlas = document.createElement("canvas") as PaintCanvas;
      atlas.className = "expo-atlas";
      // Both spellings: `layoutsubtree` (Chrome < 155) and `content="drawable"`.
      atlas.setAttribute("layoutsubtree", "");
      atlas.setAttribute("content", "drawable");
      atlas.width = cw * COLS;
      atlas.height = ch * Math.ceil(n / COLS);
      for (let i = 0; i < n; i++) {
        const d = document.createElement("div");
        d.className = "expo-board";
        d.setAttribute("drawable", "");
        d.dataset.booth = String(i);
        atlas.appendChild(d);
        made.push(d);
      }
      root.appendChild(atlas);
      const cell = (i: number) => ({ x: (i % COLS) * cw, y: Math.floor(i / COLS) * ch, w: cw, h: ch });
      const upload = scene.useBoardAtlas(atlas, cell);
      const ctx = atlas.getContext("2d") as DrawCtx;
      atlas.onpaint = () => {
        ctx.clearRect(0, 0, atlas.width, atlas.height);
        made.forEach((el, i) => {
          const c = cell(i);
          try {
            ctx.drawElementImage(el, c.x, c.y, c.w, c.h);
          } catch {
            // Not painted yet; the next paint event draws it.
          }
        });
        upload();
      };
      const r = requestAnimationFrame(() => atlas.requestPaint?.());
      cleanup = () => {
        cancelAnimationFrame(r);
        atlas.remove();
      };
    } else {
      const layer = document.createElement("div");
      layer.className = "expo-css-layer";
      for (let i = 0; i < n; i++) {
        const d = document.createElement("div");
        d.className = "expo-board";
        d.dataset.booth = String(i);
        made.push(d);
      }
      root.appendChild(layer);
      scene.useCssBoards(layer, made);
      cleanup = () => layer.remove();
    }
    setHosts(made);
    setMode(useCanvas ? "canvas" : "css3d");
    return cleanup;
    // One set of boards for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) {
      setBooth(startBooth);
      setFocus(false);
    }
  }, [open, startBooth]);

  useEffect(() => {
    scene.setExpo(open, open ? startBooth : undefined);
  }, [open, scene, startBooth]);
  useEffect(() => scene.setExpoBooth(booth), [booth, scene]);
  useEffect(() => scene.setExpoFocus(focus), [focus, scene]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(n - 1, i));
      setBooth(next);
      if (next !== boothRef.current) setFocus(false);
    },
    [n],
  );

  // Input on the floor: drag to look, click a board or a set, wheel/keys to walk.
  useEffect(() => {
    if (!open || !mode) return;
    const canvas = root.querySelector<HTMLCanvasElement>(".film-canvas")!;
    const cursor = root.querySelector<HTMLElement>(".cursor");
    let down: { x: number; y: number; moved: boolean } | null = null;
    let hovered: Element | null = null;
    const ndc = (e: PointerEvent | MouseEvent) => [(e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1] as const;

    // Canvas mode: the boards are pixels in the scene, so map a hit back to the element under it.
    const linkAt = (boothIdx: number, x: number, y: number) => {
      const host = hosts[boothIdx];
      const base = host.getBoundingClientRect();
      for (const a of host.querySelectorAll<HTMLElement>("a, button")) {
        const r = a.getBoundingClientRect();
        const l = r.left - base.left;
        const t = r.top - base.top;
        if (x >= l - 6 && x <= l + r.width + 6 && y >= t - 6 && y <= t + r.height + 6) return a;
      }
      return null;
    };
    const setHover = (el: Element | null) => {
      if (el === hovered) return;
      hovered?.classList.remove("is-hover");
      el?.classList.add("is-hover"); // a DOM change, so the canvas repaints the board
      hovered = el;
    };

    const onDown = (e: PointerEvent) => {
      if (e.target !== canvas) return;
      down = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (down && e.buttons) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 6) down.moved = true;
        if (down.moved) {
          scene.nudgeExpo(-e.movementX * 0.0045, e.movementY * 0.0025);
          canvas.style.cursor = "grabbing";
        }
        return;
      }
      if (e.target !== canvas) return;
      const hit = scene.pick(...ndc(e));
      const link = hit?.kind === "board" && mode === "canvas" ? linkAt(hit.booth, hit.x, hit.y) : null;
      setHover(link);
      const clickable = !!link || (hit && (hit.booth !== boothRef.current || hit.kind === "board"));
      canvas.style.cursor = clickable ? "pointer" : "grab";
      cursor?.classList.toggle("is-link", !!clickable);
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      canvas.style.cursor = "grab";
      if (!d || d.moved || e.target !== canvas) return;
      const hit = scene.pick(...ndc(e));
      if (!hit) return;
      if (hit.booth !== boothRef.current) return go(hit.booth);
      if (hit.kind === "board") {
        const link = mode === "canvas" ? linkAt(hit.booth, hit.x, hit.y) : null;
        if (link) return link.click();
        setFocus((f) => !f);
      } else setFocus(false);
    };
    // CSS 3D mode: the boards are real DOM above the scene.
    const onBoardClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const story = t.closest<HTMLAnchorElement>("a[data-story]");
      if (story) {
        e.preventDefault();
        e.stopPropagation();
        return onClose(story.getAttribute("href")!.slice(1));
      }
      const host = t.closest<HTMLElement>(".expo-board");
      if (!host || t.closest("a")) return;
      const i = Number(host.dataset.booth);
      if (i !== boothRef.current) go(i);
      else setFocus((f) => !f);
    };

    let wheelAcc = 0;
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest(".expo-hud")) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = performance.now();
      if (now < wheelLock) return;
      wheelAcc += d;
      if (Math.abs(wheelAcc) > 60) {
        go(boothRef.current + Math.sign(wheelAcc));
        wheelAcc = 0;
        wheelLock = now + 700;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, [contenteditable]");
      if (typing) return;
      if (e.key === "Escape") return focusRef.current ? setFocus(false) : onClose();
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") go(boothRef.current + 1);
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") go(boothRef.current - 1);
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) go(Number(e.key) - 1);
      else if ((e.key === "Enter" || e.key === " ") && (t === document.body || t === canvas)) setFocus((f) => !f);
      else return;
      e.preventDefault();
    };
    // Tabbing into a board's links walks to that booth.
    const onFocusIn = (e: FocusEvent) => {
      const host = (e.target as HTMLElement).closest<HTMLElement>(".expo-board");
      if (!host) return;
      go(Number(host.dataset.booth));
      setFocus(true);
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    root.addEventListener("focusin", onFocusIn);
    hosts.forEach((h) => h.addEventListener("click", onBoardClick));
    return () => {
      setHover(null);
      canvas.style.cursor = "";
      cursor?.classList.remove("is-link");
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      root.removeEventListener("focusin", onFocusIn);
      hosts.forEach((h) => h.removeEventListener("click", onBoardClick));
    };
  }, [open, mode, hosts, root, scene, go, onClose, n]);

  const b = BOOTHS[booth];

  return (
    <>
      {hosts.map((h, i) => createPortal(<Board b={BOOTHS[i]} i={i} />, h, BOOTHS[i].id))}
      <div className={`expo-hud ${focus ? "is-reading" : ""}`} aria-hidden={!open} inert={!open}>
        <div className="expo-head">
          <p className="mono expo-title">
            <span className="rec-dot" /> Expo mode <span className="dim">· the work, on one floor</span>
          </p>
          <p className="mono expo-badge" title={mode === "canvas" ? "Each board is live HTML drawn into the WebGL scene with drawElementImage()" : "This browser has no HTML-in-Canvas yet, so the boards are HTML laid over the scene in CSS 3D"}>
            {mode === "canvas" ? "Rendered with HTML-in-Canvas" : "CSS 3D fallback · HTML-in-Canvas unavailable"}
          </p>
          <button type="button" className="expo-exit mono" onClick={() => onClose()}>
            Exit expo <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="expo-foot">
          <div className="expo-now" aria-live="polite">
            <span className="mono dim">
              Booth {String(booth + 1).padStart(2, "0")} / {String(n).padStart(2, "0")} · {b.hall}
            </span>
            <span className="expo-now-name">{b.name}</span>
          </div>
          <div className="expo-bar">
            <button type="button" className="expo-arrow" onClick={() => go(booth - 1)} disabled={booth === 0} aria-label="Previous booth">
              ←
            </button>
            <ol className="expo-dir mono">
              {BOOTHS.map((x, i) => (
                <li key={x.id}>
                  <button type="button" className={i === booth ? "is-on" : ""} aria-current={i === booth ? "true" : undefined} onClick={() => go(i)}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span className="expo-dir-name">{x.name}</span>
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="expo-arrow" onClick={() => go(booth + 1)} disabled={booth === n - 1} aria-label="Next booth">
              →
            </button>
            <button type="button" className="expo-read mono" aria-pressed={focus} onClick={() => setFocus((f) => !f)}>
              {focus ? "Back to booth" : "Read board"}
            </button>
          </div>
          <p className="expo-hint mono dim hide-sm">Drag to look · ← → or scroll to walk · click a board to read · Esc to leave</p>
        </div>
      </div>
    </>
  );
}
