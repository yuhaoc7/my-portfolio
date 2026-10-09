import * as THREE from "three";
import { C, CanvasPlane, M, cyl, fontStack, label, plinth, rbox, smooth, type Station } from "./kit";

/**
 * HiABR — SDXL served from 2 nodes × 4 GPUs behind Nginx least-connections.
 * Prompts arrive, the balancer routes each to the least-busy GPU, GPUs pull
 * micro-batches of up to 4 from a bounded queue, and finished images float up.
 */
export function sdxlServing(): Station {
  const g = new THREE.Group();
  g.add(plinth(24, 15));
  const Y = 0.66;

  // Two-tier GPU shelf
  const shelfMat = new THREE.MeshStandardMaterial({ color: "#d9d5cc", roughness: 0.7, metalness: 0.1 });
  const shroud = new THREE.MeshStandardMaterial({ color: "#2a2a30", roughness: 0.4, metalness: 0.4 });
  const fanMat = new THREE.MeshStandardMaterial({ color: "#151518", roughness: 0.7 });
  const gpus: { pos: THREE.Vector3; fans: THREE.Group[]; queue: number; busy: number; ring: THREE.Mesh; shown: number }[] = [];

  [0, 1].forEach((tier) => {
    const y = Y + tier * 2.6;
    const z = tier === 0 ? 1.4 : -1.4;
    const shelf = rbox(9.4, 0.24, 2.6, shelfMat, 0.06);
    shelf.position.set(1.5, y + 0.12 + (tier ? 0.2 : 0), z);
    g.add(shelf);
    if (tier) {
      [-3, 6].forEach((x) => {
        const post = rbox(0.24, 2.8, 0.24, M.steel, 0.04);
        post.position.set(x, Y + 1.4, z);
        g.add(post);
      });
    }
    const nodeTag = label([{ text: `NODE ${tier + 1}`, font: "mono", size: 32, tracking: 5, color: "#7a776f" }], 0.3, { pxW: 280 });
    nodeTag.mesh.userData.billboard = false;
    nodeTag.mesh.position.set(-2.6, y + 0.45 + (tier ? 0.2 : 0), z + 1.31);
    g.add(nodeTag.mesh);

    for (let i = 0; i < 4; i++) {
      const gx = -1.1 + i * 2.1;
      const gy = y + 0.24 + (tier ? 0.2 : 0) + 0.8;
      const card = new THREE.Group();
      const body = rbox(1.8, 1.5, 0.5, shroud, 0.1);
      const stripe = rbox(1.82, 0.08, 0.52, M.accent, 0.02);
      stripe.position.y = 0.62;
      card.add(body, stripe);
      const fans: THREE.Group[] = [];
      [-0.42, 0.42].forEach((fx) => {
        const fan = new THREE.Group();
        const housing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 32), M.steel);
        fan.add(housing);
        for (let b = 0; b < 7; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.02), fanMat);
          blade.position.x = 0.15;
          const pivot = new THREE.Group();
          pivot.rotation.z = (b / 7) * Math.PI * 2;
          blade.rotation.x = 0.5;
          pivot.add(blade);
          fan.add(pivot);
        }
        const hub = cyl(0.08, 0.08, 0.04, M.steel, 16);
        hub.rotation.x = Math.PI / 2;
        fan.add(hub);
        fan.position.set(fx, -0.08, 0.27);
        card.add(fan);
        fans.push(fan);
      });
      card.position.set(gx, gy, z);
      g.add(card);
      // Queue ring above the card — fills as prompts wait
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 32, 0.001), M.glowBlue);
      ring.position.set(gx, gy + 1.05, z);
      g.add(ring);
      gpus.push({ pos: new THREE.Vector3(gx, gy + 0.9, z), fans, queue: 0, busy: 0, ring, shown: 0 });
    }
  });

  // Nginx balancer
  const lb = rbox(2, 1.4, 2, M.ink, 0.12);
  lb.position.set(-7.4, Y + 0.7, 0);
  const lbLight = rbox(1.4, 0.08, 0.06, M.glowGreen, 0.02);
  lbLight.position.set(-7.4, Y + 1.1, 1.02);
  lbLight.castShadow = false;
  g.add(lb, lbLight);
  const lbTag = label([{ text: "NGINX · LEAST-CONN", font: "mono", size: 32, tracking: 4, color: "#ffffff" }], 0.24, { pxW: 520, align: "center" });
  lbTag.mesh.userData.billboard = false;
  lbTag.mesh.position.set(-7.4, Y + 0.6, 1.02);
  g.add(lbTag.mesh);

  // Prompt spheres
  const R = 80;
  const prompts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 14, 10), M.glowBlue, R);
  g.add(prompts);
  const pr = Array.from({ length: R }, () => ({ alive: false, f: 0, gpu: 0, from: new THREE.Vector3() }));
  const dummy = new THREE.Object3D();

  // Generated images — soft gradient "renders"
  const palettes = [
    ["#f7c59f", "#ef6f6c", "#465775"],
    ["#c6dabf", "#88d498", "#1a936f"],
    ["#e9d8a6", "#ee9b00", "#9b2226"],
    ["#bde0fe", "#a2d2ff", "#5e60ce"],
    ["#ffd6ff", "#e7c6ff", "#7b2cbf"],
    ["#f1faee", "#a8dadc", "#457b9d"],
  ];
  const imgMats = palettes.map((p, i) => {
    const c = new CanvasPlane(256, 256, 1, { transparent: true });
    c.draw((ctx, w, h) => {
      const grd = ctx.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, p[0]);
      grd.addColorStop(0.6, p[1]);
      grd.addColorStop(1, p[2]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      // a sun / horizon motif, different per palette
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(w * (0.3 + (i % 3) * 0.2), h * 0.38, 34 + i * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.66 + 0.06 * Math.sin(x / 30 + i)));
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
    });
    c.material.side = THREE.DoubleSide;
    return c.material;
  });
  const I = 30;
  const imgGeo = new THREE.PlaneGeometry(1.2, 1.2);
  const images = Array.from({ length: I }, (_, i) => {
    const m = new THREE.Mesh(imgGeo, imgMats[i % imgMats.length].clone());
    m.visible = false;
    g.add(m);
    return { m, f: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
  });
  let nextImg = 0;

  const counter = new CanvasPlane(900, 300, 2.4);
  counter.mesh.userData.billboard = true;
  counter.mesh.position.set(-6.5, 7.2, -3);
  g.add(counter.mesh);
  let lastCounter = -1;

  let spawnAcc = 0;
  let batchClock = 0;

  return {
    group: g,
    focus: new THREE.Vector3(0.5, 3.4, 0),
    update(t, dt, local) {
      const k = smooth(0.1, 0.85, local);
      const users = Math.round(4 + 60 * k);
      const ipm = Math.round(6 + 134 * Math.pow(k, 1.2));
      if (ipm !== lastCounter) {
        lastCounter = ipm;
        counter.draw((ctx) => {
          ctx.textBaseline = "top";
          ctx.fillStyle = "#7a776f";
          ctx.font = `500 30px ${fontStack("mono")}`;
          ctx.fillText(`IMAGES / MIN  ·  ${users} CONCURRENT USERS`, 6, 10);
          ctx.fillStyle = C.ink;
          ctx.font = `400 160px ${fontStack("serif")}`;
          ctx.fillText(String(ipm), 0, 52);
          ctx.fillStyle = C.accent;
          ctx.font = `500 30px ${fontStack("mono")}`;
          ctx.fillText("0 ERRORS · p95 21 s", 6, 238);
        });
      }

      // Arrivals
      spawnAcc += dt * (1.2 + k * 9);
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        const slot = pr.find((p) => !p.alive);
        if (!slot) break;
        // least connections
        let best = 0;
        for (let i = 1; i < gpus.length; i++) if (gpus[i].queue + gpus[i].busy < gpus[best].queue + gpus[best].busy) best = i;
        gpus[best].queue = Math.min(4, gpus[best].queue + 1);
        slot.alive = true;
        slot.f = 0;
        slot.gpu = best;
        slot.from.set(-12, Y + 1 + Math.random() * 2, (Math.random() - 0.5) * 6);
      }

      // Micro-batch every 50 ms "window" (slowed for the eye)
      batchClock += dt;
      if (batchClock > 0.9) {
        batchClock = 0;
        gpus.forEach((gp) => {
          if (gp.queue > 0) {
            const n = gp.queue;
            gp.queue = 0;
            gp.busy = 1;
            for (let j = 0; j < n; j++) {
              const im = images[nextImg];
              nextImg = (nextImg + 1) % I;
              im.f = -j * 0.08;
              im.from.copy(gp.pos);
              im.to.set(gp.pos.x + (Math.random() - 0.5) * 3, Y + 9 + Math.random() * 3, gp.pos.z - 2 - Math.random() * 3);
              im.m.visible = true;
            }
          } else gp.busy = 0;
        });
      }

      const lbPos = new THREE.Vector3(-7.4, Y + 1.5, 0);
      const p = new THREE.Vector3();
      pr.forEach((s, i) => {
        if (s.alive) {
          s.f += dt * 0.5;
          if (s.f < 0.5) {
            p.lerpVectors(s.from, lbPos, s.f / 0.5);
          } else {
            const f = (s.f - 0.5) / 0.5;
            p.lerpVectors(lbPos, gpus[s.gpu].pos, f);
            p.y += Math.sin(f * Math.PI) * 2.2;
          }
          if (s.f >= 1) s.alive = false;
          dummy.position.copy(p);
          dummy.scale.setScalar(1);
        } else dummy.scale.setScalar(0);
        dummy.updateMatrix();
        prompts.setMatrixAt(i, dummy.matrix);
      });
      prompts.instanceMatrix.needsUpdate = true;

      gpus.forEach((gp) => {
        const spin = 4 + gp.busy * 18;
        gp.fans.forEach((f) => (f.rotation.z -= dt * spin));
        if (gp.shown !== gp.queue) {
          gp.shown = gp.queue;
          gp.ring.geometry.dispose();
          gp.ring.geometry = new THREE.TorusGeometry(0.28, 0.05, 6, 24, Math.max(0.001, (gp.queue / 4) * Math.PI * 2));
        }
      });

      images.forEach((im) => {
        if (!im.m.visible) return;
        im.f += dt * 0.28;
        const f = Math.max(0, im.f);
        im.m.position.lerpVectors(im.from, im.to, smooth(0, 1, f));
        const s = smooth(0, 0.15, f) * (1 - smooth(0.8, 1, f));
        im.m.scale.setScalar(Math.max(0.001, s));
        im.m.rotation.y = Math.sin(t + f * 3) * 0.3;
        (im.m.material as THREE.MeshBasicMaterial).opacity = s;
        if (f >= 1) im.m.visible = false;
      });
    },
  };
}
