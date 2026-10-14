import * as THREE from "three";
import { C, CanvasPlane, M, clamp01, fontStack, roundRect } from "./kit";

/**
 * Iso kit — the drawing language shared by every station: hard-edged boxes
 * with a fine outline, dark hardware against light clay, canvas faces for
 * screens and front panels, cables that are routed rather than draped, and
 * status LEDs that light when something is done.
 *
 * Geometry is authored in model units and scaled by `S` into world units.
 * Model axes: x across, y front-to-back (front = +y), z up.
 */

export type V3 = [number, number, number];

const std = (color: string, roughness = 0.6, metalness = 0.2) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

export const IM = {
  dark: std("#2b2b31", 0.5, 0.25),
  inner: std("#45454d", 0.55, 0.3),
  board: std("#1f2024", 0.7, 0.1),
  alu: std("#c9c6bf", 0.42, 0.55),
  ledOff: new THREE.MeshBasicMaterial({ color: "#3a3a40" }),
  cableOff: std(C.ink, 0.6, 0.1),
  cableOn: new THREE.MeshBasicMaterial({ color: C.accent, toneMapped: false }),
  edgeDark: new THREE.LineBasicMaterial({ color: "#6a6a74", transparent: true, opacity: 0.55 }),
  edgeLight: new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.22 }),
};

const LIGHT = new Set<THREE.Material>([M.clay, M.clay2, M.stone, M.steel, IM.alu]);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Progress through a window that opens at `a` and lasts `d`. */
export const win = (T: number, a: number, d: number) => clamp01((T - a) / d);

export type Iso = ReturnType<typeof iso>;

export function iso(S: number) {
  const geoCache = new Map<string, THREE.BoxGeometry>();
  const edgeCache = new Map<string, THREE.EdgesGeometry>();

  const at = (x: number, y: number, z: number) => new THREE.Vector3(x * S, z * S, y * S);

  /** A box by its min corner (x, y, z) and size (w across, d deep, h tall). */
  function part(
    x: number, y: number, z: number, w: number, d: number, h: number,
    mat: THREE.Material, parent: THREE.Object3D, opts: { shadow?: boolean; edges?: boolean } = {},
  ) {
    const key = `${w}|${d}|${h}`;
    let geo = geoCache.get(key);
    if (!geo) geoCache.set(key, (geo = new THREE.BoxGeometry(w * S, h * S, d * S)));
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(at(x + w / 2, y + d / 2, z + h / 2));
    m.castShadow = opts.shadow ?? false;
    m.receiveShadow = true;
    if (opts.edges) {
      let eg = edgeCache.get(key);
      if (!eg) edgeCache.set(key, (eg = new THREE.EdgesGeometry(geo)));
      m.add(new THREE.LineSegments(eg, LIGHT.has(mat) ? IM.edgeLight : IM.edgeDark));
    }
    parent.add(m);
    return m;
  }

  /** Big, shadow-casting, outlined part. */
  const solid = (x: number, y: number, z: number, w: number, d: number, h: number, mat: THREE.Material, parent: THREE.Object3D) =>
    part(x, y, z, w, d, h, mat, parent, { shadow: true, edges: true });

  /**
   * A canvas plane w × h model units, `ppu` pixels per unit, facing +y (the front).
   * Pass `mirror` when the parent is mirrored in x so text still reads.
   */
  function face(
    w: number, h: number, ppu: number,
    draw: (ctx: CanvasRenderingContext2D, k: number, W: number, H: number) => void,
    opts: { mirror?: boolean; transparent?: boolean } = {},
  ) {
    const p = new CanvasPlane(Math.round(w * ppu), Math.round(h * ppu), h * S, { transparent: opts.transparent ?? false });
    p.draw((ctx, W, H) => draw(ctx, ppu, W, H));
    if (opts.mirror) p.mesh.scale.x = -1;
    p.mesh.userData.billboard = false;
    return p;
  }

  /** Orthogonal path through `pts` with rounded corners, returned in world units. */
  function route(pts: V3[], r = 2.4): THREE.Vector3[] {
    const out: V3[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const da = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const dc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
      const ra = Math.min(r, da / 2), rc = Math.min(r, dc / 2);
      const p0 = lerp3(b, a, ra / da), p2 = lerp3(b, c, rc / dc);
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        out.push([0, 1, 2].map((q) => (1 - t) ** 2 * p0[q] + 2 * (1 - t) * t * b[q] + t * t * p2[q]) as V3);
      }
    }
    out.push(pts[pts.length - 1]);
    return out.map((p) => at(...p));
  }

  /** A routed cable that can draw itself in (`reveal`) and go live (`live`). */
  function cable(pts: V3[], parent: THREE.Object3D, opts: { radius?: number; corner?: number } = {}) {
    const curve = new THREE.CatmullRomCurve3(route(pts, opts.corner), false, "centripetal");
    const tube = new THREE.TubeGeometry(curve, Math.max(64, pts.length * 24), opts.radius ?? 0.028, 6);
    const mesh = new THREE.Mesh<THREE.TubeGeometry, THREE.Material>(tube, IM.cableOff);
    mesh.castShadow = true;
    mesh.visible = false;
    parent.add(mesh);
    const total = tube.index!.count;
    return {
      mesh,
      curve,
      reveal(r: number) {
        mesh.visible = r > 0;
        tube.setDrawRange(0, Math.floor((clamp01(r) * total) / 6) * 6);
      },
      live(on: boolean) {
        mesh.material = on ? IM.cableOn : IM.cableOff;
      },
    };
  }

  return { S, at, part, solid, face, route, cable };
}

/* -------------------------------------------------------------------------- */
/* Users: the laptops and desktops that stand for the people at the other end  */
/* -------------------------------------------------------------------------- */

/** Draws a generic app window into a screen canvas. */
export function drawApp(ctx: CanvasRenderingContext2D, W: number, H: number, title: string, body?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) {
  ctx.fillStyle = "#16161a";
  ctx.fillRect(0, 0, W, H);
  const p = Math.round(H * 0.05);
  ctx.fillStyle = "#f4f2ee";
  roundRect(ctx, p, p, W - 2 * p, H - 2 * p, p * 0.6);
  ctx.fill();
  const bar = Math.round(H * 0.11);
  ctx.fillStyle = "#e6e3dc";
  ctx.fillRect(p, p + bar - 2, W - 2 * p, 2);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(p + bar * 0.6 + i * bar * 0.45, p + bar * 0.5, bar * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#7a776f";
  ctx.font = `500 ${Math.round(bar * 0.42)}px ${fontStack("mono")}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(title, p + bar * 2.1, p + bar * 0.52);
  if (body) body(ctx, p + bar * 0.4, p + bar * 1.3, W - 2 * p - bar * 0.8, H - 2 * p - bar * 1.7);
}

/**
 * A laptop at (x, y, z), ~33 cm wide when 1 unit = 5 mm. The lid hinges at
 * the back; `setOpen(0 → 1)` swings it from closed to open. The screen is a
 * canvas you can redraw.
 */
export function laptop(I: Iso, x: number, y: number, z: number, parent: THREE.Object3D, opts: { ppu?: number; title?: string } = {}) {
  const W = 66, D = 46, H = 2.6, LH = 44;
  const g = new THREE.Group();
  g.position.copy(I.at(x, y, z));
  parent.add(g);
  I.solid(0, 0, 0, W, D, H, IM.alu, g);
  I.part(5, 5, H, W - 10, 20, 0.3, IM.dark, g);
  I.part(24, 30, H, 18, 12, 0.2, M.stone, g);
  const lid = new THREE.Group();
  lid.position.copy(I.at(0, 0, H));
  g.add(lid);
  I.solid(0, 0, 0, W, 1.4, LH, IM.alu, lid);
  const screen = I.face(W - 6, LH - 6, opts.ppu ?? 8, (ctx, _k, cw, ch) => drawApp(ctx, cw, ch, opts.title ?? "user"));
  screen.mesh.position.copy(I.at(W / 2, 1.45, LH / 2));
  lid.add(screen.mesh);
  const setOpen = (t: number) => {
    lid.rotation.x = lerp(Math.PI / 2, -0.22, clamp01(t));
  };
  setOpen(1);
  return { group: g, lid, screen, setOpen, size: [W, D, H + LH] as V3 };
}

/**
 * A desktop: monitor on a stand, a tower to its right and a keyboard in front.
 * Occupies about 160 × 100 units.
 */
export function desktop(I: Iso, x: number, y: number, z: number, parent: THREE.Object3D, opts: { ppu?: number; title?: string } = {}) {
  const g = new THREE.Group();
  g.position.copy(I.at(x, y, z));
  parent.add(g);
  const MW = 108, MH = 64;
  I.solid(40, 18, 0, 28, 20, 1.6, IM.dark, g);
  I.solid(50, 22, 1.6, 8, 4, 22, IM.dark, g);
  I.solid(0, 24, 18, MW, 4, MH, IM.dark, g);
  const screen = I.face(MW - 6, MH - 7, opts.ppu ?? 6, (ctx, _k, cw, ch) => drawApp(ctx, cw, ch, opts.title ?? "user"));
  screen.mesh.position.copy(I.at(MW / 2, 28.05, 18 + 4 + (MH - 7) / 2));
  g.add(screen.mesh);
  I.solid(14, 52, 0, 80, 26, 2.4, IM.alu, g);
  I.part(17, 55, 2.4, 74, 20, 0.4, IM.inner, g);
  I.solid(98, 54, 0, 12, 18, 1.8, IM.alu, g);
  I.solid(124, 0, 0, 38, 84, 86, IM.dark, g);
  const led = I.part(150, 84, 76, 3, 0.4, 3, IM.ledOff, g);
  I.part(128, 84, 10, 30, 0.3, 50, IM.inner, g);
  return { group: g, screen, led };
}
