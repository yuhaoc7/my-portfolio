import * as THREE from "three";
import { C, M, label, rbox, smooth, type Station } from "./kit";

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

/**
 * VGI-Bench — a curved gallery wall of the benchmark's 25 task scenes (images
 * from the paper's teaser), flipping in as the reader arrives, with a central
 * screen playing generated-frame sequences from the paper.
 */
export function vgiGallery(base: string): Station {
  const g = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const tex = (url: string) => {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  // Floor disc
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.4, 0.4, 96), M.clay);
  floor.position.y = 0.2;
  floor.receiveShadow = true;
  floor.castShadow = true;
  g.add(floor);

  const wall = new THREE.Group();
  g.add(wall);
  const R = 12;
  const cols = 5;
  const rows = 5;
  const pw = 3.1;
  const ph = (pw * 150) / 372;
  const span = 1.45; // radians
  const panels: { pivot: THREE.Group; i: number }[] = [];
  const domainMats = C.domain.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  TASKS.forEach((task, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const a = -span / 2 + (col / (cols - 1)) * span;
    const pivot = new THREE.Group();
    pivot.position.set(Math.sin(a) * R, 1.2 + (rows - 1 - row) * (ph + 0.42) + ph / 2, -Math.cos(a) * R + 4);
    pivot.rotation.order = "YXZ";
    pivot.rotation.y = -a;
    const frame = rbox(pw + 0.16, ph + 0.16, 0.12, M.clay, 0.04);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex(`${base}/${task.id}.webp`), toneMapped: false }));
    img.position.z = 0.065;
    const strip = rbox(pw + 0.16, 0.08, 0.14, domainMats[task.d], 0.02);
    strip.position.y = -ph / 2 - 0.16;
    pivot.add(frame, img, strip);
    wall.add(pivot);
    panels.push({ pivot, i });
  });

  // Central screen with frame sequences
  const screen = new THREE.Group();
  screen.position.set(0, 0.4, 3.2);
  g.add(screen);
  const stand = rbox(0.3, 2.4, 0.3, M.ink, 0.06);
  stand.position.y = 1.2;
  const foot = rbox(2.2, 0.12, 1.2, M.ink, 0.05);
  foot.position.y = 0.06;
  const bezel = rbox(5.4, 3.2, 0.18, M.ink, 0.1);
  bezel.position.y = 2.4 + 1.6;
  screen.add(stand, foot, bezel);
  const seqTex = SEQS.map((s) => [0, 1, 2].map((k) => tex(`${base}/seq-${s}-${k}.webp`)));
  const screenMat = new THREE.MeshBasicMaterial({ map: seqTex[0][0], toneMapped: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 2.87), screenMat);
  face.position.set(0, 4, 0.1);
  screen.add(face);
  // three "frame" thumbnails under the screen
  const thumbs = [0, 1, 2].map((k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.84), new THREE.MeshBasicMaterial({ map: seqTex[0][k], toneMapped: false, transparent: true }));
    m.position.set(-1.75 + k * 1.75, 1.9, 0.3);
    const f = rbox(1.6, 0.94, 0.06, M.clay, 0.03);
    f.position.set(-1.75 + k * 1.75, 1.9, 0.25);
    screen.add(f, m);
    return m;
  });
  const play = rbox(0.14, 0.14, 0.02, M.glowAccent, 0.02);
  play.position.set(-2.4, 5.35, 0.12);
  screen.add(play);

  const caption = label(
    [
      { text: "VGI-BENCH · EMNLP 2026", font: "mono", size: 30, tracking: 5, color: C.accent },
      { text: "27 tasks · 810 instances · 20 models", font: "serif", size: 70, color: C.ink },
    ],
    1.4,
    { pxW: 1200, align: "center" },
  );
  caption.mesh.position.set(0, 0.42, 7.6);
  caption.mesh.rotation.x = -Math.PI / 2;
  caption.mesh.userData.billboard = false;
  g.add(caption.mesh);

  let seq = 0;
  let frame = 0;
  let clock = 0;

  return {
    group: g,
    focus: new THREE.Vector3(0, 4.6, 0),
    update(t, dt, local) {
      panels.forEach(({ pivot, i }) => {
        const order = (i % cols) * 0.035 + Math.floor(i / cols) * 0.02;
        const f = smooth(0.02 + order, 0.3 + order, local);
        pivot.scale.setScalar(0.001 + 0.999 * f);
        pivot.rotation.x = (1 - f) * -1.2;
      });
      clock += dt;
      if (clock > 0.85) {
        clock = 0;
        frame = (frame + 1) % 4;
        if (frame === 0) seq = (seq + 1) % SEQS.length;
        const fi = Math.min(frame, 2);
        screenMat.map = seqTex[seq][fi];
        screenMat.needsUpdate = true;
        thumbs.forEach((m, k) => {
          const mm = m.material as THREE.MeshBasicMaterial;
          mm.map = seqTex[seq][k];
          mm.opacity = k === fi ? 1 : 0.45;
          mm.needsUpdate = true;
        });
      }
      play.visible = Math.sin(t * 6) > 0;
      screen.rotation.y = Math.sin(t * 0.3) * 0.05;
    },
  };
}
