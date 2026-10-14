import * as THREE from "three";
import { C, M, clamp01, fontStack, label, plinth, roundRect, type Station } from "./kit";
import { IM, desktop, drawApp, easeOut, iso, laptop, win, type V3 } from "./iso";

const TASKS: { id: string; d: number }[] = [
  { id: "block-assembly", d: 0 },
  { id: "remove-obstacle", d: 0 },
  { id: "untie-knot", d: 0 },
  { id: "classify-blocks", d: 1 },
  { id: "color-mix", d: 1 },
  { id: "rope-untangle", d: 0 },
  { id: "tool-use-common", d: 0 },
  { id: "tool-use-uncommon", d: 0 },
  { id: "object-packing", d: 1 },
  { id: "pick-unique", d: 1 },
  { id: "unhook-ring", d: 0 },
  { id: "gears", d: 2 },
  { id: "euler-path", d: 3 },
  { id: "hanoi-tower", d: 3 },
  { id: "sorting", d: 1 },
  { id: "clock-running", d: 2 },
  { id: "light-reflection", d: 2 },
  { id: "jigsaw-puzzle", d: 3 },
  { id: "leave-parking-lot", d: 3 },
  { id: "maze", d: 3 },
  { id: "recover-2d-net", d: 2 },
  { id: "rolling-dice", d: 2 },
  { id: "section-3d-figure", d: 2 },
  { id: "polyform-tiling", d: 3 },
  { id: "sliding-puzzle", d: 3 },
];

const SEQS = ["net-a", "cut-box", "maze", "net-b", "cut-cyl"];

/** The 20 models in the run queue: 9 video, 11 image (anonymous slots). */
const MODELS = Array.from({ length: 20 }, (_, j) => (j < 9 ? `video-${j + 1}` : `image-${j - 8}`));
const NT = 27, NI = 810; // benchmark totals; 25 of the 27 tasks hang on the wall
/** Queue schedule over run progress q: model j runs on [s, s + QD]. */
const QD = 0.15;
const qStart = (j: number) => (j * (1 - QD)) / 19;

// Model units: 1 = 5 mm. Axes: x across, y front-to-back (front = +y), z up.
const S = 0.026;
const PW = 1000, PD = 654;
// Back wall with the 5 × 5 video wall of task screens
const WX = 200, WY = 36, WW = 600, WD = 28, WH = 482;
const WF = WY + WD; // wall front
const TW = 104, TH = 46, IW = 96, IH = (96 * 150) / 372, BZ = 6; // bezel / image / bezel depth
const COLS = 5, ROWS = 5, GX = 12, PZ = 62;
const TX0 = WX + (WW - (COLS * TW + (COLS - 1) * GX)) / 2;
const tileX = (c: number) => TX0 + c * (TW + GX);
const tileZ = (r: number) => 156 + (ROWS - 1 - r) * PZ;
const BUSZ = 126;
// Desks and the evaluation harness
const DESK_H = 146;
const LD = { x: 40, y: 300, w: 250, d: 120 };
const RD = { x: 710, y: 300, w: 250, d: 120 };
const HX = 430, HY = 360, HW = 140, HD = 80, HH = 118;

// Timeline beats (T: 0 → 1)
const BOOT = 0.46;
const SW0 = 0.48, SW1 = 0.9;
const LIVE = 0.92;

const MONO = () => fontStack("mono");

/**
 * VGI-Bench — an evaluation lab. The benchmark's task scenes are mounted as a
 * 5 × 5 video wall, the harness racks the 20 models (9 video, 11 image) and
 * boots, and the inference node works through the 27 tasks one by one (each
 * screen's LED goes green once evaluated; the readout counts tasks and
 * instances). The researcher's laptops show the 20-model run queue and the
 * instances collected. Progress only — no results are shown. When the run is
 * done the links go live and the node replays generated frames from the paper.
 */
export function vgiGallery(base: string): Station {
  const g = new THREE.Group();
  g.add(plinth(PW * S, PD * S));
  const I = iso(S);
  const { at, part, solid, face, cable } = I;

  const model = new THREE.Group();
  model.position.set((-PW / 2) * S, 0.66, (-PD / 2) * S);
  g.add(model);

  // ── media ──
  let loaded = 0;
  const loader = new THREE.TextureLoader();
  const imgLoader = new THREE.ImageLoader();
  const taskTex = TASKS.map((task) => {
    const t = loader.load(`${base}/${task.id}.webp`, () => loaded++);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
  const seqImg = SEQS.map((s) => [0, 1, 2].map((k) => imgLoader.load(`${base}/seq-${s}-${k}.webp`, () => loaded++)));
  const ready = (im: unknown): im is HTMLImageElement =>
    !!im && (im as HTMLImageElement).complete && (im as HTMLImageElement).naturalWidth > 0;
  const taskImg = (i: number) => taskTex[i].image as HTMLImageElement | undefined;

  const domainMats = C.domain.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));

  // ── back wall: dark base and posts, clay face, header sign, row rails, cable bus ──
  solid(WX - 10, WY - 6, 0, WW + 20, WD + 14, 10, IM.dark, model);
  solid(WX, WY, 10, WW, WD, WH - 10, M.clay, model);
  for (const x of [WX - 10, WX + WW]) solid(x, WY - 6, 10, 10, WD + 10, WH - 4, IM.dark, model);
  solid(WX, WF, WH - 26, WW, 3, 24, IM.dark, model);
  const sign = face(WW - 16, 20, 5, (ctx, k, W, H) => {
    ctx.fillStyle = "#2b2b31";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    ctx.font = `600 ${8.4 * k}px ${MONO()}`;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${1.6 * k}px`;
    ctx.fillStyle = "#f4f2ee";
    ctx.textAlign = "left";
    ctx.fillText("VGI-BENCH", 6 * k, H / 2);
    ctx.fillStyle = "#9a968e";
    ctx.font = `500 ${6 * k}px ${MONO()}`;
    ctx.fillText("PROBING VISUAL INTELLIGENCE IN VIDEO GENERATION MODELS", 76 * k, H / 2);
    ctx.textAlign = "right";
    C.domain.forEach((c, i) => {
      const x = W - (6 + (3 - i) * 22) * k;
      ctx.fillStyle = c;
      ctx.fillRect(x - 16 * k, H / 2 - 3 * k, 16 * k, 6 * k);
    });
    ctx.fillStyle = "#9a968e";
    ctx.fillText("4 DOMAINS", W - 98 * k, H / 2);
  });
  sign.mesh.position.copy(at(WX + WW / 2, WF + 3.1, WH - 14));
  model.add(sign.mesh);
  for (let r = 0; r < ROWS; r++) part(WX + 6, WF, tileZ(r) + TH / 2 - 4, WW - 12, 2, 8, IM.inner, model);
  solid(TX0, WF, BUSZ, COLS * TW + (COLS - 1) * GX, 5, 8, IM.dark, model);
  const busLeds = Array.from({ length: COLS }, (_, c) => {
    part(tileX(c) + TW / 2 - 2, WF, BUSZ + 8, 4, 3, tileZ(ROWS - 1) - BUSZ - 8, IM.inner, model);
    return part(tileX(c) + TW / 2 - 8, WF + 5, BUSZ + 2.5, 3, 0.4, 3, IM.ledOff, model);
  });

  // ── the 25 task screens ──
  const imgGeo = new THREE.PlaneGeometry(IW * S, IH * S);
  const tiles = TASKS.map((task, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const x = tileX(c), z = tileZ(r);
    const grp = new THREE.Group();
    const home = at(x, WF, z);
    grp.position.copy(home);
    model.add(grp);
    solid(0, 0, 0, TW, BZ, TH, IM.dark, grp);
    part((TW - IW) / 2, BZ, (TH - IH) / 2, IW, 0.3, IH, IM.board, grp);
    const mat = new THREE.MeshBasicMaterial({ map: taskTex[i], toneMapped: false, transparent: true, opacity: 0 });
    const img = new THREE.Mesh(imgGeo, mat);
    img.position.copy(at(TW / 2, BZ + 0.45, TH / 2));
    grp.add(img);
    const strip = part(x, WF, z - 7, 34, 0.8, 3, domainMats[task.d], model);
    const led = part(x + TW - 5, WF, z - 8, 5, 0.8, 5, IM.ledOff, model);
    strip.visible = led.visible = false;
    const order = (ROWS - 1 - r) * COLS + c; // bottom row first
    return { grp, home, mat, strip, led, a: 0.01 + order * 0.0085, img };
  });

  // Selection frame that walks the wall during the run
  const hl = new THREE.Group();
  hl.visible = false;
  model.add(hl);
  part(-4, 0, -4, TW + 8, 1.5, 2, M.glowAccent, hl);
  part(-4, 0, TH + 2, TW + 8, 1.5, 2, M.glowAccent, hl);
  part(-4, 0, -2, 2, 1.5, TH + 4, M.glowAccent, hl);
  part(TW + 2, 0, -2, 2, 1.5, TH + 4, M.glowAccent, hl);

  // ── desks ──
  const desk = (d: typeof LD) => {
    solid(d.x, d.y, DESK_H - 6, d.w, d.d, 6, M.clay2, model);
    for (const [x, y] of [[d.x + 6, d.y + 6], [d.x + d.w - 12, d.y + 6], [d.x + 6, d.y + d.d - 12], [d.x + d.w - 12, d.y + d.d - 12]])
      solid(x, y, 0, 6, 6, DESK_H - 6, IM.dark, model);
    part(d.x + 12, d.y + 8, 70, d.w - 24, 2, 66, IM.inner, model, { edges: true });
  };
  desk(LD);
  desk(RD);

  // Left desk: the inference workstation running the model under test
  const ws = desktop(I, LD.x + 12, LD.y + 12, DESK_H, model, { ppu: 8, title: "inference node" });
  solid(LD.x + 196, LD.y + 54, DESK_H, 36, 48, 2, M.clay, model); // notepad
  part(LD.x + 200, LD.y + 60, DESK_H + 2, 28, 1, 0.3, M.stone, model);
  part(LD.x + 200, LD.y + 68, DESK_H + 2, 22, 1, 0.3, M.stone, model);

  // Right desk: the researcher's laptops — model run queue and collection progress
  const lbLap = laptop(I, RD.x + 18, RD.y + 40, DESK_H, model, { ppu: 11, title: "run queue" });
  const anLap = laptop(I, RD.x + 102, RD.y + 40, DESK_H, model, { ppu: 11, title: "analysis" });
  lbLap.setOpen(0);
  anLap.setOpen(0);
  solid(RD.x + 196, RD.y + 62, DESK_H, 14, 14, 18, M.stone, model); // mug
  part(RD.x + 198, RD.y + 64, DESK_H + 18, 10, 10, 0.3, IM.dark, model);

  // ── evaluation harness: 20 model cartridges and a score readout ──
  solid(HX, HY, 0, HW, HD, HH, IM.dark, model);
  part(HX + 6, HY + HD, 8, HW - 12, 0.4, 100, IM.inner, model);
  const hPower = part(HX + HW - 12, HY + HD, HH - 8, 4, 0.5, 4, IM.ledOff, model);
  const carts = Array.from({ length: 20 }, (_, k) => {
    const c = k % 5, r = Math.floor(k / 5);
    const grp = new THREE.Group();
    const home = at(HX + 9 + c * 25, HY + HD, 12 + (3 - r) * 23);
    grp.position.copy(home);
    grp.visible = false;
    model.add(grp);
    part(0, 0, 0, 22, 4, 19, k < 9 ? M.clay : M.stone, grp, { edges: true });
    part(3, 4, 3, 11, 0.3, 2.4, IM.dark, grp);
    const led = part(16, 4, 13, 3, 0.4, 3, IM.ledOff, grp);
    return { grp, home, led, a: 0.18 + k * 0.006 };
  });
  solid(HX + 6, HY + 10, HH, HW - 12, 52, 32, IM.dark, model);
  const score = face(HW - 20, 26, 8, () => {});
  score.mesh.position.copy(at(HX + HW / 2, HY + 62.15, HH + 16));
  model.add(score.mesh);

  // ── cabling (routed on the floor, up the desk backs and the wall face) ──
  const tower: V3 = [LD.x + 12 + 143, LD.y + 12, DESK_H + 8];
  const cables = [
    cable([tower, [tower[0], LD.y - 8, tower[2]], [tower[0], LD.y - 8, 3], [HX + 30, LD.y - 8, 3], [HX + 30, HY - 4, 3], [HX + 30, HY - 4, 40], [HX + 30, HY, 40]], model, { radius: 0.034, corner: 6 }),
    ...[0, 1].map((q) => {
      const lx = RD.x + 18 + 33 + q * 84, ly = RD.y - 6 - q * 5, hx = HX + HW - 30 + q * 8;
      return cable([[hx, HY, 40], [hx, HY - 4, 40], [hx, HY - 4, 3], [hx, ly, 3], [lx, ly, 3], [lx, ly, DESK_H + 1.4], [lx, RD.y + 40, DESK_H + 1.4]], model, { radius: 0.03, corner: 6 });
    }),
    ...[0, 1].map((q) => {
      const x = 488 + q * 24;
      return cable([[x, HY, 24], [x, HY - 4, 24], [x, HY - 4, 3], [x, WF + 16, 3], [x, WF + 16, 14], [x, WF + 3, 14], [x, WF + 3, BUSZ]], model, { radius: 0.034, corner: 6 });
    }),
  ];
  const dummy = new THREE.Object3D();
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), M.glowAccent, cables.length * 2);
  pulses.count = 0;
  pulses.frustumCulled = false;
  g.add(pulses);
  const pulseHost = new THREE.Vector3();

  // ── floor captions ──
  const flat = (p: ReturnType<typeof label>, x: number, y: number) => {
    p.mesh.userData.billboard = false;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.copy(at(x, y, 0.4));
    model.add(p.mesh);
  };
  flat(
    label(
      [
        { text: "VGI-BENCH · EMNLP 2026", font: "mono", size: 30, tracking: 5, color: C.accent },
        { text: "27 tasks · 810 instances · 20 models", font: "serif", size: 70, color: C.ink },
      ],
      1.3,
      { pxW: 1200, align: "center" },
    ),
    PW / 2,
    PD - 64,
  );
  flat(label([{ text: "INFERENCE · GENERATE + COLLECT", font: "mono", size: 30, tracking: 4, color: "#7a776f" }], 0.42, { pxW: 900, align: "center" }), LD.x + LD.w / 2, LD.y + LD.d + 26);
  flat(label([{ text: "RUN QUEUE · INSTANCES", font: "mono", size: 30, tracking: 4, color: "#7a776f" }], 0.42, { pxW: 900, align: "center" }), RD.x + RD.w / 2, RD.y + RD.d + 26);
  flat(label([{ text: "HARNESS · 9 VIDEO + 11 IMAGE", font: "mono", size: 30, tracking: 4, color: "#7a776f" }], 0.42, { pxW: 900, align: "center" }), HX + HW / 2, HY + HD + 26);

  // ── screens ──
  type Run = { phase: number; done: number; cur: number; f: number; q: number; inst: number };
  const run: Run = { phase: 0, done: 0, cur: 0, f: 0, q: 0, inst: 0 };
  /** 0 queued, 1 running, 2 done */
  const qState = (j: number) => (run.q >= 1 || run.q >= qStart(j) + QD ? 2 : run.q > qStart(j) ? 1 : 0);

  const drawImg = (ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = "#2b2b31";
    ctx.fillRect(x, y, w, h);
    if (ready(im)) ctx.drawImage(im, x, y, w, h);
  };
  const chip = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, text: string, bg: string, fg = "#ffffff") => {
    ctx.font = `600 ${h * 0.56}px ${MONO()}`;
    const w = ctx.measureText(text).width + h * 0.9;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, h * 0.3);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + h * 0.45, y + h * 0.53);
    return w;
  };
  const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left", weight = 500) => {
    ctx.font = `${weight} ${size}px ${MONO()}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  };

  let seq = 0, seqFrame = 0, seqClock = 0;
  let boot = 0;

  // Workstation: off → loading weights → per-task generation → replay
  const drawWorkstation = () => {
    const { phase, cur, f } = run;
    if (phase === 0) {
      ws.screen.draw((ctx, W, H) => {
        ctx.fillStyle = "#16161a";
        ctx.fillRect(0, 0, W, H);
      });
      return;
    }
    if (phase === 1) {
      ws.screen.draw((ctx, W, H) =>
        drawApp(ctx, W, H, "inference node · loading", (c, x, y, w, h) => {
          text(c, "loading weights", x, y + h * 0.42, h * 0.08, "#7a776f");
          c.fillStyle = "#e6e3dc";
          c.fillRect(x, y + h * 0.5, w, h * 0.05);
          c.fillStyle = C.accent;
          c.fillRect(x, y + h * 0.5, w * boot, h * 0.05);
          text(c, `${Math.round(boot * 100)}%  ·  ${NT} tasks · ${NI} instances`, x, y + h * 0.7, h * 0.06, "#9a968e");
        }),
      );
      return;
    }
    if (phase === 2) {
      const task = TASKS[cur] as (typeof TASKS)[number] | undefined;
      const slots = Math.min(4, Math.floor(f * 5));
      const verdict = f > 0.82;
      ws.screen.draw((ctx, W, H) =>
        drawApp(ctx, W, H, `inference · task ${String(cur + 1).padStart(2, "0")}/${NT}`, (c, x, y, w, h) => {
          const iw = w * 0.56, ih = (iw * 150) / 372;
          drawImg(c, task ? taskImg(cur) : undefined, x, y, iw, ih);
          if (task) {
            c.fillStyle = C.domain[task.d];
            c.fillRect(x, y + ih + h * 0.015, iw * 0.3, h * 0.025);
          }
          const rx = x + iw + w * 0.04;
          text(c, "INPUT FRAME", rx, y + h * 0.07, h * 0.055, "#9a968e");
          text(c, task ? task.id : `task ${cur + 1} (off wall)`, rx, y + h * 0.17, h * 0.07, C.ink, "left", 600);
          text(c, `20 models · ${slots}/4 keyframes`, rx, y + h * 0.28, h * 0.05, "#7a776f");
          if (verdict) chip(c, rx, y + h * 0.34, h * 0.1, "COLLECTED", C.green);
          else chip(c, rx, y + h * 0.34, h * 0.1, "GENERATING…", "#e6e3dc", "#7a776f");
          const sy = y + ih + h * 0.07, sh = h - (sy - y), sw = (w - 3 * w * 0.02) / 4;
          for (let s = 0; s < 4; s++) {
            const sx = x + s * (sw + w * 0.02);
            const fh = Math.min(sh, (sw * 150) / 372);
            if (s < slots) {
              c.globalAlpha = 0.55 + 0.15 * s;
              drawImg(c, task ? taskImg(cur) : undefined, sx, sy, sw, fh);
              c.globalAlpha = 1;
            } else {
              c.fillStyle = "#e6e3dc";
              c.fillRect(sx, sy, sw, fh);
            }
            text(c, `t${s + 1}`, sx + 4, sy + fh - 5, fh * 0.22, s < slots ? "#ffffff" : "#9a968e");
          }
        }),
      );
      return;
    }
    // phase 3: replay generated frame sequences from the paper
    ws.screen.draw((ctx, W, H) =>
      drawApp(ctx, W, H, `replay · seq-${SEQS[seq]}`, (c, x, y, w, h) => {
        const bw = w * 0.7, bh = Math.min(h, (bw * 405) / 720);
        drawImg(c, seqImg[seq][seqFrame], x, y, bw, bh);
        chip(c, x + 6, y + 6, h * 0.09, `FRAME ${seqFrame + 1}/3`, C.accent);
        const tx = x + bw + w * 0.03, tw = w - bw - w * 0.03, th = (h - 2 * h * 0.03) / 3;
        for (let k = 0; k < 3; k++) {
          c.globalAlpha = k === seqFrame ? 1 : 0.45;
          drawImg(c, seqImg[seq][k], tx, y + k * (th + h * 0.03), tw, th);
          c.globalAlpha = 1;
          if (k === seqFrame) {
            c.strokeStyle = C.accent;
            c.lineWidth = 3;
            c.strokeRect(tx + 1.5, y + k * (th + h * 0.03) + 1.5, tw - 3, th - 3);
          }
        }
      }),
    );
  };

  const STATE = ["queued", "running", "done"];
  const drawQueue = () => {
    lbLap.screen.draw((ctx, W, H) =>
      drawApp(ctx, W, H, "run queue · 20 models", (c, x, y, w, h) => {
        const rh = h / MODELS.length;
        MODELS.forEach((name, j) => {
          const yy = y + j * rh, st = run.phase < 2 ? 0 : qState(j);
          if (st === 1) {
            c.fillStyle = "rgba(255,90,31,0.14)";
            c.fillRect(x - 4, yy, w + 8, rh);
          }
          text(c, String(j + 1).padStart(2, "0"), x, yy + rh * 0.78, rh * 0.62, "#9a968e");
          text(c, name, x + w * 0.1, yy + rh * 0.78, rh * 0.62, st === 0 ? "#9a968e" : C.ink, "left", st === 1 ? 700 : 500);
          const bx = x + w * 0.38, bw = w * 0.4;
          c.fillStyle = "#e6e3dc";
          c.fillRect(bx, yy + rh * 0.3, bw, rh * 0.4);
          const prog = st === 2 ? 1 : st === 1 ? clamp01((run.q - qStart(j)) / QD) : 0;
          c.fillStyle = st === 2 ? C.green : C.accent;
          c.fillRect(bx, yy + rh * 0.3, bw * prog, rh * 0.4);
          text(c, STATE[st], x + w, yy + rh * 0.78, rh * 0.58, st === 2 ? C.green : st === 1 ? C.accent : "#9a968e", "right", 600);
        });
      }),
    );
  };
  const drawAnalysis = () => {
    anLap.screen.draw((ctx, W, H) =>
      drawApp(ctx, W, H, "collection · instances", (c, x, y, w, h) => {
        text(c, "TASKS EVALUATED BY DOMAIN", x, y + h * 0.08, h * 0.065, "#9a968e");
        for (let d = 0; d < 4; d++) {
          let n = 0, tot = 0;
          TASKS.forEach((t, i) => {
            if (t.d !== d) return;
            tot++;
            if (i < run.done) n++;
          });
          const yy = y + h * (0.15 + d * 0.11);
          c.fillStyle = "#e6e3dc";
          c.fillRect(x, yy, w * 0.72, h * 0.07);
          c.fillStyle = C.domain[d];
          c.fillRect(x, yy, (w * 0.72 * n) / tot, h * 0.07);
          text(c, `${n}/${tot}`, x + w, yy + h * 0.062, h * 0.065, C.ink, "right", 600);
        }
        const gy = y + h * 0.66;
        text(c, "INSTANCES COLLECTED", x, gy, h * 0.055, "#9a968e");
        text(c, `${run.inst} / ${NI}`, x, gy + h * 0.17, h * 0.13, run.phase === 3 ? C.green : C.ink, "left", 600);
        c.fillStyle = "#e6e3dc";
        c.fillRect(x, gy + h * 0.24, w, h * 0.06);
        c.fillStyle = run.phase === 3 ? C.green : C.accent;
        c.fillRect(x, gy + h * 0.24, (w * run.inst) / NI, h * 0.06);
      }),
    );
  };
  const drawScore = () => {
    score.draw((ctx, W, H) => {
      const k = W / (HW - 20);
      ctx.fillStyle = "#1d1d22";
      ctx.fillRect(0, 0, W, H);
      if (run.phase === 0) return;
      const state = run.phase === 3 ? "DONE" : run.phase === 2 ? "RUNNING" : "BOOT";
      const col = run.phase === 3 ? C.green : C.accent;
      text(ctx, "EVAL PROGRESS · 20 MODELS", 5 * k, 9 * k, 5 * k, "#9a968e");
      text(ctx, state, (HW - 25) * k, 9 * k, 5 * k, col, "right", 700);
      text(ctx, `TASK ${String(run.done).padStart(2, "0")}/${NT}`, 5 * k, 21.5 * k, 8.5 * k, "#f4f2ee", "left", 600);
      text(ctx, `${run.inst}/${NI}`, (HW - 25) * k, 21.5 * k, 8.5 * k, col, "right", 600);
    });
  };

  let kWs = -1, kLb = -1, kAn = -1, kSc = -1;

  // Drawn at full size, shown a little smaller so it fits beside the text.
  g.scale.setScalar(0.78);

  return {
    group: g,
    focus: new THREE.Vector3(0, 4.8, -1.6),
    update(t, dt, local) {
      const T = clamp01((local - 0.18) / 0.54);

      // Screens mount on the wall, bottom row first, then power on.
      for (const tl of tiles) {
        const e = easeOut(win(T, tl.a, 0.07));
        tl.grp.visible = T > tl.a;
        tl.grp.position.set(tl.home.x, tl.home.y + (1 - e) * 50 * S, tl.home.z + (1 - e) * 130 * S);
        tl.grp.rotation.x = -(1 - e) * 0.5;
        tl.mat.opacity = win(T, tl.a + 0.06, 0.05);
        tl.img.visible = tl.mat.opacity > 0;
        tl.strip.visible = tl.led.visible = e > 0.95;
      }

      // Cartridges slot into the harness; laptops open.
      for (const ct of carts) {
        const e = easeOut(win(T, ct.a, 0.05));
        ct.grp.visible = T > ct.a;
        ct.grp.position.set(ct.home.x, ct.home.y, ct.home.z + (1 - e) * 70 * S);
      }
      lbLap.setOpen(easeOut(win(T, 0.22, 0.08)));
      anLap.setOpen(easeOut(win(T, 0.26, 0.08)));
      cables.forEach((c, i) => c.reveal(win(T, 0.3 + i * 0.025, 0.07)));

      // Run state
      boot = win(T, 0.28, BOOT - 0.28);
      const sweep = (T - SW0) / (SW1 - SW0);
      run.q = clamp01(sweep);
      const p = run.q * NT;
      run.phase = T < 0.28 ? 0 : T < SW0 ? 1 : T < LIVE ? 2 : 3;
      if (run.phase === 3) run.q = 1;
      run.done = run.phase === 3 ? NT : run.phase === 2 ? Math.min(NT, Math.floor(p)) : 0;
      run.cur = Math.min(NT - 1, Math.floor(p));
      run.f = run.phase === 2 && p < NT ? p - run.cur : 1;
      run.inst = run.phase >= 2 ? Math.floor(run.q * NI) : 0;
      const powered = T >= BOOT, live = run.phase === 3;

      tiles.forEach((tl, i) => {
        tl.led.material = i < run.done ? M.glowGreen : IM.ledOff;
      });
      const testing = run.phase === 2 && p < NT;
      const onWall = testing && run.cur < TASKS.length;
      hl.visible = onWall;
      if (onWall) hl.position.copy(tiles[run.cur].home).add(pulseHost.set(0, 0, (BZ - 5) * S));

      hPower.material = powered ? M.glowGreen : IM.ledOff;
      ws.led.material = run.phase >= 1 ? (live ? M.glowGreen : M.glowAccent) : IM.ledOff;
      carts.forEach((ct, k) => {
        if (!powered) ct.led.material = IM.ledOff;
        else {
          const st = run.phase < 2 ? 0 : qState(k);
          ct.led.material = st === 2 ? M.glowGreen : st === 1 && Math.sin(t * 9 + k) > -0.2 ? M.glowAccent : IM.ledOff;
        }
      });
      busLeds.forEach((l, c) => (l.material = live ? (Math.sin(t * 7 + c * 1.3) > -0.4 ? M.glowAccent : IM.ledOff) : onWall && run.cur % COLS === c ? M.glowAccent : IM.ledOff));
      cables.forEach((c) => c.live(live));

      pulses.count = live ? cables.length * 2 : 0;
      if (live) {
        for (let i = 0; i < pulses.count; i++) {
          const u = (t * 0.32 + (i & 1) * 0.5 + (i >> 1) * 0.17) % 1;
          cables[i >> 1].curve.getPointAt(u, dummy.position);
          dummy.position.add(model.position);
          dummy.scale.setScalar(0.6 + 0.6 * Math.sin(u * Math.PI));
          dummy.updateMatrix();
          pulses.setMatrixAt(i, dummy.matrix);
        }
        pulses.instanceMatrix.needsUpdate = true;
      }

      // Replay clock for the finished state
      if (live) {
        seqClock += dt;
        if (seqClock > 0.9) {
          seqClock = 0;
          seqFrame = (seqFrame + 1) % 3;
          if (seqFrame === 0) seq = (seq + 1) % SEQS.length;
        }
      }

      // Redraw canvases only when what they show has changed.
      const L = loaded * 1e7;
      const kw =
        run.phase === 0 ? L + 1
        : run.phase === 1 ? L + 2e5 + Math.round(boot * 50)
        : run.phase === 2 ? L + 4e5 + run.cur * 100 + Math.min(4, Math.floor(run.f * 5)) * 10 + (run.f > 0.82 ? 1 : 0)
        : L + 6e5 + seq * 10 + seqFrame;
      if (kw !== kWs) {
        kWs = kw;
        drawWorkstation();
      }
      const kr = run.phase * 1e4 + run.inst;
      const kq = run.phase * 1e4 + Math.round(run.q * 400);
      if (kq !== kLb) {
        kLb = kq;
        drawQueue();
      }
      if (kr !== kAn) {
        kAn = kr;
        drawAnalysis();
      }
      if (kr !== kSc) {
        kSc = kr;
        drawScore();
      }
    },
  };
}
