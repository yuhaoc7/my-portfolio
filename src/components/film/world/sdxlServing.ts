import * as THREE from "three";
import { C, M, clamp01, fontStack, label, plinth, roundRect, smooth, type Station } from "./kit";
import { IM, desktop, drawApp, easeOut, iso, laptop, win, type V3 } from "./iso";

/**
 * HiABR — SDXL served from 2 nodes × 4 GPUs behind Nginx least-connections.
 *
 * Four people at two desks (two laptops, two desktops) and a Locust load
 * generator with its swarm of virtual users are cabled into a small network
 * cabinet whose 3U Nginx appliance shows the live connection count for each
 * of the eight upstream workers. Two open-frame inference nodes carry four
 * 24 GB cards each; every card has a bounded queue shelf in front of it.
 *
 * As the reader scrolls the set is built (desks, nodes, cards, cabinet, cables),
 * the cluster powers on and passes health checks, and then traffic flows:
 * prompts are typed on the users' screens, travel as tokens to the balancer,
 * which sends each to the least-busy GPU; GPUs pull micro-batches of up to four
 * from their queue, the fans spin up, and finished images travel back to the
 * screen that asked for them. Locust ramps from 4 to 64 users.
 */

// Model units: 1 = 5 mm. Model axes: x across, y front-to-back (front = +y), z up.
const S = 0.026;
const DT = 150; // desk top height (75 cm)
const NY = -60; // node base back edge
const NODE_X = [20, 240];
const cardZ = (k: number) => 48 + k * 38;
const laneIn = (k: number) => 9.2 - k * 2.2;
const laneOut = (k: number) => 173 + k * 2.2;
const QCAP = 8;
const SPEED = 9; // world units / s for tokens
const NT = 96;
const NIM = 96;
const NSWARM = 64;
const LOCUST = 4;

// Timeline (T: 0 → 1)
const T_DESK = [0.02, 0.07];
const T_NODE = [0.0, 0.05];
const T_CARD = (gp: number) => 0.1 + gp * 0.022;
const T_RACK = 0.08;
const T_UNIT = [0.16, 0.2, 0.24, 0.27];
const T_LOCUST = 0.12;
const T_DASH = 0.28;
const T_UCAB = (u: number) => 0.34 + u * 0.03;
const T_NCAB = (n: number) => 0.48 + n * 0.03;
const T_ICAB = (gp: number) => 0.53 + gp * 0.008;
const POWER = 0.64;
const HEALTH = (gp: number) => 0.66 + gp * 0.012;
const LIVE = 0.76;

const PROMPTS = [
  "a lighthouse at dusk, oil painting",
  "misty mountains at sunrise, ink wash",
  "neon city street in the rain, 35mm",
  "a cabin under the northern lights",
  "sunflower field at golden hour",
  "koi pond seen from above, ukiyo-e",
];
const TILE = ["#f0956a", "#9aa3ad", "#7a6cff", "#3ad59a", "#f2b632", "#3fb3ad"].map((c) => new THREE.Color(c));

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* Procedural "SDXL outputs", one per prompt, painted once into 256² canvases   */
/* -------------------------------------------------------------------------- */

type Painter = (c: CanvasRenderingContext2D, s: number) => void;
const PAINT: Painter[] = [
  // lighthouse at dusk
  (c, s) => {
    const sky = c.createLinearGradient(0, 0, 0, s * 0.62);
    sky.addColorStop(0, "#2b2d5c");
    sky.addColorStop(0.6, "#c8607a");
    sky.addColorStop(1, "#f9b97a");
    c.fillStyle = sky;
    c.fillRect(0, 0, s, s * 0.62);
    c.fillStyle = "#ffd9a0";
    c.beginPath();
    c.arc(s * 0.72, s * 0.62, s * 0.09, Math.PI, 0);
    c.fill();
    const sea = c.createLinearGradient(0, s * 0.62, 0, s);
    sea.addColorStop(0, "#3b4a6e");
    sea.addColorStop(1, "#1c2440");
    c.fillStyle = sea;
    c.fillRect(0, s * 0.62, s, s * 0.38);
    c.fillStyle = "rgba(255,210,160,0.5)";
    for (let i = 0; i < 9; i++) {
      const w = s * (0.16 - i * 0.012);
      c.fillRect(s * 0.72 - w / 2, s * (0.65 + i * 0.035), w, s * 0.008);
    }
    c.fillStyle = "rgba(255,236,190,0.28)";
    c.beginPath();
    c.moveTo(s * 0.28, s * 0.27);
    c.lineTo(s * 0.98, s * 0.12);
    c.lineTo(s * 0.98, s * 0.32);
    c.fill();
    c.fillStyle = "#151a2c";
    c.beginPath();
    c.moveTo(0, s * 0.7);
    c.lineTo(s * 0.18, s * 0.6);
    c.lineTo(s * 0.4, s * 0.66);
    c.lineTo(s * 0.46, s * 0.78);
    c.lineTo(0, s * 0.84);
    c.fill();
    c.fillStyle = "#f3eee6";
    c.beginPath();
    c.moveTo(s * 0.245, s * 0.62);
    c.lineTo(s * 0.265, s * 0.3);
    c.lineTo(s * 0.295, s * 0.3);
    c.lineTo(s * 0.315, s * 0.62);
    c.fill();
    c.fillStyle = "#c2413a";
    for (const v of [0.36, 0.46, 0.56]) c.fillRect(s * 0.25, s * v, s * 0.062, s * 0.035);
    c.fillStyle = "#ffe7a8";
    c.fillRect(s * 0.262, s * 0.255, s * 0.036, s * 0.045);
    c.fillStyle = "#151a2c";
    c.fillRect(s * 0.255, s * 0.24, s * 0.05, s * 0.016);
  },
  // misty mountains, ink wash
  (c, s) => {
    c.fillStyle = "#f1ede4";
    c.fillRect(0, 0, s, s);
    c.fillStyle = "#e8735a";
    c.beginPath();
    c.arc(s * 0.68, s * 0.3, s * 0.09, 0, Math.PI * 2);
    c.fill();
    ["#cdd1d6", "#9aa3ad", "#68727e", "#363d48"].forEach((col, i) => {
      const base = s * (0.42 + i * 0.13);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, s);
      for (let x = 0; x <= s; x += s / 32) c.lineTo(x, base - s * 0.12 * Math.abs(Math.sin((x / s) * (3 + i) * 1.3 + i * 1.7)) - s * 0.03 * Math.sin((x / s) * 17 + i));
      c.lineTo(s, s);
      c.fill();
      if (i < 3) {
        const mist = c.createLinearGradient(0, base - s * 0.04, 0, base + s * 0.12);
        mist.addColorStop(0, "rgba(241,237,228,0)");
        mist.addColorStop(1, "rgba(241,237,228,0.7)");
        c.fillStyle = mist;
        c.fillRect(0, base - s * 0.04, s, s * 0.16);
      }
    });
  },
  // neon city in the rain
  (c, s) => {
    const r = rng(7);
    const bg = c.createLinearGradient(0, 0, 0, s);
    bg.addColorStop(0, "#120f2a");
    bg.addColorStop(1, "#2a1b4d");
    c.fillStyle = bg;
    c.fillRect(0, 0, s, s);
    const neon = ["#ff5a1f", "#ffd166", "#6a8cff", "#ff4fa3"];
    for (let i = 0; i < 9; i++) {
      const w = s * (0.1 + r() * 0.1), x = (i * s) / 8 - s * 0.03, h = s * (0.3 + r() * 0.4);
      c.fillStyle = i % 2 ? "#1b1736" : "#231e44";
      c.fillRect(x, s * 0.78 - h, w, h);
      for (let wy = s * 0.78 - h + 6; wy < s * 0.74; wy += 9)
        for (let wx = x + 4; wx < x + w - 4; wx += 7)
          if (r() < 0.35) {
            c.fillStyle = neon[(r() * 4) | 0];
            c.fillRect(wx, wy, 3, 4);
          }
    }
    c.fillStyle = "#0d0b1e";
    c.fillRect(0, s * 0.78, s, s * 0.22);
    for (let i = 0; i < 26; i++) {
      c.fillStyle = neon[i % 4];
      c.globalAlpha = 0.25 + r() * 0.3;
      c.fillRect(r() * s, s * 0.8, 2 + r() * 3, s * (0.05 + r() * 0.15));
    }
    c.globalAlpha = 1;
    c.strokeStyle = "rgba(200,210,255,0.25)";
    c.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = r() * s, y = r() * s;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 3, y + 10);
      c.stroke();
    }
  },
  // cabin under the northern lights
  (c, s) => {
    const r = rng(11);
    const bg = c.createLinearGradient(0, 0, 0, s);
    bg.addColorStop(0, "#06101f");
    bg.addColorStop(1, "#12345a");
    c.fillStyle = bg;
    c.fillRect(0, 0, s, s);
    c.fillStyle = "#ffffff";
    for (let i = 0; i < 50; i++) {
      c.globalAlpha = 0.3 + r() * 0.6;
      c.fillRect(r() * s, r() * s * 0.6, 1.5, 1.5);
    }
    c.globalAlpha = 1;
    c.lineCap = "round";
    for (const band of [
      { col: "rgba(58,213,154,0.55)", v: 0.28, lw: 26 },
      { col: "rgba(120,230,190,0.35)", v: 0.36, lw: 16 },
      { col: "rgba(140,100,255,0.3)", v: 0.22, lw: 14 },
    ]) {
      c.strokeStyle = band.col;
      c.lineWidth = band.lw;
      c.beginPath();
      for (let x = -10; x <= s + 10; x += 8) {
        const y = s * band.v + Math.sin(x / 38) * s * 0.06 + Math.sin(x / 13) * s * 0.015;
        if (x < 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.fillStyle = "#dfe8f0";
    c.beginPath();
    c.moveTo(0, s * 0.8);
    c.quadraticCurveTo(s * 0.5, s * 0.7, s, s * 0.78);
    c.lineTo(s, s);
    c.lineTo(0, s);
    c.fill();
    c.fillStyle = "#0b1a2c";
    for (const [x, h] of [[0.1, 0.22], [0.18, 0.3], [0.84, 0.26], [0.92, 0.2]]) {
      c.beginPath();
      c.moveTo(s * x, s * (0.8 - h));
      c.lineTo(s * (x + 0.06), s * 0.81);
      c.lineTo(s * (x - 0.06), s * 0.81);
      c.fill();
    }
    c.fillStyle = "#5b3a29";
    c.fillRect(s * 0.42, s * 0.64, s * 0.2, s * 0.12);
    c.fillStyle = "#2a1a12";
    c.beginPath();
    c.moveTo(s * 0.4, s * 0.645);
    c.lineTo(s * 0.52, s * 0.56);
    c.lineTo(s * 0.64, s * 0.645);
    c.fill();
    c.fillStyle = "#ffcf6b";
    c.fillRect(s * 0.47, s * 0.68, s * 0.04, s * 0.04);
    c.fillRect(s * 0.55, s * 0.68, s * 0.04, s * 0.04);
  },
  // sunflower field
  (c, s) => {
    const r = rng(5);
    const sky = c.createLinearGradient(0, 0, 0, s * 0.5);
    sky.addColorStop(0, "#8ec5de");
    sky.addColorStop(1, "#f6d28b");
    c.fillStyle = sky;
    c.fillRect(0, 0, s, s * 0.5);
    c.fillStyle = "#fff1c9";
    c.beginPath();
    c.arc(s * 0.3, s * 0.42, s * 0.08, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4f7a2a";
    c.fillRect(0, s * 0.48, s, s * 0.52);
    const fl = Array.from({ length: 70 }, () => ({ v: r(), x: r() * s })).sort((a, b) => a.v - b.v);
    for (const f of fl) {
      const y = s * (0.5 + f.v * f.v * 0.5), rad = 2 + f.v * f.v * 16;
      c.fillStyle = "#f2b632";
      c.beginPath();
      c.arc(f.x, y, rad, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5a3a1a";
      c.beginPath();
      c.arc(f.x, y, rad * 0.45, 0, Math.PI * 2);
      c.fill();
    }
  },
  // koi pond, ukiyo-e
  (c, s) => {
    const r = rng(3);
    const bg = c.createRadialGradient(s * 0.5, s * 0.5, s * 0.1, s * 0.5, s * 0.5, s * 0.75);
    bg.addColorStop(0, "#3fb3ad");
    bg.addColorStop(1, "#165e63");
    c.fillStyle = bg;
    c.fillRect(0, 0, s, s);
    c.strokeStyle = "rgba(255,255,255,0.18)";
    c.lineWidth = 2;
    for (const [x, y] of [[0.3, 0.3], [0.7, 0.65]])
      for (let k = 1; k < 4; k++) {
        c.beginPath();
        c.arc(s * x, s * y, k * s * 0.06, 0, Math.PI * 2);
        c.stroke();
      }
    c.fillStyle = "#3f8f4f";
    for (const [x, y, rr] of [[0.15, 0.75, 0.09], [0.82, 0.2, 0.07], [0.62, 0.88, 0.06]]) {
      c.beginPath();
      c.moveTo(s * x, s * y);
      c.arc(s * x, s * y, s * rr, 0.4, Math.PI * 2 - 0.1);
      c.closePath();
      c.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = s * (0.2 + r() * 0.6), y = s * (0.2 + r() * 0.6), a = r() * Math.PI * 2;
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.fillStyle = "#ff7a3d";
      c.beginPath();
      c.ellipse(0, 0, s * 0.07, s * 0.025, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(-s * 0.06, 0);
      c.lineTo(-s * 0.11, -s * 0.025);
      c.lineTo(-s * 0.11, s * 0.025);
      c.fill();
      c.fillStyle = "#fff4ea";
      c.beginPath();
      c.ellipse(s * 0.02, 0, s * 0.025, s * 0.016, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  },
];

/* -------------------------------------------------------------------------- */
/* Token paths: chains of curves (cables) and hidden straight legs              */
/* -------------------------------------------------------------------------- */

type Leg = { c: THREE.Curve<THREE.Vector3>; len: number; rev: boolean };
type Path = { legs: Leg[]; cum: number[]; total: number };
const legOf = (c: THREE.Curve<THREE.Vector3>, rev = false): Leg => ({ c, len: c.getLength(), rev });
function mkPath(legs: Leg[]): Path {
  const cum = [0];
  for (const l of legs) cum.push(cum[cum.length - 1] + l.len);
  return { legs, cum, total: cum[cum.length - 1] };
}
function sample(p: Path, s: number, out: THREE.Vector3) {
  let i = 0;
  while (i < p.legs.length - 1 && s > p.cum[i + 1]) i++;
  const L = p.legs[i];
  let u = L.len > 0 ? clamp01((s - p.cum[i]) / L.len) : 0;
  if (L.rev) u = 1 - u;
  L.c.getPointAt(u, out);
}

function rotorGeo(R: number) {
  const P = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  const shapes: THREE.Shape[] = [];
  const hub = new THREE.Shape();
  hub.absarc(0, 0, R * 0.3, 0, Math.PI * 2, false);
  shapes.push(hub);
  for (let b = 0; b < 9; b++) {
    const a = (b / 9) * Math.PI * 2;
    const sh = new THREE.Shape();
    const p0 = P(R * 0.26, a), p1 = P(R, a + 0.32), p2 = P(R, a + 0.62), p3 = P(R * 0.26, a + 0.5);
    const c0 = P(R * 0.72, a + 0.06), c1 = P(R * 0.66, a + 0.5);
    sh.moveTo(p0.x, p0.y);
    sh.quadraticCurveTo(c0.x, c0.y, p1.x, p1.y);
    sh.lineTo(p2.x, p2.y);
    sh.quadraticCurveTo(c1.x, c1.y, p3.x, p3.y);
    sh.closePath();
    shapes.push(sh);
  }
  return new THREE.ExtrudeGeometry(shapes, { depth: 0.8 * S, bevelEnabled: false, curveSegments: 4 });
}

function wrapText(c: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number, maxLines: number) {
  const words = text.split(" ");
  let line = "", ln = 0, cx = x;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (c.measureText(test).width > w && line) {
      c.fillText(line, x, y + ln * lh);
      ln++;
      line = words[i];
      if (ln >= maxLines) return { x: cx, y: y + (ln - 1) * lh };
    } else line = test;
  }
  c.fillText(line, x, y + ln * lh);
  cx = x + c.measureText(line).width;
  return { x: cx, y: y + ln * lh };
}

/* -------------------------------------------------------------------------- */

export function sdxlServing(): Station {
  const I = iso(S);
  const { at, part, solid, face, cable } = I;
  const g = new THREE.Group();
  g.add(plinth(24, 15));
  const Y = 0.66;
  const model = new THREE.Group();
  model.position.y = Y;
  g.add(model);
  const E = { shadow: true, edges: true };
  const dummy = new THREE.Object3D();
  const mono = (px: number, w = 500) => `${w} ${px}px ${fontStack("mono")}`;
  const sans = (px: number, w = 400) => `${w} ${px}px ${fontStack("sans")}`;

  const imgs = PAINT.map((p) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    p(cv.getContext("2d")!, 256);
    return cv;
  });
  const noise = document.createElement("canvas");
  noise.width = noise.height = 48;
  {
    const c = noise.getContext("2d")!;
    const d = c.createImageData(48, 48);
    const r = rng(99);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 60 + r() * 160;
      d.data[i] = v;
      d.data[i + 1] = v * 0.96;
      d.data[i + 2] = Math.min(255, v * 1.04);
      d.data[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  }

  /* ── desks and the people at them ─────────────────────────────────────── */

  function desk(x: number, y: number, w: number, d: number) {
    const grp = new THREE.Group();
    model.add(grp);
    solid(x, y, DT - 4, w, d, 4, M.clay, grp);
    for (const [lx, ly] of [[x + 3, y + 3], [x + w - 7, y + 3], [x + 3, y + d - 7], [x + w - 7, y + d - 7]]) part(lx, ly, 0, 4, 4, DT - 4, IM.dark, grp, E);
    part(x + 7, y + 3, DT - 16, w - 14, 2, 12, IM.dark, grp, E);
    return grp;
  }
  const deskA = desk(-445, 130, 245, 120);
  const deskB = desk(-445, -150, 255, 110);
  solid(-441, 232, DT, 6, 6, 9, M.clay2, deskA); // mug
  part(-240, -68, DT, 16, 20, 0.8, M.clay2, deskB, { edges: true }); // notepad
  part(-236, -64, DT + 0.8, 1.2, 14, 1.2, M.accent, deskB); // pen

  type Dev = { screen: { draw: (fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => void }; setOpen?: (t: number) => void; led?: THREE.Mesh };
  const dA0 = laptop(I, -435, 175, DT, deskA, { ppu: 8 });
  const dA1 = desktop(I, -367, 150, DT, deskA, { ppu: 6 });
  const dB0 = desktop(I, -435, -140, DT, deskB, { ppu: 6 });
  const dB1 = laptop(I, -262, -120, DT, deskB, { ppu: 8 });

  // Locust load generator: a laptop on a clay pedestal, with its swarm of virtual users.
  const locustG = new THREE.Group();
  model.add(locustG);
  solid(30, 150, 0, 100, 76, 44, M.clay2, locustG);
  const dL = laptop(I, 47, 170, 44, locustG, { ppu: 8 });
  {
    const f = face(84, 22, 6, (c, k, W, H) => {
      c.fillStyle = "#e6e3dc";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#7a776f";
      c.font = mono(4.2 * k);
      c.textBaseline = "top";
      c.fillText("LOAD GENERATOR", 4 * k, 3 * k);
      c.fillStyle = C.accent;
      c.font = mono(3.6 * k);
      c.fillText("locust -u 64 -r 4", 4 * k, 9.5 * k);
      c.fillStyle = "#7a776f";
      c.fillText("POST /generate", 4 * k, 15 * k);
    });
    f.mesh.position.copy(at(80, 226.05, 22));
    locustG.add(f.mesh);
  }
  solid(150, 100, 0, 262, 168, 4, M.clay2, locustG);
  const swarmBody = new THREE.InstancedMesh(new THREE.BoxGeometry(16 * S, 12 * S, 5 * S), IM.dark, NSWARM);
  const swarmScr = new THREE.InstancedMesh(new THREE.PlaneGeometry(13 * S, 8.4 * S), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), NSWARM);
  swarmBody.castShadow = true;
  locustG.add(swarmBody, swarmScr);
  const swarmPos = Array.from({ length: NSWARM }, (_, i) => at(176 + (i % 8) * 30, 116 + Math.floor(i / 8) * 19, 10));
  const swarmOrder = Array.from({ length: NSWARM }, (_, i) => i);
  {
    const r = rng(42);
    for (let i = NSWARM - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [swarmOrder[i], swarmOrder[j]] = [swarmOrder[j], swarmOrder[i]];
    }
  }
  const swarmRank = new Int16Array(NSWARM);
  swarmOrder.forEach((cell, rank) => (swarmRank[cell] = rank));
  const swarmFlash = new Float32Array(NSWARM).fill(-9);
  const colOff = new THREE.Color("#3a3a40"), colIdle = new THREE.Color("#e9e6df"), colHot = new THREE.Color(C.accent);
  for (let i = 0; i < NSWARM; i++) swarmScr.setColorAt(i, colOff);

  const devs: Dev[] = [dA0, dA1, dB0, dB1, dL];
  const NAMES = ["mia · laptop", "ravi · desktop", "jun · desktop", "sam · laptop"];
  const desks = [deskA, deskB];

  /* ── network cabinet with the Nginx appliance ─────────────────────────── */

  const rack = new THREE.Group();
  model.add(rack);
  solid(-150, -45, 0, 120, 110, 6, IM.dark, rack);
  solid(-150, -45, 6, 3, 110, 140, IM.dark, rack);
  solid(-33, -45, 6, 3, 110, 140, IM.dark, rack);
  part(-147, -45, 6, 114, 3, 140, IM.board, rack);
  solid(-150, -45, 146, 120, 110, 4, IM.dark, rack);
  part(-141, 55, 6, 3, 4, 140, IM.inner, rack, E);
  part(-42, 55, 6, 3, 4, 140, IM.inner, rack, E);
  for (const z of [28, 37, 46, 83, 101, 119, 128]) part(-138, 60, z + 0.2, 96, 1, 8.6, IM.inner, rack, { edges: true });
  {
    const tag = face(56, 4, 10, (c, k, W, H) => {
      c.fillStyle = "#2b2b31";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#d9d6cf";
      c.font = mono(2.8 * k);
      c.textBaseline = "middle";
      c.textAlign = "center";
      c.fillText("LB-01 · EDGE CABINET 14U", W / 2, H / 2);
    });
    tag.mesh.position.copy(at(-90, 65.05, 148));
    rack.add(tag.mesh);
  }

  const panelBase = (c: CanvasRenderingContext2D, W: number, H: number) => {
    c.fillStyle = "#33333a";
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "#55555e";
    c.lineWidth = 2;
    c.strokeRect(1, 1, W - 2, H - 2);
  };
  const port = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    c.fillStyle = "#141417";
    roundRect(c, x, y, w, h, Math.min(w, h) * 0.15);
    c.fill();
    c.fillStyle = "#2c2c33";
    c.fillRect(x + w * 0.3, y + h * 0.62, w * 0.4, h * 0.22);
  };

  const units: THREE.Group[] = [];
  const unit = (z: number, h: number, ppu: number, draw: (c: CanvasRenderingContext2D, k: number, W: number, H: number) => void) => {
    const grp = new THREE.Group();
    rack.add(grp);
    solid(-138, -39, z, 96, 100, h, IM.dark, grp);
    const f = face(96, h, ppu, draw);
    f.mesh.position.copy(at(-90, 61.05, z + h / 2));
    grp.add(f.mesh);
    units.push(grp);
    return { grp, f };
  };
  // UPS 2U
  const ups = unit(10, 17.6, 6, (c, k, W, H) => {
    panelBase(c, W, H);
    c.fillStyle = "#26262b";
    for (let i = 0; i < 7; i++) c.fillRect(4 * k, (3 + i * 1.8) * k, 30 * k, 0.9 * k);
    c.fillStyle = "#121216";
    roundRect(c, 40 * k, 4 * k, 22 * k, 9 * k, 4);
    c.fill();
    c.fillStyle = "#17a974";
    c.font = mono(2.6 * k);
    c.textBaseline = "top";
    c.fillText("ON-LINE 230V", 41.5 * k, 5.2 * k);
    c.fillStyle = "#9a968e";
    c.fillText("LOAD ▮▮▮▯▯", 41.5 * k, 9 * k);
    c.fillStyle = "#d9d6cf";
    c.font = mono(3 * k);
    c.fillText("UPS 1500VA", 68 * k, 6 * k);
  });
  const upsLed = part(-58, 61, 5 + 10, 2, 0.5, 2, IM.ledOff, ups.grp);

  // Nginx 3U — the balancer. Its LCD shows the live connection count for each upstream.
  const NZ = 56, NH = 26.6;
  const IN_Z = [69, 64, 79, 74, 59]; // ingress port z per user (U0, U1, U2, U3, Locust)
  const OUT_Z = [64, 74];
  const ng = unit(NZ, NH, 8, () => {});
  const nginxFace = ng.f;
  const inLed = IN_Z.map((z) => part(-128.4, 61, z - 0.8, 1.6, 0.5, 1.6, IM.ledOff, ng.grp));
  const outLed = OUT_Z.map((z) => part(-52.4, 61, z - 0.8, 1.6, 0.5, 1.6, IM.ledOff, ng.grp));
  // Switch 1U
  const SW_LED = 12;
  const sw = unit(92, 8.6, 8, (c, k, W, H) => {
    panelBase(c, W, H);
    c.fillStyle = "#d9d6cf";
    c.font = mono(2.6 * k);
    c.textBaseline = "middle";
    c.fillText("SW-01 · 10GbE", 3 * k, H / 2);
    for (let q = 0; q < SW_LED; q++) port(c, (24 + q * 6) * k, 3.8 * k, 4.4 * k, 4 * k);
  });
  const swLeds = Array.from({ length: SW_LED }, (_, q) => part(-138 + 25.4 + q * 6, 61, 92 + 6.4, 1.6, 0.5, 1.0, IM.ledOff, sw.grp));
  // Patch panel 1U
  unit(110, 8.6, 8, (c, k, W, H) => {
    panelBase(c, W, H);
    for (let q = 0; q < 16; q++) {
      port(c, (8 + q * 5.2) * k, 2.8 * k, 3.6 * k, 3.4 * k);
      c.fillStyle = "#e6e3dc";
      c.fillRect((8 + q * 5.2) * k, 6.8 * k, 3.6 * k, 1 * k);
    }
  });

  /* ── the two inference nodes ──────────────────────────────────────────── */

  type Card = { grp: THREE.Group; bar: THREE.Mesh; led: THREE.Mesh };
  const lipFaces: ReturnType<typeof face>[] = [];
  const rotorLocal: THREE.Vector3[] = [];
  const nodes = NODE_X.map((NX, n) => {
    const grp = new THREE.Group();
    model.add(grp);
    grp.position.copy(at(NX, NY, 0));
    solid(0, 0, 0, 184, 80, 36, IM.dark, grp);
    const bf = face(184, 36, 5, (c, k, W, H) => {
      panelBase(c, W, H);
      port(c, 10 * k, 14 * k, 4 * k, 4 * k);
      c.fillStyle = "#9a968e";
      c.font = mono(2.2 * k);
      c.textBaseline = "top";
      c.fillText("NIC", 9.6 * k, 19.5 * k);
      c.fillStyle = "#26262b";
      for (let i = 0; i < 8; i++) c.fillRect(22 * k, (5 + i * 3.4) * k, 50 * k, 1.6 * k);
      c.fillStyle = "#d9d6cf";
      c.font = mono(5 * k);
      c.fillText(`NODE ${"AB"[n]}`, 80 * k, 5 * k);
      c.fillStyle = "#9a968e";
      c.font = mono(2.6 * k);
      c.fillText("4 × 24 GB · SDXL 1.0 fp16", 80 * k, 13 * k);
      c.fillText(`FastAPI × 4 · :800${n * 4}–:800${n * 4 + 3}`, 80 * k, 17.5 * k);
      c.fillText(`10.0.0.${11 + n}`, 80 * k, 22 * k);
      const cx = 166 * k, cy = 18 * k;
      c.strokeStyle = "#55555e";
      c.lineWidth = 2;
      for (let r = 2; r <= 10; r += 2.6) {
        c.beginPath();
        c.arc(cx, cy, r * k, 0, Math.PI * 2);
        c.stroke();
      }
      c.strokeStyle = "#9a968e";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(142 * k, 18 * k, 2.6 * k, -Math.PI / 2 + 0.9, Math.PI * 1.5 - 0.9);
      c.stroke();
      c.beginPath();
      c.moveTo(142 * k, 15 * k);
      c.lineTo(142 * k, 18 * k);
      c.stroke();
    });
    bf.mesh.position.copy(at(92, 80.05, 18));
    grp.add(bf.mesh);
    const led = part(147, 80, 23, 2.4, 0.5, 2.4, IM.ledOff, grp);
    // open frame: two aluminium uprights, a top rail and the riser backplane
    solid(0, 34, 36, 5, 6, 166, IM.alu, grp);
    solid(165, 34, 36, 5, 6, 166, IM.alu, grp);
    solid(0, 34, 202, 170, 6, 5, IM.alu, grp);
    part(5, 36, 36, 160, 3, 160, IM.board, grp, E);
    {
      const tg = face(64, 4.4, 8, (c, k, W, H) => {
        c.fillStyle = "#c9c6bf";
        c.fillRect(0, 0, W, H);
        c.fillStyle = C.ink;
        c.font = mono(2.8 * k);
        c.textBaseline = "middle";
        c.textAlign = "center";
        c.fillText(`gpu-node-${"ab"[n]} · upstream sdxl`, W / 2, H / 2);
      });
      tg.mesh.position.copy(at(85, 40.05, 204.5));
      grp.add(tg.mesh);
    }
    const cards: Card[] = [];
    for (let k = 0; k < 4; k++) {
      const gp = n * 4 + k, cz = cardZ(k);
      // queue shelf (bounded, 8 slots) bolted to the left upright
      part(12, 40, cz - 2, 84, 14, 2, IM.inner, grp, E);
      part(12, 52, cz - 6, 84, 2, 4, IM.inner, grp);
      part(5, 34, cz - 2, 7, 6, 2, IM.alu, grp);
      const lip = face(84, 6, 6, () => {});
      lip.mesh.position.copy(at(54, 54.1, cz - 3));
      grp.add(lip.mesh);
      lipFaces.push(lip);
      // the card
      const cg = new THREE.Group();
      grp.add(cg);
      solid(100, 40, cz, 62, 12, 28, IM.dark, cg);
      const cf = face(62, 28, 6, (c, kk, W, H) => {
        c.fillStyle = "#2e2e34";
        c.fillRect(0, 0, W, H);
        c.fillStyle = "#3a3a42";
        c.fillRect(0, 0, W, 4 * kk);
        c.strokeStyle = "#4a4a52";
        c.lineWidth = 2;
        c.strokeRect(1, 1, W - 2, H - 2);
        for (const u of [10.5, 31, 51.5]) {
          c.fillStyle = "#141417";
          c.beginPath();
          c.arc(u * kk, 14 * kk, 8.6 * kk, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "#55555e";
          c.lineWidth = 2;
          c.stroke();
        }
        c.fillStyle = "#d9d6cf";
        c.font = mono(2.4 * kk);
        c.textBaseline = "bottom";
        c.fillText(`GPU ${gp}`, 1.4 * kk, H - 0.6 * kk);
        c.textAlign = "right";
        c.fillText("24 GB", 55 * kk, H - 0.6 * kk);
      });
      cf.mesh.position.copy(at(131, 52.05, cz + 14));
      cg.add(cf.mesh);
      const bar = part(106, 52, cz + 25, 50, 0.6, 1.6, IM.ledOff, cg);
      const cled = part(157, 52, cz + 1.4, 2, 0.6, 2, IM.ledOff, cg);
      part(162, 40, cz - 2, 1.5, 12, 32, M.steel, cg, { edges: true });
      part(104, 38, cz + 2, 54, 2, 4, IM.inner, cg);
      for (const u of [10.5, 31, 51.5]) rotorLocal.push(at(100 + u, 52.3, cz + 14));
      cg.visible = false;
      cards.push({ grp: cg, bar, led: cled });
    }
    return { grp, led, cards };
  });
  const rotors = new THREE.InstancedMesh(rotorGeo(7.6 * S), IM.alu, rotorLocal.length);
  model.add(rotors);

  /* ── the wall dashboard (Locust / throughput) ─────────────────────────── */

  const dash = new THREE.Group();
  model.add(dash);
  dash.position.copy(at(70, -205, 0));
  dash.rotation.y = -0.32;
  solid(-80, -16, 0, 40, 36, 4, IM.dark, dash);
  solid(40, -16, 0, 40, 36, 4, IM.dark, dash);
  solid(-63, 0, 4, 6, 6, 192, IM.dark, dash);
  solid(57, 0, 4, 6, 6, 192, IM.dark, dash);
  solid(-118, 6, 190, 236, 6, 138, IM.dark, dash);
  const dashScr = face(228, 128, 4, (c, _k, W, H) => {
    c.fillStyle = "#0f0f12";
    c.fillRect(0, 0, W, H);
  });
  dashScr.mesh.position.copy(at(0, 12.05, 259));
  dash.add(dashScr.mesh);
  const dashLed = part(-2, 12, 191.5, 4, 0.5, 1.4, IM.ledOff, dash);

  const caption = label(
    [
      { text: "NGINX LEAST_CONN · 2 NODES × 4 GPUs · ONE FASTAPI WORKER PER GPU", font: "mono", size: 30, tracking: 4, color: "#7a776f" },
      { text: "BOUNDED QUEUES · MICRO-BATCH ≤ 4 / 50 ms · 4 → 64 USERS · 6 → 140 IMG/MIN", font: "mono", size: 30, tracking: 4, color: C.accent },
    ],
    0.55,
    { pxW: 1500 },
  );
  caption.mesh.position.set(-1.0, Y + 0.02, 6.95);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  /* ── cabling ───────────────────────────────────────────────────────────── */

  // Users → Nginx ingress ports. Floor rows and rack risers are ordered so no two runs cross.
  const UCAB: V3[][] = [
    [[-375, 176, 151.3], [-375, 136, 151.3], [-196, 136, 151.3], [-196, 136, 1.5], [-196, 80, 1.5], [-142.2, 80, 1.5], [-142.2, 68, 1.5], [-142.2, 68, 69], [-132, 68, 69], [-132, 61.6, 69]],
    [[-217, 150.5, 165], [-217, 141, 165], [-217, 141, 151.3], [-193, 141, 151.3], [-193, 141, 1.5], [-193, 83, 1.5], [-139.8, 83, 1.5], [-139.8, 68, 1.5], [-139.8, 68, 64], [-132, 68, 64], [-132, 61.6, 64]],
    [[-290, -139.5, 165], [-290, -146, 165], [-290, -146, 151.3], [-183, -146, 151.3], [-183, -146, 1.5], [-183, 74, 1.5], [-147, 74, 1.5], [-147, 68, 1.5], [-147, 68, 79], [-132, 68, 79], [-132, 61.6, 79]],
    [[-202, -119, 151.3], [-202, -128, 151.3], [-186, -128, 151.3], [-186, -128, 1.5], [-186, 77, 1.5], [-144.6, 77, 1.5], [-144.6, 68, 1.5], [-144.6, 68, 74], [-132, 68, 74], [-132, 61.6, 74]],
    [[107, 171, 45.3], [107, 146, 45.3], [107, 146, 1.5], [107, 86, 1.5], [-137.4, 86, 1.5], [-137.4, 68, 1.5], [-137.4, 68, 59], [-132, 68, 59], [-132, 61.6, 59]],
  ];
  const NCAB: V3[][] = NODE_X.map((NX, n) => {
    const nic = NX + 12, ry = n ? 72 : 69, lx = n ? -22 : -26, z = OUT_Z[n];
    return [[-46, 61.6, z], [-46, ry, z], [lx, ry, z], [lx, ry, 1.5], [nic, ry, 1.5], [nic, 26, 1.5], [nic, 26, 20], [nic, 20.6, 20]];
  });
  const ucab = UCAB.map((p) => cable(p, model, { radius: 0.03 }));
  const ncab = NCAB.map((p) => cable(p, model, { radius: 0.036 }));
  const gin: ReturnType<typeof cable>[] = [];
  const gout: ReturnType<typeof cable>[] = [];
  NODE_X.forEach((NX) => {
    for (let k = 0; k < 4; k++) {
      const cz = cardZ(k), li = NX + laneIn(k), lo = NX + laneOut(k);
      gin.push(cable([[li, NY + 46, 36.5], [li, NY + 46, cz + 4], [NX + 13, NY + 46, cz + 4]], model, { radius: 0.022, corner: 2 }));
      gout.push(cable([[NX + 163.6, NY + 46, cz + 14], [lo, NY + 46, cz + 14], [lo, NY + 46, 36.5]], model, { radius: 0.022, corner: 2 }));
    }
  });
  const allCables = [...ucab, ...ncab, ...gin, ...gout];

  // Paths: user → (inside Nginx) → node cable → (inside node base) → card queue, and back.
  const line = (a: V3, b: V3) => legOf(new THREE.LineCurve3(at(...a), at(...b)));
  const LBMID: V3 = [-90, 10, 70];
  const last = (p: V3[]) => p[p.length - 1];
  const FWD: Path[][] = [];
  const BACK: Path[][] = [];
  UCAB.forEach((up, u) => {
    FWD.push([]);
    BACK.push([]);
    for (let gp = 0; gp < 8; gp++) {
      const n = gp >> 2, k = gp & 3, NX = NODE_X[n];
      const nic = last(NCAB[n]), nb0 = NCAB[n][0];
      const li = NX + laneIn(k), lo = NX + laneOut(k);
      FWD[u].push(
        mkPath([
          legOf(ucab[u].curve),
          line(last(up), LBMID),
          line(LBMID, nb0),
          legOf(ncab[n].curve),
          line(nic, [li, NY + 46, 20]),
          line([li, NY + 46, 20], [li, NY + 46, 36.5]),
          legOf(gin[gp].curve),
        ]),
      );
      BACK[u].push(
        mkPath([
          legOf(gout[gp].curve),
          line([lo, NY + 46, 36.5], [lo, NY + 46, 20]),
          line([lo, NY + 46, 20], nic),
          legOf(ncab[n].curve, true),
          line(nb0, LBMID),
          line(LBMID, last(up)),
          legOf(ucab[u].curve, true),
        ]),
      );
    }
  });
  const slotV = Array.from({ length: 8 }, (_, gp) => Array.from({ length: QCAP }, (_, i) => at(NODE_X[gp >> 2] + 91 - i * 10, NY + 46, cardZ(gp & 3) + 4)));
  const cardC = Array.from({ length: 8 }, (_, gp) => at(NODE_X[gp >> 2] + 124, NY + 46, cardZ(gp & 3) + 4));

  /* ── tokens ─────────────────────────────────────────────────────────────── */

  const promptMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(7 * S, 7 * S, 7 * S), M.glowAccent, NT);
  const imageMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(11 * S, 11 * S, 2.6 * S), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), NIM);
  for (let i = 0; i < NIM; i++) imageMesh.setColorAt(i, TILE[0]);
  promptMesh.count = 0;
  imageMesh.count = 0;
  promptMesh.frustumCulled = imageMesh.frustumCulled = rotors.frustumCulled = false;
  model.add(promptMesh, imageMesh);

  type Tok = { on: boolean; ph: number; u: number; gp: number; s: number; path: Path | null; pos: THREE.Vector3; pr: number; t0: number };
  const tk: Tok[] = Array.from({ length: NT }, () => ({ on: false, ph: 0, u: 0, gp: 0, s: 0, path: null, pos: new THREE.Vector3(), pr: 0, t0: 0 }));
  const im: Tok[] = Array.from({ length: NIM }, () => ({ on: false, ph: 0, u: 0, gp: 0, s: 0, path: null, pos: new THREE.Vector3(), pr: 0, t0: 0 }));
  const conn = new Int16Array(8);
  const qLen = new Int8Array(8);
  const q = Array.from({ length: 8 }, () => new Int16Array(QCAP));
  const gs = new Int8Array(8); // 0 idle · 1 batching window · 2 denoising
  const gt = new Float32Array(8);
  const gdur = new Float32Array(8);
  const bN = new Int8Array(8);
  const bU = Array.from({ length: 8 }, () => new Int8Array(4));
  const bP = Array.from({ length: 8 }, () => new Int8Array(4));
  const fanSpd = new Float32Array(8);
  const fanAng = new Float32Array(8);
  const flashIn = new Float32Array(5).fill(-9);
  const flashOut = new Float32Array(2).fill(-9);
  const thumbs: number[] = [];
  let thumbVer = 0, served = 0;
  let rr = 0, spawnAcc = 0, simOn = false, routed = -1, routedAt = -9;
  const rnd = rng(2024);

  type UState = { mode: number; t0: number; pr: number; stage: number; gpu: number; step: number; batch: number; next: number; key: number; drawn: number; secs: number };
  const us: UState[] = Array.from({ length: 4 }, (_, u) => ({ mode: 0, t0: 0, pr: (u * 2 + 1) % PROMPTS.length, stage: 0, gpu: 0, step: 0, batch: 1, next: 0, key: -1, drawn: -9, secs: 0 }));

  function pick() {
    let best = -1;
    for (let j = 0; j < 8; j++) {
      const i = (rr + j) % 8;
      if (best < 0 || conn[i] < conn[best]) best = i;
    }
    rr = (rr + 1) % 8;
    return best;
  }
  function send(u: number, pr: number) {
    let i = 0;
    while (i < NT && tk[i].on) i++;
    if (i >= NT) return false;
    const gp = pick();
    conn[gp]++;
    const o = tk[i];
    o.on = true;
    o.ph = 0;
    o.u = u;
    o.gp = gp;
    o.pr = pr;
    o.s = 0;
    o.path = FWD[u][gp];
    sample(o.path, 0, o.pos);
    return true;
  }
  function deliver(o: Tok, t: number) {
    conn[o.gp] = Math.max(0, conn[o.gp] - 1);
    served++;
    thumbs.unshift(o.pr);
    if (thumbs.length > 8) thumbs.length = 8;
    thumbVer++;
    if (o.u < 4 && us[o.u].mode === 2) {
      const st = us[o.u];
      st.mode = 3;
      st.t0 = t;
      st.secs = 14 + rnd() * 7;
    }
  }
  function spawnImage(u: number, gp: number, pr: number, delay: number, t: number) {
    let i = 0;
    while (i < NIM && im[i].on) i++;
    const o = i < NIM ? im[i] : null;
    if (!o) {
      deliver({ on: false, ph: 0, u, gp, s: 0, path: null, pos: new THREE.Vector3(), pr, t0: 0 }, t);
      return;
    }
    o.on = true;
    o.u = u;
    o.gp = gp;
    o.pr = pr;
    o.path = BACK[u][gp];
    o.s = -delay * SPEED;
    sample(o.path, 0, o.pos);
  }
  function reset(t: number) {
    for (const o of tk) o.on = false;
    for (const o of im) o.on = false;
    conn.fill(0);
    qLen.fill(0);
    gs.fill(0);
    spawnAcc = 0;
    us.forEach((st, u) => {
      st.mode = 0;
      st.stage = 0;
      st.next = t + [0.2, 1.3, 2.4, 0.8][u];
    });
  }

  function simulate(t: number, dt: number, ramp: number) {
    // people at the desks: type, send, wait, look at the result
    us.forEach((st, u) => {
      if (st.mode === 0 && t >= st.next) {
        st.mode = 1;
        st.t0 = t;
        st.pr = (st.pr + 1) % PROMPTS.length;
      } else if (st.mode === 1 && (t - st.t0) * 15 >= PROMPTS[st.pr].length + 6) {
        if (send(u, st.pr)) {
          st.mode = 2;
          st.stage = 0;
        }
      } else if (st.mode === 3 && t - st.t0 > 3.6) {
        st.mode = 0;
        st.next = t + 0.5 + rnd() * 1.5;
      }
    });
    // Locust: open-loop arrivals that ramp with the user count
    let inflight = 0;
    for (let i = 0; i < 8; i++) inflight += conn[i];
    spawnAcc += dt * (0.6 + 6.4 * ramp);
    const lit = Math.round(4 + 60 * ramp);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (inflight < 80 && send(LOCUST, (rnd() * PROMPTS.length) | 0)) {
        inflight++;
        swarmFlash[swarmOrder[(rnd() * lit) | 0]] = t;
      }
    }

    // prompts in flight
    for (let i = 0; i < NT; i++) {
      const o = tk[i];
      if (!o.on) continue;
      if (o.ph === 0) {
        const P = o.path!, prev = o.s;
        o.s = Math.min(P.total, o.s + SPEED * dt);
        if (prev < P.cum[1] && o.s >= P.cum[1]) {
          flashIn[o.u] = t;
          routed = o.gp;
          routedAt = t;
          if (o.u < 4) {
            us[o.u].stage = 1;
            us[o.u].gpu = o.gp;
          }
        }
        if (prev < P.cum[3] && o.s >= P.cum[3]) flashOut[o.gp >> 2] = t;
        sample(P, o.s, o.pos);
        if (o.s >= P.total && qLen[o.gp] < QCAP) {
          q[o.gp][qLen[o.gp]++] = i;
          o.ph = 1;
          if (o.u < 4) us[o.u].stage = 2;
        }
      } else if (o.ph === 2) {
        o.pos.lerp(cardC[o.gp], 1 - Math.exp(-dt * 16));
        if (t - o.t0 > 0.3) o.on = false;
      }
    }
    // queues slide toward the head; GPUs pull micro-batches of up to 4
    const a = 1 - Math.exp(-dt * 12);
    for (let gp = 0; gp < 8; gp++) {
      for (let i = 0; i < qLen[gp]; i++) tk[q[gp][i]].pos.lerp(slotV[gp][i], a);
      if (gs[gp] === 0 && qLen[gp] > 0) {
        gs[gp] = 1;
        gt[gp] = 0;
      } else if (gs[gp] === 1) {
        gt[gp] += dt;
        if (gt[gp] >= 0.35 || qLen[gp] >= 4) {
          const n = Math.min(4, qLen[gp]);
          for (let i = 0; i < n; i++) {
            const o = tk[q[gp][i]];
            o.ph = 2;
            o.t0 = t;
            bU[gp][i] = o.u;
            bP[gp][i] = o.pr;
            if (o.u < 4) {
              us[o.u].stage = 3;
              us[o.u].batch = n;
              us[o.u].step = 0;
            }
          }
          for (let i = n; i < qLen[gp]; i++) q[gp][i - n] = q[gp][i];
          qLen[gp] -= n;
          bN[gp] = n;
          gs[gp] = 2;
          gt[gp] = 0;
          gdur[gp] = 1.9 + 0.22 * n;
        }
      } else if (gs[gp] === 2) {
        gt[gp] += dt;
        const step = Math.min(30, Math.floor((gt[gp] / gdur[gp]) * 30));
        for (let i = 0; i < bN[gp]; i++) if (bU[gp][i] < 4) us[bU[gp][i]].step = step;
        if (gt[gp] >= gdur[gp]) {
          for (let i = 0; i < bN[gp]; i++) {
            spawnImage(bU[gp][i], gp, bP[gp][i], i * 0.16, t);
            if (bU[gp][i] < 4) us[bU[gp][i]].stage = 4;
          }
          gs[gp] = 0;
        }
      }
    }
    // finished images on their way back
    for (let i = 0; i < NIM; i++) {
      const o = im[i];
      if (!o.on) continue;
      o.s += SPEED * dt;
      if (o.s >= 0) sample(o.path!, o.s, o.pos);
      if (o.s >= o.path!.total) {
        o.on = false;
        deliver(o, t);
      }
    }
  }

  /* ── canvas content ─────────────────────────────────────────────────────── */

  let phase = 0; // 0 off · 1 booted · 2 powered · 3 live
  let usersNow = 0, ipmNow = 0, upCount = 0, rampNow = 0;

  const drawNginx = (c: CanvasRenderingContext2D, W: number, H: number) => {
    const k = 8;
    panelBase(c, W, H);
    const v = (z: number) => (NZ + NH - z) * k;
    c.fillStyle = "#9a968e";
    c.font = mono(1.9 * k);
    c.textBaseline = "top";
    c.fillText("IN", 4.4 * k, 0.8 * k);
    c.fillText("OUT", 89.2 * k, 0.8 * k);
    for (const z of IN_Z) port(c, 4 * k, v(z) - 2 * k, 4 * k, 4 * k);
    OUT_Z.forEach((z, n) => {
      port(c, 90 * k, v(z) - 2 * k, 4 * k, 4 * k);
      c.fillStyle = "#9a968e";
      c.font = mono(1.9 * k);
      c.textBaseline = "middle";
      c.fillText("AB"[n], 94.6 * k, v(z));
    });
    c.fillStyle = "#121216";
    roundRect(c, 13 * k, 2.4 * k, 72 * k, 21.8 * k, 6);
    c.fill();
    if (phase < 2) return;
    c.textBaseline = "top";
    c.font = mono(2.2 * k);
    c.fillStyle = "#9a968e";
    c.fillText("upstream sdxl { least_conn; }", 15 * k, 3.4 * k);
    c.textAlign = "right";
    c.fillStyle = upCount === 8 ? C.green : "#9a968e";
    c.fillText(`${upCount}/8 up`, 83.4 * k, 3.4 * k);
    c.textAlign = "left";
    const recent = routedAt > lastT - 0.25;
    for (let i = 0; i < 8; i++) {
      const x = (15 + i * 8.6 + (i >= 4 ? 1.2 : 0)) * k, w = 7 * k, top = 7.4 * k, h = 11.6 * k;
      c.fillStyle = "#1f1f25";
      c.fillRect(x, top, w, h);
      const f = Math.min(1, conn[i] / 10);
      c.fillStyle = C.accent;
      c.fillRect(x, top + h * (1 - f), w, h * f);
      if (recent && routed === i) {
        c.strokeStyle = "#f4f2ee";
        c.lineWidth = 3;
        c.strokeRect(x + 1.5, top + 1.5, w - 3, h - 3);
      }
      c.fillStyle = "#d9d6cf";
      c.font = mono(2.2 * k);
      c.textAlign = "center";
      c.fillText(String(conn[i]), x + w / 2, top + 0.4 * k);
      c.fillStyle = i < upCount ? C.green : "#55555e";
      c.beginPath();
      c.arc(x + 1.2 * k, 21.2 * k, 0.8 * k, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#9a968e";
      c.font = mono(1.9 * k);
      c.textAlign = "left";
      c.fillText(`g${i}`, x + 2.6 * k, 20 * k);
    }
  };

  const drawLip = (gp: number) => (c: CanvasRenderingContext2D, W: number, H: number) => {
    const k = 6;
    c.fillStyle = "#26262b";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#9a968e";
    c.font = mono(2.6 * k);
    c.textBaseline = "middle";
    c.fillText(`q${gp}`, 1.6 * k, H / 2);
    // slots: head at the right, next to the card
    for (let i = 0; i < QCAP; i++) {
      const x = (91 - i * 10 - 12 - 3.5) * k;
      c.fillStyle = i < qLen[gp] ? C.accent : "#3a3a42";
      c.fillRect(x, 2 * k, 7 * k, 2 * k);
    }
  };
  const lipDraw = Array.from({ length: 8 }, (_, gp) => drawLip(gp));
  const lipKey = new Int8Array(8).fill(-1);

  const drawUser = (u: number) => (c: CanvasRenderingContext2D, W: number, H: number) => {
    const st = us[u];
    if (phase === 0) {
      c.fillStyle = "#0f0f12";
      c.fillRect(0, 0, W, H);
      return;
    }
    drawApp(c, W, H, `sdxl.hiabr.lab — ${NAMES[u]}`);
    // the same body rectangle drawApp lays out
    const p = Math.round(H * 0.05), bar = Math.round(H * 0.11);
    const x = p + bar * 0.4, y = p + bar * 1.3, w = W - 2 * p - bar * 0.8, h = H - 2 * p - bar * 1.7;
    const s = Math.min(h, w * 0.46), ix = x + w - s, lw = w - s - h * 0.08;
    const typing = st.mode === 1, live = phase === 3;
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillStyle = "#9a968e";
    c.font = mono(h * 0.065);
    c.fillText("PROMPT", x, y);
    const by = y + h * 0.1, bh = h * 0.4, pad = h * 0.04;
    c.fillStyle = "#ffffff";
    roundRect(c, x, by, lw, bh, h * 0.03);
    c.fill();
    c.strokeStyle = typing ? C.accent : "#dcd8d0";
    c.lineWidth = Math.max(1.5, h * 0.008);
    c.stroke();
    const fs = h * 0.082;
    c.font = sans(fs);
    c.fillStyle = C.ink;
    let text = "";
    if (live && st.mode >= 1) text = typing ? PROMPTS[st.pr].slice(0, Math.min(PROMPTS[st.pr].length, Math.floor((lastT - st.t0) * 15))) : PROMPTS[st.pr];
    if (!text && !typing) {
      c.fillStyle = "#bdb9b0";
      text = live ? "describe an image…" : "";
    }
    const end = wrapText(c, text, x + pad, by + pad, lw - 2 * pad, fs * 1.25, 3);
    if (typing && Math.floor(lastT * 3) % 2 === 0) {
      c.fillStyle = C.accent;
      c.fillRect(end.x + 2, end.y, Math.max(2, fs * 0.08), fs);
    }
    // generate button
    const bty = by + bh + h * 0.05, bth = h * 0.13;
    c.fillStyle = st.mode === 2 ? C.accent : typing ? "#2b2b31" : "#cfcac0";
    roundRect(c, x, bty, lw * 0.56, bth, bth / 2);
    c.fill();
    c.fillStyle = "#ffffff";
    c.font = sans(bth * 0.5, 600);
    c.textBaseline = "middle";
    c.fillText(st.mode === 2 ? "Generating…" : "Generate", x + bth * 0.45, bty + bth / 2);
    // status
    let status = "connecting to sdxl.hiabr.lab…";
    if (phase === 2) status = "nginx: waiting for health checks";
    if (live) {
      if (st.mode === 0) status = "ready";
      else if (st.mode === 1) status = "typing…";
      else if (st.mode === 3) status = `done in ${st.secs.toFixed(1)} s · gpu ${st.gpu}`;
      else
        status = [
          "POST /generate → nginx",
          `least_conn → gpu ${st.gpu} (node ${"AB"[st.gpu >> 2]})`,
          `queued on gpu ${st.gpu}`,
          `denoising ${st.step}/30 · batch of ${st.batch}`,
          "200 OK · receiving image",
        ][st.stage];
    }
    c.textBaseline = "top";
    c.font = mono(h * 0.062);
    c.fillStyle = st.mode === 3 ? C.green : "#7a776f";
    wrapText(c, status, x, bty + bth + h * 0.06, lw, h * 0.075, 2);
    if (live && st.mode === 2 && st.stage === 3) {
      c.fillStyle = "#e6e3dc";
      c.fillRect(x, y + h - h * 0.035, lw, h * 0.035);
      c.fillStyle = C.accent;
      c.fillRect(x, y + h - h * 0.035, (lw * st.step) / 30, h * 0.035);
    }
    // image area
    c.save();
    roundRect(c, ix, y, s, s, h * 0.03);
    c.clip();
    c.fillStyle = "#e6e3dc";
    c.fillRect(ix, y, s, s);
    if (live && st.mode === 2 && st.stage === 3) {
      const f = st.step / 30;
      c.globalAlpha = 1;
      c.drawImage(noise, ix, y, s, s);
      c.globalAlpha = f * f;
      c.drawImage(imgs[st.pr], ix, y, s, s);
      c.globalAlpha = 1;
    } else if (live && st.mode === 3) {
      const r = clamp01((lastT - st.t0) / 0.5);
      c.drawImage(imgs[st.pr], ix, y, s, s);
      if (r < 1) {
        c.globalAlpha = 1 - r;
        c.drawImage(noise, ix, y, s, s);
        c.globalAlpha = 1;
      }
    } else {
      c.strokeStyle = "#cfcac0";
      c.lineWidth = 2;
      c.setLineDash([6, 6]);
      c.strokeRect(ix + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84);
      c.setLineDash([]);
      c.fillStyle = "#9a968e";
      c.font = mono(s * 0.07);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("1024 × 1024", ix + s / 2, y + s / 2);
    }
    c.restore();
  };
  const userDraw = [0, 1, 2, 3].map((u) => drawUser(u));

  let locKey = -1;
  const drawLocust = (c: CanvasRenderingContext2D, W: number, H: number) => {
    if (phase === 0) {
      c.fillStyle = "#0f0f12";
      c.fillRect(0, 0, W, H);
      return;
    }
    drawApp(c, W, H, "locust · sdxl /generate");
    const p = Math.round(H * 0.05), bar = Math.round(H * 0.11);
    const x = p + bar * 0.4, y = p + bar * 1.3, w = W - 2 * p - bar * 0.8, h = H - 2 * p - bar * 1.7;
    const live = phase === 3;
    const tiles: [string, string, string][] = [
      ["USERS", live ? String(usersNow) : "0", C.accent],
      ["IMG/MIN", live ? String(ipmNow) : "0", C.ink],
      ["FAILS", "0 %", C.green],
    ];
    const tw = (w - h * 0.08) / 3;
    tiles.forEach(([lab, val, col], i) => {
      const tx = x + i * (tw + h * 0.04);
      c.fillStyle = "#ffffff";
      roundRect(c, tx, y, tw, h * 0.34, h * 0.03);
      c.fill();
      c.fillStyle = "#9a968e";
      c.font = mono(h * 0.06);
      c.textBaseline = "top";
      c.textAlign = "left";
      c.fillText(lab, tx + h * 0.04, y + h * 0.04);
      c.fillStyle = col;
      c.font = mono(h * 0.14, 600);
      c.fillText(val, tx + h * 0.04, y + h * 0.13);
    });
    const cy = y + h * 0.4, ch = h * 0.6;
    c.fillStyle = "#ffffff";
    roundRect(c, x, cy, w, ch, h * 0.03);
    c.fill();
    c.strokeStyle = "rgba(36,36,42,0.1)";
    c.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      c.beginPath();
      c.moveTo(x + 6, cy + (ch * i) / 4);
      c.lineTo(x + w - 6, cy + (ch * i) / 4);
      c.stroke();
    }
    if (!live) return;
    const plot = (fn: (r: number) => number, col: string, lw: number) => {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath();
      const n = Math.max(2, Math.round(rampNow * 40));
      for (let i = 0; i <= n; i++) {
        const r = (i / n) * rampNow, px = x + 10 + r * (w - 20), py = cy + ch - 8 - fn(r) * (ch - 20);
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
    };
    plot((r) => (Math.floor((4 + 60 * r) / 4) * 4) / 64, "#9a968e", 2);
    plot((r) => (6 + 134 * Math.pow(r, 1.2)) / 140, C.accent, 3);
  };

  let dashKey = -1, dashDrawn = -9, nginxKey = -1, nginxDrawn = -9;
  const drawDash = (c: CanvasRenderingContext2D, W: number, H: number) => {
    c.fillStyle = "#141418";
    c.fillRect(0, 0, W, H);
    if (phase < 2) return;
    const live = phase === 3;
    const panel = (x: number, y: number, w: number, h: number) => {
      c.fillStyle = "#1d1d23";
      roundRect(c, x, y, w, h, 12);
      c.fill();
    };
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillStyle = "#8a877f";
    c.font = mono(19);
    c.fillText("SDXL INFERENCE · HiABR LAB · 2 NODES × 4 GPUs", 28, 22);
    c.textAlign = "right";
    c.fillStyle = live ? C.accent : "#8a877f";
    c.fillText(live ? "● LIVE" : "● HEALTH CHECKS", W - 28, 22);
    c.textAlign = "left";
    // headline number
    panel(24, 60, 300, 304);
    c.fillStyle = "#8a877f";
    c.font = mono(17);
    c.fillText("IMAGES / MIN", 44, 80);
    c.fillStyle = "#f4f2ee";
    c.font = `400 150px ${fontStack("serif")}`;
    c.fillText(String(live ? ipmNow : 0), 38, 104);
    c.fillStyle = C.accent;
    c.font = mono(20);
    c.fillText(`${live ? usersNow : 0} USERS · 0 ERRORS`, 44, 282);
    c.fillStyle = "#8a877f";
    c.font = mono(17);
    c.fillText("p95 21 s · batch ≤ 4 / 50 ms", 44, 316);
    // throughput vs users
    panel(340, 60, 300, 304);
    c.fillStyle = "#8a877f";
    c.font = mono(15);
    c.fillText("IMG/MIN vs CONCURRENT USERS", 356, 78);
    const X0 = 372, Y0 = 336, CW = 250, CH = 206;
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      c.beginPath();
      c.moveTo(X0, Y0 - (CH * i) / 4);
      c.lineTo(X0 + CW, Y0 - (CH * i) / 4);
      c.stroke();
    }
    c.fillStyle = "#6a675f";
    c.font = mono(13);
    c.fillText("140", X0 - 34, Y0 - CH - 6);
    c.fillText("64", X0 + CW - 16, Y0 + 6);
    c.fillText("users", X0, Y0 + 6);
    const px = (u: number) => X0 + (u / 64) * CW, py = (v: number) => Y0 - (v / 140) * CH;
    // before the fix: OOM above 4 users
    c.strokeStyle = "#8a877f";
    c.setLineDash([6, 6]);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(px(0), py(0));
    c.lineTo(px(4), py(6));
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = "#8a877f";
    c.beginPath();
    c.moveTo(px(4) + 6, py(6) - 6);
    c.lineTo(px(4) + 18, py(6) - 18);
    c.moveTo(px(4) + 18, py(6) - 6);
    c.lineTo(px(4) + 6, py(6) - 18);
    c.stroke();
    c.fillStyle = "#8a877f";
    c.font = mono(12);
    c.fillText("before: OOM > 4", px(4) + 22, py(6) - 22);
    if (live) {
      c.strokeStyle = C.accent;
      c.lineWidth = 4;
      c.beginPath();
      const n = Math.max(2, Math.round(rampNow * 30));
      for (let i = 0; i <= n; i++) {
        const r = (i / n) * rampNow, u = 4 + 60 * r, v = 6 + 134 * Math.pow(r, 1.2);
        if (i) c.lineTo(px(u), py(v));
        else c.moveTo(px(u), py(v));
      }
      c.stroke();
      c.fillStyle = C.accent;
      c.beginPath();
      c.arc(px(usersNow), py(ipmNow), 6, 0, Math.PI * 2);
      c.fill();
    }
    // workers
    panel(656, 60, 232, 304);
    c.fillStyle = "#8a877f";
    c.font = mono(15);
    c.fillText("WORKERS · QUEUE / 8", 672, 78);
    for (let i = 0; i < 8; i++) {
      const yy = 110 + i * 31;
      c.fillStyle = i < upCount ? C.green : "#4a4a52";
      c.beginPath();
      c.arc(678, yy + 9, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#d9d6cf";
      c.font = mono(15);
      c.fillText(`g${i}`, 690, yy + 1);
      for (let j = 0; j < QCAP; j++) {
        c.fillStyle = j < qLen[i] ? C.accent : "#2c2c33";
        c.fillRect(724 + j * 12, yy + 2, 9, 14);
      }
      c.fillStyle = gs[i] === 2 ? C.accent : "#6a675f";
      c.fillText(gs[i] === 2 ? `RUN ×${bN[i]}` : "idle", 826, yy + 1);
    }
    // latest outputs
    panel(24, 378, 864, 116);
    c.fillStyle = "#8a877f";
    c.font = mono(15);
    c.fillText("LATEST", 40, 394);
    c.fillText(`${served} served`, 40, 470);
    thumbs.forEach((pr, i) => {
      const tx = 150 + i * 92;
      c.drawImage(imgs[pr], tx, 390, 82, 82);
    });
  };

  /* ── update ─────────────────────────────────────────────────────────────── */

  let lastT = 0;
  // Drawn at full size, shown a little smaller so it fits beside the text.
  g.scale.setScalar(0.88);

  return {
    group: g,
    focus: new THREE.Vector3(0, 3.0, -0.35),
    update(t, dt, local) {
      lastT = t;
      dt = Math.min(dt, 0.05);
      const T = clamp01((local - 0.18) / 0.54);
      const powered = T >= POWER;
      const live = T >= LIVE;
      const ramp = live ? smooth(LIVE, 1, T) : 0;
      rampNow = ramp;
      usersNow = Math.round(4 + 60 * ramp);
      ipmNow = Math.round(6 + 134 * Math.pow(ramp, 1.2));
      upCount = 0;
      for (let i = 0; i < 8; i++) if (T >= HEALTH(i)) upCount++;

      // desks drop in, lids open, desktops boot
      desks.forEach((d, i) => {
        const e = win(T, T_DESK[i], 0.1);
        d.visible = e > 0;
        d.position.y = (1 - easeOut(e)) * 160 * S;
      });
      dA0.setOpen(win(T, 0.18, 0.1));
      dB1.setOpen(win(T, 0.21, 0.1));
      dL.setOpen(win(T, T_LOCUST + 0.1, 0.1));
      const booted = T >= 0.3;
      dA1.led.material = dB0.led.material = booted ? M.glowGreen : IM.ledOff;

      // Locust pedestal and the swarm of virtual users
      {
        const e = win(T, T_LOCUST, 0.1);
        locustG.visible = e > 0;
        locustG.position.y = (1 - easeOut(e)) * 140 * S;
        const lit = live ? usersNow : 0;
        for (let i = 0; i < NSWARM; i++) {
          const sc = easeOut(win(T, T_LOCUST + 0.06 + swarmRank[i] * 0.0015, 0.04));
          dummy.position.copy(swarmPos[i]);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(Math.max(0.001, sc));
          dummy.updateMatrix();
          swarmBody.setMatrixAt(i, dummy.matrix);
          dummy.position.z += 2.55 * S;
          dummy.updateMatrix();
          swarmScr.setMatrixAt(i, dummy.matrix);
          swarmScr.setColorAt(i, swarmRank[i] < lit ? (t - swarmFlash[i] < 0.3 ? colHot : colIdle) : colOff);
        }
        swarmBody.instanceMatrix.needsUpdate = true;
        swarmScr.instanceMatrix.needsUpdate = true;
        swarmScr.instanceColor!.needsUpdate = true;
      }

      // nodes drop in; cards slide into their slots and report seated
      nodes.forEach((nd, n) => {
        const e = win(T, T_NODE[n], 0.1);
        nd.grp.visible = e > 0;
        nd.grp.position.y = (1 - easeOut(e)) * 180 * S;
        nd.led.material = powered ? M.glowGreen : IM.ledOff;
        nd.cards.forEach((cd, k) => {
          const gp = n * 4 + k, a = T_CARD(gp);
          const ce = easeOut(win(T, a, 0.05));
          cd.grp.visible = T > a;
          cd.grp.position.z = (1 - ce) * 90 * S;
          cd.led.material = ce >= 1 ? M.glowGreen : IM.ledOff;
          const hc = !live && powered && T >= HEALTH(gp) && T < HEALTH(gp) + 0.012;
          cd.bar.material = (live && gs[gp] === 2) || hc ? M.glowAccent : IM.ledOff;
        });
      });

      // cabinet, its units, the dashboard
      {
        const e = win(T, T_RACK, 0.1);
        rack.visible = e > 0;
        rack.position.y = (1 - easeOut(e)) * 160 * S;
        units.forEach((u, i) => {
          const ue = easeOut(win(T, T_UNIT[i], 0.05));
          u.visible = T > T_UNIT[i];
          u.position.z = (1 - ue) * 80 * S;
        });
        const de = win(T, T_DASH, 0.1);
        dash.visible = de > 0;
        dash.position.y = (1 - easeOut(de)) * 120 * S;
        upsLed.material = T >= T_UNIT[0] + 0.05 ? M.glowGreen : IM.ledOff;
        dashLed.material = powered ? M.glowGreen : IM.ledOff;
      }

      // cables draw in, then go live
      ucab.forEach((c, u) => c.reveal(win(T, T_UCAB(u), 0.08)));
      ncab.forEach((c, n) => c.reveal(win(T, T_NCAB(n), 0.07)));
      gin.forEach((c, gp) => c.reveal(win(T, T_ICAB(gp), 0.06)));
      gout.forEach((c, gp) => c.reveal(win(T, T_ICAB(gp) + 0.01, 0.06)));
      for (const c of allCables) c.live(live);

      // the service
      if (live) {
        if (!simOn) {
          simOn = true;
          reset(t);
        }
        simulate(t, dt, ramp);
      } else if (simOn) {
        simOn = false;
        reset(t);
      }

      // LEDs on the cabinet
      inLed.forEach((l, u) => (l.material = powered && T >= T_UCAB(u) + 0.08 ? (t - flashIn[u] < 0.12 ? M.glowAccent : M.glowGreen) : IM.ledOff));
      outLed.forEach((l, n) => (l.material = powered && T >= T_NCAB(n) + 0.07 ? (t - flashOut[n] < 0.12 ? M.glowAccent : M.glowGreen) : IM.ledOff));
      swLeds.forEach((l, qq) => (l.material = powered ? (live && Math.sin(t * 13 + qq * 1.7) > 0.2 ? M.glowAccent : M.glowGreen) : IM.ledOff));

      // fans: idle when powered, fast while denoising
      let ri = 0;
      nodes.forEach((nd, n) =>
        nd.cards.forEach((cd, k) => {
          const gp = n * 4 + k;
          const target = !powered ? 0 : live && gs[gp] === 2 ? 26 : 4;
          fanSpd[gp] += (target - fanSpd[gp]) * Math.min(1, dt * 2.5);
          fanAng[gp] -= fanSpd[gp] * dt;
          const vis = nd.grp.visible && cd.grp.visible;
          for (let f = 0; f < 3; f++, ri++) {
            dummy.position.copy(rotorLocal[ri]).add(nd.grp.position).add(cd.grp.position);
            dummy.rotation.set(0, 0, fanAng[gp] + f * 0.7);
            dummy.scale.setScalar(vis ? 1 : 0.001);
            dummy.updateMatrix();
            rotors.setMatrixAt(ri, dummy.matrix);
          }
        }),
      );
      rotors.instanceMatrix.needsUpdate = true;

      // tokens
      dummy.rotation.set(0, 0, 0);
      let n = 0;
      for (const o of tk) {
        if (!o.on) continue;
        dummy.position.copy(o.pos);
        dummy.scale.setScalar(o.ph === 2 ? Math.max(0.05, 1 - (t - o.t0) / 0.3) : 1);
        dummy.updateMatrix();
        promptMesh.setMatrixAt(n++, dummy.matrix);
      }
      promptMesh.count = n;
      promptMesh.instanceMatrix.needsUpdate = true;
      n = 0;
      for (const o of im) {
        if (!o.on || o.s < 0) continue;
        dummy.position.copy(o.pos);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        imageMesh.setMatrixAt(n, dummy.matrix);
        imageMesh.setColorAt(n++, TILE[o.pr]);
      }
      imageMesh.count = n;
      imageMesh.instanceMatrix.needsUpdate = true;
      imageMesh.instanceColor!.needsUpdate = true;

      // canvases — redrawn only when what they show has changed
      phase = live ? 3 : powered ? 2 : booted ? 1 : 0;
      us.forEach((st, u) => {
        const chars = st.mode === 1 ? Math.floor((t - st.t0) * 15) + (Math.floor(t * 3) % 2) * 1000 : 0;
        const revealing = st.mode === 3 && t - st.t0 < 0.55;
        const key = phase * 1e7 + st.mode * 1e6 + st.stage * 1e5 + st.step * 2000 + chars + (st.mode === 0 ? 0 : st.pr * 3e7);
        if ((key !== st.key || revealing) && t - st.drawn > 1 / 14) {
          st.key = key;
          st.drawn = t;
          devs[u].screen.draw(userDraw[u]);
        }
      });
      const lk = phase * 1e6 + usersNow * 1000 + ipmNow;
      if (lk !== locKey) {
        locKey = lk;
        dL.screen.draw(drawLocust);
      }
      let qk = 0;
      for (let i = 0; i < 8; i++) qk = qk * 7 + conn[i];
      const nk = phase * 1e9 + upCount * 1e8 + (routedAt > t - 0.25 ? routed + 1 : 0) * 1e7 + (qk % 1e7);
      if (nk !== nginxKey && t - nginxDrawn > 0.08) {
        nginxKey = nk;
        nginxDrawn = t;
        nginxFace.draw(drawNginx);
      }
      for (let gp = 0; gp < 8; gp++)
        if (lipKey[gp] !== qLen[gp]) {
          lipKey[gp] = qLen[gp];
          lipFaces[gp].draw(lipDraw[gp]);
        }
      let gk = 0;
      for (let i = 0; i < 8; i++) gk = gk * 3 + gs[i] + qLen[i] * 0.1;
      const dk = phase * 1e9 + upCount * 1e8 + usersNow * 1e5 + ipmNow * 100 + thumbVer + gk * 1e-3;
      if (dk !== dashKey && t - dashDrawn > 0.2) {
        dashKey = dk;
        dashDrawn = t;
        dashScr.draw(drawDash);
      }
    },
  };
}
