import * as THREE from "three";
import { C, CanvasPlane, M, fontStack, label, plinth, rbox, roundRect, smooth, type Station } from "./kit";

/**
 * IBM–Illinois — full-parameter training of Llama-3.1-8B on 4 nodes × 4 GPUs.
 * Racks blink in lock-step with training steps, gradient pulses travel the
 * all-reduce ring between nodes, a loss curve draws itself, and 16 browser
 * workers roll out WebArena trajectories overhead.
 */
export function gpuCluster(): Station {
  const g = new THREE.Group();
  g.add(plinth(22, 15));
  const Y = 0.66;

  const rackX = [-4.8, -1.6, 1.6, 4.8];
  const rackMat = new THREE.MeshStandardMaterial({ color: "#2b2b31", roughness: 0.5, metalness: 0.25 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: "#4a4a52", roughness: 0.45, metalness: 0.35 });
  const grilleMat = new THREE.MeshStandardMaterial({ color: "#1b1b1f", roughness: 0.8 });

  const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
  const ledCount = 4 * 4 * 8;
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), ledCount);
  const dummy = new THREE.Object3D();
  let li = 0;

  rackX.forEach((x, r) => {
    const rack = rbox(2.5, 5.6, 2.3, rackMat, 0.08);
    rack.position.set(x, Y + 2.8, 0);
    g.add(rack);
    // Top cap
    const cap = rbox(2.6, 0.12, 2.4, M.clay2, 0.04);
    cap.position.set(x, Y + 5.66, 0);
    g.add(cap);
    for (let s = 0; s < 4; s++) {
      const y = Y + 0.9 + s * 1.2;
      const blade = rbox(2.2, 1.0, 0.12, bladeMat, 0.04);
      blade.position.set(x, y, 1.16);
      const grille = rbox(1.2, 0.62, 0.04, grilleMat, 0.02);
      grille.position.set(x - 0.35, y, 1.23);
      g.add(blade, grille);
      for (let k = 0; k < 8; k++) {
        dummy.position.set(x + 0.42 + (k % 4) * 0.16, y + (k < 4 ? 0.14 : -0.14), 1.25);
        dummy.updateMatrix();
        leds.setMatrixAt(li, dummy.matrix);
        leds.setColorAt(li, new THREE.Color(C.green));
        li++;
      }
    }
    const tag = label([{ text: `NODE ${r + 1}`, font: "mono", size: 34, tracking: 5, color: "#ffffff" }], 0.32, { pxW: 300, align: "center" });
    tag.mesh.userData.billboard = false;
    tag.mesh.position.set(x, Y + 5.3, 1.17);
    g.add(tag.mesh);
  });
  g.add(leds);

  // All-reduce ring: arcs between neighbouring racks + a return arc behind.
  const ringCurves: THREE.Curve<THREE.Vector3>[] = [];
  const cableMat = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    let curve: THREE.Curve<THREE.Vector3>;
    if (i < 3) {
      const a = new THREE.Vector3(rackX[i], Y + 5.75, 0.5);
      const b = new THREE.Vector3(rackX[i + 1], Y + 5.75, 0.5);
      const m = a.clone().add(b).multiplyScalar(0.5);
      m.y += 1.1;
      curve = new THREE.QuadraticBezierCurve3(a, m, b);
    } else {
      curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(rackX[3], Y + 5.75, -0.6),
        new THREE.Vector3(rackX[3] + 1.5, Y + 8.4, -1.6),
        new THREE.Vector3(rackX[0] - 1.5, Y + 8.4, -1.6),
        new THREE.Vector3(rackX[0], Y + 5.75, -0.6),
      );
    }
    ringCurves.push(curve);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.07, 10), cableMat);
    tube.castShadow = true;
    g.add(tube);
  }
  const P = 28;
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 16, 12), M.glowAccent, P);
  g.add(pulses);

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
  browsers.position.set(0, Y + 11.2, -2.2);
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
  caption.mesh.position.set(0, Y + 0.02, 6.3);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  const green = new THREE.Color(C.green);
  const amber = new THREE.Color(C.accent);
  const off = new THREE.Color("#3a3a40");
  const tmp = new THREE.Color();

  return {
    group: g,
    focus: new THREE.Vector3(0, 5.4, 0),
    update(t, _dt, local) {
      const k = smooth(0.05, 0.9, local);
      // LEDs: a training step sweeps across all 16 GPUs
      const step = (t * 1.6) % 1;
      for (let i = 0; i < ledCount; i++) {
        const gpu = Math.floor(i / 8);
        const on = Math.sin(t * 9 + i * 1.7) > -0.2;
        const sweep = Math.abs(step - gpu / 16) < 0.08;
        tmp.copy(sweep ? amber : on ? green : off);
        leds.setColorAt(i, tmp);
      }
      if (leds.instanceColor) leds.instanceColor.needsUpdate = true;

      for (let i = 0; i < P; i++) {
        const c = ringCurves[i % 4];
        const f = (t * 0.45 + i / P) % 1;
        dummy.position.copy(c.getPointAt(f));
        dummy.scale.setScalar(0.7 + 0.5 * Math.sin(f * Math.PI));
        dummy.updateMatrix();
        pulses.setMatrixAt(i, dummy.matrix);
      }
      pulses.instanceMatrix.needsUpdate = true;

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
      browsers.position.y = 0.66 + 11.2 - (1 - smooth(0.15, 0.55, local)) * 2.5;
      browsers.scale.setScalar(0.75 + 0.25 * smooth(0.15, 0.55, local));
    },
  };
}
