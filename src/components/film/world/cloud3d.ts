import * as THREE from "three";
import { label, type CanvasPlane } from "./kit";

const INK = "#2a241b";
const SAGE = "#4f6b60";

/**
 * Thin wires with light travelling along them. WebGL lines are stuck at one
 * pixel, so these are screen-space ribbons, built by `ribbon`. aFlow is distance
 * along the wire, or −1 to stay still.
 */
export function flowMaterial(color: string, pulse: string, width: number, alpha: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPulse: { value: new THREE.Color(pulse) },
      uTime: { value: 0 },
      uWidth: { value: width },
      uAlpha: { value: alpha },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOther;
      attribute float aSide;
      attribute float aFlow;
      uniform float uTime;
      uniform float uWidth;
      uniform vec2 uRes;
      varying float vHead;
      void main() {
        vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 b = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
        vec2 half_ = uRes * 0.5;
        vec2 d = (b.xy / b.w - a.xy / a.w) * half_;
        d = length(d) > 0.0001 ? normalize(d) : vec2(1.0, 0.0);
        vHead = aFlow < 0.0 ? 0.35 : smoothstep(0.66, 1.0, fract(aFlow / 300.0 - uTime * 0.16));
        float w = uWidth * (1.0 + vHead * 0.5) * 0.5;
        a.xy += vec2(-d.y, d.x) * aSide * w / half_ * a.w;
        gl_Position = a;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uPulse;
      uniform float uAlpha;
      varying float vHead;
      void main() {
        gl_FragColor = vec4(mix(uColor, uPulse, vHead), uAlpha + (0.9 - uAlpha) * vHead);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Turn line-segment pairs (x, y, z, x, y, z, …) and per-vertex flow into a ribbon geometry. */
export function ribbon(geo: THREE.BufferGeometry, seg: number[], flow: number[]) {
  const n = seg.length / 6;
  const pos = new Float32Array(n * 18);
  const other = new Float32Array(n * 18);
  const side = new Float32Array(n * 6);
  const along = new Float32Array(n * 6);
  // Corners a−, a+, b−, a−, b−, b+. The screen direction flips at b, so its side sign does too.
  const corners: [0 | 1, number][] = [
    [0, -1],
    [0, 1],
    [1, -1],
    [0, -1],
    [1, -1],
    [1, 1],
  ];
  for (let i = 0; i < n; i++) {
    corners.forEach(([end, sign], c) => {
      const v = i * 6 + c;
      const me = i * 6 + end * 3;
      const you = i * 6 + (1 - end) * 3;
      for (let k = 0; k < 3; k++) {
        pos[v * 3 + k] = seg[me + k];
        other[v * 3 + k] = seg[you + k];
      }
      side[v] = sign;
      along[v] = flow[i * 2 + end];
    });
  }
  geo.dispose(); // frees the last frame's GL buffers
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aOther", new THREE.BufferAttribute(other, 3));
  geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geo.setAttribute("aFlow", new THREE.BufferAttribute(along, 1));
}

const rnd = (n: number) => {
  const v = Math.sin(n * 91.7) * 24634.63;
  return v - Math.floor(v);
};

/**
 * The opening map as a real 3D cloud: a core and a hub per section hanging at
 * different heights above the sheet, each with its own swarm of parts, wired
 * together. Local origin is on the sheet; Y is up off it. About 8 × 5 wide.
 */
export function cloud3d(names: string[], material: THREE.ShaderMaterial) {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);

  const seg: number[] = [];
  const flow: number[] = [];
  const line = (a: THREE.Vector3, b: THREE.Vector3, moving = true) => {
    const len = a.distanceTo(b) * 100;
    seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
    flow.push(moving ? 0 : -1, moving ? len : -1);
  };
  const curve = (a: THREE.Vector3, b: THREE.Vector3, rise: number) => {
    const n = 18;
    const p = new THREE.Vector3();
    const q = a.clone();
    let along = 0;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      p.lerpVectors(a, b, u);
      p.y += Math.sin(u * Math.PI) * rise;
      const d = p.distanceTo(q) * 100;
      seg.push(q.x, q.y, q.z, p.x, p.y, p.z);
      flow.push(along, along + d);
      along += d;
      q.copy(p);
    }
  };

  const core = new THREE.Vector3(0, 1.35, 0);
  const hubs = names.map((_, i) => {
    const a = (i / names.length) * Math.PI * 2 + 0.4;
    const r = 0.72 + rnd(i + 1) * 0.28;
    return new THREE.Vector3(Math.cos(a) * 3.7 * r, 0.5 + rnd(i + 11) * 1.45, Math.sin(a) * 2.5 * r);
  });

  const inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 });
  const sageMat = new THREE.MeshStandardMaterial({ color: SAGE, roughness: 0.4, metalness: 0.15 });
  const cardMat = new THREE.MeshStandardMaterial({ color: "#fbf6ea", roughness: 0.7 });
  const shadowMat = new THREE.MeshBasicMaterial({ color: "#6b5433", transparent: true, opacity: 0.13, depthWrite: false, toneMapped: false });

  const beads: THREE.Vector3[] = [];
  const cards: THREE.Vector3[] = [];
  hubs.forEach((h, i) => {
    curve(core, h, 0.5);
    line(h, new THREE.Vector3(h.x, 0.01, h.z), false);
    const next = hubs[(i + 3) % hubs.length];
    curve(h, next, 0.5);
    const count = 6 + Math.floor(rnd(i + 5) * 8);
    for (let k = 0; k < count; k++) {
      // Spread over a sphere around the hub, flattened where it would reach the sheet.
      const th = rnd(i * 7 + k) * Math.PI * 2;
      const ph = Math.acos(2 * rnd(i * 13 + k + 0.5) - 1);
      const r = 0.45 + rnd(i * 17 + k) * 0.75;
      const p = new THREE.Vector3(h.x + Math.sin(ph) * Math.cos(th) * r, Math.max(0.14, h.y + Math.cos(ph) * r * 0.75), h.z + Math.sin(ph) * Math.sin(th) * r);
      line(h, p);
      (k % 4 === 0 ? cards : beads).push(p);
    }
  });

  const wires = new THREE.BufferGeometry();
  ribbon(wires, seg, flow);
  const lines = new THREE.Mesh(wires, material);
  lines.frustumCulled = false;
  lines.renderOrder = 3;
  spin.add(lines);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const beadMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), inkMat, beads.length);
  beads.forEach((p, i) => beadMesh.setMatrixAt(i, m.compose(p, q.identity(), one)));
  const cardMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.15, 0.02), cardMat, cards.length);
  cards.forEach((p, i) => cardMesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e.set(rnd(i) * 0.5, rnd(i + 3) * 1.2 - 0.6, 0)), one)));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.2, 0.15, 0.02)), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }));
  spin.add(beadMesh, cardMesh);
  cards.forEach((p, i) => {
    const o = edge.clone();
    o.position.copy(p);
    o.quaternion.setFromEuler(e.set(rnd(i) * 0.5, rnd(i + 3) * 1.2 - 0.6, 0));
    spin.add(o);
  });

  const hubGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const hubMeshes = hubs.map((h) => {
    const o = new THREE.Mesh(hubGeo, sageMat);
    o.position.copy(h);
    spin.add(o);
    return o;
  });
  const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), sageMat);
  coreMesh.position.copy(core);
  const coreWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42, 1)), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.45 }));
  coreWire.position.copy(core);
  spin.add(coreMesh, coreWire);

  // Soft spots on the paper beneath everything, so the height reads.
  const all = [...hubs, ...beads, ...cards, core];
  const spots = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18), shadowMat, all.length);
  q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  all.forEach((p, i) => {
    const big = i < hubs.length || i === all.length - 1;
    const r = big ? 0.14 : 0.05;
    spots.setMatrixAt(i, m.compose(new THREE.Vector3(p.x + p.y * 0.1, 0.012, p.z - p.y * 0.05), q, new THREE.Vector3(r, r, r)));
  });
  spots.renderOrder = 2;
  spin.add(spots);

  const labels: CanvasPlane[] = names.map((text, i) => {
    const l = label([{ text, font: "mono", size: 34, color: "#ffffff", tracking: 1 }], 0.25, { pxW: 560, align: "center" });
    (l.material as THREE.MeshBasicMaterial).color.set(INK);
    l.mesh.position.copy(hubs[i]).add(new THREE.Vector3(0, 0.26, 0));
    spin.add(l.mesh);
    return l;
  });

  const inv = new THREE.Quaternion();
  return {
    group,
    labels,
    materials: [inkMat, sageMat, cardMat, shadowMat, edge.material as THREE.Material, coreWire.material as THREE.Material],
    update(t: number, camera: THREE.Camera) {
      spin.rotation.y = Math.sin(t * 0.22) * 0.5 + t * 0.03;
      coreWire.rotation.y = t * 0.3;
      coreWire.rotation.x = t * 0.17;
      hubMeshes.forEach((o, i) => o.rotateY(0.002 + i * 0.0002));
      spin.getWorldQuaternion(inv).invert();
      for (const l of labels) l.mesh.quaternion.copy(inv).multiply(camera.quaternion);
    },
  };
}
