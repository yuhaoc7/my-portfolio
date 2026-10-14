import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { C, M, label, smooth, type Station } from "./kit";
import { IM } from "./iso";
import { campus } from "./campus";
import { evalPipeline } from "./evalPipeline";
import { gpuCluster } from "./gpuCluster";
import { dashboards } from "./dashboards";
import { sdxlServing } from "./sdxlServing";
import { vgiGallery } from "./vgiGallery";
import { retrievalFunnel } from "./retrievalFunnel";

/**
 * Camera framing for one chapter. `station` frames that station's focus point;
 * otherwise the whole set is framed. `shift` slides the image sideways (as a
 * fraction of the viewport) to leave room for the text column.
 */
type Shot = { station?: number; az: number; polar: number; dist: number; shift: number };

// Chapter order matches `chapters` in data/resume.ts.
const SHOTS: Shot[] = [
  { station: 2, az: -0.78, polar: 1.3, dist: 30, shift: -0.2 }, // 00 hero — low, close on the GPU cluster
  { az: 1.12, polar: 1.08, dist: 200, shift: -0.22 }, //            01 prologue — pull back: the whole set
  { station: 0, az: -0.55, polar: 1.18, dist: 28, shift: -0.22 }, // 02 education
  { station: 1, az: 0.55, polar: 1.06, dist: 31, shift: 0.23 }, //   03 TIMAN
  { station: 2, az: -0.38, polar: 1.18, dist: 29, shift: -0.22 }, //  04 IBM
  { station: 3, az: 0.42, polar: 1.22, dist: 27, shift: 0.22 }, //   05 visibilityx
  { station: 4, az: -0.5, polar: 1.14, dist: 31, shift: -0.22 }, //  06 HiABR
  { station: 5, az: 0.1, polar: 1.3, dist: 29, shift: 0.22 }, //    07 VGI-Bench
  { station: 6, az: -0.32, polar: 1.22, dist: 30, shift: -0.22 }, // 08 PIR-Arena
  { az: -1.1, polar: 0.9, dist: 230, shift: 0 }, //                  09 toolkit
  { az: -0.05, polar: 0.5, dist: 260, shift: 0 }, //                 10 fade out
];

const STATION_POS = [0, -10, 4, -8, 4, -8, 3].map((z, i) => new THREE.Vector3(i * 50, 0, z));
const PIN_TEXT = ["UIUC", "TIMAN", "IBM–ILLINOIS", "VISIBILITYX", "HIABR", "VGI-BENCH", "PIR-ARENA"];
const FIRST_STATION_CHAPTER = 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Dark theme, after the iso-glow skill: a near-black studio, bodies drawn as
 * dark solids with light hairline edges, and whatever is live glowing in the
 * accent colour (bloom only in the dark theme).
 */
const DARK = { bg: "#121314", line: "#6b7178", shadow: "#000000" };
const labelDark = { value: 0 };
const hsl = { h: 0, s: 0, l: 0 };
function darkColor(c: THREE.Color) {
  c.getHSL(hsl);
  if (hsl.s > 0.55 && hsl.l > 0.25 && hsl.l < 0.8) return c.clone().multiplyScalar(0.85); // keep real colours
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
const ease = (t: number) => t * t * (3 - 2 * t);

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.5, 900);
  private sun: THREE.DirectionalLight;
  private stations: Station[] = [];
  private pins: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private billboards: THREE.Object3D[] = [];
  private center = new THREE.Vector3();
  private clock = new THREE.Clock();
  private raf = 0;
  private chapter = 0;
  private chapterTarget = 0;
  private locals: number[] = [];
  private mouse = new THREE.Vector2();
  private mouseTarget = new THREE.Vector2();
  private intro = 0;
  private introTarget = 0;
  private timeScale: number;
  private mobile = false;
  private w = 1;
  private h = 1;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private target = new THREE.Vector3();
  private dark = false;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private hemi!: THREE.HemisphereLight;
  private floorMat!: THREE.ShadowMaterial;
  private themed = new WeakMap<THREE.Material, { color?: THREE.Color; opacity?: number }>();
  private frameNo = 0;

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; mediaBase: string }) {
    this.timeScale = opts.reducedMotion ? 0.3 : 1;
    this.mobile = window.innerWidth < 768;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const bg = new THREE.Color(C.bg);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 140, 520);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.hemi = new THREE.HemisphereLight("#ffffff", "#d8d2c6", 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff6ea", 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    // Infinite studio floor — only the shadows show.
    this.floorMat = new THREE.ShadowMaterial({ color: "#7d7465", opacity: 0.16 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const builders = [campus, evalPipeline, gpuCluster, dashboards, sdxlServing, () => vgiGallery(opts.mediaBase), retrievalFunnel];
    builders.forEach((build, i) => {
      const s = build();
      s.group.position.copy(STATION_POS[i]);
      s.focus.add(STATION_POS[i]);
      this.scene.add(s.group);
      this.stations.push(s);
      this.locals.push(0);

      const pin = label(
        [
          { text: String(i + FIRST_STATION_CHAPTER).padStart(2, "0"), font: "serif", size: 120, color: C.ink },
          { text: PIN_TEXT[i], font: "mono", size: 40, tracking: 6, color: C.ink },
        ],
        7,
        { pxW: 560, align: "center" },
      );
      pin.mesh.position.copy(STATION_POS[i]).add(new THREE.Vector3(0, 22, 0));
      this.scene.add(pin.mesh);
      this.pins.push({ mesh: pin.mesh, mat: pin.material });
    });
    this.center.copy(STATION_POS[0]).add(STATION_POS[STATION_POS.length - 1]).multiplyScalar(0.5);

    this.scene.traverse((o) => {
      if (o.userData.billboard) this.billboards.push(o);
    });

    this.resize();
  }

  /** Switch between the light clay studio and the dark iso-glow studio. */
  setTheme(dark: boolean) {
    this.dark = dark;
    const bg = new THREE.Color(dark ? DARK.bg : C.bg);
    (this.scene.background as THREE.Color).copy(bg);
    this.scene.fog!.color.copy(bg);
    this.hemi.color.set(dark ? "#aab3c0" : "#ffffff");
    this.hemi.groundColor.set(dark ? "#121314" : "#d8d2c6");
    this.hemi.intensity = dark ? 0.45 : 0.9;
    this.sun.color.set(dark ? "#dfe6f2" : "#fff6ea");
    this.sun.intensity = dark ? 0.9 : 2.1;
    this.scene.environmentIntensity = dark ? 0.25 : 0.55;
    this.floorMat.color.set(dark ? DARK.shadow : "#7d7465");
    this.floorMat.opacity = dark ? 0.5 : 0.16;
    labelDark.value = dark ? 1 : 0;
    this.scene.traverse((o) => this.themeObject(o));
    for (const m of [...Object.values(M), ...Object.values(IM)]) this.themeMaterial(m);
    if (dark && !this.composer && !this.mobile) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.45, 0.45, 1.05);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(this.w, this.h);
    }
  }

  private themeObject(o: THREE.Object3D) {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach((m) => this.themeMaterial(m));
    else this.themeMaterial(mat);
  }

  private themeMaterial(m: THREE.Material) {
    let orig = this.themed.get(m);
    if (!orig) {
      const c = (m as THREE.MeshBasicMaterial).color as THREE.Color | undefined;
      orig = { color: c?.clone(), opacity: m.opacity };
      this.themed.set(m, orig);
      if (m instanceof THREE.MeshBasicMaterial && m.transparent && (m.map as THREE.CanvasTexture | null)?.isCanvasTexture) patchLabel(m);
    }
    const color = (m as THREE.MeshBasicMaterial).color as THREE.Color | undefined;
    if (!color || !orig.color || m instanceof THREE.ShadowMaterial) return;
    if (m instanceof THREE.MeshStandardMaterial && m.vertexColors) {
      color.copy(orig.color).multiplyScalar(this.dark ? 0.5 : 1); // e.g. the Altgeld Hall scan keeps its brick
    } else if (m instanceof THREE.MeshStandardMaterial) {
      color.copy(this.dark ? darkColor(orig.color) : orig.color);
    } else if (m instanceof THREE.LineBasicMaterial) {
      color.copy(this.dark ? new THREE.Color(DARK.line) : orig.color);
      m.opacity = this.dark ? Math.min(1, (orig.opacity ?? 1) + 0.25) : orig.opacity ?? 1;
    } else if (m instanceof THREE.MeshBasicMaterial && !m.map && m.toneMapped === false) {
      orig.color.getHSL(hsl);
      color.copy(orig.color);
      if (this.dark && hsl.s > 0.4) color.multiplyScalar(2.6); // live things glow
    }
  }

  setChapter(c: number, locals: number[]) {
    this.chapterTarget = c;
    for (let i = 0; i < this.stations.length; i++) this.locals[i] = locals[i + FIRST_STATION_CHAPTER] ?? 0;
  }

  setPointer(x: number, y: number) {
    this.mouseTarget.set(x, y);
  }

  fadeIn() {
    this.introTarget = 1;
  }

  resize = () => {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.mobile = this.w < 768;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.fov = this.w / this.h < 1 ? 48 : 30;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(this.w, this.h);
  };

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.frame();
    };
    tick();
  }

  private shotTarget(s: Shot, out: THREE.Vector3) {
    return s.station === undefined ? out.copy(this.center) : out.copy(this.stations[s.station].focus);
  }

  private frame() {
    const rawDt = Math.min(this.clock.getDelta(), 0.5);
    const dt = Math.min(rawDt, 0.05);
    const t = this.clock.elapsedTime * this.timeScale;

    this.chapter += (this.chapterTarget - this.chapter) * Math.min(rawDt * 2.6, 1);
    this.mouse.lerp(this.mouseTarget, Math.min(dt * 2.5, 1));
    this.intro += (this.introTarget - this.intro) * Math.min(dt * 0.9, 1);

    const max = SHOTS.length - 1;
    const c = Math.min(Math.max(this.chapter, 0), max);
    const i = Math.min(Math.floor(c), max - 1);
    const A = SHOTS[i];
    const B = SHOTS[i + 1];
    // Project-to-project moves hold on each set, then fly the gap quickly.
    const hop = A.station !== undefined && B.station !== undefined && i >= FIRST_STATION_CHAPTER;
    const f = hop ? ease(Math.min(1, Math.max(0, (c - i - 0.35) / 0.3))) : ease(c - i);

    // Each end of the blend: a station that flies its own camera path takes over
    // inside its chapter; otherwise the shot dollies in and orbits with progress.
    const end = (s: Shot, k: number, out: THREE.Vector3) => {
      const st = s.station === undefined ? undefined : this.stations[s.station];
      const local = k >= FIRST_STATION_CHAPTER && s.station !== undefined ? this.locals[s.station] : 0.5;
      const own = k >= FIRST_STATION_CHAPTER ? st?.shot?.(local) : undefined;
      if (st && own) {
        out.copy(own.target).add(st.group.position);
        return { az: own.az, polar: own.polar, dist: own.dist, own: true };
      }
      this.shotTarget(s, out);
      return { az: s.az + (local - 0.5) * 0.55, polar: s.polar + (0.5 - local) * 0.08, dist: s.dist * (1.12 - local * 0.3), own: false };
    };
    const ea = end(A, i, this.tmpA);
    const eb = end(B, i + 1, this.tmpB);
    const travel = this.tmpA.distanceTo(this.tmpB);
    this.target.lerpVectors(this.tmpA, this.tmpB, f);

    const arc = Math.sin(Math.PI * f);
    // Between two projects the camera skims low past the set and swings round,
    // instead of pulling back to a wide shot; overview chapters still pull out.
    let dist = lerp(ea.dist, eb.dist, f) + arc * (hop ? Math.min(14, travel * 0.16) : Math.min(70, travel * 0.55));
    let polar = lerp(ea.polar, eb.polar, f) + (hop ? arc * 0.12 : -arc * Math.min(0.25, travel * 0.004));
    let az = lerp(ea.az, eb.az, f) + (hop ? arc * 0.6 * (i % 2 ? 1 : -1) : 0);
    const own = (ea.own ? 1 - f : 0) + (eb.own ? f : 0);
    let shift = lerp(A.shift, B.shift, f);
    az += this.mouse.x * 0.05 * (1 - own * 0.6);
    polar = Math.min(1.5, Math.max(0.3, polar - this.mouse.y * 0.03 * (1 - own * 0.6)));
    dist *= lerp(1.45, 1, ease(this.intro));
    az += (1 - ease(this.intro)) * -0.35;
    if (this.mobile) {
      dist *= 1.35;
      shift = 0;
    }

    const sp = Math.sin(polar);
    this.camera.position.set(
      this.target.x + Math.sin(az) * sp * dist,
      this.target.y + Math.cos(polar) * dist,
      this.target.z + Math.cos(az) * sp * dist,
    );
    this.camera.lookAt(this.target);
    this.camera.setViewOffset(this.w, this.h, shift * this.w, this.mobile ? this.h * 0.24 : 0, this.w, this.h);

    // Sun follows the frame so shadows stay crisp in close-ups.
    const half = Math.min(140, Math.max(20, dist * 0.6));
    this.sun.position.copy(this.target).add(new THREE.Vector3(30, 60, 26).multiplyScalar(half / 30));
    this.sun.target.position.copy(this.target);
    const sc = this.sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = half * 8;
    sc.updateProjectionMatrix();

    // Overview chapters show every station "as dressed".
    const overview = Math.max(smooth(0.2, 0.9, c) * (1 - smooth(1.2, 2, c)), smooth(8.2, 9, c));
    const heroBoost = 1 - smooth(0, 1, c);
    this.pins.forEach((p) => {
      p.mat.opacity = overview;
      p.mesh.visible = overview > 0.01;
      p.mesh.position.y = 22 + Math.sin(t + p.mesh.position.x) * 0.6;
    });

    // Only the stations in the current pair of shots render, unless the whole set is in frame.
    this.stations.forEach((s, k) => {
      const near = A.station === k || B.station === k || overview > 0.01;
      s.group.visible = near;
      if (near) s.update(t, dt * this.timeScale, Math.max(this.locals[k], overview * 0.75, A.station === k ? heroBoost * 0.7 : 0));
    });

    for (const b of this.billboards) b.quaternion.copy(this.camera.quaternion);

    // Stations swap materials as they run; theme any that appeared since the last pass.
    if (this.dark && ++this.frameNo % 30 === 0) this.scene.traverseVisible((o) => this.themeObject(o));

    if (this.dark && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
