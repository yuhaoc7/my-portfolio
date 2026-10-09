import * as THREE from "three";
import { C, M, label, plinth, rbox, smooth, type Station } from "./kit";

/**
 * PIR-Arena — proactive retrieval. A cloud of documents falls through three
 * filters (BM25 → dense → cross-encoder rerank); most are discarded at each
 * stage and the survivor lands on the user's device at the right moment.
 */
export function retrievalFunnel(): Station {
  const g = new THREE.Group();
  g.add(plinth(16, 16));
  const Y = 0.66;

  const stages = [
    { y: 10.5, r: 4.6, name: "BM25" },
    { y: 7.2, r: 3.0, name: "DENSE" },
    { y: 4.3, r: 1.6, name: "RERANK" },
  ];
  stages.forEach((s, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.09, 12, 96), i === 2 ? M.accent : M.ink);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = s.y;
    ring.castShadow = true;
    g.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(s.r, 64),
      new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.25, roughness: 0.2, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = s.y;
    g.add(disc);
    const tag = label([{ text: `0${i + 1} ${s.name}`, font: "mono", size: 34, tracking: 5, color: i === 2 ? C.accent : C.ink }], 0.36, { pxW: 360 });
    tag.mesh.position.set(s.r + 1.4, s.y + 0.1, 0);
    g.add(tag.mesh);
  });

  // Phone receiving the recommendation
  const phone = new THREE.Group();
  const body = rbox(1.5, 0.16, 2.9, M.ink, 0.12);
  const screen = rbox(1.32, 0.02, 2.6, new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), 0.08);
  screen.position.y = 0.09;
  const card = rbox(1.1, 0.03, 0.6, M.accent, 0.04);
  card.position.set(0, 0.11, -0.6);
  phone.add(body, screen, card);
  phone.position.set(0, Y + 0.6, 0);
  phone.rotation.x = -0.25;
  g.add(phone);
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.9, 64), new THREE.MeshBasicMaterial({ color: C.accent, toneMapped: false, transparent: true }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = Y + 0.04;
  g.add(glow);

  // Documents
  const N = 360;
  const docs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.02, 0.56), new THREE.MeshStandardMaterial({ roughness: 0.6 }), N);
  docs.castShadow = true;
  g.add(docs);
  const d = Array.from({ length: N }, (_, i) => ({
    f: Math.random(),
    a: Math.random() * Math.PI * 2,
    r: 1 + Math.random() * 4.5,
    // which stage it dies at: 0, 1, 2 or 3 (=delivered)
    die: (() => {
      const u = Math.random();
      return u < 0.62 ? 0 : u < 0.86 ? 1 : u < 0.98 ? 2 : 3;
    })(),
    spin: Math.random() * 6,
    i,
  }));
  const dummy = new THREE.Object3D();
  const paper = new THREE.Color("#ffffff");
  const hot = new THREE.Color(C.accent);
  const blue = new THREE.Color(C.blue);
  const top = 13.5;

  const caption = label(
    [
      { text: "50,000 DOCS → 1 CARD · 1.8 s p95", font: "mono", size: 30, tracking: 4, color: "#7a776f" },
      { text: "34 scenes · 831 minutes · 11 need types", font: "serif", size: 60, color: C.ink },
    ],
    1.2,
    { pxW: 1200, align: "center" },
  );
  caption.mesh.position.set(0, Y + 0.02, 6.3);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  return {
    group: g,
    focus: new THREE.Vector3(0, 6.2, 0),
    update(t, dt, local) {
      const speed = 0.05 + 0.12 * smooth(0, 0.6, local);
      d.forEach((doc) => {
        doc.f += dt * speed * (0.8 + (doc.i % 5) * 0.08);
        if (doc.f > 1) {
          doc.f -= 1;
          doc.a = Math.random() * Math.PI * 2;
        }
        const y = top - doc.f * (top - Y - 0.9);
        // radius narrows past each stage the doc survives
        let r = doc.r;
        let alive = 1;
        let col = paper;
        for (let s = 0; s < 3; s++) {
          if (y < stages[s].y) {
            if (doc.die === s) {
              alive = Math.max(0, 1 - (stages[s].y - y) * 1.6);
              col = blue;
            }
            r = Math.min(r, stages[s].r * 0.75);
          }
        }
        if (doc.die === 3 && y < stages[2].y) {
          r = Math.max(0, r * ((y - Y) / (stages[2].y - Y)));
          col = hot;
        }
        const ang = doc.a + t * 0.2 + doc.f * 2;
        dummy.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
        dummy.rotation.set(Math.sin(doc.spin + t) * 0.6, ang, Math.cos(doc.spin + t) * 0.4);
        dummy.scale.setScalar(Math.max(0.0001, doc.die === 3 ? 1 : alive));
        dummy.updateMatrix();
        docs.setMatrixAt(doc.i, dummy.matrix);
        docs.setColorAt(doc.i, col);
      });
      docs.instanceMatrix.needsUpdate = true;
      if (docs.instanceColor) docs.instanceColor.needsUpdate = true;
      const pulse = (t * 0.6) % 1;
      glow.scale.setScalar(0.6 + pulse * 1.2);
      (glow.material as THREE.MeshBasicMaterial).opacity = 1 - pulse;
      card.position.z = -0.6 + Math.sin(t * 2) * 0.03;
    },
  };
}
