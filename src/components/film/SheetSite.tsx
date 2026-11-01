"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Lenis from "lenis";
import { profile } from "@/data/resume";
import { SECTIONS, SectionBlock } from "./SheetContent";
import type { SheetWorld } from "./world/SheetWorld";
import "./sheet.css";

/**
 * HTML-in-Canvas is a Chrome origin trial. With a token (register the site at
 * developer.chrome.com/origintrials) in NEXT_PUBLIC_HTML_IN_CANVAS_TOKEN, visitors
 * get it without a flag; an injected meta tag enables it before we detect it.
 */
function enableOriginTrial() {
  const token = process.env.NEXT_PUBLIC_HTML_IN_CANVAS_TOKEN;
  if (!token || document.querySelector(`meta[content="${token}"]`)) return;
  const m = document.createElement("meta");
  m.httpEquiv = "origin-trial";
  m.content = token;
  document.head.appendChild(m);
}

/** HTML-in-Canvas: draw live DOM into a canvas. */
function supportsHTMLInCanvas() {
  enableOriginTrial();
  const ctx = CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>;
  return typeof ctx.drawElementImage === "function" && "requestPaint" in HTMLCanvasElement.prototype;
}

type PaintCanvas = HTMLCanvasElement & { requestPaint?: () => void; onpaint: ((e: Event) => void) | null };
type DrawCtx = CanvasRenderingContext2D & { drawElementImage(el: Element, dx: number, dy: number, dw: number, dh: number): unknown };

export default function SheetSite() {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const linePath = useRef<SVGPathElement>(null);
  const navRef = useRef<HTMLOListElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const worldRef = useRef<SheetWorld | null>(null);
  const tops = useRef<number[]>([]);
  const [hosts, setHosts] = useState<HTMLElement[]>([]);
  const [mode, setMode] = useState<"canvas" | "css" | "none" | null>(null);
  const [active, setActive] = useState(0);
  const [dark, setDark] = useState(true);
  const activeRef = useRef(0);

  // Theme: the viewer's saved choice, else dark (the sheet glows best on black).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("film-theme");
    } catch {}
    setDark(saved ? saved === "dark" : true);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    worldRef.current?.setTheme(dark);
  }, [dark]);
  const toggleTheme = () =>
    setDark((d) => {
      try {
        localStorage.setItem("film-theme", d ? "light" : "dark");
      } catch {}
      return !d;
    });

  const scrollToY = (y: number) =>
    lenisRef.current?.scrollTo(Math.max(0, y), { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  const jump = (i: number) => scrollToY(tops.current[i] - 40);

  useEffect(() => {
    const el = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.innerWidth < 768;
    const width = narrow ? 440 : 1080;
    const canvasMode = supportsHTMLInCanvas();
    let disposed = false;
    let world: SheetWorld | null = null;
    const cleanups: (() => void)[] = [];

    // One host per section. In canvas mode each lives in its own drawable canvas;
    // otherwise they stack in a real DOM column that is laid on the sheet in CSS 3D.
    const made = SECTIONS.map((s) => {
      const h = document.createElement("div");
      h.className = `sx-host ${narrow ? "is-narrow" : ""}`;
      h.style.width = `${width}px`;
      h.dataset.section = s.id;
      return h;
    });
    const tileCanvases: PaintCanvas[] = [];
    let layer: HTMLElement | null = null;
    let column: HTMLElement | null = null;
    if (canvasMode) {
      const holder = document.createElement("div");
      holder.className = "sx-tiles";
      made.forEach((h) => {
        const c = document.createElement("canvas") as PaintCanvas;
        // `layoutsubtree` before Chrome 155, `content="drawable"` after.
        c.setAttribute("layoutsubtree", "");
        c.setAttribute("content", "drawable");
        h.setAttribute("drawable", "");
        c.appendChild(h);
        holder.appendChild(c);
        tileCanvases.push(c);
      });
      el.appendChild(holder);
      cleanups.push(() => holder.remove());
    } else {
      layer = document.createElement("div");
      layer.className = "sx-css-layer";
      column = document.createElement("div");
      column.className = "sx-column";
      column.style.width = `${width}px`;
      made.forEach((h) => column!.appendChild(h));
      el.appendChild(layer);
      cleanups.push(() => layer!.remove());
    }
    setHosts(made);

    // --- Layout: section tops and heights in CSS px, down the sheet ---
    const layout = () => {
      let y = 0;
      const tiles = made.map((h) => {
        const t = { y, h: Math.ceil(h.offsetHeight) };
        y += t.h;
        return t;
      });
      tops.current = tiles.map((t) => t.y);
      world?.setLayout(width, tiles);
      // Stop when the end of the page has crossed the floor and sits mid-view.
      if (spacer.current) spacer.current.style.height = `${Math.max(0, y - 380) + window.innerHeight}px`;
    };

    // --- Smooth scroll drives the sheet ---
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.08, smoothWheel: !reduced });
    lenisRef.current = lenis;
    let rafId = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    const onScroll = () => {
      const y = window.scrollY;
      if (world) world.scroll = y;
      const ts = tops.current;
      let a = 0;
      for (let i = 0; i < ts.length; i++) if (y + 260 >= ts[i]) a = i;
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }
    };
    lenis.on("scroll", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      window.removeEventListener("scroll", onScroll);
    });

    // --- In-sheet links that point at sections ---
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const i = SECTIONS.findIndex((s) => `#${s.id}` === a.getAttribute("href"));
      if (i < 0) return;
      e.preventDefault();
      jump(i);
    };
    el.addEventListener("click", onClick);
    cleanups.push(() => el.removeEventListener("click", onClick));

    import("./world/SheetWorld").then(({ SheetWorld }) => {
      if (disposed || !canvasRef.current) return;
      try {
        world = new SheetWorld(canvasRef.current, { bend: canvasMode, reducedMotion: reduced });
      } catch {
        // No WebGL: show the column as an ordinary page.
        el.classList.add("no-webgl");
        if (layer && column) {
          layer.remove();
          el.querySelector(".sx-plain")?.appendChild(column);
        }
        setMode("none");
        return;
      }
      worldRef.current = world;
      if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __sheet: SheetWorld }).__sheet = world;
      world.setTheme(document.documentElement.dataset.theme === "dark");
      layout();
      onScroll();

      if (canvasMode) {
        const k = Math.min(2, Math.max(1.25, window.devicePixelRatio));
        tileCanvases.forEach((c, i) => {
          const host = made[i];
          const ctx = c.getContext("2d") as DrawCtx;
          c.onpaint = () => {
            const w = Math.round(width * k);
            const h = Math.round(Math.ceil(host.offsetHeight) * k);
            if (c.width !== w || c.height !== h) {
              c.width = w;
              c.height = h;
            }
            ctx.clearRect(0, 0, w, h);
            try {
              ctx.drawElementImage(host, 0, 0, w, h);
            } catch {
              return; // not painted yet; the next paint event draws it
            }
            world!.updateTile(i, c);
            // A section can change height (fonts, images): keep the stack in step.
            const want = Math.ceil(host.offsetHeight);
            const have = (tops.current[i + 1] ?? world!.height) - tops.current[i];
            if (want !== have) layout();
          };
          c.requestPaint?.();
        });
      } else if (layer && column) {
        world.useCss(layer, column);
        const ro = new ResizeObserver(layout);
        ro.observe(column);
        cleanups.push(() => ro.disconnect());
      }

      // The left-hand index draws a line to where its section sits on the sheet.
      world.onFrame = () => {
        const nav = navRef.current;
        const path = linePath.current;
        if (!nav || !path || !world) return;
        const i = activeRef.current;
        const dot = nav.querySelectorAll<HTMLElement>(".sx-nav-dot")[i];
        const p = world.project(tops.current[i] + 60, -1);
        if (!dot || !p.visible) {
          path.setAttribute("d", "");
          return;
        }
        const r = dot.getBoundingClientRect();
        const x0 = r.left + r.width / 2;
        const y0 = r.top + r.height / 2;
        const mx = x0 + (p.x - x0) * 0.5;
        path.setAttribute("d", `M${x0},${y0} C${mx},${y0} ${mx},${p.y} ${p.x},${p.y}`);
      };
      world.start();
      setMode(canvasMode ? "canvas" : "css");
    });

    const onResize = () => {
      world?.resize();
      layout();
    };
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));
    const onMove = (e: PointerEvent) => world?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    window.addEventListener("pointermove", onMove);
    cleanups.push(() => window.removeEventListener("pointermove", onMove));

    // --- Canvas mode: the sections are pixels on the sheet, so map pointer hits back to their elements ---
    if (canvasMode) {
      const canvas = canvasRef.current!;
      let hovered: HTMLElement | null = null;
      const elementAt = (e: PointerEvent | MouseEvent) => {
        const hit = world?.pick((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        if (!hit) return null;
        const host = made[hit.tile];
        const base = host.getBoundingClientRect();
        for (const a of host.querySelectorAll<HTMLElement>("a, button")) {
          const r = a.getBoundingClientRect();
          const l = r.left - base.left;
          const t = r.top - base.top;
          if (hit.x >= l - 4 && hit.x <= l + r.width + 4 && hit.y >= t - 4 && hit.y <= t + r.height + 4) return a;
        }
        return null;
      };
      const onHover = (e: PointerEvent) => {
        if (e.target !== canvas) return;
        const a = elementAt(e);
        if (a !== hovered) {
          hovered?.classList.remove("is-hover");
          a?.classList.add("is-hover"); // a DOM change, so that section repaints
          hovered = a;
        }
        canvas.style.cursor = a ? "pointer" : "";
      };
      const onCanvasClick = (e: MouseEvent) => {
        const a = elementAt(e as PointerEvent);
        if (a) a.click();
      };
      // Tabbing through links inside the canvas brings them into view.
      const onFocusIn = (e: FocusEvent) => {
        const t = e.target as HTMLElement;
        const i = made.findIndex((h) => h.contains(t));
        if (i < 0) return;
        const dy = t.getBoundingClientRect().top - made[i].getBoundingClientRect().top;
        scrollToY(tops.current[i] + dy - 200);
      };
      canvas.addEventListener("pointermove", onHover);
      canvas.addEventListener("click", onCanvasClick);
      el.addEventListener("focusin", onFocusIn);
      cleanups.push(() => {
        canvas.removeEventListener("pointermove", onHover);
        canvas.removeEventListener("click", onCanvasClick);
        el.removeEventListener("focusin", onFocusIn);
      });
    }

    return () => {
      disposed = true;
      cleanups.forEach((f) => f());
      world?.dispose();
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="sheet">
      <canvas ref={canvasRef} className="sx-canvas" />
      <div ref={spacer} className="sx-spacer" aria-hidden="true" />
      <div className="sx-plain" />
      {hosts.map((h, i) => createPortal(<SectionBlock s={SECTIONS[i]} n={i} />, h, SECTIONS[i].id))}

      <header className="sx-hud">
        <a href="#top" className="sx-mark" onClick={(e) => (e.preventDefault(), scrollToY(0))}>
          <span className="sx-mark-glyph" aria-hidden="true">
            YC
          </span>
          <span>{profile.name}</span>
        </a>
        <nav className="sx-top-nav sx-mono" aria-label="Primary">
          <a href="/photography" className="hide-sm">
            Photography
          </a>
          <a href={profile.resume} target="_blank" rel="noopener noreferrer" className="hide-sm">
            Résumé
          </a>
          <button type="button" className="sx-theme" onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark}>
            <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
          </button>
          <a href={`mailto:${profile.email}`} className="sx-cta">
            Contact
          </a>
        </nav>
      </header>

      <nav className="sx-nav sx-mono" aria-label="Sections">
        <ol ref={navRef}>
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <button type="button" className={i === active ? "is-on" : ""} aria-current={i === active ? "step" : undefined} onClick={() => jump(i)}>
                <span>{s.label}</span>
                <span className="sx-nav-dot" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <svg className="sx-lines" aria-hidden="true">
        <path ref={linePath} />
      </svg>

      {mode && mode !== "none" && (
        <p className="sx-badge sx-mono" title={mode === "canvas" ? "Every section is live HTML drawn into the WebGL scene with drawElementImage()" : "This browser has no HTML-in-Canvas yet, so the sheet is real HTML laid flat in CSS 3D"}>
          {mode === "canvas" ? "● Rendered with HTML-in-Canvas" : "CSS 3D · enable HTML-in-Canvas in Chrome for the full sheet"}
        </p>
      )}
    </div>
  );
}
