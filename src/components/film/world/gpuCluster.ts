import * as THREE from "three";
import { C, CanvasPlane, M, clamp01, fontStack, label, plinth, rbox, roundRect, smooth, type Station } from "./kit";

/**
 * IBM–Illinois — the training cluster, built as the reader scrolls. Sixteen
 * GPUs drop into four open 4U servers, the lids close, the nodes slide into
 * two racks, the cabling is run the way a real row is cabled (two NIC links
 * per node through the vertical manager to the top-of-rack switch, uplinks in
 * the overhead ladder tray) and the cluster powers on. A loss curve draws
 * itself and 16 browser workers roll out WebArena trajectories overhead.
 */

// Model units: 1 = 5 mm. A 4U server is 88 wide, 150 deep, 34 tall.
// Model axes: x across, y front-to-back (front = +y), z up.
const S = 0.026;
const FZ = 7;
const SW = 88;
const SD = 150;
const SH = 34;
const NS = 4;
const NG = 4;
const RKW = 110;
const RKD = 176;
const RKH = 196;
const RACKX = [100, 240];
const RY0 = 24;
const slotZ = (s: number) => FZ + 10 + s * 40;
const SWZ = slotZ(4);
const TRZ = FZ + RKH + 30;
const TRY = RY0 + 70;
const floorPos = (j: number): V3 => [35 + j * 100, 250, FZ];
const rackPos = (j: number): V3 => [RACKX[j >> 1] + 11, RY0 + 14, slotZ(2 + (j % 2))];
const cardX = (k: number) => 6 + k * 19.6;

type V3 = [number, number, number];
const at = (x: number, y: number, z: number) => new THREE.Vector3(x * S, z * S, y * S);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const win = (T: number, a: number, d: number) => clamp01((T - a) / d);

const std = (color: string, roughness = 0.6, metalness = 0.2) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const darkMat = std("#2b2b31", 0.5, 0.25);
const innerMat = std("#45454d", 0.55, 0.3);
const boardMat = std("#1f2024", 0.7, 0.1);
const ledOff = new THREE.MeshBasicMaterial({ color: "#3a3a40" });
const edgeDark = new THREE.LineBasicMaterial({ color: "#6a6a74", transparent: true, opacity: 0.55 });
const edgeLight = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.22 });

const geoCache = new Map<string, THREE.BoxGeometry>();
const edgeCache = new Map<string, THREE.EdgesGeometry>();
/** A box by its min corner and size in model units. */
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
    m.add(new THREE.LineSegments(eg, mat === M.clay || mat === M.stone || mat === M.steel ? edgeLight : edgeDark));
  }
  parent.add(m);
  return m;
}

/** A front-facing canvas drawn in model units; mirrored back so text reads. */
function face(w: number, h: number, ppu: number, draw: (ctx: CanvasRenderingContext2D, u: number) => void) {
  const p = new CanvasPlane(Math.round(w * ppu), Math.round(h * ppu), h * S, { transparent: false });
  p.draw((ctx) => draw(ctx, ppu));
  p.mesh.scale.x = -1;
  return p.mesh;
}

/** Orthogonal path with rounded corners. */
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

function serverFace(n: number) {
  // Drawn in canvas space, which is the model's x mirrored (u' = SW - u).
  return face(SW, SH, 6, (ctx, k) => {
    const R = (u: number, v: number, w: number, h: number) => [(SW - u - w) * k, v * k, w * k, h * k] as const;
    ctx.fillStyle = "#33333a";
    ctx.fillRect(0, 0, SW * k, SH * k);
    ctx.strokeStyle = "#55555e";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, SW * k - 2, SH * k - 2);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 4; c++) {
        const [x, y, w, h] = R(4 + c * 10, 3 + r * 15, 8.6, 13);
        ctx.fillStyle = "#26262b";
        roundRect(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = "#5a5a63";
        ctx.fillRect(x + 8, y + 18, w - 16, 3);
      }
    ctx.fillStyle = "#d9d6cf";
    ctx.font = `500 ${5 * k}px ${fontStack("mono")}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText(`N${n}`, (SW - 49) * k, 3 * k);
    for (const u of [49, 59]) {
      const [x, y, w, h] = R(u, 21, 7, 6);
      ctx.fillStyle = "#18181b";
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
    }
    ctx.fillStyle = "#26262b";
    for (let i = 0; i < 6; i++) {
      const [x, y, w, h] = R(72, 16 + i * 2.4, 12, 1.2);
      ctx.fillRect(x, y, w, h);
    }
    const [cx, cy] = [(SW - 79) * k, 7 * k];
    ctx.strokeStyle = "#9a968e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6 * k, -Math.PI / 2 + 0.9, -Math.PI / 2 - 0.9 + Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3 * k);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  });
}

function storageFace(n: number) {
  return face(SW, SH, 6, (ctx, k) => {
    ctx.fillStyle = "#33333a";
    ctx.fillRect(0, 0, SW * k, SH * k);
    ctx.strokeStyle = "#55555e";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, SW * k - 2, SH * k - 2);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = "#26262b";
        roundRect(ctx, (4 + c * 11) * k, (3 + r * 9.6) * k, 9.6 * k, 8.4 * k, 3);
        ctx.fill();
        ctx.fillStyle = "#5a5a63";
        ctx.fillRect((6 + c * 11) * k, (9 + r * 9.6) * k, 5 * k, 0.8 * k);
      }
    ctx.fillStyle = "#d9d6cf";
    ctx.font = `500 ${4.4 * k}px ${fontStack("mono")}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText(`STOR-${n}`, (SW - 4) * k, 4 * k);
  });
}

function switchFace(name: string) {
  return face(SW, 10, 8, (ctx, k) => {
    ctx.fillStyle = "#33333a";
    ctx.fillRect(0, 0, SW * k, 10 * k);
    ctx.fillStyle = "#d9d6cf";
    ctx.font = `500 ${3.6 * k}px ${fontStack("mono")}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillText(name, (SW - 9) * k, 5 * k);
    for (let q = 0; q < 8; q++) {
      ctx.fillStyle = "#18181b";
      roundRect(ctx, (SW - 22 - q * 5.6 - 4.4) * k, 2.6 * k, 4.4 * k, 4.4 * k, 2);
      ctx.fill();
    }
    ctx.fillStyle = "#26262b";
    for (let i = 0; i < 3; i++) ctx.fillRect(4 * k, (2 + i * 2.2) * k, 12 * k, 1.1 * k);
  });
}

export function gpuCluster(): Station {
  const g = new THREE.Group();
  g.add(plinth(19, 21));
  const Y = 0.66;

  // The model is mirrored in x so the racks' open sides face the camera.
  const model = new THREE.Group();
  model.scale.x = -1;
  model.position.set(235 * S, Y - FZ * S, -300 * S);
  g.add(model);

  // ── racks: open frame, vertical cable manager, top-of-rack switch ──
  const fingerGeo = new THREE.BoxGeometry(3 * S, 1.2 * S, 1.2 * S);
  const fingers = new THREE.InstancedMesh(fingerGeo, innerMat, 2 * 2 * 24);
  const dummy = new THREE.Object3D();
  let fi = 0;
  const managers = RACKX.map((x0, k) => {
    const y0 = RY0;
    part(x0, y0, FZ, RKW, RKD, 8, darkMat, model, { shadow: true, edges: true });
    part(x0, y0, FZ, RKW, 4, RKH, darkMat, model, { shadow: true, edges: true });
    part(x0, y0, FZ, 4, RKD, RKH, darkMat, model, { shadow: true, edges: true });
    for (const [x, y] of [[x0 + RKW - 6, y0], [x0 + RKW - 6, y0 + RKD - 6], [x0, y0 + RKD - 6]])
      part(x, y, FZ, 6, 6, RKH, darkMat, model, { shadow: true, edges: true });
    part(x0, y0, FZ + RKH, RKW, RKD, 6, darkMat, model, { shadow: true, edges: true });
    for (let q = 0; q < 5; q++) part(x0 + RKW - 9, y0 + 6, slotZ(q) - 2, 3, RKD - 12, 1.5, innerMat, model);
    part(x0 + RKW - 12, y0 + RKD, FZ + 8, 12, 6, RKH - 8, darkMat, model, { shadow: true, edges: true });
    for (let z = FZ + 16; z < FZ + RKH - 6 && fi < fingers.count - 1; z += 8)
      for (const x of [x0 + RKW - 12, x0 + RKW - 3]) {
        dummy.position.copy(at(x + 1.5, y0 + RKD + 6.6, z));
        dummy.updateMatrix();
        fingers.setMatrixAt(fi++, dummy.matrix);
      }
    const tag = label([{ text: `RACK ${"AB"[k]}`, font: "mono", size: 40, tracking: 6, color: "#ffffff" }], 5 * S, { pxW: 360 });
    tag.mesh.userData.billboard = false;
    tag.mesh.scale.x = -1;
    tag.mesh.position.copy(at(x0 + 50, y0 + RKD + 0.3, FZ + RKH + 3));
    model.add(tag.mesh);

    const sx = x0 + 11, sy = y0 + 14;
    part(sx, sy, SWZ, SW, SD, 10, darkMat, model, { shadow: true, edges: true });
    const sf = switchFace(`TOR-${"AB"[k]}`);
    sf.position.copy(at(sx + SW / 2, sy + SD + 0.15, SWZ + 5));
    model.add(sf);
    const ports = Array.from({ length: 8 }, (_, q) => part(sx + 23.4 + q * 5.6, sy + SD, SWZ + 1.2, 1.6, 0.4, 0.8, ledOff, model));
    const swLed = part(sx + 3, sy + SD, SWZ + 4, 2, 0.4, 2, ledOff, model);
    return { x0, sx, ports, swLed };
  });
  fingers.count = fi;
  model.add(fingers);

  // The lower two slots of each rack hold storage nodes, so the racks read full.
  const fillerLeds: THREE.Mesh[] = [];
  RACKX.forEach((x0, r) => {
    for (let q = 0; q < 2; q++) {
      const sx = x0 + 11, sy = RY0 + 14, sz = slotZ(q);
      part(sx, sy, sz, SW, SD, SH, darkMat, model, { shadow: true, edges: true });
      const f = storageFace(r * 2 + q + 1);
      f.position.copy(at(sx + SW / 2, sy + SD + 0.15, sz + SH / 2));
      model.add(f);
      for (let l = 0; l < 3; l++) fillerLeds.push(part(sx + 74 + l * 4, sy + SD, sz + 3, 1.8, 0.5, 1.8, ledOff, model));
    }
  });

  // Overhead ladder tray between the racks.
  {
    const x0 = RACKX[0] + 20, len = RACKX[1] + 90 - x0;
    for (const y of [TRY, TRY + 22]) part(x0, y, TRZ, len, 2, 3, darkMat, model, { shadow: true, edges: true });
    const rungs = Math.floor((len - 8) / 9);
    const rung = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2 * S, 0.8 * S, 20 * S), innerMat, rungs);
    for (let i = 0; i < rungs; i++) {
      dummy.position.copy(at(x0 + 4 + i * 9, TRY + 12, TRZ + 1.5));
      dummy.updateMatrix();
      rung.setMatrixAt(i, dummy.matrix);
    }
    model.add(rung);
    for (const x of [x0 + 4, x0 + len - 6]) for (const y of [TRY, TRY + 22]) part(x, y, FZ + RKH + 6, 1, 1, TRZ - FZ - RKH - 6, innerMat, model);
  }

  // ── servers ──
  const servers = Array.from({ length: NS }, (_, j) => {
    const grp = new THREE.Group();
    model.add(grp);
    const E = { shadow: true, edges: true };
    part(0, 0, 0, SW, SD, 3, darkMat, grp, E);
    part(0, 0, 0, 2, SD, SH, darkMat, grp, E);
    part(SW - 2, 0, 0, 2, SD, SH, darkMat, grp, E);
    part(0, 0, 0, SW, 2, SH, darkMat, grp, E);
    part(0, SD - 3, 0, SW, 3, SH, darkMat, grp, E);
    part(2, 2, 3, SW - 4, 96, 0.4, boardMat, grp);
    part(58, 3, 3, 13, 26, 18, innerMat, grp, E);
    part(72, 3, 3, 13, 26, 18, innerMat, grp, E);
    for (const x of [8, 32]) part(x, 6, 3, 16, 16, 12, M.stone, grp, E);
    for (let r = 0; r < 6; r++) part(5 + r * 8.6, 24, 3, 1.4, 6, 4, innerMat, grp);
    for (let k = 0; k < NG; k++) part(cardX(k) - 0.4, 34, 3, 16.8, 56, 0.6, innerMat, grp);
    part(2, 100, 3, SW - 4, 8, 28, innerMat, grp, E);
    part(2, 116, 3, SW - 4, 30, 22, innerMat, grp, E);
    const front = serverFace(j + 1);
    front.position.copy(at(SW / 2, SD + 0.15, SH / 2));
    grp.add(front);
    const leds = [0, 1, 2, 3].map((q) => part(50 + q * 4, SD, SH - 14, 1.8, 0.5, 1.8, ledOff, grp));

    const lid = new THREE.Group();
    lid.visible = false;
    grp.add(lid);
    part(0, 0, SH, SW, SD, 2, darkMat, lid, E);
    part(10, 104, SH + 2, SW - 20, 8, 0.2, innerMat, lid);

    const cards = Array.from({ length: NG }, (_, k) => {
      const cg = new THREE.Group();
      grp.add(cg);
      const x = cardX(k), y = 30, z = 4, w = 16, d = 64, h = 24;
      part(x, y, z, w, d, h, M.clay, cg, E);
      part(x + 0.8, y + 6, z + h, w - 1.6, d - 14, 0.5, M.stone, cg);
      part(x + 6, y + 4, z + h, 4, 7, 2.5, M.ink, cg);
      part(x - 0.5, y + d, z - 2, w + 1, 1.4, h + 4, M.steel, cg, { edges: true });
      const led = part(x + 7, y + d - 6, z + h, 2, 2, 0.5, ledOff, cg);
      cg.visible = false;
      return { g: cg, led };
    });
    return { j, grp, lid, cards, leds, from: floorPos(j), to: rackPos(j) };
  });

  // ── cabling: two NIC links per node, port → forward → manager lane → up → switch port ──
  type Cable = { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; total: number; ph: number };
  const cableOff = std(C.ink, 0.6, 0.1);
  const cableOn = new THREE.MeshBasicMaterial({ color: C.accent, toneMapped: false });
  const makeCable = (pts: THREE.Vector3[], ph: number): Cable => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const tube = new THREE.TubeGeometry(curve, Math.max(64, pts.length * 4), 0.028, 6);
    const mesh = new THREE.Mesh(tube, cableOff);
    mesh.castShadow = true;
    model.add(mesh);
    return { mesh, curve, total: tube.index!.count, ph };
  };
  const cables: Cable[] = [];
  servers.forEach((sv) => {
    const m = managers[sv.j >> 1], s = sv.j % 2, [sx, sy, sz] = sv.to;
    for (let p = 0; p < 2; p++) {
      const idx = s * 2 + p;
      const px = sx + 52.5 + p * 10, pz = sz + SH - 24, fy = sy + SD + 0.3, cy = RY0 + RKD + 6.6;
      const lane = m.x0 + RKW - 9 + idx * 0.85, spx = m.sx + 24.2 + idx * 5.6, spz = SWZ + 5.2;
      cables.push(makeCable(route([[px, fy, pz], [px, cy, pz], [lane, cy, pz], [lane, cy, spz], [spx, cy, spz], [spx, fy, spz]]), Math.random()));
    }
  });
  const uplinks: Cable[] = [];
  for (let q = 0; q < 4; q++) {
    const y = TRY + 6 + q * 3.2, za = SWZ + 10, zt = TRZ + 3.4;
    const xa = managers[0].sx + 58 + q * 2.2, xb = managers[1].sx + 30 - q * 2.2;
    uplinks.push(makeCable(route([[xa, y, za], [xa, y, zt], [xb, y, zt], [xb, y, za]], 5), q / 4));
  }
  const all = [...cables, ...uplinks];
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), M.glowAccent, all.length);
  pulses.count = 0;
  model.add(pulses);

  // Loss curve panel
  const lossPanel = rbox(5.2, 3.3, 0.16, M.clay, 0.08);
  lossPanel.position.set(-8.4, Y + 4.4, -2.6);
  lossPanel.rotation.y = 0.5;
  g.add(lossPanel);
  const loss = new CanvasPlane(1024, 640, 3.0);
  loss.mesh.position.set(-8.4 + Math.sin(0.5) * 0.09, Y + 4.4, -2.6 + Math.cos(0.5) * 0.09);
  loss.mesh.rotation.y = 0.5;
  g.add(loss.mesh);
  const lossAt = (x: number) => 0.18 + 0.72 * Math.exp(-x * 4.2) + 0.03 * Math.sin(x * 60) * (1 - x);
  let lastLoss = -1;
  const drawLoss = (k: number) => {
    loss.draw((ctx, w, h) => {
      ctx.fillStyle = "#7a776f";
      ctx.font = `500 30px ${fontStack("mono")}`;
      ctx.fillText("TRAIN LOSS · LLAMA-3.1-8B", 40, 60);
      ctx.fillStyle = C.accent;
      ctx.fillText(`SFT → RL   step ${Math.round(k * 4800)}`, 40, 104);
      ctx.strokeStyle = "rgba(36,36,42,0.12)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const y = 160 + i * 100;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(w - 40, y);
        ctx.stroke();
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      const n = Math.max(2, Math.floor(k * 200));
      for (let i = 0; i < n; i++) {
        const x = i / 199;
        const px = 40 + x * (w - 80);
        const py = 160 + (1 - lossAt(x)) * 420;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // RL phase marker
      if (k > 0.5) {
        const px = 40 + 0.5 * (w - 80);
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = C.accent;
        ctx.beginPath();
        ctx.moveTo(px, 150);
        ctx.lineTo(px, h - 60);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  };

  // 16 browser workers (WebArena rollouts)
  const browsers = new THREE.Group();
  browsers.position.set(0, Y + 12, -5);
  g.add(browsers);
  const variants = [0, 1, 2, 3].map((v) => {
    const c = new CanvasPlane(512, 340, 1);
    c.draw((ctx, w, h) => {
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, 0, 0, w, h, 22);
      ctx.fill();
      ctx.fillStyle = "#f0eee9";
      roundRect(ctx, 0, 0, w, 48, 22);
      ctx.fill();
      ctx.fillRect(0, 26, w, 22);
      ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(26 + i * 22, 24, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#e3e0d9";
      roundRect(ctx, 100, 13, w - 130, 22, 11);
      ctx.fill();
      ctx.fillStyle = "#bdb9b0";
      ctx.font = `500 13px ${fontStack("mono")}`;
      ctx.fillText(["shop.webarena/cart", "gitlab.webarena/issues", "maps.webarena/route", "reddit.webarena/f/ml"][v], 112, 29);
      // page body
      ctx.fillStyle = "#e9e6df";
      if (v === 0) {
        for (let i = 0; i < 6; i++) {
          roundRect(ctx, 24 + (i % 3) * 160, 70 + Math.floor(i / 3) * 130, 140, 110, 10);
          ctx.fill();
        }
      } else if (v === 1) {
        for (let i = 0; i < 7; i++) {
          roundRect(ctx, 24, 70 + i * 36, i % 2 ? 300 : 420, 22, 6);
          ctx.fill();
        }
      } else if (v === 2) {
        roundRect(ctx, 24, 66, w - 48, h - 90, 12);
        ctx.fill();
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(70, 270);
        ctx.bezierCurveTo(160, 120, 300, 300, 440, 110);
        ctx.stroke();
      } else {
        for (let i = 0; i < 4; i++) {
          roundRect(ctx, 24, 66 + i * 64, w - 48, 52, 10);
          ctx.fill();
        }
      }
    });
    return c.material;
  });
  const browserGeo = new THREE.PlaneGeometry(2.2, 1.46);
  const cursors: THREE.Mesh[] = [];
  const bars: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const pane = new THREE.Group();
    const back = rbox(2.34, 1.6, 0.06, M.clay, 0.06);
    back.castShadow = false;
    const face = new THREE.Mesh(browserGeo, variants[(i * 3) % 4]);
    face.position.z = 0.035;
    const cursor = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), M.glowAccent);
    cursor.position.z = 0.05;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.05), M.glowBlue);
    bar.position.set(0, -0.68, 0.05);
    pane.add(back, face, cursor, bar);
    pane.position.set((col - 1.5) * 2.6, (1.5 - row) * 1.85, 0);
    pane.rotation.y = (col - 1.5) * -0.12;
    pane.userData.seed = Math.random() * 10;
    browsers.add(pane);
    cursors.push(cursor);
    bars.push(bar);
  }

  const caption = label(
    [
      { text: "4 NODES × 4 GPUS · DEEPSPEED ZERO-3", font: "mono", size: 30, tracking: 4, color: "#7a776f" },
      { text: "16 BROWSER WORKERS · 800+ WEBARENA TASKS · 20 h → 3 h", font: "mono", size: 30, tracking: 4, color: C.accent },
    ],
    0.9,
    { pxW: 1400 },
  );
  caption.mesh.position.set(0, Y + 0.02, 9.2);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  // ── timeline (T: 0 → 1 across the chapter) ──
  const POWER = 0.93;
  const pose = (sv: (typeof servers)[number], T: number): V3 => {
    const t = win(T, 0.52 + sv.j * 0.06, 0.08);
    const [fx, fy] = sv.from, [rx, ry, rz] = sv.to, LZ = FZ + 60, pre = ry + 180;
    const A = sv.from, B: V3 = [fx, fy, LZ], Cc: V3 = [rx, pre, LZ], D: V3 = [rx, pre, rz];
    if (t < 0.14) return lerp3(A, B, smooth(0, 0.14, t));
    if (t < 0.55) return lerp3(B, Cc, smooth(0.14, 0.55, t));
    if (t < 0.7) return lerp3(Cc, D, smooth(0.55, 0.7, t));
    return lerp3(D, sv.to, smooth(0.7, 1, t));
  };
  const cableWin = (i: number) => 0.82 + (i >> 1) * 0.006 + (i & 1) * 0.002;

  // ── camera: skims the floor along the row of open servers while the GPUs drop
  // in, rides up with the nodes into the racks, then backs off for power-on ──
  const serverAt = (x: number) => new THREE.Vector3(235 * S - (x + SW / 2) * S, Y + 0.45, -300 * S + (250 + SD / 2) * S);
  const rackFront = new THREE.Vector3(235 * S - 225 * S, Y + 2.7, -300 * S + (RY0 + RKD) * S);
  type Key = { l: number; target: THREE.Vector3; az: number; polar: number; dist: number };
  const keys: Key[] = [
    { l: 0, target: serverAt(-150), az: 1.35, polar: 1.46, dist: 12 },
    { l: 0.27, target: serverAt(floorPos(0)[0]), az: 1.22, polar: 1.0, dist: 10 },
    { l: 0.33, target: serverAt(floorPos(1)[0]), az: 1.17, polar: 1.0, dist: 10 },
    { l: 0.38, target: serverAt(floorPos(2)[0]), az: 1.12, polar: 1.0, dist: 10 },
    { l: 0.44, target: serverAt(floorPos(3)[0]), az: 1.02, polar: 1.02, dist: 10.2 },
    { l: 0.52, target: rackFront.clone().add(new THREE.Vector3(-1.2, -1, 2.6)), az: 0.55, polar: 1.3, dist: 11 },
    { l: 0.62, target: rackFront, az: 0.15, polar: 1.3, dist: 12.5 },
    { l: 0.72, target: rackFront.clone().add(new THREE.Vector3(0, 0.6, 0)), az: -0.2, polar: 1.25, dist: 15 },
    { l: 1, target: rackFront.clone().add(new THREE.Vector3(0, 2.6, -1)), az: -0.5, polar: 1.12, dist: 21 },
  ];


  const shotOut = { target: new THREE.Vector3(), az: 0, polar: 0, dist: 0 };

  return {
    group: g,
    focus: new THREE.Vector3(0, 3.8, -1),
    shot(local) {
      let n = 0;
      while (n < keys.length - 2 && local > keys[n + 1].l) n++;
      const a = keys[n], b = keys[n + 1], u = smooth(a.l, b.l, local);
      shotOut.target.lerpVectors(a.target, b.target, u);
      shotOut.az = lerp(a.az, b.az, u);
      shotOut.polar = lerp(a.polar, b.polar, u);
      shotOut.dist = lerp(a.dist, b.dist, u);
      return shotOut;
    },
    update(t, _dt, local) {
      const T = clamp01((local - 0.26) / 0.46);
      const k = smooth(0.3, 0.95, local);
      const powered = T >= POWER;

      for (const sv of servers) {
        sv.grp.position.copy(at(...pose(sv, T)));
        sv.cards.forEach((c, n) => {
          const a = 0.03 + sv.j * 0.08 + n * 0.03;
          const e = easeOut(win(T, a, 0.06));
          c.g.visible = T > a - 0.01;
          c.g.position.y = (1 - e) * 120 * S;
          c.led.material = e >= 1 ? M.glowGreen : ledOff;
        });
        const lt = win(T, 0.43 + sv.j * 0.008, 0.04);
        sv.lid.visible = lt > 0;
        sv.lid.position.y = (1 - smooth(0, 1, lt)) * 70 * S;
        const on = powered && T >= POWER + sv.j * 0.004;
        sv.leds.forEach((l, q) => (l.material = on && (q === 0 || Math.sin(t * 11 + q * 2.1 + sv.j) > 0) ? M.glowGreen : ledOff));
      }

      const reveal = (c: Cable, a: number, d: number) => {
        const r = win(T, a, d);
        c.mesh.visible = r > 0;
        c.mesh.geometry.setDrawRange(0, Math.floor((r * c.total) / 6) * 6);
        c.mesh.material = powered ? cableOn : cableOff;
      };
      cables.forEach((c, i) => reveal(c, cableWin(i), 0.04));
      uplinks.forEach((c, i) => reveal(c, 0.86 + i * 0.008, 0.04));

      pulses.count = powered ? all.length : 0;
      if (powered) {
        all.forEach((c, i) => {
          const u = (t * (i < cables.length ? 0.7 : 0.45) + c.ph) % 1;
          dummy.position.copy(c.curve.getPointAt(u));
          dummy.scale.setScalar(0.6 + 0.6 * Math.sin(u * Math.PI));
          dummy.updateMatrix();
          pulses.setMatrixAt(i, dummy.matrix);
        });
        pulses.instanceMatrix.needsUpdate = true;
      }
      fillerLeds.forEach((l, q) => (l.material = powered && Math.sin(t * 7 + q * 2.7) > -0.5 ? M.glowGreen : ledOff));
      for (const m of managers) {
        m.swLed.material = powered ? M.glowGreen : ledOff;
        m.ports.forEach((p, q) => (p.material = powered && Math.sin(t * 14 + q * 1.7) > -0.3 ? M.glowAccent : ledOff));
      }

      const lk = Math.round(k * 120);
      if (lk !== lastLoss) {
        lastLoss = lk;
        drawLoss(Math.max(0.02, k));
      }

      browsers.children.forEach((pane, i) => {
        const s = pane.userData.seed as number;
        const c = cursors[i];
        c.position.x = Math.sin(t * 0.9 + s) * 0.8;
        c.position.y = Math.cos(t * 1.3 + s * 2) * 0.45;
        const prog = (t * 0.12 + s * 0.1) % 1;
        bars[i].scale.x = Math.max(0.001, prog);
        bars[i].position.x = -1 + prog;
        pane.position.z = Math.sin(t * 0.6 + s) * 0.15;
      });
      const bk = smooth(0.6, 0.8, local);
      browsers.position.y = Y + 12 - (1 - bk) * 2;
      browsers.scale.setScalar(0.62 + 0.18 * bk);
    },
  };
}
