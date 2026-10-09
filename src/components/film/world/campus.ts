import * as THREE from "three";
import { M, box, cyl, plinth, rbox, smooth, type Station } from "./kit";

/** Education — a columned, domed hall in the spirit of the UIUC Main Quad, with a floating mortarboard. */
export function campus(): Station {
  const g = new THREE.Group();
  g.add(plinth(18, 13));

  const hall = new THREE.Group();
  hall.position.set(0, 0.65, -0.8);
  g.add(hall);

  // Steps
  [9.6, 9, 8.4].forEach((w, i) => {
    const s = rbox(w, 0.22, 4.6 - i * 0.35, M.clay, 0.03);
    s.position.set(0, 0.11 + i * 0.22, 0.6 - i * 0.12);
    hall.add(s);
  });
  // Body
  const body = rbox(7.8, 3.4, 3.6, M.clay, 0.05);
  body.position.set(0, 0.66 + 1.7, -0.6);
  hall.add(body);
  // Columns
  for (let i = 0; i < 6; i++) {
    const x = -3.1 + i * 1.24;
    const col = cyl(0.2, 0.23, 3.1, M.clay, 24);
    col.position.set(x, 0.66 + 1.55, 1.6);
    const cap = box(0.6, 0.14, 0.6, M.clay);
    cap.position.set(x, 0.66 + 3.17, 1.6);
    hall.add(col, cap);
  }
  // Entablature + pediment
  const ent = box(7.9, 0.45, 1.5, M.clay);
  ent.position.set(0, 0.66 + 3.46, 1.2);
  hall.add(ent);
  const shape = new THREE.Shape();
  shape.moveTo(-4, 0);
  shape.lineTo(4, 0);
  shape.lineTo(0, 1.25);
  shape.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false }), M.clay);
  ped.castShadow = ped.receiveShadow = true;
  ped.position.set(0, 0.66 + 3.68, 0.45);
  hall.add(ped);
  // Drum + dome
  const drum = cyl(1.7, 1.75, 0.9, M.clay2, 48);
  drum.position.set(0, 0.66 + 3.4 + 0.45, -0.8);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.clay);
  dome.castShadow = dome.receiveShadow = true;
  dome.position.set(0, 0.66 + 4.3, -0.8);
  const lantern = cyl(0.18, 0.22, 0.5, M.accent, 16);
  lantern.position.set(0, 0.66 + 6.2, -0.8);
  hall.add(drum, dome, lantern);

  // Lawn paths + round trees
  const path = box(1.4, 0.04, 5, M.clay2);
  path.position.set(0, 0.66, 4.2);
  path.castShadow = false;
  g.add(path);
  const treeMat = new THREE.MeshStandardMaterial({ color: "#d7dccb", roughness: 0.9 });
  [
    [-6.8, 3.6, 1],
    [-5.2, 4.8, 0.75],
    [6.6, 3.8, 0.95],
    [5.1, 5, 0.7],
    [-7.2, -3.8, 0.85],
    [7.1, -3.6, 0.9],
  ].forEach(([x, z, s]) => {
    const trunk = cyl(0.08, 0.1, 0.8 * s, M.stone, 8);
    trunk.position.set(x, 0.66 + 0.4 * s, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 2), treeMat);
    crown.castShadow = crown.receiveShadow = true;
    crown.position.set(x, 0.66 + 1.25 * s, z);
    g.add(trunk, crown);
  });

  // Mortarboard
  const cap = new THREE.Group();
  const board = rbox(2.4, 0.08, 2.4, M.ink, 0.03);
  const skull = cyl(0.8, 0.9, 0.55, M.ink, 32);
  skull.position.y = -0.3;
  const button = cyl(0.09, 0.09, 0.06, M.accent, 12);
  button.position.y = 0.07;
  const cord = box(0.04, 0.02, 1.1, M.accent);
  cord.position.set(0.55, 0.06, 0.3);
  cord.rotation.y = 0.9;
  const tassel = cyl(0.06, 0.12, 0.55, M.accent, 10);
  tassel.position.set(0.98, -0.25, 0.62);
  board.rotation.y = Math.PI / 4;
  cap.add(board, skull, button, cord, tassel);
  cap.position.set(0, 10.5, -0.8);
  g.add(cap);

  return {
    group: g,
    focus: new THREE.Vector3(0, 4.2, 0),
    update(t, _dt, local) {
      cap.position.y = 9.8 + Math.sin(t * 1.1) * 0.25 + (1 - smooth(0, 0.4, local)) * 3;
      cap.rotation.y = t * 0.35;
      cap.rotation.z = Math.sin(t * 0.8) * 0.06;
    },
  };
}
