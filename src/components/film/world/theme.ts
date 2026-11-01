import * as THREE from "three";
import { M } from "./kit";
import { IM } from "./iso";

/**
 * Light clay ↔ dark iso-glow theming for the station sets: in the dark theme
 * bodies become dark solids with light hairline edges, and whatever is live
 * keeps (and brightens) its colour.
 */
const DARK_LINE = "#6b7178";
const labelDark = { value: 0 };
const hsl = { h: 0, s: 0, l: 0 };

function darkColor(c: THREE.Color) {
  c.getHSL(hsl);
  if (hsl.s > 0.55 && hsl.l > 0.25 && hsl.l < 0.8) return c.clone().multiplyScalar(0.85);
  const l = hsl.l < 0.35 ? hsl.l * 0.8 + 0.02 : 0.035 + 0.08 * (1 - hsl.l);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.55, l);
}

/** Transparent canvas labels flip their greys (ink ↔ paper) in the dark theme; colours stay. */
function patchLabel(m: THREE.MeshBasicMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLabelDark = labelDark;
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform float uLabelDark;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        if (uLabelDark > 0.5) {
          vec3 c = diffuseColor.rgb;
          float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
          if (sat < 0.16) diffuseColor.rgb = vec3(0.92) - c * 0.9;
        }`,
      );
  };
  m.customProgramCacheKey = () => "label-dark";
  m.needsUpdate = true;
}

export class Themer {
  dark = false;
  private orig = new WeakMap<THREE.Material, { color?: THREE.Color; opacity?: number } | null>();

  /** Leave a material alone (e.g. one that shows HTML). */
  skip(m: THREE.Material) {
    this.orig.set(m, null);
  }

  apply(root: THREE.Object3D, dark: boolean) {
    this.dark = dark;
    labelDark.value = dark ? 1 : 0;
    root.traverse((o) => this.object(o));
    for (const m of [...Object.values(M), ...Object.values(IM)]) this.material(m);
  }

  object(o: THREE.Object3D) {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach((m) => this.material(m));
    else this.material(mat);
  }

  material(m: THREE.Material) {
    let orig = this.orig.get(m);
    if (orig === null) return;
    if (!orig) {
      const c = (m as THREE.MeshBasicMaterial).color as THREE.Color | undefined;
      orig = { color: c?.clone(), opacity: m.opacity };
      this.orig.set(m, orig);
      if (m instanceof THREE.MeshBasicMaterial && m.transparent && (m.map as THREE.CanvasTexture | null)?.isCanvasTexture) patchLabel(m);
    }
    const color = (m as THREE.MeshBasicMaterial).color as THREE.Color | undefined;
    if (!color || !orig.color || m instanceof THREE.ShadowMaterial) return;
    if (m instanceof THREE.MeshStandardMaterial && m.vertexColors) {
      color.copy(orig.color).multiplyScalar(this.dark ? 0.5 : 1);
    } else if (m instanceof THREE.MeshStandardMaterial) {
      color.copy(this.dark ? darkColor(orig.color) : orig.color);
    } else if (m instanceof THREE.LineBasicMaterial) {
      color.copy(this.dark ? new THREE.Color(DARK_LINE) : orig.color);
      m.opacity = this.dark ? Math.min(1, (orig.opacity ?? 1) + 0.25) : orig.opacity ?? 1;
    } else if (m instanceof THREE.MeshBasicMaterial && !m.map && m.toneMapped === false) {
      orig.color.getHSL(hsl);
      color.copy(orig.color);
      if (this.dark && hsl.s > 0.4) color.multiplyScalar(2.6);
    }
  }
}
