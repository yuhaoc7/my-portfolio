import * as THREE from "three";
import { C, M, clamp01, fontStack, plinth, roundRect, smooth, type Station } from "./kit";
import { IM, desktop, drawApp, easeOut, iso, laptop, lerp, win } from "./iso";

/**
 * PIR-Arena — proactive retrieval, built as a sorting machine beside the
 * user's desk. The user writes on a laptop; that context runs down a cable to
 * an LLM that writes a query on top of the tower. The corpus hopper releases
 * cards onto three vibrating sieve trays (BM25 → dense → cross-encoder
 * rerank); at every tray most cards slide off a chute into a reject bin and a
 * few drop through the slot. The one survivor lands in the dispatcher, rides a
 * pneumatic tube across the floor and up through the desk, and pops up on the
 * laptop as a suggestion while the user is still typing.
 */

// Model units: 1 = 5 mm. Model axes: x across, y front-to-back (front = +y), z up.
const S = 0.04;

// Tower
const CX = -105, CY = -135;
const TX0 = -142, TX1 = -68, TY0 = -170, TY1 = -100;
const TRAY = [206, 136, 66];
const BODY = 20;
const SIDE = [1, -1, 1]; // which side each stage rejects to
const HOP = [
  { x0: -58, z0: 146, z1: 200 },
  { x0: -184, z0: 76, z1: 130 },
  { x0: -58, z0: 10, z1: 60 },
];
const HY0 = -160, HD = 50;
const OUTLET_Z = 228;
const DISP_TOP = 40;

// Timeline (T)
const ON = [0.4, 0.52, 0.64];
const RUN = 0.12;
const OUT_ON = 0.76;
const DELIVER = 0.92;

const NAMES = ["BM25", "DENSE", "RERANK"];
const SUBS = ["lexical · top 1k", "bi-encoder · top 100", "cross-encoder · top 1"];
const COUNTS: [number, number][] = [[50000, 1000], [1000, 100], [100, 1]];
const REJECTS = ["−49,000", "−900", "−99"];

const DOC =
  "Most assistants wait to be asked. A proactive one has to decide when a need arises and what to surface from continuous context, before the user asks, so retrieval must be fast and precise. Dense passage retrieval";
const QUERY = "dense passage retrieval · cite";

const mono = () => fontStack("mono");
const sans = () => fontStack("sans");
const serif = () => fontStack("serif");

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, w: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const wd of words) {
    const next = line ? `${line} ${wd}` : wd;
    if (ctx.measureText(next).width > w && line) {
      lines.push(line);
      line = wd;
    } else line = next;
  }
  lines.push(line);
  return lines;
}

/* ------------------------------ screen faces ------------------------------ */

function drawReadout(ctx: CanvasRenderingContext2D, W: number, H: number, k: number, state: number, count: string, prog: number) {
  ctx.fillStyle = "#26262b";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#4a4a52";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  const p = H * 0.14;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#8d8a83";
  ctx.font = `500 ${H * 0.17}px ${mono()}`;
  ctx.fillText(`0${k + 1} / 03`, p, H * 0.3);
  ctx.fillStyle = "#ece9e2";
  ctx.font = `600 ${H * 0.27}px ${mono()}`;
  ctx.fillText(NAMES[k], p, H * 0.62);
  ctx.fillStyle = "#8d8a83";
  ctx.font = `500 ${H * 0.14}px ${mono()}`;
  ctx.fillText(SUBS[k], p, H * 0.84);
  ctx.textAlign = "right";
  ctx.fillStyle = state === 1 ? C.accent : state === 2 ? "#ece9e2" : "#5d5d66";
  ctx.font = `500 ${H * 0.4}px ${mono()}`;
  ctx.fillText(count, W - p, H * 0.6);
  ctx.fillStyle = state === 2 ? C.green : "#8d8a83";
  ctx.font = `500 ${H * 0.14}px ${mono()}`;
  ctx.fillText(state === 0 ? "STANDBY" : state === 1 ? "SCORING" : "PASS ▸ NEXT", W - p, H * 0.84);
  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(p, H - p * 0.55, W - 2 * p, p * 0.22);
  ctx.fillStyle = state === 2 ? C.green : C.accent;
  ctx.fillRect(p, H - p * 0.55, (W - 2 * p) * prog, p * 0.22);
}

function drawLLM(ctx: CanvasRenderingContext2D, W: number, H: number, chars: number, done: boolean) {
  ctx.fillStyle = "#26262b";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#4a4a52";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  const p = H * 0.12;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ece9e2";
  ctx.font = `600 ${H * 0.19}px ${mono()}`;
  ctx.fillText("LLM · QUERY GEN", p, H * 0.3);
  ctx.fillStyle = "#8d8a83";
  ctx.font = `500 ${H * 0.13}px ${mono()}`;
  ctx.fillText("ctx ← related-work.md ¶2 · live", p, H * 0.52);
  ctx.fillStyle = "#1b1b1f";
  ctx.fillRect(p * 0.6, H * 0.62, W - p * 1.2, H * 0.28);
  ctx.font = `500 ${H * 0.15}px ${mono()}`;
  ctx.fillStyle = C.accent;
  ctx.fillText("q>", p, H * 0.82);
  ctx.fillStyle = done ? "#ece9e2" : "#cfcac0";
  ctx.fillText(QUERY.slice(0, chars) + (done ? "" : "▍"), p + H * 0.36, H * 0.82);
}

function drawLaptop(ctx: CanvasRenderingContext2D, W: number, H: number, chars: number, pop: number, blink: boolean) {
  drawApp(ctx, W, H, "related-work.md — notes", (c, x, y, w, h) => {
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillStyle = "#24242a";
    c.font = `600 ${h * 0.075}px ${sans()}`;
    c.fillText("2.3  Retrieval for proactive assistants", x, y + h * 0.02);
    c.fillStyle = "#dedad2";
    for (let i = 0; i < 3; i++) {
      roundRect(c, x, y + h * 0.15 + i * h * 0.065, w * (i === 2 ? 0.58 : 0.97), h * 0.032, 3);
      c.fill();
    }
    c.font = `400 ${h * 0.062}px ${serif()}`;
    c.fillStyle = "#3a3a42";
    const lines = wrap(c, DOC.slice(0, chars), w * 0.97);
    const lh = h * 0.085;
    const y0 = y + h * 0.39;
    lines.forEach((l, i) => c.fillText(l, x, y0 + i * lh));
    if (blink) {
      const last = lines[lines.length - 1];
      c.fillStyle = C.ink;
      c.fillRect(x + c.measureText(last).width + 2, y0 + (lines.length - 1) * lh, 3, lh * 0.8);
    }
    if (pop <= 0) return;
    const cw = w * 0.6, ch = h * 0.52;
    const cx = x + w - cw + (1 - pop) * w * 0.12, cy = y + h - ch;
    c.globalAlpha = pop;
    c.fillStyle = "rgba(20,20,26,0.16)";
    roundRect(c, cx + 6, cy + 8, cw, ch, 14);
    c.fill();
    c.fillStyle = "#ffffff";
    roundRect(c, cx, cy, cw, ch, 14);
    c.fill();
    c.strokeStyle = "#e3dfd7";
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = C.accent;
    roundRect(c, cx, cy, 8, ch, 4);
    c.fill();
    const q = cx + ch * 0.12;
    c.fillStyle = C.accent;
    c.font = `600 ${ch * 0.085}px ${mono()}`;
    c.fillText("PROACTIVE · JUST NOW", q, cy + ch * 0.1);
    c.fillStyle = "#24242a";
    c.font = `600 ${ch * 0.12}px ${sans()}`;
    c.fillText("Dense Passage Retrieval", q, cy + ch * 0.25);
    c.fillText("for Open-Domain QA", q, cy + ch * 0.39);
    c.fillStyle = "#7a776f";
    c.font = `400 ${ch * 0.082}px ${sans()}`;
    c.fillText("Karpukhin et al., 2020 · in your library", q, cy + ch * 0.56);
    c.fillText("matches the sentence you're writing", q, cy + ch * 0.66);
    c.fillStyle = C.accent;
    roundRect(c, q, cy + ch * 0.8, cw * 0.26, ch * 0.13, ch * 0.065);
    c.fill();
    c.fillStyle = "#ffffff";
    c.font = `600 ${ch * 0.075}px ${sans()}`;
    c.textBaseline = "middle";
    c.textAlign = "center";
    c.fillText("Cite", q + cw * 0.13, cy + ch * 0.865);
    c.fillStyle = "#7a776f";
    c.fillText("Later", q + cw * 0.42, cy + ch * 0.865);
    c.globalAlpha = 1;
  });
}

const NEEDS = Array.from({ length: 22 }, (_, i) => ({ p: 0.03 + ((i * 0.618034) % 1) * 0.94, type: (i * 7) % 11 }));
const NEED_COL = Array.from({ length: 11 }, (_, i) => `hsl(${(i * 33 + 18) % 360} 38% 62%)`);
const METRICS: [string, number][] = [["precision", 0.82], ["recall", 0.7], ["relevance", 0.88], ["timeliness", 0.76]];

function drawArena(ctx: CanvasRenderingContext2D, W: number, H: number, play: number, metrics: number) {
  drawApp(ctx, W, H, "pir-arena — scene 17 / 34", (c, x, y, w, h) => {
    const lw = w * 0.6;
    const vh = h * 0.6;
    c.fillStyle = "#2b2b31";
    roundRect(c, x, y, lw, vh, 8);
    c.fill();
    c.fillStyle = "#3d3d45";
    roundRect(c, x + lw * 0.07, y + vh * 0.12, lw * 0.3, vh * 0.38, 4);
    c.fill();
    c.fillStyle = "#4a4a53";
    c.fillRect(x, y + vh * 0.72, lw, vh * 0.28);
    c.fillStyle = "#5b5b64";
    roundRect(c, x + lw * 0.56, y + vh * 0.34, lw * 0.15, vh * 0.42, 10);
    c.fill();
    c.beginPath();
    c.arc(x + lw * 0.635, y + vh * 0.24, vh * 0.09, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c9c6bf";
    c.fillRect(x + lw * 0.3, y + vh * 0.62, lw * 0.18, vh * 0.1);
    c.fillStyle = C.accent;
    c.beginPath();
    c.arc(x + lw * 0.06, y + vh * 0.88, vh * 0.035, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ece9e2";
    c.font = `500 ${vh * 0.075}px ${mono()}`;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText("CONTEXT STREAM · kitchen · 14:02", x + lw * 0.1, y + vh * 0.885);
    // timeline of need moments
    const ty = y + vh + h * 0.07, th = h * 0.13;
    c.fillStyle = "#e6e3dc";
    roundRect(c, x, ty, lw, th, 6);
    c.fill();
    for (const n of NEEDS) {
      c.fillStyle = NEED_COL[n.type];
      c.fillRect(x + n.p * lw - 3, ty + th * 0.2, 6, th * 0.6);
      if (n.p < play) {
        c.fillStyle = C.accent;
        c.beginPath();
        c.moveTo(x + n.p * lw, ty - 2);
        c.lineTo(x + n.p * lw - 6, ty - 12);
        c.lineTo(x + n.p * lw + 6, ty - 12);
        c.closePath();
        c.fill();
      }
    }
    c.fillStyle = C.ink;
    c.fillRect(x + play * lw - 1.5, ty - 4, 3, th + 8);
    c.fillStyle = "#7a776f";
    c.font = `500 ${h * 0.05}px ${mono()}`;
    c.textBaseline = "top";
    c.fillText("need moments · 11 types   ▲ surfaced", x, ty + th + h * 0.035);
    // metrics column
    const rx = x + lw + w * 0.05, rw = w - lw - w * 0.05;
    c.fillStyle = C.ink;
    c.font = `600 ${h * 0.075}px ${mono()}`;
    c.fillText("PIR-ARENA", rx, y + h * 0.01);
    c.fillStyle = "#7a776f";
    c.font = `500 ${h * 0.048}px ${mono()}`;
    c.fillText("34 scenes · 831 min", rx, y + h * 0.11);
    METRICS.forEach(([name, v], i) => {
      const my = y + h * 0.25 + i * h * 0.15;
      c.fillStyle = "#3a3a42";
      c.font = `500 ${h * 0.05}px ${mono()}`;
      c.fillText(name, rx, my);
      c.fillStyle = "#e6e3dc";
      roundRect(c, rx, my + h * 0.065, rw, h * 0.035, 4);
      c.fill();
      c.fillStyle = i === 3 ? C.accent : C.ink;
      roundRect(c, rx, my + h * 0.065, Math.max(8, rw * v * metrics), h * 0.035, 4);
      c.fill();
    });
    c.fillStyle = "#7a776f";
    c.font = `500 ${h * 0.045}px ${mono()}`;
    c.fillText("BM25 → dense → CE", rx, y + h * 0.88);
  });
}

/* --------------------------------- station -------------------------------- */

export function retrievalFunnel(): Station {
  const I = iso(S);
  const g = new THREE.Group();
  g.add(plinth(16, 16));
  const Y = 0.66;
  const model = new THREE.Group();
  model.position.y = Y;
  g.add(model);
  const rand = rng(8);

  // ── tower frame ──
  I.solid(-155, -183, 0, 100, 96, 5, IM.dark, model);
  for (const x of [-147, -68]) for (const y of [-175, -100]) I.solid(x, y, 5, 5, 5, 275, IM.dark, model);

  const builds: { grp: THREE.Group; a: number; d: number }[] = [];

  // ── corpus hopper + LLM query module ──
  const top = new THREE.Group();
  model.add(top);
  builds.push({ grp: top, a: 0, d: 0.1 });
  I.solid(TX0, TY0, 236, TX1 - TX0, TY1 - TY0, 4, M.clay, top);
  I.solid(TX0, TY0, 240, TX1 - TX0, 2, 40, M.clay, top);
  I.solid(TX0, TY0 + 2, 240, 2, TY1 - TY0 - 2, 40, M.clay, top);
  I.solid(TX1 - 2, TY0 + 2, 240, 2, TY1 - TY0 - 2, 40, M.clay, top);
  I.solid(TX0 + 2, TY1 - 2, 240, TX1 - TX0 - 4, 2, 22, M.clay, top);
  I.part(TX0 + 2, TY0 + 2, 240, TX1 - TX0 - 4, TY1 - TY0 - 4, 22, M.stone, top);
  I.solid(CX - 10, CY - 10, OUTLET_Z, 20, 20, 8, IM.dark, top);
  const corpus = I.face(66, 16, 10, (ctx, k, W, H) => {
    ctx.fillStyle = "#ebe8e1";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#7a776f";
    ctx.font = `500 ${3 * k}px ${mono()}`;
    ctx.fillText("CORPUS", 3 * k, 4.5 * k);
    ctx.fillStyle = C.ink;
    ctx.font = `600 ${6 * k}px ${sans()}`;
    ctx.fillText("50,000 docs", 3 * k, 10.5 * k);
    ctx.fillStyle = "#cfcac0";
    for (let i = 0; i < 18; i++) ctx.fillRect((42 + (i % 6) * 3.8) * k, (3 + Math.floor(i / 6) * 4) * k, 2.8 * k, 3.2 * k);
  });
  corpus.mesh.position.copy(I.at(CX, TY1 + 0.15, 251));
  top.add(corpus.mesh);
  I.solid(TX0 + 4, TY0, 280, 66, 28, 26, IM.dark, top);
  const llm = I.face(60, 18, 12, (ctx, _k, W, H) => drawLLM(ctx, W, H, 0, false));
  llm.mesh.position.copy(I.at(CX, TY0 + 28.15, 293));
  top.add(llm.mesh);
  const llmLed = I.part(TX0 + 64, TY0 + 28, 302, 2.4, 0.5, 2.4, IM.ledOff, top);
  // a heap of loose cards on top of the corpus
  const cardGeo = new THREE.BoxGeometry(10 * S, 0.8 * S, 14 * S);
  const heap = new THREE.InstancedMesh(cardGeo, M.clay, 30);
  heap.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < heap.count; i++) {
    dummy.position.set((TX0 + 8 + rand() * 58) * S, (262.5 + rand() * 1.5) * S, (-142 + rand() * 38) * S);
    dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
    dummy.updateMatrix();
    heap.setMatrixAt(i, dummy.matrix);
  }
  heap.castShadow = true;
  top.add(heap);

  // ── sieve trays ──
  const sieveGeo = new THREE.PlaneGeometry((TX1 - TX0 - 4) * S, (TY1 - TY0 - 4) * S);
  const stages = [0, 1, 2].map((k) => {
    const grp = new THREE.Group();
    model.add(grp);
    builds.push({ grp, a: 0.06 + k * 0.06, d: 0.1 });
    const tz = TRAY[k];
    I.solid(TX0, TY0, tz - BODY, TX1 - TX0, TY1 - TY0, BODY, IM.dark, grp);
    const pitch = [7, 5, 3.6][k];
    const sieve = I.face(TX1 - TX0 - 4, TY1 - TY0 - 4, 6, (ctx, u, W, H) => {
      ctx.fillStyle = "#3a3a40";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1f2024";
      for (let yy = pitch / 2; yy < H / u; yy += pitch)
        for (let xx = pitch / 2; xx < W / u; xx += pitch) {
          ctx.beginPath();
          ctx.arc(xx * u, yy * u, pitch * 0.26 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.fillStyle = "#111114";
      roundRect(ctx, W / 2 - 8 * u, H / 2 - 8 * u, 16 * u, 16 * u, 2 * u);
      ctx.fill();
    });
    sieve.mesh.rotation.x = -Math.PI / 2;
    sieve.mesh.position.copy(I.at(CX, CY, tz + 0.2));
    grp.add(sieve.mesh);
    I.solid(TX0, TY0, tz, TX1 - TX0, 2, 8, IM.dark, grp);
    I.solid(TX0, TY1 - 2, tz, TX1 - TX0, 2, 4, IM.dark, grp);
    I.solid(SIDE[k] > 0 ? TX0 : TX1 - 2, TY0 + 2, tz, 2, TY1 - TY0 - 4, 8, IM.dark, grp);
    const readout = I.face(60, 15, 12, (ctx, _u, W, H) => drawReadout(ctx, W, H, k, 0, COUNTS[k][0].toLocaleString("en-US"), 0));
    readout.mesh.position.copy(I.at(TX0 + 34, TY1 + 0.15, tz - BODY / 2));
    grp.add(readout.mesh);
    const led = I.part(TX1 - 8, TY1, tz - BODY / 2 - 1.5, 3, 0.5, 3, IM.ledOff, grp);

    // chute to the reject bin
    const h = HOP[k];
    const edge = SIDE[k] > 0 ? TX1 : TX0;
    const ex = edge + SIDE[k] * 18, dz = tz - h.z1;
    const L = Math.hypot(18, dz);
    const chute = I.part(0, 0, 0, L, 30, 1.2, M.stone, grp, { edges: true, shadow: true });
    chute.position.copy(I.at((edge + ex) / 2, CY, (tz + h.z1) / 2));
    chute.rotation.z = -SIDE[k] * Math.atan2(dz, 18);
    // reject bin
    const H = h.z1 - h.z0;
    I.solid(h.x0, HY0, h.z0, 32, HD, 3, IM.dark, grp);
    I.solid(h.x0, HY0, h.z0 + 3, 32, 2, H - 3, IM.dark, grp);
    I.solid(h.x0, HY0 + HD - 2, h.z0 + 3, 32, 2, H - 3, IM.dark, grp);
    I.solid(h.x0, HY0 + 2, h.z0 + 3, 2, HD - 4, H - 3, IM.dark, grp);
    I.solid(h.x0 + 30, HY0 + 2, h.z0 + 3, 2, HD - 4, H - 3, IM.dark, grp);
    I.part(SIDE[k] > 0 ? -63 : -152, CY - 6, h.z1 - 12, 5, 12, 8, IM.inner, grp);
    const pile = new THREE.Group();
    pile.position.copy(I.at(h.x0 + 2, HY0 + 2, h.z0 + 3));
    grp.add(pile);
    I.part(0, 0, 0, 28, HD - 4, 1, M.clay2, pile);
    pile.scale.y = 0.001;
    const tag = I.face(26, 9, 14, (ctx, u, W, Hh) => {
      ctx.fillStyle = "#26262b";
      ctx.fillRect(0, 0, W, Hh);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#8d8a83";
      ctx.font = `500 ${2.2 * u}px ${mono()}`;
      ctx.fillText("REJECT", W / 2, 2.6 * u);
      ctx.fillStyle = "#ece9e2";
      ctx.font = `600 ${3.4 * u}px ${mono()}`;
      ctx.fillText(REJECTS[k], W / 2, 6.3 * u);
    });
    tag.mesh.position.copy(I.at(h.x0 + 16, HY0 + HD + 0.15, h.z1 - 8));
    grp.add(tag.mesh);
    return { grp, tz, readout, led, pile, H, h, edge, key: "" };
  });

  // ── dispatcher ──
  const disp = new THREE.Group();
  model.add(disp);
  builds.push({ grp: disp, a: 0.22, d: 0.08 });
  I.solid(-125, -155, 5, 40, 40, DISP_TOP - 5, IM.dark, disp);
  I.part(-117, -147, DISP_TOP, 24, 24, 0.4, IM.board, disp);
  const dface = I.face(30, 10, 14, (ctx, u, W, H) => {
    ctx.fillStyle = "#26262b";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ece9e2";
    ctx.font = `600 ${3.4 * u}px ${mono()}`;
    ctx.fillText("OUT ▸ USER", 2 * u, H / 2);
  });
  dface.mesh.position.copy(I.at(-108, -114.85, 30));
  disp.add(dface.mesh);
  const dispLed = I.part(-91, -115, 28.5, 3, 0.5, 3, IM.ledOff, disp);
  I.part(-110, -115, 9, 10, 1.5, 10, IM.inner, disp);

  // ── the user's desk ──
  I.solid(-46, 50, 145, 238, 130, 5, M.clay2, model);
  I.solid(-44, 56, 0, 6, 118, 145, IM.dark, model);
  I.solid(184, 56, 0, 6, 118, 145, IM.dark, model);
  I.solid(-38, 52, 70, 222, 3, 70, IM.inner, model);
  I.part(-6, 60, 150, 8, 8, 0.6, IM.inner, model);
  I.part(11, 64, 150, 8, 8, 0.6, IM.inner, model);
  const lap = laptop(I, -34, 120, 150, model, { ppu: 14, title: "related-work.md — notes" });
  lap.group.rotation.y = -0.2;
  const dk = desktop(I, 30, 64, 150, model, { ppu: 10, title: "pir-arena" });

  // ── cables: context out (laptop → LLM), pneumatic tube back (dispatcher → laptop) ──
  const ctxCable = I.cable(
    [[15, 128, 153], [15, 68, 153], [15, 68, 3], [15, -92, 3], [-58, -92, 3], [-58, -92, 293], [-58, -150, 293], [-72, -150, 293]],
    model,
    { radius: 0.03, corner: 6 },
  );
  const tube = I.cable(
    [[-105, -115, 14], [-105, 40, 14], [-2, 40, 14], [-2, 64, 14], [-2, 64, 154], [-2, 124, 154]],
    model,
    { radius: 0.075, corner: 12 },
  );
  tube.mesh.material = IM.alu;

  const beadGeo = new THREE.BoxGeometry(2.6 * S, 2.6 * S, 2.6 * S);
  const beads = new THREE.InstancedMesh(beadGeo, M.glowAccent, 6);
  beads.frustumCulled = false;
  beads.count = 0;
  model.add(beads);

  // ── museum placard ──
  I.solid(-188, 125, 0, 106, 53, 15, M.clay, model);
  I.solid(-186, 125, 15, 102, 15, 22, M.clay, model);
  const plac = new THREE.Group();
  plac.position.copy(I.at(-135, 150, 30));
  plac.rotation.x = -1.0;
  model.add(plac);
  I.part(-52, -4, -27, 104, 4, 54, M.clay2, plac, { edges: true, shadow: true });
  const plaque = I.face(100, 50, 10, (ctx, k, W, H) => {
    ctx.fillStyle = "#f3f1ec";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#7a776f";
    ctx.font = `500 ${3.6 * k}px ${mono()}`;
    ctx.fillText("08 · PIR-ARENA · PROACTIVE RETRIEVAL", 5 * k, 9 * k);
    ctx.fillStyle = C.ink;
    ctx.font = `400 ${9.5 * k}px ${serif()}`;
    ctx.fillText("50,000 docs → 1 card", 5 * k, 22 * k);
    ctx.fillStyle = C.accent;
    ctx.font = `500 ${3.8 * k}px ${mono()}`;
    ctx.fillText("BM25 → DENSE → CROSS-ENCODER · 1.8 s p95", 5 * k, 31 * k);
    ctx.fillStyle = "#3a3a42";
    ctx.fillText("34 SCENES · 831 MIN · 11 NEED TYPES", 5 * k, 38 * k);
    ctx.fillStyle = "#cfcac0";
    ctx.fillRect(5 * k, 42 * k, 90 * k, 0.6 * k);
    for (let i = 0; i < 4; i++) ctx.fillRect((5 + i * 30) * k, 41 * k, 0.6 * k, 2.6 * k);
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(68 * k, 42.3 * k, 1.3 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a776f";
    ctx.font = `500 ${2.6 * k}px ${mono()}`;
    ctx.fillText("need ▸ shown at the right moment", 5 * k, 47.5 * k);
  });
  plaque.mesh.position.copy(I.at(0, 0.1, 0));
  plac.add(plaque.mesh);

  // ── documents in flight ──
  const N = 200;
  const CYCLE = 7;
  const paperMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  const cards = new THREE.InstancedMesh(cardGeo, paperMat, N);
  cards.castShadow = true;
  cards.frustumCulled = false;
  model.add(cards);
  const off = new Float32Array(N), die = new Uint8Array(N), yaw = new Float32Array(N), spin = new Float32Array(N);
  const jx = new Float32Array(N * 3), jy = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    off[i] = rand();
    const r = rand();
    die[i] = r < 0.55 ? 0 : r < 0.82 ? 1 : r < 0.96 ? 2 : 3;
    yaw[i] = rand() * Math.PI;
    spin[i] = rand() * 6;
    for (let k = 0; k < 3; k++) {
      jx[i * 3 + k] = CX + (rand() - 0.5) * 58;
      jy[i * 3 + k] = CY + (rand() - 0.5) * 52;
    }
  }
  const cPaper = new THREE.Color("#ffffff"), cReject = new THREE.Color(C.stone), cHot = new THREE.Color(C.accent);
  for (let i = 0; i < N; i++) cards.setColorAt(i, cPaper);

  // ── the survivor ──
  const hero = new THREE.Group();
  const heroBody = new THREE.Mesh(cardGeo, M.clay);
  heroBody.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2 * S, 0.3 * S, 14 * S), M.glowAccent);
  stripe.position.set(-3 * S, 0.5 * S, 0);
  hero.add(heroBody, stripe);
  hero.scale.setScalar(1.2);
  hero.visible = false;
  model.add(hero);
  const HL: [number, number][] = [[CX - 14, CY + 8], [CX + 13, CY - 10], [CX - 6, CY + 5]];

  const tmp = new THREE.Vector3();
  const setP = (o: THREE.Object3D, x: number, y: number, z: number) => o.position.set(x * S, z * S, y * S);
  const hide = (i: number) => {
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    cards.setMatrixAt(i, dummy.matrix);
  };

  let lapKey = -1, dkKey = -1, llmKey = -1;

  // Drawn at full size, shown a little smaller so it fits beside the text.
  g.scale.setScalar(0.8);

  return {
    group: g,
    focus: new THREE.Vector3(0, 5.0, -0.6),
    update(t, _dt, local) {
      const T = clamp01((local - 0.18) / 0.54);

      // build: parts drop into place
      for (const b of builds) {
        const e = easeOut(win(T, b.a, b.d));
        b.grp.visible = T > b.a;
        b.grp.position.y = (1 - e) * 90 * S;
      }
      lap.setOpen(easeOut(win(T, 0.02, 0.14)));

      // stages: readouts, LEDs, reject piles
      stages.forEach((st, k) => {
        const p = win(T, ON[k], RUN);
        const state = T < ON[k] ? 0 : p < 1 ? 1 : 2;
        const [a, b] = COUNTS[k];
        const n = state === 0 ? a : state === 2 ? b : Math.round(a * Math.pow(b / a, smooth(0, 1, p)));
        const key = `${state}|${n}|${Math.round(p * 24)}`;
        if (key !== st.key) {
          st.key = key;
          const s = n.toLocaleString("en-US");
          st.readout.draw((ctx, W, H) => drawReadout(ctx, W, H, k, state, s, p));
        }
        st.led.material = state === 2 ? M.glowGreen : state === 1 && Math.sin(t * 12) > 0 ? M.glowAccent : IM.ledOff;
        st.pile.scale.y = Math.max(0.001, (0.06 + 0.8 * p) * (st.H - 6));
      });

      // query
      const qp = win(T, 0.3, 0.1);
      const qc = Math.round(qp * QUERY.length) * 2 + (qp >= 1 ? 1 : 0);
      if (qc !== llmKey) {
        llmKey = qc;
        llm.draw((ctx, W, H) => drawLLM(ctx, W, H, qc >> 1, (qc & 1) === 1));
      }
      llmLed.material = T >= 0.4 ? M.glowGreen : T >= 0.3 ? M.glowAccent : IM.ledOff;
      ctxCable.reveal(win(T, 0.24, 0.08));
      ctxCable.live(T >= 0.32);
      tube.reveal(win(T, 0.68, 0.1));
      dispLed.material = T >= DELIVER ? M.glowGreen : T >= OUT_ON ? M.glowAccent : IM.ledOff;
      dk.led.material = T >= 0.97 ? M.glowGreen : IM.ledOff;

      // ambient flow through the trays
      for (let i = 0; i < N; i++) {
        const u = (((t / CYCLE + off[i]) % 1) + 1) % 1;
        const k = Math.floor(u / 0.24);
        const r = u - k * 0.24;
        const d = die[i];
        if (k > 3 || d < k || (k === 3 && (d !== 3 || r >= 0.06 || T < OUT_ON)) || (k < 3 && T < ON[k])) {
          hide(i);
          continue;
        }
        let x: number, y: number, z: number, tumble = 0;
        let col = cPaper;
        if (k === 3) {
          const f = r / 0.06;
          x = CX;
          y = CY;
          z = lerp(TRAY[2], DISP_TOP + 1, f * f);
          tumble = f;
          col = cHot;
        } else {
          const tz = TRAY[k] + 1.2;
          const lx = jx[i * 3 + k], ly = jy[i * 3 + k];
          if (r < 0.06) {
            const f = r / 0.06;
            const fz = k === 0 ? OUTLET_Z : TRAY[k - 1];
            x = lerp(CX, lx, f);
            y = lerp(CY, ly, f);
            z = lerp(fz, tz, f * f);
            tumble = f;
          } else if (r < 0.18) {
            x = lx + Math.sin(t * 38 + i) * 0.5;
            y = ly;
            z = tz;
          } else {
            const v = (r - 0.18) / 0.06;
            if (d === k) {
              col = cReject;
              const st = stages[k];
              const hx = st.h.x0 + 16, pileTop = st.h.z0 + 3 + (0.06 + 0.8 * win(T, ON[k], RUN)) * (st.H - 6) + 1;
              if (v < 0.45) {
                const f = smooth(0, 1, v / 0.45);
                x = lerp(lx, st.edge, f);
                y = ly;
                z = tz;
              } else if (v < 0.7) {
                const f = (v - 0.45) / 0.25;
                x = lerp(st.edge, hx, f);
                y = lerp(ly, CY, f);
                z = lerp(tz, st.h.z1 - 3, f);
              } else {
                const f = (v - 0.7) / 0.3;
                x = hx;
                y = CY;
                z = lerp(st.h.z1 - 3, pileTop, f * f);
                tumble = f;
              }
            } else {
              const f = smooth(0, 1, v);
              x = lerp(lx, CX, f);
              y = lerp(ly, CY, f);
              z = tz;
            }
          }
        }
        setP(dummy, x, y, z);
        dummy.rotation.set(Math.sin(spin[i] + tumble * 5) * tumble * 0.9, yaw[i] + tumble * 2, Math.cos(spin[i]) * tumble * 0.5);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        cards.setMatrixAt(i, dummy.matrix);
        cards.setColorAt(i, col);
      }
      cards.instanceMatrix.needsUpdate = true;
      if (cards.instanceColor) cards.instanceColor.needsUpdate = true;

      // the survivor: followed through every stage, then down the tube
      hero.visible = true;
      hero.rotation.set(0, 0.3, 0);
      heroBody.material = T >= 0.72 ? M.accent : M.clay;
      const fall = (a: number, d: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
        const f = win(T, a, d);
        setP(hero, lerp(x0, x1, f), lerp(y0, y1, f), lerp(z0, z1, f * f) + 1.5);
        hero.rotation.x = Math.sin(f * Math.PI) * 0.8;
      };
      const slide = (a: number, d: number, x0: number, y0: number, z: number, x1: number, y1: number) => {
        const f = smooth(0, 1, win(T, a, d));
        setP(hero, lerp(x0, x1, f), lerp(y0, y1, f), z + 1.5);
      };
      const [h0, h1, h2] = HL;
      if (T < 0.4) hero.visible = false;
      else if (T < 0.43) fall(0.4, 0.03, CX, CY, OUTLET_Z, h0[0], h0[1], TRAY[0] + 1);
      else if (T < 0.52) slide(0.5, 0.02, h0[0], h0[1], TRAY[0] + 1, CX, CY);
      else if (T < 0.55) fall(0.52, 0.03, CX, CY, TRAY[0], h1[0], h1[1], TRAY[1] + 1);
      else if (T < 0.64) slide(0.62, 0.02, h1[0], h1[1], TRAY[1] + 1, CX, CY);
      else if (T < 0.67) fall(0.64, 0.03, CX, CY, TRAY[1], h2[0], h2[1], TRAY[2] + 1);
      else if (T < 0.76) slide(0.74, 0.02, h2[0], h2[1], TRAY[2] + 1, CX, CY);
      else if (T < 0.79) fall(0.76, 0.03, CX, CY, TRAY[2], CX, CY, DISP_TOP);
      else if (T < 0.8 || T >= DELIVER) hero.visible = false;
      else {
        tube.curve.getPointAt(smooth(0.8, DELIVER, T), tmp);
        hero.position.copy(tmp);
        hero.position.y += 3.6 * S;
        hero.rotation.set(0, 0, 0);
      }

      // beads: context flowing out, results flowing back once the loop is live
      let nb = 0;
      if (T >= 0.32)
        for (let q = 0; q < 3; q++, nb++) {
          ctxCable.curve.getPointAt((t * 0.22 + q / 3) % 1, tmp);
          dummy.position.copy(tmp);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          beads.setMatrixAt(nb, dummy.matrix);
        }
      if (T >= DELIVER + 0.02)
        for (let q = 0; q < 3; q++, nb++) {
          tube.curve.getPointAt((t * 0.16 + q / 3) % 1, tmp);
          dummy.position.copy(tmp);
          dummy.scale.setScalar(1.5);
          dummy.updateMatrix();
          beads.setMatrixAt(nb, dummy.matrix);
        }
      beads.count = nb;
      if (nb) beads.instanceMatrix.needsUpdate = true;

      // screens
      const chars = Math.floor(DOC.length * clamp01((T - 0.04) / 0.84));
      const pop = Math.round(easeOut(win(T, DELIVER, 0.06)) * 12);
      const blink = Math.floor(t * 2) % 2 === 0;
      const lk = chars * 100 + pop * 2 + (blink ? 1 : 0);
      if (lk !== lapKey) {
        lapKey = lk;
        lap.screen.draw((ctx, W, H) => drawLaptop(ctx, W, H, chars, pop / 12, blink));
      }
      const play = 0.12 + 0.72 * T;
      const met = Math.round(easeOut(win(T, 0.9, 0.1)) * 16);
      const dkk = Math.round(play * 160) * 32 + met;
      if (dkk !== dkKey) {
        dkKey = dkk;
        dk.screen.draw((ctx, W, H) => drawArena(ctx, W, H, play, met / 16));
      }
    },
  };
}

