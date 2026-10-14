import * as THREE from "three";
import { C, M, clamp01, fontStack, plinth, roundRect, smooth, type CanvasPlane, type Station } from "./kit";
import { IM, desktop, drawApp, easeOut, iso, laptop, lerp, win, type V3 } from "./iso";

/**
 * visibilityx.ai — the dashboard studio, built as the reader scrolls.
 *
 * Twelve loose component modules (the copy-pasted widgets, ~2,000 duplicated
 * lines) fly in and lock into a modular rack — the shared component library.
 * Patch cables are run from the rack to every consumer: the team's wall
 * display, an exec's desktop, a marketer's and an analyst's laptop, and two
 * physical chart sculptures (sessions / day bars, traffic-source donut).
 * Each screen boots, shows skeletons while it loads, then draws its charts;
 * the median-load rail drops from 2.4 s to 1.6 s and the whole studio goes
 * live (cables turn accent, LEDs green, the CI badge passes).
 */

// Model units: 1 = 5 mm. Origin at the plinth centre; x across, y front (+y), z up.
const S = 0.026;
const Y = 0.66;

// ── data (the chapter's numbers) ──
const SCORE = Array.from({ length: 30 }, (_, i) => {
  const x = i / 29;
  return 65.5 + 16.9 * Math.pow(x, 0.85) + 2.1 * Math.sin(i * 1.7) * (1 - x * 0.7);
});
SCORE[29] = 82.4;
const SESS = [42, 55, 48, 61, 58, 72, 66, 70, 64, 80, 77, 86, 82, 94];
const SHARES = [0.42, 0.24, 0.2, 0.14];
const SOURCES = ["Organic", "Referral", "Social", "Direct"];
const SRC_COL = ["#2b2b31", C.accent, "#9a968e", "#cfcac0"];
const MODULES: [string, string][] = [
  ["KpiCard", "kpi"], ["LineChart", "line"], ["BarChart", "bars"], ["DonutChart", "donut"],
  ["DataTable", "table"], ["DateRange", "date"], ["FilterBar", "filter"], ["Paginator", "pager"],
  ["ExportCsv", "export"], ["useFetch", "fn"], ["useCache", "fn"], ["useLazyChart", "fn"],
];

// ── canvas helpers ──
const MUTED = "#7a776f";
const SKEL = "#e6e3dc";
type Ctx = CanvasRenderingContext2D;

function txt(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, font: "mono" | "sans" | "serif" = "mono", align: CanvasTextAlign = "left", weight = 500) {
  ctx.font = `${font === "serif" ? 400 : weight} ${Math.round(size)}px ${fontStack(font)}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}

function skeleton(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = SKEL;
  const r = h * 0.03;
  roundRect(ctx, x, y, w * 0.32, h * 0.12, r);
  ctx.fill();
  roundRect(ctx, x, y + h * 0.18, w * 0.2, h * 0.07, r);
  ctx.fill();
  roundRect(ctx, x, y + h * 0.34, w, h * 0.66, r);
  ctx.fill();
  ctx.fillStyle = "#d9d5cc";
  roundRect(ctx, x + w * 0.04, y + h * 0.42, w * 0.18, h * 0.04, r);
  ctx.fill();
}

function lineChart(ctx: Ctx, x: number, y: number, w: number, h: number, p: number, lw: number) {
  ctx.strokeStyle = "rgba(36,36,42,0.1)";
  ctx.lineWidth = Math.max(1, lw * 0.3);
  for (let i = 0; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / 3);
    ctx.lineTo(x + w, y + (h * i) / 3);
    ctx.stroke();
  }
  const px = (i: number) => x + (i / 29) * w;
  const py = (v: number) => y + h - ((v - 60) / 28) * h;
  const n = p * 29;
  const last = Math.floor(n);
  const ex = px(n), ey = py(last >= 29 ? SCORE[29] : lerp(SCORE[last], SCORE[last + 1], n - last));
  ctx.beginPath();
  ctx.moveTo(px(0), py(SCORE[0]));
  for (let i = 1; i <= last; i++) ctx.lineTo(px(i), py(SCORE[i]));
  ctx.lineTo(ex, ey);
  ctx.lineTo(ex, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,90,31,0.09)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px(0), py(SCORE[0]));
  for (let i = 1; i <= last; i++) ctx.lineTo(px(i), py(SCORE[i]));
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(ex, ey, lw * 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function barChart(ctx: Ctx, x: number, y: number, w: number, h: number, p: number) {
  const n = SESS.length, gap = w / n, bw = gap * 0.62;
  ctx.fillStyle = "rgba(36,36,42,0.1)";
  ctx.fillRect(x, y + h, w, Math.max(1, h * 0.01));
  for (let i = 0; i < n; i++) {
    const e = easeOut(clamp01(p * 1.7 - i * 0.05));
    const bh = (SESS[i] / 94) * h * e;
    ctx.fillStyle = i === n - 1 ? C.accent : C.ink;
    ctx.fillRect(x + i * gap + (gap - bw) / 2, y + h - bh, bw, bh);
  }
}

function donutChart(ctx: Ctx, cx: number, cy: number, r: number, p: number) {
  let a = -Math.PI / 2;
  ctx.lineWidth = r * 0.42;
  ctx.lineCap = "butt";
  const total = easeOut(p) * Math.PI * 2;
  let used = 0;
  SHARES.forEach((s, i) => {
    const len = Math.min(s * Math.PI * 2, Math.max(0, total - used));
    used += s * Math.PI * 2;
    if (len <= 0) return;
    ctx.strokeStyle = SRC_COL[i];
    ctx.beginPath();
    ctx.arc(cx, cy, r, a + 0.02, a + Math.max(0.03, len - 0.02));
    ctx.stroke();
    a += s * Math.PI * 2;
  });
}

function legend(ctx: Ctx, x: number, y: number, size: number, rowH: number) {
  SOURCES.forEach((s, i) => {
    ctx.fillStyle = SRC_COL[i];
    ctx.fillRect(x, y + i * rowH - size * 0.75, size * 0.8, size * 0.8);
    txt(ctx, s, x + size * 1.3, y + i * rowH, size, C.ink, "sans");
    txt(ctx, `${Math.round(SHARES[i] * 100)}%`, x + size * 9, y + i * rowH, size, MUTED, "mono", "right");
  });
}

function screenOff(ctx: Ctx, W: number, H: number) {
  ctx.fillStyle = "#141417";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255,255,255,0.07)");
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

type Body = (ctx: Ctx, x: number, y: number, w: number, h: number, p: number, sec: number) => void;
const SKEL_END = 0.24;
const phase = (p: number) => clamp01((p - SKEL_END) / (1 - SKEL_END));

// The team wall: the 30-day visibility score.
const wallBody: Body = (ctx, x, y, w, h, p, sec) => {
  if (p < SKEL_END) return skeleton(ctx, x, y, w, h);
  const q = phase(p), u = h / 100;
  txt(ctx, "VISIBILITY SCORE · 30 D", x, y + 7 * u, 3.8 * u, MUTED);
  txt(ctx, (82.4 * easeOut(Math.min(1, q * 1.3))).toFixed(1), x, y + 30 * u, 24 * u, C.ink, "serif");
  txt(ctx, "MEDIAN LOAD", x, y + 45 * u, 4 * u, MUTED);
  txt(ctx, `${sec.toFixed(1)} s`, x, y + 56 * u, 9 * u, sec < 1.65 ? C.accent : C.ink, "mono");
  txt(ctx, "SHARED COMPONENTS", x, y + 69 * u, 4 * u, MUTED);
  txt(ctx, "12", x, y + 80 * u, 9 * u, C.ink, "mono");
  lineChart(ctx, x + w * 0.3, y + 6 * u, w * 0.68, h * 0.86, q, 1.1 * u);
};

// The exec's desktop: KPI cards over the sessions trend.
const execBody: Body = (ctx, x, y, w, h, p, sec) => {
  if (p < SKEL_END) return skeleton(ctx, x, y, w, h);
  const q = phase(p), u = h / 100, cw = (w - 8 * u) / 3;
  const kpis: [string, string][] = [["SCORE", (82.4 * easeOut(Math.min(1, q * 1.3))).toFixed(1)], ["COMPONENTS", "12"], ["LOAD", `${sec.toFixed(1)} s`]];
  kpis.forEach(([k, v], i) => {
    const cx = x + i * (cw + 4 * u);
    ctx.fillStyle = "#ebe8e1";
    roundRect(ctx, cx, y, cw, 30 * u, 3 * u);
    ctx.fill();
    txt(ctx, k, cx + 3 * u, y + 9 * u, 5 * u, MUTED);
    txt(ctx, v, cx + 3 * u, y + 24 * u, 11 * u, i === 2 && sec < 1.65 ? C.accent : C.ink, i === 0 ? "serif" : "mono");
  });
  barChart(ctx, x, y + 38 * u, w, 58 * u, q);
};

// The marketer's laptop: traffic sources.
const marketBody: Body = (ctx, x, y, w, h, p) => {
  if (p < SKEL_END) return skeleton(ctx, x, y, w, h);
  const q = phase(p), u = h / 100;
  txt(ctx, "TRAFFIC SOURCES", x, y + 8 * u, 6 * u, MUTED);
  donutChart(ctx, x + 26 * u, y + 56 * u, 26 * u, q);
  legend(ctx, x + w * 0.52, y + 34 * u, 6.4 * u, 15 * u);
};

// The analyst's laptop: sessions per day plus the raw rows.
const analystBody: Body = (ctx, x, y, w, h, p) => {
  if (p < SKEL_END) return skeleton(ctx, x, y, w, h);
  const q = phase(p), u = h / 100;
  txt(ctx, "SESSIONS / DAY", x, y + 8 * u, 6 * u, MUTED);
  barChart(ctx, x, y + 14 * u, w, 44 * u, q);
  for (let r = 0; r < 4; r++) {
    const ry = y + 66 * u + r * 9 * u;
    ctx.fillStyle = r % 2 ? "#f4f2ee" : "#ebe8e1";
    ctx.fillRect(x, ry - 6 * u, w, 9 * u);
    if (q > 0.3 + r * 0.15) {
      txt(ctx, `day ${14 - r}`, x + 2 * u, ry, 5 * u, MUTED);
      const bw = (SESS[13 - r] / 94) * w * 0.5;
      ctx.fillStyle = r === 0 ? C.accent : C.ink;
      ctx.fillRect(x + w - 2 * u - bw, ry - 3.6 * u, bw, 3 * u);
    }
  }
};

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dashboards(): Station {
  const g = new THREE.Group();
  g.add(plinth(20, 13));
  const I = iso(S);
  const mdl = new THREE.Group();
  mdl.position.set(0, Y, 0);
  g.add(mdl);
  const { part, solid, face, cable } = I;
  const rand = rng(17);

  // ── the component rack (front centre) ──
  solid(-124, -10, 0, 248, 50, 12, IM.dark, mdl);
  solid(-116, 0, 12, 232, 4, 136, IM.board, mdl);
  solid(-116, 0, 12, 6, 30, 136, IM.dark, mdl);
  solid(110, 0, 12, 6, 30, 136, IM.dark, mdl);
  solid(-110, 0, 142, 220, 30, 6, IM.dark, mdl);
  solid(-110, 0, 12, 220, 30, 6, IM.dark, mdl);
  for (const z of [58.3, 99.6]) part(-110, 4, z, 220, 26, 1.2, IM.inner, mdl);
  for (let c = 1; c < 4; c++) part(-110 + c * 55 - 0.6, 4, 18, 1.2, 2, 124, IM.inner, mdl);
  // header plate with the library counter
  solid(-116, 20, 148, 232, 10, 20, IM.dark, mdl);
  const header = face(226, 16, 6, () => {});
  header.mesh.position.copy(I.at(0, 30.05, 158));
  mdl.add(header.mesh);
  const rackLed = part(104, 30, 156, 4, 0.5, 4, IM.ledOff, mdl);
  // CI badge on the base
  const ci = face(220, 9, 7, (ctx, k, W, H) => {
    ctx.fillStyle = "#2b2b31";
    ctx.fillRect(0, 0, W, H);
    txt(ctx, "VITEST · 180+ UNIT TESTS · 80 % LINE COVERAGE · CI ON EVERY PR", 4 * k, H * 0.68, 4.2 * k, "#bdb9b0");
  });
  ci.mesh.position.copy(I.at(-6, 40.05, 6));
  mdl.add(ci.mesh);
  const ciLed = part(110, 40, 4, 4, 0.5, 4, IM.ledOff, mdl);
  // ports where the patch cables leave the base
  part(-126, 18, 0, 2, 14, 6, IM.inner, mdl);
  part(124, 2, 0, 2, 24, 6, IM.inner, mdl);
  for (const x of [-46, -6, 34]) part(x, -12, 0, 12, 2, 6, IM.inner, mdl);

  let lastHeader = -1;
  const drawHeader = (n: number) => {
    header.draw((ctx, W, H) => {
      const k = 6;
      ctx.fillStyle = "#2b2b31";
      ctx.fillRect(0, 0, W, H);
      txt(ctx, "SHARED COMPONENT LIBRARY", 3 * k, H * 0.66, 6 * k, "#d9d6cf");
      txt(ctx, `${n} / 12`, 112 * k, H * 0.66, 6 * k, n === 12 ? "#ffffff" : "#8a877f");
      const lines = Math.round((n / 12) * 200) * 10;
      txt(ctx, `−${lines.toLocaleString("en-US")} DUPLICATED LINES`, 212 * k, H * 0.66, 5 * k, n === 12 ? C.accent : "#8a877f", "mono", "right");
    });
  };

  // ── the twelve modules ──
  const MW = 52, MD = 24, MH = 38;
  const modules = MODULES.map(([name, kind], i) => {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.copy(I.at(-MW / 2, -MD / 2, -MH / 2));
    outer.add(inner);
    mdl.add(outer);
    solid(0, 0, 0, MW, MD, MH, M.clay, inner);
    const f = face(MW - 2, MH - 2, 6, (ctx, k, W, H) => {
      ctx.fillStyle = "#ebe8e1";
      ctx.fillRect(0, 0, W, H);
      const fn = kind === "fn";
      txt(ctx, fn ? "composable" : "<component>", 3 * k, 7 * k, 3.4 * k, MUTED);
      txt(ctx, name, 3 * k, 15 * k, 5.4 * k, C.ink, "sans", "left", 600);
      // icon area
      const ix = 3 * k, iy = 19 * k, iw = W - 6 * k, ih = H - 22 * k;
      ctx.fillStyle = "#dcd8cf";
      roundRect(ctx, ix, iy, iw, ih, k);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.ink;
      ctx.lineWidth = 0.6 * k;
      const cx = ix + iw / 2, cy = iy + ih / 2;
      if (kind === "line") {
        ctx.beginPath();
        [0.1, 0.55, 0.3, 0.7, 0.45, 0.85].forEach((v, j) => ctx.lineTo(ix + 3 * k + (j / 5) * (iw - 6 * k), iy + ih - 2 * k - v * (ih - 4 * k)));
        ctx.stroke();
      } else if (kind === "bars") {
        for (let j = 0; j < 6; j++) {
          const bh = (0.3 + 0.12 * j) * (ih - 4 * k);
          ctx.fillStyle = j === 5 ? C.accent : C.ink;
          ctx.fillRect(ix + 4 * k + j * 6.5 * k, iy + ih - 2 * k - bh, 4 * k, bh);
        }
      } else if (kind === "donut") {
        ctx.lineWidth = 2.4 * k;
        ctx.beginPath();
        ctx.arc(cx, cy, ih * 0.32, -1.5, 2.6);
        ctx.stroke();
        ctx.strokeStyle = C.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, ih * 0.32, 2.7, 4.7);
        ctx.stroke();
      } else if (kind === "kpi") {
        txt(ctx, "82.4", ix + 3 * k, iy + ih - 3 * k, 8 * k, C.ink, "serif");
      } else if (kind === "table" || kind === "filter" || kind === "pager") {
        const rows = kind === "table" ? 3 : 1;
        for (let r = 0; r < rows; r++) ctx.fillRect(ix + 3 * k, iy + 2.6 * k + r * 3.6 * k, iw - 6 * k, 1.6 * k);
        if (kind === "pager") for (let j = 0; j < 5; j++) ctx.fillRect(ix + 4 * k + j * 8 * k, iy + ih - 6 * k, 5 * k, 4 * k);
        if (kind === "filter") for (let j = 0; j < 3; j++) { roundRect(ctx, ix + 3 * k + j * 13 * k, iy + ih - 7 * k, 11 * k, 4.4 * k, 2 * k); ctx.fill(); }
      } else if (kind === "date") {
        for (let r = 0; r < 2; r++) for (let j = 0; j < 7; j++) ctx.fillRect(ix + 3 * k + j * 5.7 * k, iy + 3 * k + r * 5 * k, 4 * k, 3.4 * k);
      } else if (kind === "export") {
        ctx.beginPath();
        ctx.moveTo(cx, iy + 2 * k);
        ctx.lineTo(cx, iy + ih - 4 * k);
        ctx.moveTo(cx - 3 * k, iy + ih - 7 * k);
        ctx.lineTo(cx, iy + ih - 4 * k);
        ctx.lineTo(cx + 3 * k, iy + ih - 7 * k);
        ctx.stroke();
      } else {
        txt(ctx, "( ) =>", ix + 3 * k, iy + ih - 3.5 * k, 6 * k, C.ink, "mono");
      }
    });
    f.mesh.position.copy(I.at(MW / 2, MD + 0.05, MH / 2));
    inner.add(f.mesh);
    const led = part(MW - 6, MD, MH - 6, 3, 0.5, 3, IM.ledOff, inner);
    const col = i % 4, row = Math.floor(i / 4);
    const slot: V3 = [-110 + col * 55 + 1.5 + MW / 2, 4 + MD / 2, 18 + (2 - row) * 41.33 + 1.6 + MH / 2];
    const start: V3 = [(rand() - 0.5) * 660, -40 + rand() * 260, 170 + rand() * 210];
    const rot: V3 = [(rand() - 0.5) * 3, (rand() - 0.5) * 3, (rand() - 0.5) * 3];
    return { outer, led, slot, start, rot, a: 0.02 + i * 0.028, ph: rand() * 6 };
  });

  // ── the team wall display (back centre) ──
  solid(-70, -250, 0, 140, 50, 6, IM.dark, mdl);
  solid(-14, -240, 6, 28, 20, 190, IM.dark, mdl);
  solid(-170, -220, 190, 340, 12, 190, IM.dark, mdl);
  const wall = face(330, 176, 4, (ctx, _k, W, H) => screenOff(ctx, W, H));
  wall.mesh.position.copy(I.at(0, -207.95, 199 + 88));
  mdl.add(wall.mesh);
  const wallLed = part(156, -208, 192.5, 4, 0.5, 2.5, IM.ledOff, mdl);

  // ── chart sculptures (back left / back right) ──
  const BOARD_H = 210;
  const boardFace = (x0: number, title: string, extra?: (ctx: Ctx, k: number, W: number, H: number) => void) => {
    solid(x0, -225, 0, 170, 8, BOARD_H, M.clay, mdl);
    solid(x0, -215, 0, 170, 70, 10, IM.dark, mdl);
    const f = face(166, BOARD_H - 4, 3, (ctx, k, W, H) => {
      ctx.fillStyle = "#eeebe5";
      ctx.fillRect(0, 0, W, H);
      txt(ctx, title, 5 * k, 14 * k, 8 * k, MUTED);
      extra?.(ctx, k, W, H);
    });
    f.mesh.position.copy(I.at(x0 + 85, -216.95, BOARD_H / 2));
    mdl.add(f.mesh);
  };
  const zTop = BOARD_H - 2; // canvas top edge in model z
  boardFace(-370, "SESSIONS / DAY", (ctx, k, W) => {
    ctx.strokeStyle = "rgba(36,36,42,0.12)";
    ctx.lineWidth = 2;
    for (let q = 0; q <= 4; q++) {
      const yy = (zTop - (10 + (130 * q) / 4)) * k;
      ctx.beginPath();
      ctx.moveTo(5 * k, yy);
      ctx.lineTo(W - 5 * k, yy);
      ctx.stroke();
    }
    txt(ctx, "14 DAYS", 5 * k, 26 * k, 6 * k, C.accent);
  });
  boardFace(200, "TRAFFIC SOURCES", (ctx, k) => {
    SOURCES.forEach((s, i) => {
      const lx = 5 * k + (i % 2) * 80 * k, ly = (24 + Math.floor(i / 2) * 11) * k;
      ctx.fillStyle = SRC_COL[i];
      ctx.fillRect(lx, ly - 5 * k, 5 * k, 5 * k);
      txt(ctx, `${s.toUpperCase()} ${Math.round(SHARES[i] * 100)}`, lx + 8 * k, ly, 6 * k, C.ink);
    });
  });
  // bars: one geometry of height 1, scaled
  const bars = SESS.map((_, i) => part(-362 + i * 11, -200, 10, 8, 16, 1, i === SESS.length - 1 ? M.accent : IM.dark, mdl, { shadow: true, edges: true }));
  bars.forEach((b) => (b.visible = false));
  // donut: four extruded ring segments, standing up and facing front
  const DC: V3 = [285, -200, 100];
  solid(279, -200, 10, 12, 12, 32, IM.dark, mdl);
  const segMats = [IM.dark, M.accent, M.steel, M.stone];
  let acc = 0;
  const segs = SHARES.map((s, i) => {
    const a0 = Math.PI / 2 - acc * Math.PI * 2 - 0.025;
    const a1 = Math.PI / 2 - (acc + s) * Math.PI * 2 + 0.025;
    acc += s;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 58 * S, a1, a0, false);
    shape.absarc(0, 0, 34 * S, a0, a1, true);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 14 * S, bevelEnabled: false, curveSegments: 40 });
    const m = new THREE.Mesh(geo, segMats[i]);
    m.castShadow = true;
    m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), i >= 2 ? IM.edgeLight : IM.edgeDark));
    m.visible = false;
    mdl.add(m);
    const mid = (a0 + a1) / 2;
    return { m, dx: Math.cos(mid), dz: Math.sin(mid) };
  });

  // ── the users ──
  const exec = desktop(I, -365, 95, 0, mdl, { ppu: 6, title: "exec · overview" });
  const lap1 = laptop(I, 190, 110, 0, mdl, { ppu: 8, title: "marketing · traffic" });
  const lap2 = laptop(I, 290, 110, 0, mdl, { ppu: 8, title: "analyst · sessions" });
  const lapLeds = [lap1, lap2].map((l) => part(58, 46, 0.8, 3, 0.4, 1, IM.ledOff, l.group));
  lap1.setOpen(0);
  lap2.setOpen(0);
  // desk name plates
  const plate = (x: number, y: number, who: string) => {
    solid(x, y, 0, 44, 4, 12, M.clay, mdl);
    const f = face(42, 10, 8, (ctx, k, W, H) => {
      ctx.fillStyle = "#ebe8e1";
      ctx.fillRect(0, 0, W, H);
      txt(ctx, who, W / 2, H * 0.68, 4.6 * k, C.ink, "mono", "center");
    });
    f.mesh.position.copy(I.at(x + 22, y + 4.05, 6));
    mdl.add(f.mesh);
  };
  plate(-330, 192, "EXEC");
  plate(201, 172, "MARKETING");
  plate(301, 172, "ANALYST");

  // ── the median-load rail (front) ──
  solid(-180, 200, 0, 360, 22, 16, IM.dark, mdl);
  part(-40, 204, 16, 212, 14, 0.4, IM.board, mdl);
  for (const s of [1.6, 2.4]) part(-40 + (210 * s) / 2.4 - 0.6, 202, 16, 1.2, 18, 4, IM.inner, mdl);
  const fill = part(-40, 205, 16.4, 1, 12, 3, IM.inner, mdl, { shadow: true });
  const railLed = part(-177, 222, 6, 4, 0.5, 4, IM.ledOff, mdl);
  const rail = face(340, 12, 6, () => {});
  rail.mesh.position.copy(I.at(5, 222.05, 8));
  mdl.add(rail.mesh);
  let lastRail = -1;
  const drawRail = (sec: number, live: boolean) => {
    rail.draw((ctx, W, H) => {
      const k = 6;
      ctx.fillStyle = "#2b2b31";
      ctx.fillRect(0, 0, W, H);
      txt(ctx, "MEDIAN DASHBOARD LOAD", 3 * k, H * 0.66, 5 * k, "#d9d6cf");
      txt(ctx, "parallel REST · Pinia cache · lazy ECharts", 100 * k, H * 0.66, 4.2 * k, "#8a877f");
      txt(ctx, `2.4 s → ${sec.toFixed(1)} s`, 336 * k, H * 0.68, 6.4 * k, live ? C.accent : "#ffffff", "mono", "right");
    });
  };

  // ── patch cables, rack → every consumer ──
  const Z = 2;
  const runs: V3[][] = [
    [[0, -10, Z], [0, -190, Z], [0, -190, 9], [0, -218, 9], [0, -218, 192]], // wall
    [[-124, 25, Z], [-222, 25, Z], [-222, 93, Z], [-222, 93, 24]], // exec desktop
    [[124, 20, Z], [178, 20, Z], [178, 133, Z], [192, 133, Z]], // marketer laptop
    [[124, 8, Z], [272, 8, Z], [272, 133, Z], [292, 133, Z]], // analyst laptop
    [[-40, -10, Z], [-40, -120, Z], [-280, -120, Z], [-280, -147, Z]], // bars sculpture
    [[40, -10, Z], [40, -120, Z], [280, -120, Z], [280, -147, Z]], // donut sculpture
  ];
  const cables = runs.map((pts) => cable(pts, mdl, { corner: 6 }));
  const CW = (i: number) => 0.44 + i * 0.025;
  const CD = 0.07;
  const done = (i: number) => CW(i) + CD;
  const PULSES = 2;
  const pulses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.075, 0.075), M.glowAccent, cables.length * PULSES);
  pulses.count = 0;
  mdl.add(pulses);
  const dummy = new THREE.Object3D();
  const tmp = new THREE.Vector3();

  // ── screens ──
  type Scr = { plane: CanvasPlane; title: string; body: Body; on: number; key: number };
  const screens: Scr[] = [
    { plane: wall, title: "visibilityx · team wall", body: wallBody, on: done(0), key: -2 },
    { plane: exec.screen, title: "exec · overview", body: execBody, on: done(1), key: -2 },
    { plane: lap1.screen, title: "marketing · traffic", body: marketBody, on: done(2), key: -2 },
    { plane: lap2.screen, title: "analyst · sessions", body: analystBody, on: done(3), key: -2 },
  ];

  const LIVE = 0.9;
  return {
    group: g,
    focus: new THREE.Vector3(0, 4.3, -0.8),
    update(t, _dt, local) {
      const T = clamp01((local - 0.18) / 0.54);
      const live = T >= LIVE;

      // modules fly in and lock
      let locked = 0;
      for (const m of modules) {
        const u = win(T, m.a, 0.13);
        const [sx, sy, sz] = m.start, [tx, ty, tz] = m.slot;
        const py = ty + 100;
        let x: number, y: number, z: number, r: number;
        if (u < 0.62) {
          const v = smooth(0, 0.62, u);
          x = lerp(sx, tx, v);
          y = lerp(sy, py, v);
          z = lerp(sz, tz, v) + Math.sin(v * Math.PI) * 40 + Math.sin(t * 1.1 + m.ph) * 6 * (1 - u);
          r = 1 - v;
        } else {
          const v = smooth(0.62, 1, u);
          x = tx;
          y = lerp(py, ty, v);
          z = tz;
          r = 0;
        }
        m.outer.position.set(x * S, z * S, y * S);
        const spin = r > 0 ? t * 0.35 * r : 0;
        m.outer.rotation.set(m.rot[0] * r, m.rot[1] * r + spin, m.rot[2] * r);
        const ok = u >= 1;
        if (ok) locked++;
        m.led.material = ok ? M.glowGreen : IM.ledOff;
      }
      if (locked !== lastHeader) {
        lastHeader = locked;
        drawHeader(locked);
      }
      rackLed.material = locked === 12 ? M.glowGreen : IM.ledOff;

      // laptops open as the library completes
      lap1.setOpen(easeOut(win(T, 0.36, 0.1)));
      lap2.setOpen(easeOut(win(T, 0.4, 0.1)));

      // cables
      cables.forEach((c, i) => {
        c.reveal(win(T, CW(i), CD));
        c.live(live);
      });
      pulses.count = live ? cables.length * PULSES : 0;
      if (live) {
        cables.forEach((c, i) => {
          for (let q = 0; q < PULSES; q++) {
            const u = (t * 0.32 + q / PULSES + i * 0.17) % 1;
            c.curve.getPointAt(u, tmp);
            dummy.position.copy(tmp);
            dummy.scale.setScalar(0.5 + 0.7 * Math.sin(u * Math.PI));
            dummy.updateMatrix();
            pulses.setMatrixAt(i * PULSES + q, dummy.matrix);
          }
        });
        pulses.instanceMatrix.needsUpdate = true;
      }

      // load time
      const sec = 2.4 - 0.8 * smooth(0.55, 0.88, T);
      const L = (210 * sec) / 2.4;
      fill.scale.x = L;
      fill.position.x = (-40 + L / 2) * S;
      fill.material = live ? IM.cableOn : IM.inner;
      const rk = Math.round(sec * 10) * 2 + (live ? 1 : 0);
      if (rk !== lastRail) {
        lastRail = rk;
        drawRail(sec, live);
      }

      // screens: off → skeleton → charts
      for (const s of screens) {
        const on = T >= s.on;
        const p = on ? win(T, s.on, 0.16) : 0;
        const key = on ? Math.round(p * 48) * 100 + Math.round(sec * 10) : -1;
        if (key === s.key) continue;
        s.key = key;
        if (!on) s.plane.draw((ctx, W, H) => screenOff(ctx, W, H));
        else s.plane.draw((ctx, W, H) => drawApp(ctx, W, H, s.title, (c, x, y, w, h) => s.body(c, x, y, w, h, p, sec)));
      }
      exec.led.material = T >= screens[1].on ? M.glowGreen : IM.ledOff;
      lapLeds[0].material = T >= screens[2].on ? M.glowGreen : IM.ledOff;
      lapLeds[1].material = T >= screens[3].on ? M.glowGreen : IM.ledOff;
      wallLed.material = T >= screens[0].on ? M.glowGreen : IM.ledOff;
      railLed.material = live ? M.glowGreen : IM.ledOff;
      ciLed.material = live ? M.glowGreen : IM.ledOff;

      // bar sculpture
      const bStart = done(4);
      bars.forEach((b, i) => {
        const e = easeOut(win(T, bStart + i * 0.008, 0.1));
        const wob = live ? Math.sin(t * 1.4 + i * 0.9) * 2.2 : 0;
        const h = Math.max(0.01, (SESS[i] / 94) * 130 * e + wob * e);
        b.visible = e > 0;
        b.scale.y = h;
        b.position.y = (10 + h / 2) * S;
      });

      // donut sculpture
      const dStart = done(5);
      segs.forEach((sg, i) => {
        const e = easeOut(win(T, dStart + i * 0.025, 0.1));
        sg.m.visible = e > 0;
        const off = (1 - e) * 70;
        sg.m.position.set((DC[0] + sg.dx * off) * S, (DC[2] + sg.dz * off) * S, (DC[1] + (1 - e) * 60) * S);
        sg.m.rotation.z = (1 - e) * 0.6;
      });
    },
  };
}
