"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Lenis from "lenis";
import { profile } from "@/data/resume";
import { SECTIONS, SectionBlock } from "./SheetContent";
import type { SheetAnchors, SheetWorld } from "./world/SheetWorld";
import { canRasterize, rasterize } from "./rasterize";
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

const FAN = 10; // lines from the active index entry out to its section

/** Where the 3D titles, models and wires attach, read back from the laid-out DOM. */
function measure(hosts: HTMLElement[], tops: number[]): SheetAnchors {
  const a: SheetAnchors = { titles: [], stages: [], pins: [], slabs: [], names: [], graph: null };
  hosts.forEach((host, tile) => {
    const base = host.getBoundingClientRect();
    const top = tops[tile];
    const name = SECTIONS[tile].label;
    a.names.push({ tile, name });
    host.querySelectorAll<HTMLElement>("[data-x3d]").forEach((el) => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      // Group words into their wrapped lines.
      const lines: { text: string[]; l: number; r: number; b: number; h: number }[] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        for (const m of (n.textContent ?? "").matchAll(/\S+/g)) {
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const r = range.getBoundingClientRect();
          const last = lines[lines.length - 1];
          if (last && Math.abs(last.b - r.bottom) < size * 0.4) {
            // A word glued to the previous one (no space in the source) stays attached.
            if (r.left - last.r < 1) last.text[last.text.length - 1] += m[0];
            else last.text.push(m[0]);
            last.r = r.right;
          } else lines.push({ text: [m[0]], l: r.left, r: r.right, b: r.bottom, h: r.height });
        }
      }
      for (const l of lines) {
        a.titles.push({ text: l.text.join(" "), x: l.l - base.left, w: l.r - l.l, y: top + l.b - base.top - l.h * 0.22, h: l.h, size });
      }
    });
    const graph = host.querySelector<HTMLElement>("[data-graph]");
    if (graph) {
      const r = graph.getBoundingClientRect();
      a.graph = { x: r.left - base.left + r.width / 2, y: top + r.top - base.top + r.height * 0.62 };
    }
    host.querySelectorAll<HTMLElement>("[data-stage]").forEach((el) => {
      const r = el.getBoundingClientRect();
      a.stages.push({ tile, x: r.left - base.left + r.width / 2, y: top + r.top - base.top + r.height * 0.74 });
    });
    host.querySelectorAll<HTMLElement>("[data-pin]").forEach((el) => {
      const r = el.getBoundingClientRect();
      a.pins.push({ tile, x: r.left - base.left + 14, y: top + r.top - base.top + 14 });
    });
    host.querySelectorAll<HTMLElement>("[data-slab]").forEach((el) => {
      const r = el.getBoundingClientRect();
      a.slabs.push({ tile, name: el.dataset.slab || name, x0: r.left - base.left, x1: r.right - base.left, y0: top + r.top - base.top, y1: top + r.bottom - base.top });
    });
  });
  return a;
}

export default function SheetSite() {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const lineSvg = useRef<SVGSVGElement>(null);
  const navRef = useRef<HTMLOListElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const worldRef = useRef<SheetWorld | null>(null);
  const tops = useRef<number[]>([]);
  const [hosts, setHosts] = useState<HTMLElement[]>([]);
  const [mode, setMode] = useState<"canvas" | "raster" | "css" | "none" | null>(null);
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
    const rasterCanvases: HTMLCanvasElement[] = [];
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
      // Laid out off-screen for now; rasterized onto the sheet once the world exists.
      const holder = document.createElement("div");
      holder.className = "sx-raster-holder sx-raster";
      made.forEach((h) => holder.appendChild(h));
      el.appendChild(holder);
      cleanups.push(() => holder.remove());
    }
    const toColumn = () => {
      layer = document.createElement("div");
      layer.className = "sx-css-layer";
      column = document.createElement("div");
      column.className = "sx-column";
      column.style.width = `${width}px`;
      made.forEach((h) => column!.appendChild(h));
      el.appendChild(layer);
      cleanups.push(() => layer!.remove());
    };
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
      world?.setLayout(width, tiles, measure(made, tops.current));
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

    Promise.all([import("./world/SheetWorld"), canvasMode ? false : canRasterize()]).then(([{ SheetWorld }, rasterMode]) => {
      if (disposed || !canvasRef.current) return;
      if (!canvasMode && !rasterMode) toColumn();
      try {
        world = new SheetWorld(canvasRef.current, { bend: canvasMode || rasterMode, reducedMotion: reduced });
      } catch {
        // No WebGL: show the column as an ordinary page.
        el.classList.add("no-webgl");
        if (!layer) toColumn();
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
        // Web fonts change where the words fall, without always changing a section's height.
        document.fonts?.ready.then(() => !disposed && layout());
      } else if (rasterMode) {
        const k = Math.min(2, Math.max(1.5, window.devicePixelRatio));
        const paint = async () => {
          for (let i = 0; i < made.length && !disposed; i++) {
            const c = (rasterCanvases[i] ??= document.createElement("canvas"));
            try {
              await rasterize(made[i], c, k);
              world!.updateTile(i, c);
            } catch (err) {
              console.warn("Could not draw section", made[i].dataset.section, err);
            }
          }
        };
        // Portals fill the hosts on the next commit; fonts then settle the layout.
        requestAnimationFrame(async () => {
          await document.fonts?.ready;
          if (disposed) return;
          layout();
          await paint();
        });
      } else if (layer && column) {
        world.useCss(layer, column);
        const ro = new ResizeObserver(layout);
        ro.observe(column);
        cleanups.push(() => ro.disconnect());
      }

      // The left-hand index fans thin lines out to the parts of its section on the sheet.
      world.onFrame = () => {
        const nav = navRef.current;
        const svg = lineSvg.current;
        if (!nav || !svg || !world) return;
        const i = activeRef.current;
        const dot = nav.querySelectorAll<HTMLElement>(".sx-nav-dot")[i];
        const paths = svg.querySelectorAll("path");
        const ends = svg.querySelectorAll("circle");
        const r = dot?.getBoundingClientRect();
        const pins = world.pinsOf(i);
        const targets = [{ x: 40, y: tops.current[i] + 60 }, ...pins];
        paths.forEach((path, n) => {
          const k = n % FAN; // a still line and a flowing one per target
          const t = targets[k];
          const p = t && r ? world!.projectAt(t.x, t.y) : null;
          if (!p || !p.visible || !r) {
            path.setAttribute("d", "");
            ends[k].setAttribute("r", "0");
            return;
          }
          const x0 = r.left + r.width / 2;
          const y0 = r.top + r.height / 2;
          const mx = x0 + (p.x - x0) * (0.42 + k * 0.03);
          path.setAttribute("d", `M${x0},${y0} C${mx},${y0} ${mx},${p.y} ${p.x},${p.y}`);
          ends[k].setAttribute("cx", String(p.x));
          ends[k].setAttribute("cy", String(p.y));
          ends[k].setAttribute("r", "3.5");
        });
      };
      world.start();
      setMode(canvasMode ? "canvas" : rasterMode ? "raster" : "css");
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

    // --- The sections are pixels on the sheet, so map pointer hits back to their elements ---
    {
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
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -(e.clientY / window.innerHeight) * 2 + 1;
        if (dragging) {
          world?.dragMove(nx, ny);
          moved = true;
          return;
        }
        canvas.style.cursor = a ? "pointer" : world?.overModel(nx, ny) ? "grab" : "";
      };
      // Models can be picked up with a mouse; on touch, a drag still scrolls the page.
      let dragging = false;
      let moved = false;
      const onDown = (e: PointerEvent) => {
        moved = false;
        if (e.pointerType !== "mouse" || e.button !== 0 || elementAt(e)) return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -(e.clientY / window.innerHeight) * 2 + 1;
        if (!world?.dragStart(nx, ny)) return;
        dragging = true;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        world?.dragEnd();
        canvas.style.cursor = "grab";
      };
      const onCanvasClick = (e: MouseEvent) => {
        if (moved) return;
        const a = elementAt(e as PointerEvent);
        if (a) a.click();
      };
      // Tabbing through links inside the canvas brings them into view.
      const onFocusIn = (e: FocusEvent) => {
        if (!world?.bend) return;
        const t = e.target as HTMLElement;
        const i = made.findIndex((h) => h.contains(t));
        if (i < 0) return;
        const dy = t.getBoundingClientRect().top - made[i].getBoundingClientRect().top;
        scrollToY(tops.current[i] + dy - 200);
      };
      canvas.addEventListener("pointermove", onHover);
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("click", onCanvasClick);
      el.addEventListener("focusin", onFocusIn);
      cleanups.push(() => {
        canvas.removeEventListener("pointermove", onHover);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
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
      <svg ref={lineSvg} className="sx-lines" aria-hidden="true">
        {Array.from({ length: FAN * 2 }, (_, k) => (
          <path key={k} className={k < FAN ? "" : "sx-flow"} />
        ))}
        {Array.from({ length: FAN }, (_, k) => (
          <circle key={k} r="0" />
        ))}
      </svg>

      {(mode === "canvas" || mode === "css") && (
        <p className="sx-badge sx-mono" title={mode === "canvas" ? "Every section is live HTML drawn into the WebGL scene with drawElementImage()" : "This browser has no HTML-in-Canvas yet, so the sheet is real HTML laid flat in CSS 3D"}>
          {mode === "canvas" ? "● Rendered with HTML-in-Canvas" : "CSS 3D · enable HTML-in-Canvas in Chrome for the full sheet"}
        </p>
      )}
    </div>
  );
}
