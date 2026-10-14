import * as THREE from "three";
import { C, M, clamp01, fontStack, label, plinth, rbox, roundRect, smooth, type Station } from "./kit";
import { IM, drawApp, easeOut, iso, laptop, win } from "./iso";

/**
 * Education — Altgeld Hall on the Main Quad, built as the reader scrolls.
 * The quad is laid out, the hall rises course by course (wings, centre block,
 * bell tower), the roofs drop on, the trees grow, students open their laptops
 * on the benches, and at the end the windows light and the caps go up.
 */

const S = 0.05;
const BRICK = new THREE.MeshStandardMaterial({ color: "#a9553a", roughness: 0.85 });
const LIME = new THREE.MeshStandardMaterial({ color: "#dccfb6", roughness: 0.8 });
const ROOF = new THREE.MeshStandardMaterial({ color: "#454b55", roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide });
const LAWN = new THREE.MeshStandardMaterial({ color: "#bcd3ad", roughness: 0.95 });
const PATH = new THREE.MeshStandardMaterial({ color: "#e4ded2", roughness: 0.9 });
const LEAF = [new THREE.MeshStandardMaterial({ color: "#8fb287", roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: "#a9c69c", roughness: 0.9 })];
const BARK = new THREE.MeshStandardMaterial({ color: "#7a5a44", roughness: 0.9 });
const roofEdge = new THREE.LineBasicMaterial({ color: "#2a2d33", transparent: true, opacity: 0.5 });

type Facade = { cols: number; rows: number; door?: boolean; belfry?: boolean; topArch?: boolean };

export function campus(): Station {
  const g = new THREE.Group();
  g.add(plinth(18, 18));
  const Y = 0.66;
  const I = iso(S);
  const at = I.at;

  const model = new THREE.Group();
  model.position.set(-180 * S, Y, -180 * S);
  g.add(model);

  /** Hipped roof over a w × d rectangle at (x, y, z); a pyramid when square. */
  const hipRoof = (x: number, y: number, z: number, w: number, d: number, h: number, parent: THREE.Object3D) => {
    const long = w >= d;
    const r = (long ? d : w) / 2;
    const A = at(0, 0, 0), B = at(w, 0, 0), Cc = at(w, d, 0), D = at(0, d, 0);
    const R1 = long ? at(r, d / 2, h) : at(w / 2, r, h);
    const R2 = long ? at(w - r, d / 2, h) : at(w / 2, d - r, h);
    const tris = long
      ? [A, B, R2, A, R2, R1, Cc, D, R1, Cc, R1, R2, D, A, R1, B, Cc, R2]
      : [B, Cc, R2, B, R2, R1, D, A, R1, D, R1, R2, A, B, R1, Cc, D, R2];
    const geo = new THREE.BufferGeometry().setFromPoints(tris);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, ROOF);
    m.castShadow = true;
    m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), roofEdge));
    m.position.copy(at(x, y, z));
    parent.add(m);
    return m;
  };

  /** Brick facade with limestone sills, arched windows and an optional portal. */
  const facades: { draw: (lit: boolean) => void }[] = [];
  const facade = (w: number, h: number, f: Facade) => {
    const p = I.face(w, h, 6, () => {});
    const draw = (lit: boolean) =>
      p.draw((ctx, W, H) => {
        const k = W / w;
        ctx.fillStyle = "#a9553a";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(60,20,10,0.12)";
        for (let yy = 0; yy < H; yy += 7) for (let xx = (yy / 7) % 2 ? 0 : 9; xx < W; xx += 18) ctx.fillRect(xx, yy, 16, 1);
        const top = f.belfry ? 0.3 : 0;
        const rowH = (h * (1 - top)) / f.rows;
        const colW = w / f.cols;
        for (let r = 0; r < f.rows; r++)
          for (let c = 0; c < f.cols; c++) {
            const mid = f.door && r === f.rows - 1 && (c === Math.floor(f.cols / 2) || (f.cols % 2 === 0 && c === f.cols / 2 - 1));
            if (mid) continue;
            const ww = colW * 0.42, wh = rowH * 0.56;
            const x = (c + 0.5) * colW - ww / 2, y = h * top + r * rowH + rowH * 0.22;
            const arch = f.topArch && r === 0;
            ctx.fillStyle = lit ? (Math.sin(r * 7.1 + c * 3.3) > -0.5 ? "#ffd590" : "#3a3236") : "#2e2a2e";
            ctx.beginPath();
            if (arch) {
              ctx.moveTo(x * k, (y + wh) * k);
              ctx.lineTo(x * k, (y + ww / 2) * k);
              ctx.arc((x + ww / 2) * k, (y + ww / 2) * k, (ww / 2) * k, Math.PI, 0);
              ctx.lineTo((x + ww) * k, (y + wh) * k);
            } else ctx.rect(x * k, y * k, ww * k, wh * k);
            ctx.fill();
            ctx.fillStyle = "#dccfb6";
            ctx.fillRect((x - 0.6) * k, (y + wh) * k, (ww + 1.2) * k, 1.4 * k);
            ctx.fillStyle = "rgba(220,207,182,0.7)";
            ctx.fillRect((x + ww / 2 - 0.2) * k, y * k + (arch ? (ww / 2) * k : 0), 0.4 * k, wh * k - (arch ? (ww / 2) * k : 0));
          }
        if (f.door) {
          const dw = colW * 1.1, dh = rowH * 0.95, x = w / 2 - dw / 2, y = h - dh;
          ctx.fillStyle = "#dccfb6";
          ctx.beginPath();
          ctx.moveTo((x - 2) * k, H);
          ctx.lineTo((x - 2) * k, (y + dw / 2) * k);
          ctx.arc((w / 2) * k, (y + dw / 2) * k, (dw / 2 + 2) * k, Math.PI, 0);
          ctx.lineTo((x + dw + 2) * k, H);
          ctx.fill();
          ctx.fillStyle = lit ? "#ffcf80" : "#3a2c26";
          ctx.beginPath();
          ctx.moveTo(x * k, H);
          ctx.lineTo(x * k, (y + dw / 2) * k);
          ctx.arc((w / 2) * k, (y + dw / 2) * k, (dw / 2) * k, Math.PI, 0);
          ctx.lineTo((x + dw) * k, H);
          ctx.fill();
        }
        if (f.belfry) {
          const n = 3, bw = w / n;
          for (let i = 0; i < n; i++) {
            const x = i * bw + bw * 0.22, ww = bw * 0.56, y = h * 0.04, wh = h * 0.2;
            ctx.fillStyle = lit ? C.accent : "#26222a";
            ctx.beginPath();
            ctx.moveTo(x * k, (y + wh) * k);
            ctx.lineTo(x * k, (y + ww / 2) * k);
            ctx.arc((x + ww / 2) * k, (y + ww / 2) * k, (ww / 2) * k, Math.PI, 0);
            ctx.lineTo((x + ww) * k, (y + wh) * k);
            ctx.fill();
          }
          ctx.fillStyle = "#dccfb6";
          ctx.fillRect(0, h * 0.27 * k, W, 2 * k);
        }
      });
    draw(false);
    facades.push({ draw });
    return p.mesh;
  };

  /** A block of the hall that grows up from its base. */
  const block = (x: number, y: number, z: number, w: number, d: number, h: number, front: Facade, side?: Facade) => {
    const grp = new THREE.Group();
    grp.position.copy(at(x, y, z));
    model.add(grp);
    I.solid(0, 0, 0, w, d, h, BRICK, grp);
    for (const bz of [Math.round(h * 0.45), h - 3]) I.solid(-1, -1, bz, w + 2, d + 2, bz === h - 3 ? 3 : 1.6, LIME, grp);
    const f = facade(w, h - 4, front);
    f.position.copy(at(w / 2, d + 1.2, (h - 4) / 2));
    grp.add(f);
    if (side) {
      const s = facade(d, h - 4, side);
      s.rotation.y = -Math.PI / 2;
      s.position.copy(at(-1.2, d / 2, (h - 4) / 2));
      grp.add(s);
    }
    grp.scale.y = 0.001;
    return grp;
  };

  // ── the quad ──
  const ground = new THREE.Group();
  model.add(ground);
  I.part(12, 160, 0, 336, 170, 0.5, LAWN, ground);
  const paths = [
    I.part(168, 166, 0, 24, 164, 0.8, PATH, ground),
    I.part(12, 240, 0, 336, 14, 0.8, PATH, ground),
    I.part(48, 154, 0, 264, 16, 0.8, PATH, ground),
  ];

  // ── Altgeld Hall ──
  const base = new THREE.Group();
  model.add(base);
  I.solid(66, 38, 0, 228, 104, 8, LIME, base);
  I.solid(126, 46, 0, 108, 108, 8, LIME, base);
  for (let s = 0; s < 4; s++) I.solid(150 + s * 4, 154 + 0, 0, 60 - s * 8, 12 - s * 3, 2 + s * 2, LIME, base);
  base.scale.y = 0.001;

  const wingL = block(70, 40, 8, 60, 100, 50, { cols: 3, rows: 2, topArch: true }, { cols: 5, rows: 2, topArch: true });
  const wingR = block(230, 40, 8, 60, 100, 50, { cols: 3, rows: 2, topArch: true });
  const centre = block(130, 50, 8, 100, 100, 64, { cols: 4, rows: 3, door: true, topArch: true });
  const tower = block(198, 120, 8, 34, 34, 124, { cols: 1, rows: 2, belfry: true }, { cols: 1, rows: 2, belfry: true });
  const blocks = [wingL, wingR, centre, tower];

  const roofs = [
    hipRoof(68, 38, 58, 64, 104, 34, model),
    hipRoof(228, 38, 58, 64, 104, 34, model),
    hipRoof(128, 48, 72, 104, 104, 40, model),
  ];
  const spire = new THREE.Group();
  model.add(spire);
  hipRoof(196, 118, 132, 38, 38, 52, spire);
  I.solid(213.5, 135.5, 184, 3, 3, 10, LIME, spire);
  const roofY = [...roofs, spire].map((r) => r.position.y);

  // ── trees along the paths ──
  const trees = [
    [104, 300], [256, 300], [36, 196], [324, 196], [36, 296], [324, 296], [30, 70], [330, 80],
  ].map(([x, y], i) => {
    const t = new THREE.Group();
    t.position.copy(at(x, y, 0.5));
    model.add(t);
    const trunk = rbox(0.24, 1.2, 0.24, BARK, 0.05);
    trunk.position.y = 0.6;
    const a = rbox(2.0, 1.3, 2.0, LEAF[i % 2], 0.4);
    a.position.y = 1.7;
    const b = rbox(1.4, 1.0, 1.4, LEAF[(i + 1) % 2], 0.35);
    b.position.y = 2.6;
    t.add(trunk, a, b);
    t.scale.setScalar(0.001);
    return t;
  });

  // ── students: benches on the quad, a laptop on each ──
  const P = iso(0.018);
  const screens = ["CS 598 · ML systems", "ECE 391 · mp3", "MCS · thesis.tex"];
  const benches = [
    [96, 268], [264, 268], [56, 176],
  ].map(([x, y], i) => {
    const b = new THREE.Group();
    b.position.copy(at(x, y, 0.8));
    model.add(b);
    I.solid(-26, -8, 7, 52, 16, 2.5, LIME, b);
    I.solid(-22, -6, 0, 6, 12, 7, LIME, b);
    I.solid(16, -6, 0, 6, 12, 7, LIME, b);
    const holder = new THREE.Group();
    holder.position.copy(at(0, 0, 9.5));
    holder.rotation.y = (i - 1) * 0.25;
    b.add(holder);
    const lap = laptop(P, -33, -23, 0, holder, { title: screens[i] });
    lap.setOpen(0);
    b.scale.setScalar(0.001);
    return { b, lap, title: screens[i] };
  });
  const drawCode = (lap: (typeof benches)[number]["lap"], title: string, n: number) =>
    lap.screen.draw((ctx, W, H) =>
      drawApp(ctx, W, H, title, (c, x, y, w, h) => {
        const lh = h / 9;
        for (let i = 0; i < Math.min(8, n); i++) {
          c.fillStyle = i % 3 === 0 ? C.accent : i % 3 === 1 ? C.blue : "#9a968e";
          roundRect(c, x + (i % 4) * lh * 0.6, y + i * lh, w * (0.35 + ((i * 37) % 50) / 100), lh * 0.45, lh * 0.2);
          c.fill();
        }
      }),
    );
  let codeShown = -1;

  // Mortarboards for the end beat.
  const caps = [0, 1, 2].map((i) => {
    const c = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.1), IM.dark);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), IM.dark);
    crown.position.y = -0.18;
    const tassel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), M.glowAccent);
    tassel.position.set(0.5, -0.22, 0.5);
    board.castShadow = true;
    c.add(board, crown, tassel);
    c.position.copy(at([96, 180, 264][i], 230, 0));
    c.visible = false;
    model.add(c);
    return c;
  });

  // Sign at the head of the path.
  const sign = new THREE.Group();
  model.add(sign);
  I.solid(200, 306, 0.5, 70, 8, 14, LIME, sign);
  const st = I.face(66, 11, 12, (ctx, k, W, H) => {
    ctx.fillStyle = "#dccfb6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.ink;
    ctx.textBaseline = "top";
    ctx.font = `500 ${4 * k}px ${fontStack("serif")}`;
    ctx.fillText("Altgeld Hall", 2 * k, 1.2 * k);
    ctx.fillStyle = "#7a776f";
    ctx.font = `500 ${2.2 * k}px ${fontStack("mono")}`;
    ctx.fillText("UIUC · MAIN QUAD · URBANA, IL", 2 * k, 6.8 * k);
  });
  st.mesh.position.copy(at(235, 314.15, 8));
  sign.add(st.mesh);

  const caption = label(
    [
      { text: "MASTER OF COMPUTER SCIENCE · 2025 — 2026", font: "mono", size: 30, tracking: 4, color: "#7a776f" },
      { text: "B.S. COMPUTER ENGINEERING · 2021 — 2025", font: "mono", size: 30, tracking: 4, color: C.accent },
    ],
    0.9,
    { pxW: 1300 },
  );
  caption.mesh.position.set(0, Y + 0.03, 8.1);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  let lit = false;

  return {
    group: g,
    focus: new THREE.Vector3(0, 3.4, -0.5),
    update(t, _dt, local) {
      const T = clamp01((local - 0.18) / 0.54);

      // Quad: paths run out from the hall.
      paths.forEach((p, i) => {
        const r = Math.max(0.001, easeOut(win(T, 0.0 + i * 0.03, 0.1)));
        p.scale.set(i === 0 ? 1 : r, 1, i === 0 ? r : 1);
      });
      base.scale.y = Math.max(0.001, easeOut(win(T, 0.04, 0.06)));
      blocks.forEach((b, i) => (b.scale.y = Math.max(0.001, smooth(0, 1, win(T, 0.1 + i * 0.07, 0.14)))));
      [...roofs, spire].forEach((r, i) => {
        const e = easeOut(win(T, 0.44 + i * 0.05, 0.08));
        r.visible = e > 0;
        r.position.y = roofY[i] + (1 - e) * 2.6;
      });
      trees.forEach((tr, i) => tr.scale.setScalar(Math.max(0.001, 0.8 * easeOut(win(T, 0.58 + i * 0.015, 0.08)))));
      benches.forEach(({ b, lap }, i) => {
        b.scale.setScalar(Math.max(0.001, easeOut(win(T, 0.66 + i * 0.03, 0.06))));
        lap.setOpen(smooth(0, 1, win(T, 0.72 + i * 0.03, 0.06)));
      });
      const n = Math.round(win(T, 0.76, 0.14) * 8);
      if (n !== codeShown) {
        codeShown = n;
        benches.forEach((bb) => drawCode(bb.lap, bb.title, n));
      }

      const on = T >= 0.9;
      if (on !== lit) {
        lit = on;
        facades.forEach((f) => f.draw(on));
      }
      caps.forEach((c, i) => {
        c.visible = T >= 0.93;
        if (!c.visible) return;
        const ph = t * 0.9 + i * 2.1;
        c.position.y = 5.2 + i * 0.5 + Math.sin(ph) * 0.35;
        c.rotation.set(Math.sin(ph * 0.7) * 0.35, t * 0.8 + i, Math.cos(ph * 0.6) * 0.3);
      });
    },
  };
}
