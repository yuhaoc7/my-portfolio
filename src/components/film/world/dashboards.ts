import * as THREE from "three";
import { C, CanvasPlane, M, fontStack, label, plinth, rbox, smooth, type Station } from "./kit";

/**
 * visibilityx.ai — data-heavy dashboards. Three floating panels with live
 * charts; twelve scattered component blocks snap into a tidy grid (the shared
 * components that replaced ~2,000 duplicated lines); a load bar shrinks from
 * 2.4 s to 1.6 s.
 */
export function dashboards(): Station {
  const g = new THREE.Group();
  g.add(plinth(20, 13));
  const Y = 0.66;

  // Monitor-ish easel holding the panels
  const panels = new THREE.Group();
  panels.position.set(0, Y + 4.6, -1.5);
  g.add(panels);

  const mkPanel = (w: number, h: number, x: number, y: number, ry: number) => {
    const p = new THREE.Group();
    const back = rbox(w, h, 0.18, M.clay, 0.12);
    p.add(back);
    p.position.set(x, y, 0);
    p.rotation.y = ry;
    panels.add(p);
    return p;
  };

  // Panel A — 3D bar chart
  const pa = mkPanel(5.4, 3.6, -5.6, 0, 0.42);
  const barMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const b = rbox(0.34, 1, 0.34, i === 6 ? M.accent : i % 2 ? M.clay2 : M.blue, 0.05);
    b.position.set(-2 + i * 0.5, -1.4, 0.3);
    pa.add(b);
    barMeshes.push(b);
  }
  const ta = label([{ text: "SESSIONS / DAY", font: "mono", size: 30, tracking: 4, color: "#7a776f" }], 0.3, { pxW: 520 });
  ta.mesh.userData.billboard = false;
  ta.mesh.position.set(-1.2, 1.45, 0.1);
  pa.add(ta.mesh);

  // Panel B — line chart drawn on canvas
  const pb = mkPanel(6.2, 4, 0, 0.6, 0);
  const line = new CanvasPlane(1100, 700, 3.6);
  line.mesh.position.z = 0.1;
  pb.add(line.mesh);
  let lastLine = -1;
  const drawLine = (t: number) => {
    line.draw((ctx, w, h) => {
      ctx.fillStyle = "#7a776f";
      ctx.font = `500 30px ${fontStack("mono")}`;
      ctx.fillText("VISIBILITY SCORE · 30 D", 50, 70);
      ctx.fillStyle = C.ink;
      ctx.font = `400 110px ${fontStack("serif")}`;
      ctx.fillText("82.4", 50, 190);
      ctx.strokeStyle = "rgba(36,36,42,0.1)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(50, 300 + i * 100);
        ctx.lineTo(w - 50, 300 + i * 100);
        ctx.stroke();
      }
      const series = (k: number, ph: number) => (x: number) => 520 - (Math.sin(x * 7 + ph + t) * 40 + x * 160 + k);
      [
        { f: series(40, 0), c: C.blue, wdt: 6 },
        { f: series(-20, 2), c: C.accent, wdt: 4 },
      ].forEach(({ f, c, wdt }) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const x = i / 100;
          const px = 50 + x * (w - 100);
          if (i === 0) ctx.moveTo(px, f(x));
          else ctx.lineTo(px, f(x));
        }
        ctx.stroke();
      });
      void h;
    });
  };

  // Panel C — donut
  const pc = mkPanel(4.6, 3.6, 5.4, 0, -0.42);
  const arcs: THREE.Mesh[] = [];
  const arcMats = [M.blue, M.accent, M.stone, M.ink];
  const shares = [0.42, 0.24, 0.2, 0.14];
  let start = 0;
  shares.forEach((s, i) => {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.26, 16, 64, s * Math.PI * 2 - 0.05), arcMats[i]);
    torus.rotation.z = start * Math.PI * 2;
    torus.position.set(0, -0.2, 0.3);
    torus.castShadow = true;
    torus.userData.start = start;
    pc.add(torus);
    arcs.push(torus);
    start += s;
  });
  const tc = label([{ text: "TRAFFIC SOURCES", font: "mono", size: 30, tracking: 4, color: "#7a776f" }], 0.3, { pxW: 520 });
  tc.mesh.userData.billboard = false;
  tc.mesh.position.set(-0.6, 1.45, 0.1);
  pc.add(tc.mesh);

  // Twelve shared components → grid
  const blocks: { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; r: THREE.Euler }[] = [];
  for (let i = 0; i < 12; i++) {
    const m = rbox(0.9, 0.5, 0.9, i % 4 === 0 ? M.accent : i % 3 === 0 ? M.blue : M.clay, 0.08);
    const to = new THREE.Vector3(-2.1 + (i % 4) * 1.4, Y + 0.25, 2.6 + Math.floor(i / 4) * 1.2);
    const from = new THREE.Vector3((Math.random() - 0.5) * 16, Y + 2 + Math.random() * 6, (Math.random() - 0.2) * 10);
    blocks.push({ m, from, to, r: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3) });
    g.add(m);
  }

  // Load-time bar
  const track = rbox(7, 0.16, 0.5, M.clay2, 0.06);
  track.position.set(0, Y + 0.08, 5.9);
  const loadBar = rbox(1, 0.22, 0.5, M.ink, 0.06);
  loadBar.position.set(0, Y + 0.11, 5.9);
  g.add(track, loadBar);
  const loadLabel = new CanvasPlane(700, 120, 0.6);
  loadLabel.mesh.rotation.x = -Math.PI / 2;
  loadLabel.mesh.position.set(-1.2, Y + 0.02, 6.7);
  g.add(loadLabel.mesh);
  let lastLoad = -1;

  return {
    group: g,
    focus: new THREE.Vector3(0, 4, 1),
    update(t, dt, local) {
      const k = smooth(0.1, 0.75, local);
      barMeshes.forEach((b, i) => {
        const hgt = 0.4 + (1.4 + Math.sin(t * 1.2 + i * 0.8) * 0.5 + (i % 3) * 0.35) * (0.3 + 0.7 * k);
        b.scale.y = hgt;
        b.position.y = -1.4 + hgt / 2;
      });
      const lt = Math.round(t * 8);
      if (lt !== lastLine) {
        lastLine = lt;
        drawLine(t * 0.6);
      }
      arcs.forEach((a, i) => {
        a.rotation.z = (a.userData.start as number) * Math.PI * 2 + t * 0.25;
        a.position.z = 0.3 + Math.sin(t * 2 + i) * 0.05;
      });
      panels.position.y = Y + 4.6 + Math.sin(t * 0.8) * 0.12;

      blocks.forEach((b, i) => {
        const f = smooth(0.08 + i * 0.03, 0.45 + i * 0.03, local);
        b.m.position.lerpVectors(b.from, b.to, f);
        b.m.position.y += Math.sin(f * Math.PI) * 1.5;
        b.m.rotation.set(b.r.x * (1 - f), b.r.y * (1 - f) + (1 - f) * t * 0.3, b.r.z * (1 - f));
      });

      const sec = 2.4 - 0.8 * smooth(0.35, 0.85, local);
      const w = (sec / 2.4) * 7;
      loadBar.scale.x = w;
      loadBar.position.x = -3.5 + w / 2;
      const s10 = Math.round(sec * 10);
      if (s10 !== lastLoad) {
        lastLoad = s10;
        loadLabel.draw((ctx) => {
          ctx.fillStyle = C.ink;
          ctx.font = `500 44px ${fontStack("mono")}`;
          ctx.fillText(`MEDIAN LOAD  ${sec.toFixed(1)} s`, 6, 70);
        });
      }
      void dt;
    },
  };
}
