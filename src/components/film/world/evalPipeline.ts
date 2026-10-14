import * as THREE from "three";
import { C, M, clamp01, fontStack, label, plinth, roundRect, smooth, type Station } from "./kit";
import { IM, type V3, desktop, drawApp, easeOut, iso, laptop, lerp, win } from "./iso";

/**
 * TIMAN Group, UIUC — the LLM evaluation pipeline, built as the reader scrolls.
 *
 * A researcher's desktop launches the run. Prompts leave a drive-bay dataset
 * array, pass a real token-bucket rate limiter (tokens drop from a refill
 * hopper and are spent one per request), fan out across a 64-node worker
 * chassis and land on a rack of 8 model endpoints over an 8-way ribbon.
 * Results go to a cache / checkpoint unit and on to an analyst's laptop
 * running W&B. A departure-board throughput display at the back climbs from
 * 40 to 2,400 calls/min as the load test ramps: a full run goes from ~52 days
 * to ~21 hours.
 */

// Model units: 1 = 5 mm. Model axes: x across, y front-to-back (front = +y), z up.
const S = 0.026;
const I = iso(S);
const { at, part, solid, face, cable } = I;

// Plinth 22 × 14 world units = 846 × 538 model units; model origin is its back-left corner.
const PW = 846;
const PD = 538;
const F = 1.4; // cable height on the floor

const LIVE = 0.76;
const cpmAt = (T: number) => 40 + 2360 * smooth(LIVE, 0.98, T);

const MODELS = ["GPT-4o", "GPT-4o-mini", "o1", "MODEL-04", "MODEL-05", "MODEL-06", "MODEL-07", "MODEL-08"];

const mono = (px: number, w = 500) => `${w} ${px}px ${fontStack("mono")}`;
const track = (ctx: CanvasRenderingContext2D, px: number) => {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
};

/** Writes model coords into `v` (world units) without allocating. */
const atInto = (v: THREE.Vector3, x: number, y: number, z: number) => v.set(x * S, z * S, y * S);

// Shared blink state, set once per frame so `blink` needs no closure.
let bt = 0, bf = 0;
const blink = (seed: number, rate = 9) => Math.sin(bt * rate * (0.6 + 0.4 * bf) + seed * 2.39) > 0.15 - 0.6 * bf;

/** Dark hardware panel background shared by the canvas front panels. */
function panelBg(ctx: CanvasRenderingContext2D, W: number, H: number, fill = "#33333a") {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#55555e";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

function vents(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rows: number) {
  ctx.fillStyle = "#26262b";
  const p = h / rows;
  for (let i = 0; i < rows; i++) ctx.fillRect(x, y + i * p, w, p * 0.5);
}

export function evalPipeline(): Station {
  const g = new THREE.Group();
  g.add(plinth(22, 14));
  const Y = 0.66;

  const model = new THREE.Group();
  model.position.set((-PW / 2) * S, Y, (-PD / 2) * S);
  g.add(model);

  const dummy = new THREE.Object3D();
  const tmp = new THREE.Vector3();
  const colOff = new THREE.Color("#3a3a40");
  const colGreen = new THREE.Color(C.green);
  const colAccent = new THREE.Color(C.accent);

  /** A device group placed at a model-space corner that drops into place. */
  const device = (x: number, y: number, z = 0) => {
    const grp = new THREE.Group();
    grp.position.copy(at(x, y, z));
    model.add(grp);
    return { grp, base: grp.position.y };
  };
  const drop = (d: { grp: THREE.Object3D; base: number }, p: number, h = 90) => {
    d.grp.visible = p > 0;
    d.grp.position.y = d.base + (1 - easeOut(p)) * h * S;
  };
  const deskAt = (x: number, y: number, w: number, d: number, parent: THREE.Object3D) => {
    solid(x, y, 34, w, d, 6, M.clay2, parent);
    solid(x + 2, y + 2, 0, 4, d - 4, 34, M.clay2, parent);
    solid(x + w - 6, y + 2, 0, 4, d - 4, 34, M.clay2, parent);
    part(x + 6, y + 4, 4, w - 12, 3, 22, M.stone, parent);
  };

  /* ── throughput board (back, on two legs) ───────────────────────────── */
  const BX = 233, BY = 36, BW = 380, BZ = 130, BH = 104;
  const board = device(BX, BY);
  for (const lx of [26, BW - 34]) {
    solid(lx - 10, -2, 0, 28, 16, 3, IM.dark, board.grp);
    solid(lx, 2, 3, 8, 8, BZ - 3, IM.dark, board.grp);
  }
  solid(0, 0, BZ, BW, 12, BH, IM.dark, board.grp);
  part(6, 12, BZ + BH - 1, BW - 12, 0.6, 1, IM.inner, board.grp);
  const boardFace = face(BW - 8, BH - 8, 4, () => {});
  boardFace.mesh.position.copy(at(BW / 2, 12.15, BZ + BH / 2));
  board.grp.add(boardFace.mesh);
  const boardLed = part(BW - 14, 12, BZ + 3, 3, 0.5, 2, IM.ledOff, board.grp);

  const drawBoard = (on: boolean, cpm: number, T: number) => {
    boardFace.draw((ctx, W, H) => {
      const k = 4;
      panelBg(ctx, W, H, "#1b1b1f");
      if (!on) return;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const live = T >= LIVE;
      // left: the number
      ctx.fillStyle = "#8a877f";
      ctx.font = mono(5.2 * k);
      track(ctx, 6);
      ctx.fillText("THROUGHPUT · CALLS / MIN", 10 * k, 9 * k);
      ctx.fillStyle = live ? C.accent : "#e9e6df";
      ctx.font = mono(36 * k, 600);
      track(ctx, 0);
      ctx.fillText(Math.round(cpm).toLocaleString("en-US"), 9 * k, 20 * k);
      ctx.fillStyle = "#8a877f";
      ctx.font = mono(4.6 * k);
      track(ctx, 4);
      ctx.fillText(live ? "LOAD TEST · 64 WORKERS × 8 ENDPOINTS" : "BASELINE · SERIAL CALLS", 10 * k, 66 * k);
      // middle: sparkline of the ramp so far
      const gx = 160 * k, gy = 12 * k, gw = 108 * k, gh = 62 * k;
      ctx.strokeStyle = "#2c2c32";
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(gx, gy + (i * gh) / 4);
        ctx.lineTo(gx + gw, gy + (i * gh) / 4);
        ctx.stroke();
      }
      ctx.strokeStyle = live ? C.accent : "#e9e6df";
      ctx.lineWidth = 0.9 * k;
      ctx.beginPath();
      const t0 = LIVE - 0.06, t1 = 1;
      const n = 60;
      const tEnd = Math.max(t0 + 0.001, Math.min(t1, T));
      for (let i = 0; i <= n; i++) {
        const tt = t0 + ((tEnd - t0) * i) / n;
        const px = gx + ((tt - t0) / (t1 - t0)) * gw;
        const py = gy + gh - ((cpmAt(tt) - 40) / 2360) * gh * 0.94 - 1.2 * k;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = "#6a6a74";
      ctx.font = mono(3.6 * k);
      track(ctx, 2);
      ctx.fillText("2,400", gx + gw + 2 * k, gy - 1.5 * k);
      ctx.fillText("40", gx + gw + 2 * k, gy + gh - 3 * k);
      // right: ETA
      const hours = (52 * 24 * 40) / cpm;
      const eta = hours > 48 ? `${Math.round(hours / 24)} DAYS` : `${Math.round(hours)} HOURS`;
      const rx = 290 * k;
      ctx.fillStyle = "#8a877f";
      ctx.font = mono(4.6 * k);
      track(ctx, 4);
      ctx.fillText("FULL RUN · 3M+ CALLS", rx, 9 * k);
      ctx.fillStyle = "#e9e6df";
      ctx.font = mono(12 * k, 600);
      track(ctx, 0);
      ctx.fillText(eta, rx, 20 * k);
      ctx.fillStyle = "#6a6a74";
      ctx.font = mono(4.2 * k);
      track(ctx, 3);
      ctx.fillText("WAS ≈ 52 DAYS", rx, 40 * k);
      // segment bar
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i / 12 < (cpm - 40) / 2360 ? C.accent : "#2c2c32";
        ctx.fillRect(rx + i * 6 * k, 52 * k, 4.6 * k, 6 * k);
      }
      ctx.fillStyle = "#6a6a74";
      ctx.font = mono(3.6 * k);
      ctx.fillText("× 60 SPEED-UP", rx, 66 * k);
    });
  };

  /* ── researcher's desktop (front-left) ──────────────────────────────── */
  deskAt(16, 388, 180, 96, model);
  const pc = desktop(I, 24, 392, 40, model, { ppu: 7, title: "zsh — eval" });

  /* ── dataset array: 8 drive sleds ───────────────────────────────────── */
  const NX = 40, NY = 196, NW = 84, ND = 104, NH = 104;
  const nas = device(NX, NY);
  solid(0, 0, 0, NW, ND, NH, IM.dark, nas.grp);
  const nasFace = face(NW - 4, 13, 7, (ctx, k, W, H) => {
    panelBg(ctx, W, H);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e9e6df";
    ctx.font = mono(5 * k);
    track(ctx, 3);
    ctx.fillText("DATASET", 3 * k, 4.6 * k);
    ctx.fillStyle = C.accent;
    ctx.font = mono(3.2 * k);
    track(ctx, 2);
    ctx.fillText("3M+ PROMPTS · JSONL", 3 * k, 10 * k);
    vents(ctx, 58 * k, 2.5 * k, 18 * k, 8 * k, 4);
  });
  nasFace.mesh.position.copy(at(NW / 2, ND + 0.15, NH - 9));
  nas.grp.add(nasFace.mesh);
  const sleds = Array.from({ length: 8 }, (_, i) => {
    const sg = new THREE.Group();
    nas.grp.add(sg);
    const sx = 4 + (i & 1) * 39, sz = 10 + (i >> 1) * 19;
    part(sx, ND - 6, sz, 37, 8, 17, IM.inner, sg, { edges: true });
    part(sx + 4, ND + 2, sz + 6, 18, 1.2, 4, IM.dark, sg);
    const led = part(sx + 29, ND + 2, sz + 11, 2.4, 0.6, 2.4, IM.ledOff, sg);
    sg.visible = false;
    return { g: sg, led };
  });

  /* ── token bucket rate limiter ──────────────────────────────────────── */
  const KX = 176, KY = 200, KW = 92, KD = 90;
  const bucket = device(KX, KY);
  solid(0, 0, 0, KW, KD, 30, IM.dark, bucket.grp);
  const bucketFace = face(KW - 4, 26, 6, (ctx, k, W, H) => {
    panelBg(ctx, W, H);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#e9e6df";
    ctx.font = mono(5.4 * k);
    track(ctx, 3);
    ctx.fillText("TOKEN BUCKET", 4 * k, 4 * k);
    ctx.fillStyle = "#8a877f";
    ctx.font = mono(3.2 * k);
    track(ctx, 2);
    ctx.fillText("RATE LIMITER · 1 TOKEN / CALL", 4 * k, 12 * k);
    ctx.fillStyle = C.accent;
    ctx.fillText("429 → BACKOFF 2ⁿ · RETRY", 4 * k, 18 * k);
    ctx.fillStyle = "#18181b";
    roundRect(ctx, 72 * k, 7 * k, 11 * k, 12 * k, 4);
    ctx.fill();
  });
  bucketFace.mesh.position.copy(at(KW / 2, KD + 0.15, 15));
  bucket.grp.add(bucketFace.mesh);
  part(60, 33, 30, 32, 26, 0.6, IM.board, bucket.grp);

  const col = new THREE.Group();
  bucket.grp.add(col);
  for (const [x, y] of [[20, 20], [67, 20], [20, 67], [67, 67]]) solid(x, y, 30, 5, 5, 126, IM.dark, col);
  part(25, 20, 30, 42, 2, 126, IM.inner, col);
  for (const z of [72, 116]) {
    part(25, 68, z, 42, 3, 3, IM.inner, col);
    part(25, 21, z, 42, 3, 3, IM.inner, col);
    part(21, 25, z, 3, 42, 3, IM.inner, col);
  }
  const scale = face(5, 120, 6, (ctx, k, W, H) => {
    panelBg(ctx, W, H, "#2b2b31");
    ctx.fillStyle = "#9a968e";
    for (let i = 0; i <= 16; i++) ctx.fillRect(W - (i % 4 ? 2 : 3.6) * k, H - (2 + i * 7) * k, (i % 4 ? 2 : 3.6) * k, 0.5 * k);
  });
  scale.mesh.position.copy(at(22.5, 72.15, 92));
  col.add(scale.mesh);

  const hopper = new THREE.Group();
  bucket.grp.add(hopper);
  solid(12, 12, 156, 68, 68, 18, IM.dark, hopper);
  part(30, 30, 174, 32, 32, 6, IM.inner, hopper, { edges: true, shadow: true });
  const hopFace = face(66, 16, 7, () => {});
  hopFace.mesh.position.copy(at(46, 80.15, 165));
  hopper.add(hopFace.mesh);
  const hopperBase = hopper.position.y;
  const drawHopper = (cpm: number) => {
    hopFace.draw((ctx, W, H) => {
      const k = 7;
      panelBg(ctx, W, H);
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#8a877f";
      ctx.font = mono(3.4 * k);
      track(ctx, 3);
      ctx.fillText("REFILL", 3 * k, 5 * k);
      ctx.fillStyle = cpm > 41 ? C.accent : "#e9e6df";
      ctx.font = mono(5.6 * k);
      track(ctx, 0);
      const r = cpm / 60;
      ctx.fillText(`r = ${r < 10 ? r.toFixed(1) : Math.round(r)} tok/s`, 3 * k, 11.5 * k);
      vents(ctx, 50 * k, 3 * k, 13 * k, 10 * k, 4);
    });
  };

  // Tokens: NT in the stack, one falling from the hopper.
  const NT = 9, PITCH = 7;
  const tokens = new THREE.InstancedMesh(new THREE.BoxGeometry(26 * S, 6 * S, 26 * S), M.accent, NT + 1);
  tokens.castShadow = true;
  bucket.grp.add(tokens);
  let tokPhase = 0;

  /* ── worker pool: 64 nodes in an 8 × 8 chassis ──────────────────────── */
  const WX = 310, WY = 200, WW = 210, WD = 100, WH = 170;
  const pool = device(WX, WY);
  solid(0, 0, 0, WW, WD, 8, IM.dark, pool.grp);
  solid(0, 0, WH - 8, WW, WD, 8, IM.dark, pool.grp);
  solid(0, 0, 8, 5, WD, WH - 16, IM.dark, pool.grp);
  solid(WW - 5, 0, 8, 5, WD, WH - 16, IM.dark, pool.grp);
  part(5, 0, 8, WW - 10, 3, WH - 16, IM.inner, pool.grp);
  const rowZ = (r: number) => 10 + r * 19;
  for (let r = 1; r < 8; r++) part(5, 3, rowZ(r) - 2, WW - 10, 94, 1.2, IM.inner, pool.grp);
  const poolTop = face(WW - 4, 7, 9, (ctx, k, W, H) => {
    panelBg(ctx, W, H);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e9e6df";
    ctx.font = mono(3.8 * k);
    track(ctx, 4);
    ctx.fillText("WORKER POOL · 64 ASYNC WORKERS", 4 * k, H / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = C.accent;
    ctx.fillText("8 × 8", W - 6 * k, H / 2);
  });
  poolTop.mesh.position.copy(at(WW / 2, WD + 0.15, WH - 4));
  pool.grp.add(poolTop.mesh);
  const poolBase = face(WW - 4, 7, 9, (ctx, k, W, H) => {
    panelBg(ctx, W, H);
    vents(ctx, 40 * k, 1.6 * k, 120 * k, 4 * k, 3);
  });
  poolBase.mesh.position.copy(at(WW / 2, WD + 0.15, 4));
  pool.grp.add(poolBase.mesh);

  const NN = 64;
  const nodeBody = new THREE.InstancedMesh(new THREE.BoxGeometry(22 * S, 15 * S, 80 * S), M.clay2, NN);
  const nodeFront = new THREE.InstancedMesh(new THREE.BoxGeometry(20 * S, 13 * S, 0.6 * S), IM.board, NN);
  const nodeLed = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4 * S, 2.4 * S, 0.6 * S), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), NN);
  const nodeVent = new THREE.InstancedMesh(new THREE.BoxGeometry(10 * S, 1 * S, 0.4 * S), IM.inner, NN * 2);
  nodeBody.castShadow = true;
  nodeBody.receiveShadow = true;
  for (let i = 0; i < NN; i++) nodeLed.setColorAt(i, colOff);
  pool.grp.add(nodeBody, nodeFront, nodeLed, nodeVent);
  const nodeX = (c: number) => 7 + c * 24.5;

  /* ── 8 model endpoints in a rack ────────────────────────────────────── */
  const RX = 580, RY = 180, RW = 120, RD = 130, RH = 210;
  const rack = device(RX, RY);
  solid(0, 0, 0, RW, RD, 10, IM.dark, rack.grp);
  solid(0, 0, RH - 10, RW, RD, 10, IM.dark, rack.grp);
  for (const [x, y] of [[0, 0], [RW - 6, 0], [0, RD - 6], [RW - 6, RD - 6]]) solid(x, y, 10, 6, 6, RH - 20, IM.dark, rack.grp);
  part(6, 0, 10, RW - 12, 3, RH - 20, IM.inner, rack.grp);
  const rackTag = face(RW - 4, 8, 9, (ctx, k, W, H) => {
    panelBg(ctx, W, H);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e9e6df";
    ctx.font = mono(3.6 * k);
    track(ctx, 4);
    ctx.fillText("ENDPOINTS · 8 MODELS", 4 * k, H / 2);
  });
  rackTag.mesh.position.copy(at(RW / 2, RD + 0.15, RH - 5));
  rack.grp.add(rackTag.mesh);
  const srvZ = (i: number) => 14 + i * 23;
  const servers = Array.from({ length: 8 }, (_, i) => {
    const sg = new THREE.Group();
    rack.grp.add(sg);
    const name = MODELS[7 - i];
    solid(0, 0, 0, 108, 124, 18, IM.dark, sg);
    for (const x of [-3, 108]) part(x, 0, 2, 3, 124, 1.4, IM.inner, sg);
    const f = face(108, 18, 6, (ctx, k, W, H) => {
      panelBg(ctx, W, H);
      ctx.fillStyle = "#26262b";
      roundRect(ctx, 1.4 * k, 2 * k, 2.4 * k, 14 * k, 3);
      ctx.fill();
      ctx.textBaseline = "top";
      ctx.fillStyle = "#e9e6df";
      ctx.font = mono(6 * k);
      track(ctx, 1);
      ctx.fillText(name, 16 * k, 2.6 * k);
      ctx.fillStyle = "#8a877f";
      ctx.font = mono(3 * k);
      track(ctx, 2);
      ctx.fillText(`:${8001 + (7 - i)}  /v1/chat`, 16 * k, 11.4 * k);
      vents(ctx, 60 * k, 3 * k, 28 * k, 12 * k, 5);
      for (let q = 0; q < 2; q++) {
        ctx.fillStyle = "#18181b";
        roundRect(ctx, (93 + q * 6) * k, 6 * k, 4.6 * k, 6 * k, 3);
        ctx.fill();
      }
    });
    f.mesh.position.copy(at(54, 124.15, 9));
    sg.add(f.mesh);
    const pwr = part(6, 124, 11, 2.4, 0.6, 2.4, IM.ledOff, sg);
    const act = part(6, 124, 4.6, 2.4, 0.6, 2.4, IM.ledOff, sg);
    sg.visible = false;
    return { g: sg, pwr, act };
  });

  /* ── cache / checkpoint unit ────────────────────────────────────────── */
  const CX = 744, CY = 222, CW = 72, CD = 78, CH = 66;
  const cache = device(CX, CY);
  solid(0, 0, 0, CW, CD, CH, IM.dark, cache.grp);
  const cacheFace = face(CW - 4, CH - 4, 6, (ctx, k, W, H) => {
    panelBg(ctx, W, H);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#e9e6df";
    ctx.font = mono(4.4 * k);
    track(ctx, 3);
    ctx.fillText("CACHE", 4 * k, 4 * k);
    ctx.fillStyle = "#8a877f";
    ctx.font = mono(3 * k);
    track(ctx, 2);
    ctx.fillText("REQUEST-LEVEL", 4 * k, 10.5 * k);
    ctx.fillText("+ CHECKPOINTS", 4 * k, 15 * k);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#26262b";
      roundRect(ctx, 4 * k, (23 + i * 8.4) * k, 52 * k, 6.6 * k, 4);
      ctx.fill();
      ctx.fillStyle = "#4a4a52";
      ctx.fillRect(8 * k, (25.6 + i * 8.4) * k, 30 * k, 1.4 * k);
    }
    ctx.fillStyle = C.accent;
    ctx.font = mono(3 * k);
    ctx.fillText("RESUMABLE", 4 * k, 57 * k);
  });
  cacheFace.mesh.position.copy(at(CW / 2, CD + 0.15, CH / 2));
  cache.grp.add(cacheFace.mesh);
  const cacheLeds = [0, 1, 2, 3].map((i) => part(62, CD, CH - 2 - 25 - i * 8.4, 2.4, 0.6, 2.4, IM.ledOff, cache.grp));

  /* ── analyst's laptop on a side table (front-right) ─────────────────── */
  const deskGroup = new THREE.Group();
  model.add(deskGroup);
  const deskD = { grp: deskGroup, base: 0 };
  deskAt(692, 396, 100, 80, deskGroup);
  const lap = laptop(I, 708, 410, 40, deskGroup, { ppu: 10, title: "wandb · bdsu-audit" });

  /* ── cabling ────────────────────────────────────────────────────────── */
  type Run = { c: ReturnType<typeof cable>; a: number; d: number; len: number; plugs: THREE.Mesh[] };
  const runs: Run[] = [];
  const plug = (p: V3, s = 4.2) => {
    const m = part(p[0] - s / 2, p[1] - s / 2, p[2] - s / 2, s, s, s, IM.board, model);
    m.visible = false;
    return m;
  };
  const run = (pts: V3[], a: number, d = 0.04, plugSize = 4.2) => {
    const c = cable(pts, model, { radius: 0.03 });
    runs.push({ c, a, d, len: c.curve.getLength(), plugs: [plug(pts[0], plugSize), plug(pts[pts.length - 1], plugSize)] });
  };
  /** Port on a front face → stub → floor lane → stub → port on another front face. */
  const front = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, lane: number): V3[] => [
    [ax, ay + 0.5, az], [ax, ay + 6, az], [ax, ay + 6, F], [ax, lane, F], [bx, lane, F], [bx, by + 6, F], [bx, by + 6, bz], [bx, by + 0.5, bz],
  ];
  // desktop tower (back) → dataset array
  run([[167, 391.5, 54], [167, 380, 54], [167, 380, F], [167, 356, F], [62, 356, F], [62, 306, F], [62, 306, 5], [62, NY + ND + 0.5, 5]], 0.6);
  // dataset → token bucket → worker pool
  run(front(104, NY + ND, 5, KX + 20, KY + KD, 5, 340), 0.62);
  run(front(KX + 80, KY + KD, 5, WX + 20, WY + WD, 5, 340), 0.64);
  // workers → endpoints: an 8-way ribbon, nested so no two cables cross
  for (let i = 0; i < 8; i++) {
    const sx = 500 - i * 2.6, ly = 318 + i * 2.6, rx = 678 + i * 2.6, z = srvZ(i) + 9;
    run([[sx, WY + WD + 0.5, 5], [sx, 306, 5], [sx, 306, F], [sx, ly, F], [rx, ly, F], [rx, 316, F], [rx, 316, z], [rx, RY + RD + 0.6, z]], 0.66 + i * 0.006, 0.04, 2.6);
  }
  // workers → throughput board (under and behind it)
  run([[505, WY - 0.5, 100], [505, 28, 100], [505, 28, 180], [505, BY - 0.5, 180]], 0.68);
  // endpoints (top) → cache (top), overhead
  run([[690, 250, RH + 0.5], [690, 250, 226], [780, 250, 226], [780, 250, CH + 0.5]], 0.71, 0.04);
  // cache → analyst laptop
  run([[806, CY + CD + 0.5, 5], [806, 306, 5], [806, 306, F], [806, 438, F], [806, 438, 41.4], [775.5, 438, 41.4]], 0.73, 0.04, 2.6);

  const PULSES = 3;
  const pulses = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4 * S, 3.4 * S, 3.4 * S), M.glowAccent, runs.length * PULSES);
  pulses.count = 0;
  model.add(pulses);

  /* ── floor caption ──────────────────────────────────────────────────── */
  const caption = label(
    [
      { text: "TIMAN GROUP · UIUC — LLM EVALUATION PIPELINE", font: "mono", size: 30, tracking: 4, color: "#7a776f" },
      { text: "3M+ CALLS · 8 MODELS · 64 WORKERS · 40 → 2,400 CALLS / MIN", font: "mono", size: 30, tracking: 4, color: C.accent },
    ],
    0.62,
    { pxW: 1500 },
  );
  caption.mesh.position.set(-1.2, Y + 0.02, 6.35);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  /* ── screens ────────────────────────────────────────────────────────── */
  const STEPS: [number, string][] = [
    [0.12, "✓ dataset   3,000,000+ prompts"],
    [0.28, "✓ limiter   token bucket · backoff 2^n"],
    [0.44, "✓ pool      64 async workers"],
    [0.58, "✓ models    8/8 endpoints healthy"],
    [0.74, "✓ wandb     run bdsu-audit synced"],
  ];
  const drawTerm = (steps: number, calls: number, cpm: number, live: boolean) => {
    pc.screen.draw((ctx, W, H) =>
      drawApp(ctx, W, H, "zsh — eval", (c, x, y, w, h) => {
        c.fillStyle = "#1d1d22";
        roundRect(c, x, y, w, h, 6);
        c.fill();
        const fs = Math.min(h / 10, w / 27.5);
        c.font = mono(fs);
        c.textBaseline = "top";
        c.textAlign = "left";
        track(c, 0);
        let ly = y + fs * 0.6;
        const lx = x + fs * 0.7;
        c.fillStyle = "#e9e6df";
        c.fillText("$ python eval.py --models 8 --workers 64", lx, ly);
        ly += fs * 1.35;
        for (let i = 0; i < steps; i++) {
          c.fillStyle = "#7fd8b0";
          c.fillText(STEPS[i][1], lx, ly);
          ly += fs * 1.25;
        }
        if (live) {
          ly += fs * 0.3;
          const frac = calls / 3_000_000;
          c.fillStyle = "#3a3a42";
          c.fillRect(lx, ly, w - fs * 1.4, fs * 0.7);
          c.fillStyle = C.accent;
          c.fillRect(lx, ly, (w - fs * 1.4) * frac, fs * 0.7);
          ly += fs * 1.1;
          c.fillStyle = "#e9e6df";
          c.fillText(`${calls.toLocaleString("en-US")} / 3M calls · ${Math.round(cpm).toLocaleString("en-US")}/min`, lx, ly);
        } else if (steps < STEPS.length) {
          c.fillStyle = "#8a877f";
          c.fillText("…", lx, ly);
        }
      }),
    );
  };

  const METRICS = ["disparity", "sensitivity", "uncertainty"];
  const MCOL = [C.ink, C.steel, C.accent];
  const score = (m: number, q: number) => {
    const s = Math.sin(m * 12.9898 + q * 78.233) * 43758.5453;
    return 0.28 + 0.62 * (s - Math.floor(s));
  };
  const drawWandb = (fill: number, cpm: number, calls: number, on: boolean) => {
    lap.screen.draw((ctx, W, H) =>
      drawApp(ctx, W, H, "wandb · bdsu-audit", on ? (c, x, y, w, h) => {
        c.textBaseline = "top";
        c.textAlign = "left";
        track(c, 0);
        const cards: [string, string][] = [
          ["calls/min", Math.round(cpm).toLocaleString("en-US")],
          ["calls", calls >= 1e6 ? `${(calls / 1e6).toFixed(2)}M` : `${Math.round(calls / 1000)}k`],
          ["models", "8"],
        ];
        const cw = (w - 8) / 3, ch = h * 0.26;
        cards.forEach(([k, v], i) => {
          const cx = x + i * (cw + 4);
          c.fillStyle = "#e9e6df";
          roundRect(c, cx, y, cw, ch, 5);
          c.fill();
          c.fillStyle = "#7a776f";
          c.font = mono(ch * 0.24);
          c.fillText(k, cx + ch * 0.18, y + ch * 0.14);
          c.fillStyle = i === 0 ? C.accent : C.ink;
          c.font = mono(ch * 0.42, 600);
          c.fillText(v, cx + ch * 0.18, y + ch * 0.44);
        });
        // grouped bars: 8 models × 3 BDSU components
        const gy = y + ch + h * 0.08, gh = h - ch - h * 0.22;
        c.strokeStyle = "#e3e0d9";
        c.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
          c.beginPath();
          c.moveTo(x, gy + (gh * i) / 3);
          c.lineTo(x + w, gy + (gh * i) / 3);
          c.stroke();
        }
        const gw = w / 8;
        for (let m = 0; m < 8; m++)
          for (let q = 0; q < 3; q++) {
            const bh = gh * score(m, q) * fill;
            c.fillStyle = MCOL[q];
            c.fillRect(x + m * gw + gw * 0.14 + q * gw * 0.24, gy + gh - bh, gw * 0.2, bh);
          }
        c.font = mono(h * 0.055);
        METRICS.forEach((name, q) => {
          const lx = x + q * (w / 3);
          c.fillStyle = MCOL[q];
          c.fillRect(lx, y + h - h * 0.07, h * 0.05, h * 0.05);
          c.fillStyle = "#7a776f";
          c.fillText(name, lx + h * 0.08, y + h - h * 0.08);
        });
      } : undefined),
    );
  };

  /* ── timeline (T: 0 → 1 across the chapter) ─────────────────────────── */
  let keyBoard = -2, keyHop = -1, keyTerm = -1, keyLap = -2;
  let accum = 0;

  return {
    group: g,
    focus: new THREE.Vector3(0, 2.8, -0.4),
    update(t, dtRaw, local) {
      const T = clamp01((local - 0.18) / 0.54);
      const dt = Math.min(dtRaw, 0.1);
      const live = T >= LIVE;
      const cpm = cpmAt(T);
      const frac = (cpm - 40) / 2360;
      bt = t;
      bf = frac;

      // throughput board
      drop(board, win(T, 0, 0.08), 120);
      const bOn = T >= 0.05;
      boardLed.material = bOn ? M.glowGreen : IM.ledOff;
      const kb = bOn ? Math.round(cpm / 10) * 2 + (live ? 1 : 0) : -1;
      if (kb !== keyBoard) {
        keyBoard = kb;
        drawBoard(bOn, cpm, T);
      }

      // desktop
      pc.led.material = T > 0.01 ? M.glowGreen : IM.ledOff;

      // dataset array
      drop(nas, win(T, 0.04, 0.06));
      for (let i = 0; i < sleds.length; i++) {
        const s = sleds[i];
        const a = 0.08 + i * 0.009, e = easeOut(win(T, a, 0.03));
        s.g.visible = T > a;
        s.g.position.z = (1 - e) * 50 * S;
        s.led.material = e < 1 ? IM.ledOff : live && blink(i, 13) ? M.glowAccent : M.glowGreen;
      }

      // token bucket
      drop(bucket, win(T, 0.14, 0.06));
      const hp = win(T, 0.19, 0.05);
      hopper.visible = hp > 0;
      hopper.position.y = hopperBase + (1 - easeOut(hp)) * 60 * S;
      const fillN = Math.round(win(T, 0.22, 0.06) * NT);
      const cycling = T >= 0.28;
      if (cycling) tokPhase = (tokPhase + dt / lerp(1.6, 0.24, frac)) % 1;
      else tokPhase = 0;
      const u = tokPhase;
      const out = u >= 0.5 ? smooth(0, 0.55, (u - 0.5) / 0.5) : 0;
      const sink = u >= 0.5 ? smooth(0.35, 1, (u - 0.5) / 0.5) * PITCH : 0;
      for (let j = 0; j <= NT; j++) {
        let x = 46, z = 31 + j * PITCH + 3, s = 1;
        if (j === NT) {
          // the falling token
          if (!cycling) s = 0;
          else if (u < 0.5) z = lerp(150, 31 + NT * PITCH + 3, (u / 0.5) ** 2);
          else z -= sink;
        } else if (j >= fillN && !cycling) s = 0;
        else if (j === 0 && cycling) {
          x = 46 + out * 46;
          s = 1 - smooth(0.7, 1, out);
        } else if (cycling) z -= sink;
        atInto(dummy.position, x, 46, z);
        dummy.scale.setScalar(Math.max(s, 0.0001));
        dummy.updateMatrix();
        tokens.setMatrixAt(j, dummy.matrix);
      }
      tokens.instanceMatrix.needsUpdate = true;
      const kh = Math.round(cpm / 6);
      if (hp > 0 && kh !== keyHop) {
        keyHop = kh;
        drawHopper(cpm);
      }

      // worker pool
      drop(pool, win(T, 0.26, 0.06));
      for (let i = 0; i < NN; i++) {
        const r = i >> 3, c = i & 7;
        const a = 0.3 + r * 0.015 + c * 0.0016, e = easeOut(win(T, a, 0.035));
        const s = T > a ? 1 : 0.0001;
        const off = (1 - e) * 80;
        const x = nodeX(c), z = rowZ(r);
        dummy.scale.setScalar(s);
        atInto(dummy.position, x + 11, 16 + 40 + off, z + 7.5);
        dummy.updateMatrix();
        nodeBody.setMatrixAt(i, dummy.matrix);
        atInto(dummy.position, x + 11, 96.3 + off, z + 7.5);
        dummy.updateMatrix();
        nodeFront.setMatrixAt(i, dummy.matrix);
        atInto(dummy.position, x + 17.5, 96.9 + off, z + 10.5);
        dummy.updateMatrix();
        nodeLed.setMatrixAt(i, dummy.matrix);
        for (let v = 0; v < 2; v++) {
          atInto(dummy.position, x + 8, 96.8 + off, z + 3 + v * 2.2);
          dummy.updateMatrix();
          nodeVent.setMatrixAt(i * 2 + v, dummy.matrix);
        }
        nodeLed.setColorAt(i, e < 1 ? colOff : live && blink(i * 1.7, 15) ? colAccent : colGreen);
      }
      nodeBody.instanceMatrix.needsUpdate = true;
      nodeFront.instanceMatrix.needsUpdate = true;
      nodeLed.instanceMatrix.needsUpdate = true;
      nodeVent.instanceMatrix.needsUpdate = true;
      if (nodeLed.instanceColor) nodeLed.instanceColor.needsUpdate = true;

      // endpoint rack
      drop(rack, win(T, 0.42, 0.06), 110);
      for (let i = 0; i < servers.length; i++) {
        const s = servers[i];
        const a = 0.46 + i * 0.013, e = easeOut(win(T, a, 0.04));
        s.g.visible = T > a;
        atInto(s.g.position, 6, 6 + (1 - e) * 120, srvZ(i));
        s.pwr.material = e >= 1 ? M.glowGreen : IM.ledOff;
        s.act.material = live && blink(i * 3.1, 17) ? M.glowAccent : IM.ledOff;
      }

      // cache, side table, laptop
      drop(cache, win(T, 0.56, 0.06));
      for (let i = 0; i < cacheLeds.length; i++) cacheLeds[i].material = !live ? IM.ledOff : i === 0 || blink(i * 5.3, 11) ? M.glowGreen : IM.ledOff;
      drop(deskD, win(T, 0.58, 0.06), 70);
      lap.setOpen(easeOut(win(T, 0.63, 0.06)));

      // cables, plugs, pulses
      let pi = 0;
      for (let i = 0; i < runs.length; i++) {
        const R = runs[i];
        const r = win(T, R.a, R.d);
        R.c.reveal(r);
        R.c.live(live);
        R.plugs[0].visible = r > 0;
        R.plugs[1].visible = r >= 1;
        if (!live || r < 1) continue;
        const v = (0.7 + 3.2 * frac) / R.len;
        const n = 1 + Math.round(frac * (PULSES - 1));
        for (let p = 0; p < n; p++) {
          const pu = (t * v + p / n + i * 0.137) % 1;
          R.c.curve.getPointAt(pu, tmp);
          dummy.position.copy(tmp);
          dummy.scale.setScalar(0.5 + 0.5 * Math.sin(pu * Math.PI));
          dummy.updateMatrix();
          pulses.setMatrixAt(pi++, dummy.matrix);
        }
      }
      pulses.count = pi;
      if (pi) pulses.instanceMatrix.needsUpdate = true;

      // screens
      if (live) accum += (cpm / 60) * dt * 25;
      const calls = Math.min(3_000_000, Math.round(1_200_000 * smooth(LIVE, 1, T) + accum));
      let steps = 0;
      while (steps < STEPS.length && T >= STEPS[steps][0]) steps++;
      const kt = steps + 8 * (live ? 1 + Math.floor(calls / 2000) : 0);
      if (kt !== keyTerm) {
        keyTerm = kt;
        drawTerm(steps, calls, cpm, live);
      }
      const lapOn = T >= 0.66;
      const fill = live ? clamp01(calls / 1_500_000) : 0.04;
      const kl = lapOn ? (Math.floor(calls / 20000) * 61 + Math.round(cpm / 40)) * 61 + Math.round(fill * 60) : -1;
      if (kl !== keyLap) {
        keyLap = kl;
        drawWandb(Math.max(0.04, fill), cpm, calls, lapOn);
      }
    },
  };
}
