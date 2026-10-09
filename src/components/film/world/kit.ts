import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Palette for the clay diorama. Light, mostly neutral, one warm accent. */
export const C = {
  bg: "#efede8",
  clay: "#f8f7f3",
  clay2: "#e6e3dc",
  stone: "#cfcac0",
  ink: "#24242a",
  slate: "#3a3a42",
  steel: "#9a968e",
  accent: "#ff5a1f",
  blue: "#2c5cff",
  green: "#17a974",
  domain: ["#e9b9b9", "#bcd6b1", "#ecd3a4", "#b7c7e6"], // VGI-Bench task domains
};

const std = (color: string, roughness = 0.82, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export const M = {
  clay: std(C.clay),
  clay2: std(C.clay2),
  stone: std(C.stone),
  ink: std(C.ink, 0.55, 0.15),
  slate: std(C.slate, 0.6, 0.2),
  steel: std(C.steel, 0.45, 0.6),
  accent: std(C.accent, 0.5),
  blue: std(C.blue, 0.5),
  glowAccent: new THREE.MeshBasicMaterial({ color: C.accent, toneMapped: false }),
  glowBlue: new THREE.MeshBasicMaterial({ color: C.blue, toneMapped: false }),
  glowGreen: new THREE.MeshBasicMaterial({ color: C.green, toneMapped: false }),
};

const geoCache = new Map<string, THREE.BufferGeometry>();
function rgeo(w: number, h: number, d: number, r: number) {
  const key = `${w}|${h}|${d}|${r}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    geoCache.set(key, g);
  }
  return g;
}

export function rbox(w: number, h: number, d: number, mat: THREE.Material = M.clay, r = 0.06) {
  const m = new THREE.Mesh(rgeo(w, h, d, r), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function box(w: number, h: number, d: number, mat: THREE.Material = M.clay) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material = M.clay, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A rounded plinth that every station sits on — the "museum diorama" base. */
export function plinth(w: number, d: number) {
  const g = new THREE.Group();
  const base = rbox(w, 0.6, d, M.clay, 0.28);
  base.position.y = 0.3;
  const lip = rbox(w - 0.6, 0.06, d - 0.6, M.clay2, 0.03);
  lip.position.y = 0.62;
  lip.castShadow = false;
  g.add(base, lip);
  return g;
}

/* -------------------------------------------------------------------------- */
/* Canvas-backed textures for labels, screens and charts                       */
/* -------------------------------------------------------------------------- */

export function fontStack(kind: "mono" | "serif" | "sans") {
  const css = typeof document !== "undefined" ? getComputedStyle(document.body) : null;
  const v = (n: string) => css?.getPropertyValue(n).trim();
  if (kind === "mono") return `${v("--font-geist-mono") || ""}, ui-monospace, monospace`;
  if (kind === "serif") return `${v("--font-serif") || ""}, Georgia, serif`;
  return `${v("--font-geist-sans") || ""}, system-ui, sans-serif`;
}

export class CanvasPlane {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;

  constructor(
    public pxW: number,
    public pxH: number,
    worldH: number,
    opts: { transparent?: boolean; lit?: boolean } = {},
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = pxW;
    this.canvas.height = pxH;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: opts.transparent ?? true,
      toneMapped: false,
      depthWrite: !(opts.transparent ?? true),
    });
    const worldW = (worldH * pxW) / pxH;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), this.material);
  }

  draw(fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    this.ctx.clearRect(0, 0, this.pxW, this.pxH);
    fn(this.ctx, this.pxW, this.pxH);
    this.texture.needsUpdate = true;
  }
}

/** A floating text label. `lines` are drawn top to bottom. */
export function label(
  lines: { text: string; font: "mono" | "serif" | "sans"; size: number; color?: string; tracking?: number }[],
  worldH: number,
  opts: { align?: CanvasTextAlign; pxW?: number; bg?: string } = {},
) {
  const pxH = Math.ceil(lines.reduce((s, l) => s + l.size * 1.25, 0) + 24);
  const pxW = opts.pxW ?? 1024;
  const p = new CanvasPlane(pxW, pxH, worldH);
  p.draw((ctx, w) => {
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      roundRect(ctx, 0, 0, w, pxH, 18);
      ctx.fill();
    }
    let y = 12;
    for (const l of lines) {
      ctx.font = `${l.font === "serif" ? 400 : 500} ${l.size}px ${fontStack(l.font)}`;
      ctx.fillStyle = l.color ?? C.ink;
      ctx.textAlign = opts.align ?? "left";
      ctx.textBaseline = "top";
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.tracking ?? 0}px`;
      const x = opts.align === "center" ? w / 2 : opts.align === "right" ? w - 12 : 12;
      ctx.fillText(l.text, x, y);
      y += l.size * 1.25;
    }
  });
  p.mesh.userData.billboard = true;
  return p;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export interface Station {
  group: THREE.Group;
  /** World-space point the camera frames. */
  focus: THREE.Vector3;
  /** t: seconds, dt: delta, local: 0→1 progress of the reader through this chapter */
  update(t: number, dt: number, local: number): void;
}
