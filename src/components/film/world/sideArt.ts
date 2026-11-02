import * as THREE from "three";
import { label, type CanvasPlane } from "./kit";

/**
 * Blueprint line art for the dark ground beside the sheet: hairline machines
 * with dimension marks, plus plain wireframe solids. Local axes: X across,
 * Y up off the ground, Z toward the viewer; about 3–4 units across.
 */
export type SideArt = { group: THREE.Group; spin: number; labels: CanvasPlane[] };

type Seg = number[];

function boxEdges(out: Seg, x: number, y: number, z: number, w: number, h: number, d: number) {
  const X = [x, x + w];
  const Y = [y, y + h];
  const Z = [z, z + d];
  for (const a of Y) for (const b of Z) out.push(X[0], a, b, X[1], a, b);
  for (const a of X) for (const b of Z) out.push(a, Y[0], b, a, Y[1], b);
  for (const a of X) for (const b of Y) out.push(a, b, Z[0], a, b, Z[1]);
}

/** A row of horizontal lines across the front face of a box, for vents and drive bays. */
function slats(out: Seg, x: number, y: number, z: number, w: number, h: number, n: number) {
  for (let i = 1; i < n; i++) {
    const v = y + (h * i) / n;
    out.push(x, v, z, x + w, v, z);
  }
}

/** A dimension line with end ticks. */
function dim(out: Seg, a: [number, number, number], b: [number, number, number], tick = 0.08) {
  out.push(...a, ...b);
  for (const p of [a, b]) out.push(p[0] - tick, p[1], p[2], p[0] + tick, p[1], p[2]);
}

function ring(out: Seg, r: number, n: number, at: (x: number, y: number) => [number, number, number]) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    out.push(...at(Math.cos(a) * r, Math.sin(a) * r), ...at(Math.cos(b) * r, Math.sin(b) * r));
  }
}

function rack(s: Seg) {
  boxEdges(s, -0.7, 0, -0.5, 1.4, 3.1, 1);
  for (let i = 0; i < 9; i++) {
    const y = 0.14 + i * 0.32;
    boxEdges(s, -0.62, y, 0.5, 1.24, 0.26, 0.05);
    for (let k = 1; k < 7; k++) s.push(-0.62 + k * 0.177, y, 0.55, -0.62 + k * 0.177, y + 0.26, 0.55);
  }
  // A smaller unit on a cart, wired back to the rack.
  boxEdges(s, 1.2, 0.12, 0.2, 0.6, 0.5, 0.6);
  slats(s, 1.2, 0.12, 0.8, 0.6, 0.5, 4);
  ring(s, 0.06, 10, (x, y) => [1.32 + x, 0.06 + y, 0.8]);
  ring(s, 0.06, 10, (x, y) => [1.68 + x, 0.06 + y, 0.8]);
  s.push(0.7, 2.6, 0, 1.0, 2.2, 0.2, 1.0, 2.2, 0.2, 1.3, 1.1, 0.4, 1.3, 1.1, 0.4, 1.4, 0.62, 0.4);
  dim(s, [-1.05, 0, 0.5], [-1.05, 3.1, 0.5]);
  dim(s, [-0.7, -0.25, 0.5], [0.7, -0.25, 0.5]);
}

function tower(s: Seg) {
  boxEdges(s, -0.9, 0, -0.9, 1.8, 0.35, 1.8);
  boxEdges(s, -0.6, 0.35, -0.6, 1.2, 1.5, 1.2);
  boxEdges(s, -0.42, 1.85, -0.42, 0.84, 0.9, 0.84);
  boxEdges(s, -0.22, 2.75, -0.22, 0.44, 0.6, 0.44);
  slats(s, -0.6, 0.35, 0.6, 1.2, 1.5, 7);
  slats(s, -0.42, 1.85, 0.42, 0.84, 0.9, 5);
  ring(s, 0.22, 16, (x, y) => [x, 3.35 + 0.22 + y, 0]);
  s.push(0, 3.8, 0, 0, 4.2, 0);
  dim(s, [1.2, 0, 0.9], [1.2, 3.35, 0.9]);
  dim(s, [-0.9, -0.25, 0.9], [0.9, -0.25, 0.9]);
}

function kiosk(s: Seg) {
  // A screen on a post beside a low bench of drawers.
  s.push(0, 0, 0, 0, 1.7, 0, 0.07, 0, 0, 0.07, 1.7, 0);
  ring(s, 0.42, 20, (x, y) => [x + 0.03, 0.02, y]);
  boxEdges(s, -0.75, 1.7, -0.06, 1.55, 1.05, 0.12);
  boxEdges(s, -0.66, 1.79, 0.06, 1.37, 0.87, 0.01);
  boxEdges(s, 1.0, 0, -0.5, 1.5, 0.9, 1);
  slats(s, 1.0, 0, 0.5, 1.5, 0.9, 3);
  for (let k = 1; k < 3; k++) s.push(1 + k * 0.5, 0, 0.5, 1 + k * 0.5, 0.9, 0.5);
  dim(s, [-1.05, 0, 0.2], [-1.05, 2.75, 0.2]);
  dim(s, [1.0, -0.25, 0.5], [2.5, -0.25, 0.5]);
}

function torus(s: Seg) {
  const R = 1.25;
  const r = 0.55;
  const n = 26;
  const m = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = ((i + 1) / n) * Math.PI * 2;
    for (let j = 0; j < m; j++) {
      const b = (j / m) * Math.PI * 2;
      const b2 = ((j + 1) / m) * Math.PI * 2;
      const p = (u: number, v: number): [number, number, number] => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
      s.push(...p(a, b), ...p(a2, b), ...p(a, b), ...p(a, b2));
    }
  }
}

function sphere(s: Seg) {
  const r = 1.5;
  for (let la = 1; la < 8; la++) {
    const y = r * Math.cos((la / 8) * Math.PI);
    const c = r * Math.sin((la / 8) * Math.PI);
    ring(s, c, 36, (a, b) => [a, y, b]);
  }
  for (let lo = 0; lo < 8; lo++) {
    const t = (lo / 8) * Math.PI;
    ring(s, r, 36, (a, b) => [a * Math.cos(t), b, a * Math.sin(t)]);
  }
}

/** A fold of hills as a wire net. */
function ridge(s: Seg) {
  const n = 18;
  const h = (i: number, j: number) => Math.max(0, 1.5 * Math.exp(-(((i - 6) ** 2 + (j - 9) ** 2) / 22)) + 1.05 * Math.exp(-(((i - 13) ** 2 + (j - 6) ** 2) / 14)) + 0.05 * Math.sin(i * 1.7 + j));
  const p = (i: number, j: number): [number, number, number] => [(i / n - 0.5) * 4.4, h(i, j), (j / n - 0.5) * 3.2];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      if (i < n) s.push(...p(i, j), ...p(i + 1, j));
      if (j < n) s.push(...p(i, j), ...p(i, j + 1));
    }
  }
}

/** A rangefinder, in elevation-and-section style. */
function camera(s: Seg) {
  boxEdges(s, -1.2, 0, -0.32, 2.4, 1.2, 0.64);
  boxEdges(s, -0.95, 1.2, -0.2, 0.6, 0.16, 0.4);
  boxEdges(s, 0.55, 1.2, -0.2, 0.45, 0.2, 0.4);
  boxEdges(s, -0.75, 0.82, 0.32, 0.34, 0.2, 0.02);
  for (const [r, z] of [[0.46, 0.32], [0.46, 0.72], [0.4, 0.72], [0.4, 1.02], [0.3, 1.02]] as const) ring(s, r, 32, (x, y) => [x, 0.6 + y, z]);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    s.push(Math.cos(a) * 0.46, 0.6 + Math.sin(a) * 0.46, 0.32, Math.cos(a) * 0.46, 0.6 + Math.sin(a) * 0.46, 0.72);
  }
  dim(s, [-1.2, -0.25, 0.3], [1.2, -0.25, 0.3]);
}

/** A film reel with its strip running off across the ground. */
function reel(s: Seg) {
  for (const z of [-0.2, 0.2]) {
    ring(s, 1.5, 48, (x, y) => [x, 1.6 + y, z]);
    ring(s, 0.32, 18, (x, y) => [x, 1.6 + y, z]);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ring(s, 0.3, 16, (x, y) => [Math.cos(a) * 0.86 + x, 1.6 + Math.sin(a) * 0.86 + y, z]);
    }
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    s.push(Math.cos(a) * 1.5, 1.6 + Math.sin(a) * 1.5, -0.2, Math.cos(a) * 1.5, 1.6 + Math.sin(a) * 1.5, 0.2);
  }
  // Strip with its frames.
  s.push(1.5, 0.1, -0.2, 4.2, 0, -0.2, 1.5, 0.1, 0.2, 4.2, 0, 0.2);
  for (let k = 0; k < 10; k++) s.push(1.5 + k * 0.3, 0.1 - k * 0.011, -0.2, 1.5 + k * 0.3, 0.1 - k * 0.011, 0.2);
}

function cage(s: Seg) {
  boxEdges(s, -1.2, -1.2, -1.2, 2.4, 2.4, 2.4);
  boxEdges(s, -0.65, -0.65, -0.65, 1.3, 1.3, 1.3);
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) s.push(x * 1.2, y * 1.2, z * 1.2, x * 0.65, y * 0.65, z * 0.65);
}

const KINDS = [
  { draw: rack, name: "GPU RACK", notes: ["1.9 m", "0.6 m"], spin: 0, y: 0 },
  { draw: ridge, spin: 0, y: 0 },
  { draw: camera, name: "50 mm  f/1.4", notes: ["", "138 mm"], spin: 0, y: 0 },
  { draw: torus, spin: 0.14, y: 1.1 },
  { draw: reel, name: "35 mm", spin: 0, y: 0 },
  { draw: tower, name: "SERVING", notes: ["2.1 m", "1.1 m"], spin: 0, y: 0 },
  { draw: sphere, spin: 0.09, y: 1.6 },
  { draw: kiosk, name: "EVAL", notes: ["1.5 m", "0.9 m"], spin: 0, y: 0 },
  { draw: cage, spin: 0.1, y: 1.4 },
];

export function sideArt(i: number, mat: THREE.LineBasicMaterial): SideArt {
  const k = KINDS[i % KINDS.length];
  const group = new THREE.Group();
  const seg: Seg = [];
  k.draw(seg);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.y = k.y;
  group.add(lines);
  group.userData.spinner = lines;
  const labels: CanvasPlane[] = [];
  const add = (text: string, worldH: number, x: number, y: number, z: number) => {
    const l = label([{ text, font: "mono", size: 40, color: "#ffffff", tracking: 3 }], worldH, { pxW: 360, align: "center" });
    l.mesh.position.set(x, y, z);
    group.add(l.mesh);
    labels.push(l);
  };
  if (k.notes) {
    if (k.notes[0]) add(k.notes[0], 0.34, -1.5, 1.5, 0.5);
    add(k.notes[1], 0.34, 0, -0.5, 0.5);
  }
  if (k.name) add(k.name, 0.34, 0, k.draw === camera ? 1.8 : 3.75, 0);
  return { group, spin: k.spin, labels };
}

export const FORMULAS = ["y = Σ sin((2k+1)x) / (2k+1)", "NDCG@k = DCG@k / IDCG@k", "∂L/∂θ = E[∇ log p(x|θ)]", "p99 ≤ 200 ms", "x(t), y(t), z(t)", "F1 = 2PR / (P + R)"];
