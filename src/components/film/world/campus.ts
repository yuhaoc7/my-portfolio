import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { plinth, type Station } from "./kit";

/** Education — the Altgeld Hall model supplied for this portfolio. */
export function campus(): Station {
  const group = new THREE.Group();
  group.add(plinth(18, 18));

  new STLLoader().load("/models/altgeld-hall.stl", (geometry) => {
    // The STL uses Z as up. Center it before rotating into the scene's Y-up space.
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const center = bounds.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -bounds.min.z);
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();

    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const colors = new Float32Array(positions.count * 3);
    const brick = new THREE.Color("#a94f34");
    const limestone = new THREE.Color("#d6c5aa");
    const roof = new THREE.Color("#454b55");
    const color = new THREE.Color();

    // STL has no material groups, so classify each flat face by height and slope.
    for (let i = 0; i < positions.count; i += 3) {
      const height = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      const upward = (normals.getY(i) + normals.getY(i + 1) + normals.getY(i + 2)) / 3;
      // Lower wings have pitched roofs well below the bell tower's roof height.
      const pitchedRoof = height > 3 && upward > 0.2 && upward < 0.95;
      const base = height < 1.1 ? limestone : pitchedRoof ? roof : upward >= 0.95 ? limestone : brick;
      const variation = 0.94 + (Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.1;
      color.copy(base).multiplyScalar(variation);
      for (let j = 0; j < 3; j++) {
        colors[(i + j) * 3] = color.r;
        colors[(i + j) * 3 + 1] = color.g;
        colors[(i + j) * 3 + 2] = color.b;
      }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const building = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
    building.scale.setScalar(0.5);
    building.position.y = 0.66;
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);
  });

  return {
    group,
    focus: new THREE.Vector3(0, 5, 0),
    update() {},
  };
}
