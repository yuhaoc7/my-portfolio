"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { chapters, profile } from "@/data/resume";
import Sections from "./Sections";
import "./film.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

// Total "runtime" of the page, used to turn scroll progress into a timecode.
const RUNTIME_SECONDS = 3 * 60 + 24;

function timecode(progress: number) {
  const total = progress * RUNTIME_SECONDS;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total % 1) * 24);
  return `00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export default function FilmSite() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let disposed = false;
    let scene: import("./world/World").World | null = null;

    // --- WebGL scene (loaded lazily so the first paint stays light) ---
    const sceneReady = import("./world/World").then(({ World }) => {
      if (disposed || !canvas.current) return;
      try {
        scene = new World(canvas.current, { reducedMotion: reduced, mediaBase: "/media/vgi" });
        scene.start();
      } catch {
        // No WebGL: the CSS gradient fallback behind the canvas carries the page.
        el.classList.add("no-webgl");
      }
    });

    // --- Smooth scroll ---
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, smoothWheel: !reduced });
    lenisRef.current = lenis;
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    lenis.stop();

    const sections = Array.from(el.querySelectorAll<HTMLElement>("[data-chapter]"));
    let lastActive = -1;
    const onScroll = () => {
      const mid = window.innerHeight / 2;
      const centers = sections.map((s) => {
        const r = s.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      let c = 0;
      if (mid >= centers[centers.length - 1]) c = centers.length - 1;
      else if (mid > centers[0]) {
        for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) {
            c = i + (mid - centers[i]) / (centers[i + 1] - centers[i]);
            break;
          }
        }
      }
      // Per-chapter progress: 0 as a section enters from below, 1 as it leaves the top.
      const vh = window.innerHeight;
      const locals = sections.map((sec) => {
        const r = sec.getBoundingClientRect();
        return Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh)));
      });
      scene?.setChapter(c, locals);
      const a = Math.round(c);
      if (a !== lastActive) {
        lastActive = a;
        setActive(a);
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (tcRef.current) tcRef.current.textContent = timecode(p);
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`;
    };
    lenis.on("scroll", () => {
      ScrollTrigger.update();
      onScroll();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // --- Pointer: parallax + custom cursor ---
    const cursor = cursorRef.current!;
    const cx = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
    const cy = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
    const onMove = (e: PointerEvent) => {
      scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      if (finePointer) {
        cursor.classList.add("is-visible");
        cx(e.clientX);
        cy(e.clientY);
      }
    };
    const onOver = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest("a, button, [data-cursor]");
      cursor.classList.toggle("is-link", !!t);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerover", onOver);
    const onResize = () => scene?.resize();
    window.addEventListener("resize", onResize);

    // --- In-page anchors go through Lenis ---
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const target = document.querySelector(a.getAttribute("href")!);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    };
    el.addEventListener("click", onClick);

    // --- Choreography ---
    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ paused: true });
      const counter = { v: 0 };

      if (reduced) {
        gsap.set(".preloader", { autoAlpha: 0 });
      } else {
        intro
          .to(counter, {
            v: 100,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
              const n = el.querySelector(".pre-count");
              if (n) n.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          })
          .to(".pre-count, .pre-label", { yPercent: -110, duration: 0.6, ease: "power3.in", stagger: 0.05 })
          .to(".pre-bar-top", { yPercent: -100, duration: 1.2, ease: "expo.inOut" }, "-=0.1")
          .to(".pre-bar-bottom", { yPercent: 100, duration: 1.2, ease: "expo.inOut" }, "<")
          .set(".preloader", { autoAlpha: 0 });
      }

      intro.call(() => {
        scene?.fadeIn();
        lenis.start();
        setLoaded(true);
      }, [], reduced ? 0 : 2.3);

      // Hero title: characters rise out of a mask.
      el.querySelectorAll<HTMLElement>("[data-hero-split]").forEach((line, i) => {
        SplitText.create(line, {
          type: "chars",
          mask: "chars",
          charsClass: "sc",
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.chars, {
              yPercent: 115,
              rotate: 6,
              duration: reduced ? 0 : 1.4,
              ease: "expo.out",
              stagger: 0.045,
              delay: reduced ? 0 : 2.35 + i * 0.12,
            });
          },
        });
      });
      gsap.from("[data-hero-fade]", { autoAlpha: 0, y: 20, duration: 1.2, ease: "power3.out", delay: reduced ? 0 : 2.9, stagger: 0.1 });

      // Hero recedes like a dolly-out as the first scene arrives.
      if (!reduced) {
        gsap.to(".hero-name", {
          yPercent: -18,
          scale: 0.92,
          filter: "blur(6px)",
          autoAlpha: 0.15,
          ease: "none",
          scrollTrigger: { trigger: ".scene-hero", start: "top top", end: "bottom top", scrub: true },
        });
      }

      // Section headlines and statements: line-by-line mask reveal.
      el.querySelectorAll<HTMLElement>("[data-split]").forEach((node) => {
        SplitText.create(node, {
          type: "lines",
          mask: "lines",
          linesClass: "sl",
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 105,
              duration: reduced ? 0 : 1.25,
              ease: "expo.out",
              stagger: 0.09,
              scrollTrigger: { trigger: node, start: "top 85%", once: true },
            });
          },
        });
      });

      // Generic fade-up.
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((node) => {
        gsap.from(node, {
          autoAlpha: 0,
          y: reduced ? 0 : 36,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: node, start: "top 88%", once: true },
        });
      });

      // Count-ups.
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((node) => {
        const end = Number(node.dataset.count);
        const o = { v: 0 };
        gsap.to(o, {
          v: end,
          duration: reduced ? 0 : 2,
          ease: "power3.out",
          onUpdate: () => {
            node.textContent = Math.round(o.v).toLocaleString();
          },
          scrollTrigger: { trigger: node, start: "top 90%", once: true },
        });
      });

      // Slug lines draw across.
      gsap.utils.toArray<HTMLElement>(".slug-line").forEach((node) => {
        gsap.from(node, {
          scaleX: 0,
          duration: 1.4,
          ease: "expo.inOut",
          scrollTrigger: { trigger: node, start: "top 90%", once: true },
        });
      });

      // Marquee driven by scroll, with a little extra push from scroll velocity.
      const track = el.querySelector<HTMLElement>("[data-marquee]");
      if (track && !reduced) {
        gsap.fromTo(
          track,
          { xPercent: 0 },
          {
            xPercent: -50,
            ease: "none",
            scrollTrigger: { trigger: "#toolkit", start: "top bottom", end: "bottom top", scrub: 0.6 },
          },
        );
      }

      if (finePointer && !reduced) {
        // Magnetic email link.
        el.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((node) => {
          const mx = gsap.quickTo(node, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
          const my = gsap.quickTo(node, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
          node.addEventListener("pointermove", (e) => {
            const r = node.getBoundingClientRect();
            mx((e.clientX - (r.left + r.width / 2)) * 0.18);
            my((e.clientY - (r.top + r.height / 2)) * 0.3);
          });
          node.addEventListener("pointerleave", () => {
            mx(0);
            my(0);
          });
        });
      }

      // Start the intro once fonts are in and the scene has had a chance to compile.
      Promise.all([document.fonts?.ready, sceneReady]).finally(() => {
        if (!disposed) intro.play();
      });
    }, el);

    onScroll();

    return () => {
      disposed = true;
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      el.removeEventListener("click", onClick);
      scene?.dispose();
    };
  }, []);

  const jump = (id: string) => {
    const t = document.getElementById(id);
    if (t) lenisRef.current?.scrollTo(t, { duration: 2.2, easing: (x) => 1 - Math.pow(1 - x, 4) });
  };

  return (
    <div ref={root} className={`film ${loaded ? "is-loaded" : ""}`}>
      <canvas ref={canvas} className="film-canvas" aria-hidden="true" />

      {/* Preloader — letterbox bars part like a curtain */}
      <div className="preloader" aria-hidden="true">
        <div className="pre-bar pre-bar-top" />
        <div className="pre-bar pre-bar-bottom" />
        <div className="pre-center">
          <div className="pre-mask">
            <span className="pre-label mono">Yuhao Cheng — reel 2026</span>
          </div>
          <div className="pre-mask">
            <span className="pre-count">000</span>
          </div>
        </div>
      </div>

      {/* HUD */}
      <header className="hud hud-top">
        <a href="#top" className="hud-mark" data-cursor="link" aria-label="Back to top">
          <span className="hud-mark-glyph" aria-hidden="true">
            YC
          </span>
          <span className="hud-mark-name">{profile.name}</span>
        </a>
        <nav className="hud-nav mono" aria-label="Primary">
          <a href="#research" className="ulink">
            Research
          </a>
          <a href="#industry" className="ulink">
            Industry
          </a>
          <a href="#works" className="ulink">
            Publications
          </a>
          <a href="/photography" className="ulink hide-sm">
            Photography
          </a>
          <a href="#contact" className="hud-cta">
            Contact
          </a>
        </nav>
      </header>

      <div className="hud hud-bottom mono" aria-hidden="true">
        <div className="hud-tc">
          <span className="rec-dot" />
          <span ref={tcRef}>00:00:00:00</span>
          <span className="dim hide-sm">
            SC {String(active).padStart(2, "0")} · {chapters[active]?.label}
          </span>
        </div>
        <div className="hud-coords dim hide-sm">{profile.coords}</div>
        <div className="hud-progress">
          <span ref={progressRef} />
        </div>
      </div>

      <nav className="chapter-rail" aria-label="Chapters">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`rail-tick ${i === active ? "is-active" : ""}`}
            onClick={() => jump(c.id)}
            aria-label={c.label}
            aria-current={i === active ? "step" : undefined}
          >
            <span className="rail-label mono">{c.label}</span>
            <span className="rail-line" />
          </button>
        ))}
      </nav>

      <div ref={cursorRef} className="cursor" aria-hidden="true" />

      <Sections />
    </div>
  );
}
