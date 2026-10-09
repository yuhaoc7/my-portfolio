import * as THREE from "three";
import { C, CanvasPlane, M, cyl, fontStack, label, plinth, rbox, smooth, type Station } from "./kit";

/**
 * TIMAN — an LLM evaluation pipeline. Requests leave a dataset stack, pass a
 * token-bucket rate limiter, fan out across a 64-worker pool and land on 8
 * model endpoints; scored results stack up as metrics. Throughput climbs from
 * 40 to 2,400 calls/min as the reader scrolls through the chapter.
 */
export function evalPipeline(): Station {
  const g = new THREE.Group();
  g.add(plinth(22, 14));
  const Y = 0.66;

  // Dataset stack
  const data = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = rbox(2.4, 0.22, 3, i % 2 ? M.clay2 : M.clay, 0.05);
    s.position.y = Y + 0.11 + i * 0.24;
    s.rotation.y = (i - 3) * 0.03;
    data.add(s);
  }
  data.position.set(-8.6, 0, 0);
  g.add(data);

  // Token bucket: glass cylinder with an accent level
  const bucket = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 2.4, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.15, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  glass.position.y = Y + 1.2;
  const fill = cyl(0.78, 0.78, 1, M.accent, 40);
  fill.position.y = Y;
  const rim = cyl(0.95, 0.95, 0.12, M.ink, 40);
  rim.position.y = Y + 0.06;
  bucket.add(glass, fill, rim);
  bucket.position.set(-5.2, 0, 0);
  g.add(bucket);

  // Worker pool — 8 × 8 tiles
  const workerGeo = new THREE.BoxGeometry(0.42, 0.16, 0.42);
  const workers = new THREE.InstancedMesh(workerGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), 64);
  workers.castShadow = workers.receiveShadow = true;
  const workerPos: THREE.Vector3[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 64; i++) {
    const x = -2.1 + (i % 8) * 0.6;
    const z = -2.1 + Math.floor(i / 8) * 0.6;
    workerPos.push(new THREE.Vector3(x, Y + 0.08, z));
    dummy.position.copy(workerPos[i]);
    dummy.updateMatrix();
    workers.setMatrixAt(i, dummy.matrix);
    workers.setColorAt(i, new THREE.Color(C.clay2));
  }
  g.add(workers);
  const workerHeat = new Float32Array(64);

  // 8 model endpoints
  const modelZ: number[] = [];
  for (let i = 0; i < 8; i++) {
    const z = -4.2 + i * 1.2;
    modelZ.push(z);
    const slab = rbox(0.9, 2.8, 0.85, M.ink, 0.08);
    slab.position.set(5.2, Y + 1.4, z);
    const led = rbox(0.06, 1.9, 0.5, M.glowBlue, 0.02);
    led.position.set(4.73, Y + 1.5, z);
    led.castShadow = false;
    g.add(slab, led);
    const tag = new CanvasPlane(256, 64, 0.36);
    tag.draw((ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.font = `500 30px ${fontStack("mono")}`;
      ctx.textBaseline = "middle";
      ctx.fillText(`M${String(i + 1).padStart(2, "0")}`, 8, 32);
    });
    tag.mesh.position.set(4.7, Y + 2.95 + 0.02, z);
    tag.mesh.rotation.y = -Math.PI / 2;
    g.add(tag.mesh);
  }

  // Metric bars (W&B): grow with completed calls
  const bars: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const b = rbox(0.5, 1, 0.5, i % 3 === 0 ? M.accent : M.clay, 0.04);
    b.position.set(8.4, Y, modelZ[i]);
    bars.push(b);
    g.add(b);
  }

  // Requests in flight
  const N = 420;
  const reqs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ roughness: 0.5 }), N);
  reqs.castShadow = true;
  g.add(reqs);
  const phase = new Float32Array(N);
  const worker = new Uint8Array(N);
  const model = new Uint8Array(N);
  const jitter = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    phase[i] = Math.random();
    worker[i] = Math.floor(Math.random() * 64);
    model[i] = Math.floor(Math.random() * 8);
    jitter[i * 2] = Math.random() - 0.5;
    jitter[i * 2 + 1] = Math.random() - 0.5;
  }
  const blue = new THREE.Color(C.blue);
  const orange = new THREE.Color(C.accent);
  const p = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  const counter = new CanvasPlane(900, 300, 2.6);
  counter.mesh.position.set(-1.5, 7.6, -2.5);
  counter.mesh.userData.billboard = true;
  g.add(counter.mesh);
  let shown = -1;
  const drawCounter = (cpm: number, hours: number) => {
    counter.draw((ctx, w) => {
      ctx.textBaseline = "top";
      ctx.fillStyle = "#7a776f";
      ctx.font = `500 30px ${fontStack("mono")}`;
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "4px";
      ctx.fillText("THROUGHPUT  ·  CALLS / MIN", 6, 10);
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
      ctx.fillStyle = C.ink;
      ctx.font = `400 160px ${fontStack("serif")}`;
      ctx.fillText(Math.round(cpm).toLocaleString(), 0, 52);
      ctx.fillStyle = C.accent;
      ctx.font = `500 30px ${fontStack("mono")}`;
      const eta = hours > 48 ? `${Math.round(hours / 24)} DAYS` : `${Math.round(hours)} HOURS`;
      ctx.fillText(`FULL RUN ≈ ${eta}`, 6, 238);
      void w;
    });
  };

  const caption = label([{ text: "3M+ CALLS · 8 MODELS · 64 WORKERS", font: "mono", size: 30, tracking: 4, color: "#7a776f" }], 0.5, { pxW: 900 });
  caption.mesh.position.set(0, Y + 0.02, 5.6);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  let total = 0;

  return {
    group: g,
    focus: new THREE.Vector3(0, 2.6, 0),
    update(t, dt, local) {
      const k = smooth(0.1, 0.85, local);
      const cpm = 40 + (2400 - 40) * Math.pow(k, 1.6);
      const hours = (52 * 24 * 40) / cpm;
      const rounded = Math.round(cpm / 10);
      if (rounded !== shown) {
        shown = rounded;
        drawCounter(cpm, hours);
      }
      const speed = 0.035 + k * 0.42;
      fill.scale.y = 0.4 + 1.6 * (0.5 + 0.5 * Math.sin(t * (1 + k * 6)));
      fill.position.y = Y + fill.scale.y / 2;

      for (let i = 0; i < 64; i++) workerHeat[i] *= Math.exp(-dt * 4);

      for (let i = 0; i < N; i++) {
        const prev = phase[i];
        phase[i] = (phase[i] + dt * speed * (0.8 + 0.4 * ((i * 7) % 5) / 5)) % 1;
        if (phase[i] < prev) {
          worker[i] = Math.floor(Math.random() * 64);
          model[i] = Math.floor(Math.random() * 8);
        }
        const s = phase[i];
        const w = workerPos[worker[i]];
        const jx = jitter[i * 2];
        const jz = jitter[i * 2 + 1];
        let col = blue;
        let scale = 1;
        if (s < 0.22) {
          // dataset → bucket
          a.set(-8.6 + jx * 1.6, Y + 0.6 + Math.abs(jz) * 1.4, jz * 2.2);
          b.set(-5.2, Y + 2.7, 0);
          const f = s / 0.22;
          p.lerpVectors(a, b, f);
          p.y += Math.sin(f * Math.PI) * 1.2;
          scale = Math.min(1, f * 6);
        } else if (s < 0.45) {
          // bucket → worker
          a.set(-5.2, Y + 2.7, 0);
          b.set(w.x, Y + 0.35, w.z);
          const f = (s - 0.22) / 0.23;
          p.lerpVectors(a, b, f);
          p.y += Math.sin(f * Math.PI) * 1.4;
          if (f > 0.9) workerHeat[worker[i]] = 1;
        } else if (s < 0.75) {
          // worker → model
          a.set(w.x, Y + 0.35, w.z);
          b.set(4.6, Y + 1.2 + jx * 0.8, modelZ[model[i]]);
          const f = (s - 0.45) / 0.3;
          p.lerpVectors(a, b, f);
          p.y += Math.sin(f * Math.PI) * 0.9;
        } else {
          // scored result → metric bars
          col = orange;
          a.set(5.2, Y + 3.1, modelZ[model[i]]);
          b.set(8.4, Y + 0.3 + bars[model[i]].scale.y, modelZ[model[i]]);
          const f = (s - 0.75) / 0.25;
          p.lerpVectors(a, b, f);
          p.y += Math.sin(f * Math.PI) * 0.8;
          scale = 1 - smooth(0.85, 1, f);
          if (f > 0.97) total += 1;
        }
        dummy.position.copy(p);
        dummy.rotation.set(s * 6, s * 4, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        reqs.setMatrixAt(i, dummy.matrix);
        reqs.setColorAt(i, col);
      }
      reqs.instanceMatrix.needsUpdate = true;
      if (reqs.instanceColor) reqs.instanceColor.needsUpdate = true;

      const cold = new THREE.Color(C.clay2);
      const hot = new THREE.Color(C.blue);
      const tmp = new THREE.Color();
      for (let i = 0; i < 64; i++) {
        tmp.copy(cold).lerp(hot, workerHeat[i]);
        workers.setColorAt(i, tmp);
        dummy.position.copy(workerPos[i]);
        dummy.position.y += workerHeat[i] * 0.06;
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1 + workerHeat[i] * 0.6, 1);
        dummy.updateMatrix();
        workers.setMatrixAt(i, dummy.matrix);
      }
      workers.instanceMatrix.needsUpdate = true;
      if (workers.instanceColor) workers.instanceColor.needsUpdate = true;

      for (let i = 0; i < 8; i++) {
        const target = 0.4 + (1 - Math.exp(-total / 900)) * (2.2 + ((i * 37) % 10) / 10);
        const bar = bars[i];
        bar.scale.y += (target - bar.scale.y) * Math.min(1, dt * 2);
        bar.position.y = Y + bar.scale.y / 2;
      }
    },
  };
}
