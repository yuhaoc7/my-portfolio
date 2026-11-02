import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import fontData from "three/examples/fonts/droid/droid_serif_bold.typeface.json";
import { clamp01, label, type CanvasPlane, type Station } from "./kit";
import { Themer } from "./theme";
import { FORMULAS, sideArt, type SideArt } from "./sideArt";
import { cloud3d, flowMaterial, ribbon } from "./cloud3d";
import { campus } from "./campus";
import { evalPipeline } from "./evalPipeline";
import { gpuCluster } from "./gpuCluster";
import { dashboards } from "./dashboards";
import { sdxlServing } from "./sdxlServing";
import { vgiGallery } from "./vgiGallery";
import { retrievalFunnel } from "./retrievalFunnel";

/**
 * The page as one long sheet, laid out in CSS pixels. It lies flat under the
 * camera for most of its length, then folds up on an exponential curve until
 * it faces the viewer, so it reads as a road running up into a wall. Scrolling
 * slides the content along the fixed curve. Titles, models and wires stand on
 * the sheet; line art sits on the dark ground either side.
 *
 *   s — distance along the sheet in world units (0 = near end of the fold)
 *   yc — content y in CSS px (0 = top of the page)
 */
export const PX = 100; // CSS px per world unit

const THEME = {
  light: { bg: "#cfc5ae", grid: "#5c4d36", ink: "#2a2219", art: "#3b3024" },
  dark: { bg: "#12110e", grid: "#c9b78f", ink: "#e9dfc9", art: "#d9cba9" },
};
export const PAPER = "#f3ecdc";
const INK = "#1f1a14";
const STONE = "#b5a88f";

type Tile = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  tex: THREE.CanvasTexture | null;
  y: number;
  h: number;
  segs: number;
};

/** Fold shape, as fractions of the visible sheet height. */
const FOLD = { length: 5, sharpness: 6.54, height: 1.015, back: -1, pitch: -30.2, fov: 45, segs: 128, topAt: 0.33 };

/** Where things sit on the sheet, in content px; measured from the DOM. */
export type TitleLine = { text: string; x: number; y: number; w: number; h: number; size: number };
export type SheetAnchors = {
  titles: TitleLine[];
  stages: { tile: number; x: number; y: number }[];
  pins: { tile: number; x: number; y: number }[];
  slabs: { tile: number; x0: number; y0: number; x1: number; y1: number; name: string }[];
  names: { tile: number; name: string }[];
  graph: { y: number; x: number } | null;
};
const NO_ANCHORS: SheetAnchors = { titles: [], stages: [], pins: [], slabs: [], names: [], graph: null };

const hash = (n: number) => {
  const v = Math.sin(n * 127.1) * 43758.5453;
  return v - Math.floor(v);
};

const GROUND_VERT = /* glsl */ `
  attribute float aRow;
  varying vec2 vP;
  void main() {
    vP = vec2(position.x * 100.0, aRow);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
/** Contour lines over a long, low hill country, a faint survey grid, and light running up it. */
const GROUND_FRAG = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uLine;
  uniform float uTime;
  varying vec2 vP;
  float grid(vec2 p, float every, float w) {
    vec2 q = abs(mod(p + every * 0.5, every) - every * 0.5);
    vec2 f = fwidth(p) * w;
    vec2 l = 1.0 - smoothstep(vec2(0.0), f, q);
    return max(l.x, l.y);
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float hills(vec2 p) {
    return noise(p) * 0.6 + noise(p * 2.03 + 4.1) * 0.28 + noise(p * 4.1 + 9.3) * 0.12;
  }
  void main() {
    float dist = max(fwidth(vP.x), fwidth(vP.y));
    float a = grid(vP, 500.0, 1.0) * 0.06 * smoothstep(40.0, 8.0, dist);
    float h = hills(vP / vec2(1500.0, 1900.0)) * 18.0 + uTime * 0.09;
    float q = abs(fract(h) - 0.5);
    float index = 1.0 - smoothstep(0.0, 0.5, abs(mod(floor(h), 4.0) - 1.0));
    float contour = 1.0 - smoothstep(0.0, fwidth(h) * 1.15, q);
    a = max(a, contour * mix(0.2, 0.42, index) * smoothstep(120.0, 20.0, dist));
    float col = floor(vP.x / 900.0);
    float xd = abs(mod(vP.x, 900.0) - 450.0);
    float lane = 1.0 - smoothstep(0.0, fwidth(vP.x) * 1.3, xd);
    float head = mod(vP.y + uTime * (220.0 + 70.0 * mod(col * 3.0, 4.0)) + col * 613.0, 3200.0);
    float pulse = lane * smoothstep(800.0, 0.0, head);
    vec3 c = mix(uBg, uLine, a) + uLine * pulse * 0.45;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Paper fibre, tiled along the sheet so it moves with the content. */
function paperGrain() {
  const n = 512;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d")!;
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) {
    const a = hash(i) * Math.PI;
    const l = 4 + hash(i + 0.5) * 34;
    const px = hash(i + 0.25) * n;
    const py = hash(i + 0.75) * n;
    x.strokeStyle = `rgba(96,76,44,${0.02 + hash(i + 0.1) * 0.05})`;
    x.lineWidth = 0.6;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Something on the sheet that can be picked up: its home in content px, and how far it has been dragged. */
type Draggable = { group: THREE.Group; x: number; yc: number; ox: number; oy: number; tx: number; ty: number };

export type SheetPick = { tile: number; x: number; y: number };

const BUILDERS = [campus, evalPipeline, gpuCluster, dashboards, sdxlServing, () => vgiGallery("/media/vgi"), retrievalFunnel];

export class SheetWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  private themer = new Themer();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private groundMat: THREE.ShaderMaterial;
  private paper: THREE.Mesh;
  private paperMat: THREE.MeshBasicMaterial;
  private catcher: THREE.Mesh;
  private edges: THREE.LineSegments;
  private ticks: THREE.LineSegments;
  private tickMat: THREE.LineBasicMaterial;
  private labels = new Map<number, CanvasPlane>();
  private wires: THREE.Mesh;
  private wireMat: THREE.ShaderMaterial;
  private cloudMat = flowMaterial("#8d8a78", "#4a6a5e", 1, 0.5);
  private cloud: ReturnType<typeof cloud3d> | null = null;
  private cloudDrag: Draggable | null = null;
  private drag: { item: Draggable; plane: THREE.Plane; from: THREE.Vector3; tan: THREE.Vector3; tx: number; ty: number } | null = null;
  private bounds = new Map<THREE.Group, { box: THREE.Box3; at: number }>();
  private artMat: THREE.LineBasicMaterial;
  private arts: { art: SideArt; yc: number; side: number; off: number }[] = [];
  private formulas: { l: CanvasPlane; yc: number; side: number }[] = [];
  private tags: { l: CanvasPlane; yc: number; x: number; tile: number; callout: boolean }[] = [];
  private anchors: SheetAnchors = NO_ANCHORS;
  private spokes = new Map<number, { x: number; y: number }[]>();
  private font = new Font(fontData as unknown as ConstructorParameters<typeof Font>[0]);
  private titleKey = "";
  private titles: { group: THREE.Group; shadow: THREE.Group; yc: number }[] = [];
  private titleFront = new THREE.MeshBasicMaterial({ color: INK, toneMapped: false });
  private titleSide = new THREE.MeshBasicMaterial({ color: STONE, toneMapped: false });
  private titleShadow = new THREE.MeshBasicMaterial({ color: "#6b5433", transparent: true, opacity: 0.075, depthWrite: false, toneMapped: false });
  private groundLabels: THREE.MeshBasicMaterial[] = [];
  private inkColor = THEME.dark.ink;
  private q = new THREE.Quaternion();
  private m = new THREE.Matrix4();
  private tan = new THREE.Vector3();
  private xAxis = new THREE.Vector3(1, 0, 0);
  private yawQ = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private fold = { T: 1, H: 1, ds: 1, pts: new Float32Array(0), ang: new Float32Array(0), camY: 1, camZ: 1 };
  private tiles: Tile[] = [];
  private stations: (Draggable & { st: Station; side: number })[] = [];
  private css: { renderer: CSS3DRenderer; scene: THREE.Scene; obj: CSS3DObject } | null = null;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private raf = 0;
  private w = 1;
  private h = 1;
  private mouse = new THREE.Vector2();
  private mouseT = new THREE.Vector2();
  private v = new THREE.Vector3();
  private n = new THREE.Vector3();

  /** Whether the sheet bends up into a wall (only when the HTML is drawn into WebGL). */
  readonly bend: boolean;
  private sRead = 2.2;
  private sStoryStart = 1;
  private sStoryEnd = 0;
  private W = 10.8;
  private contentH = 1;
  scroll = 0;
  /** Called after every frame (to sync overlays to the sheet). */
  onFrame?: () => void;

  constructor(canvas: HTMLCanvasElement, opts: { bend: boolean; reducedMotion: boolean }) {
    this.bend = opts.bend;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene.background = new THREE.Color(THEME.light.bg);
    this.scene.fog = null;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.hemi = new THREE.HemisphereLight("#fff8ec", "#d8cbb0", 1.05);
    this.sun = new THREE.DirectionalLight("#fff6ea", 2);
    this.sun.position.set(20, 40, 18);
    this.scene.add(this.hemi, this.sun);

    // The ground follows the same fold as the sheet, but runs far past its edges.
    this.groundMat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: { uBg: { value: new THREE.Color(THEME.light.bg) }, uLine: { value: new THREE.Color(THEME.light.grid) }, uTime: { value: 0 } },
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const groundGeo = new THREE.PlaneGeometry(1, 1, 1, 180);
    groundGeo.setAttribute("aRow", new THREE.Float32BufferAttribute(new Float32Array(groundGeo.getAttribute("position").count), 1));
    this.ground = new THREE.Mesh(groundGeo, this.groundMat);
    this.ground.frustumCulled = false;
    this.themer.skip(this.groundMat);
    this.scene.add(this.ground);

    this.paperMat = new THREE.MeshBasicMaterial({ color: PAPER, map: paperGrain(), toneMapped: false, side: THREE.DoubleSide });
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.paperMat);
    this.paper.frustumCulled = false;
    this.themer.skip(this.paperMat);
    this.scene.add(this.paper);

    // Real shadows: the paper and its content are unlit, so a clear layer over them catches the sun.
    const catchMat = new THREE.ShadowMaterial({ color: "#3d2c16", opacity: 0.34, depthWrite: false });
    this.themer.skip(catchMat);
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), catchMat);
    this.catcher.frustumCulled = false;
    this.catcher.receiveShadow = true;
    this.catcher.renderOrder = 1;
    this.catcher.visible = this.bend;
    this.scene.add(this.catcher);
    if (this.bend) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.radius = 5;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.02;
      const c = this.sun.shadow.camera;
      c.left = c.bottom = -17;
      c.right = c.top = 17;
      c.near = 1;
      c.far = 80;
      this.scene.add(this.sun.target);
    }

    const edgeMat = new THREE.LineBasicMaterial({ color: "#b5a27c", transparent: true, opacity: 0.9, toneMapped: false });
    this.themer.skip(edgeMat);
    this.edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMat);
    this.edges.frustumCulled = false;
    this.tickMat = new THREE.LineBasicMaterial({ color: THEME.light.ink, transparent: true, opacity: 0.45 });
    this.themer.skip(this.tickMat);
    this.ticks = new THREE.LineSegments(new THREE.BufferGeometry(), this.tickMat);
    this.ticks.frustumCulled = false;
    this.scene.add(this.edges, this.ticks);

    this.wireMat = flowMaterial("#8d8a78", "#4a6a5e", 1, 0.45);
    this.themer.skip(this.cloudMat);
    this.themer.skip(this.wireMat);
    this.wires = new THREE.Mesh(new THREE.BufferGeometry(), this.wireMat);
    this.wires.frustumCulled = false;
    this.wires.renderOrder = 3;
    this.scene.add(this.wires);
    this.artMat = new THREE.LineBasicMaterial({ color: THEME.light.art, transparent: true, opacity: 0.8, fog: false });
    this.themer.skip(this.artMat);
    for (const m of [this.titleFront, this.titleSide, this.titleShadow]) this.themer.skip(m);

    BUILDERS.forEach((b, i) => {
      const st = b();
      st.group.scale.setScalar(this.bend ? 0.235 : 0.4);
      this.castShadows(st.group);
      // On the sheet the slab is the base, so the station's own plinth goes.
      if (this.bend) st.group.traverse((o) => o.userData.plinth && (o.visible = false));
      st.group.rotation.y = i % 2 ? -0.55 : 0.55;
      this.scene.add(st.group);
      this.stations.push({ st, group: st.group, yc: 0, side: i % 2 ? 1 : -1, x: 0, ox: 0, oy: 0, tx: 0, ty: 0 });
    });

    this.timeScale = opts.reducedMotion ? 0.1 : 0.32;
    this.resize();
  }
  private timeScale = 0.32;

  /** Solid parts cast; see-through label planes would throw rectangles. */
  private castShadows(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      m.castShadow = !mat.transparent;
    });
  }

  /* ------------------------------------------------------------------ path */

  /** Build the fold for the current sheet width and viewport, and place the camera on it. */
  private buildFold() {
    const n = FOLD.segs;
    const H = (this.W * this.h) / this.w;
    const T = FOLD.length * H;
    const ds = T / n;
    const pts = new Float32Array((n + 1) * 2);
    const seg = new Float32Array(n);
    const refY = FOLD.height * H;
    const refZ = FOLD.back * H;
    for (let i = 0, y = 0, z = 0; i < n; i++) {
      const face = Math.PI / 2 + Math.atan2(y - refY, refZ - z);
      const g = (Math.expm1((FOLD.sharpness * (i + 0.5)) / n) / Math.expm1(FOLD.sharpness)) * face;
      y += Math.sin(g) * ds;
      z -= Math.cos(g) * ds;
      pts[i * 2 + 2] = y;
      pts[i * 2 + 3] = z;
      seg[i] = g;
    }
    const ang = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) ang[i] = (seg[Math.max(0, i - 1)] + seg[Math.min(n - 1, i)]) / 2;
    // The camera stands at the point the fold turns to face.
    this.fold = { T, H, ds, pts, ang, camY: refY, camZ: refZ };
    const pitch = THREE.MathUtils.degToRad(FOLD.pitch);
    this.camera.fov = FOLD.fov;
    this.camera.position.set(0, this.fold.camY, this.fold.camZ);
    this.camera.rotation.set(pitch, 0, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // The top of the page rests a third of the way down the screen.
    const sAt = (ndcY: number) => {
      let lo = 0;
      let hi = T + H;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        this.path(mid, this.v).project(this.camera);
        if (this.v.y < ndcY) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    this.sRead = sAt(1 - 2 * FOLD.topAt);
    // A model's story plays while it travels from the top of the screen to just past the middle.
    this.sStoryStart = sAt(0.92);
    this.sStoryEnd = sAt(-0.1);
    // Low sun from the front left, aimed at the part of the sheet on screen; shadows fall back and right.
    this.path(this.sRead - H * 0.25, this.v);
    this.sun.target.position.copy(this.v);
    this.sun.position.copy(this.v).add(new THREE.Vector3(-11, 22, 11));
    this.sun.target.updateMatrixWorld();
  }

  /** Point on the sheet's centre line at distance s, and its normal. */
  private path(s: number, out: THREE.Vector3, n?: THREE.Vector3) {
    const { T, ds, pts, ang } = this.fold;
    if (!this.bend || s <= 0 || !pts.length) {
      out.set(0, 0, -s);
      n?.set(0, 1, 0);
      return out;
    }
    const f = Math.min(s, T) / ds;
    const i = Math.min(Math.floor(f), FOLD.segs - 1);
    const u = f - i;
    const a = ang[i] + (ang[i + 1] - ang[i]) * u;
    const over = Math.max(0, s - T);
    out.set(0, pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * u + Math.sin(a) * over, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * u - Math.cos(a) * over);
    n?.set(0, Math.cos(a), Math.sin(a));
    return out;
  }

  /** The small turn every model makes toward the pointer, in its own space. */
  private lean() {
    this.euler.set(-this.mouse.y * 0.07, this.mouse.x * 0.16, 0);
    return this.yawQ.setFromEuler(this.euler);
  }

  /** Orient `obj` on the sheet at s: X across, `up` off the surface. */
  private seat(q: THREE.Quaternion, s: number, normalIsY: boolean) {
    this.path(s, this.v, this.n);
    this.tan.set(0, this.n.z, -this.n.y); // toward the far end of the sheet
    if (normalIsY) this.m.makeBasis(this.xAxis, this.n, this.tan.clone().negate());
    else this.m.makeBasis(this.xAxis, this.tan, this.n);
    return q.setFromRotationMatrix(this.m);
  }

  private sOf(yc: number) {
    return this.sRead + (this.scroll - yc) / PX;
  }

  /** The s range worth drawing: from under the camera to the top of the wall. */
  private get sNear() {
    return this.bend ? this.fold.H * 1.2 : -this.camera.position.z - 3;
  }
  private get sFar() {
    return this.bend ? this.fold.T + this.fold.H * 2.5 : 140;
  }

  /** Bend a PlaneGeometry(1, 1, 1, segs) strip covering content [y0, y0 + h] across [x0, x1]. */
  private bendStrip(geo: THREE.BufferGeometry, y0: number, h: number, segs: number, x0: number, x1: number, lift: number) {
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let j = 0; j <= segs; j++) {
      this.path(this.sOf(y0 + (h * j) / segs), this.v, this.n);
      this.v.addScaledVector(this.n, lift);
      pos.setXYZ(j * 2, x0, this.v.y, this.v.z);
      pos.setXYZ(j * 2 + 1, x1, this.v.y, this.v.z);
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  /* ---------------------------------------------------------------- layout */

  /** Content width in px, and each tile's top and height in px (top to bottom). */
  setLayout(width: number, tiles: { y: number; h: number }[], anchors: SheetAnchors = NO_ANCHORS) {
    this.W = width / PX;
    this.anchors = anchors;
    if (this.bend) this.buildFold();
    this.contentH = tiles.length ? tiles[tiles.length - 1].y + tiles[tiles.length - 1].h : 1;
    const paperSegs = Math.ceil((this.contentH + 1200) / 40);
    this.paper.geometry.dispose();
    this.paper.geometry = new THREE.PlaneGeometry(1, 1, 1, paperSegs);
    this.catcher.geometry.dispose();
    this.catcher.geometry = new THREE.PlaneGeometry(1, 1, 1, paperSegs);
    this.paperMat.map!.repeat.set(width / 512, (this.contentH + 3400) / 512);
    tiles.forEach((t, i) => {
      let tile = this.tiles[i];
      const segs = Math.max(2, Math.ceil(t.h / 30));
      if (!tile) {
        const mat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, side: THREE.DoubleSide, visible: false });
        this.themer.skip(mat);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, segs), mat);
        mesh.frustumCulled = false;
        mesh.userData.tile = i;
        this.scene.add(mesh);
        tile = this.tiles[i] = { mesh, mat, tex: null, y: 0, h: 0, segs };
      } else if (tile.segs !== segs) {
        tile.mesh.geometry.dispose();
        tile.mesh.geometry = new THREE.PlaneGeometry(1, 1, 1, segs);
        tile.segs = segs;
      }
      tile.y = t.y;
      tile.h = t.h;
    });
    this.stations.forEach((s, i) => {
      const t = tiles[i + 2]; // the seven stations sit in sections 2–8
      const stage = anchors.stages.find((a) => a.tile === i + 2);
      if (t) s.yc = stage ? stage.y : t.y + t.h * 0.4;
      s.x = stage ? stage.x : 0;
      if (this.bend) s.st.group.scale.setScalar(0.235 * Math.min(1, (this.W / 10.8) * 1.2));
    });
    this.anchors.stages.forEach((a) => {
      if (this.spokes.has(a.tile)) return;
      const list: { x: number; y: number }[] = [];
      for (let k = 0; k < (this.W < 6 ? 6 : 16); k++) {
        const th = hash(a.tile * 31 + k) * Math.PI * 2;
        const r = 170 + hash(a.tile * 17 + k * 3) * 300;
        list.push({ x: Math.cos(th) * r * 1.2, y: Math.sin(th) * r * 0.62 });
      }
      this.spokes.set(a.tile, list);
    });
    if (this.bend) {
      this.buildTitles();
      this.buildCloud();
      this.buildSideArt();
      this.buildTags(tiles);
    }
  }

  /** Extruded section titles, stood on the sheet where the DOM text is laid out. */
  private buildTitles() {
    const key = JSON.stringify(this.anchors.titles);
    if (key === this.titleKey) return;
    this.titleKey = key;
    this.titles.forEach((t) => {
      for (const g of [t.group, t.shadow]) {
        this.scene.remove(g);
        g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
    });
    this.titles = this.anchors.titles.map((t) => {
      const px = t.size / PX;
      const shapes = this.font.generateShapes(t.text, px);
      const depth = Math.min(0.24, px * 0.13);
      const solid = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 6 });
      solid.computeBoundingBox();
      const b = solid.boundingBox!;
      const sx = t.w / PX / Math.max(0.01, b.max.x - b.min.x);
      const group = new THREE.Group();
      const body = new THREE.Mesh(solid, [this.titleFront, this.titleSide]);
      body.scale.x = sx;
      body.position.set(-b.min.x * sx, 0, -depth);
      group.add(body);
      // The letters stand; their shadows fall away across the paper behind them.
      const shadow = new THREE.Group();
      for (let k = 1; k <= 3; k++) {
        const flat = new THREE.ShapeGeometry(shapes, 6);
        const lean = 0.3 + k * 0.14;
        flat.applyMatrix4(new THREE.Matrix4().set(sx, lean, 0, -b.min.x * sx, 0, 0.42 + k * 0.1, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 1));
        const sh = new THREE.Mesh(flat, this.titleShadow);
        sh.renderOrder = 2;
        shadow.add(sh);
      }
      group.userData.x = shadow.userData.x = t.x / PX - this.W / 2;
      this.scene.add(group, shadow);
      return { group, shadow, yc: t.y };
    });
  }

  /** The opening map, hanging in the air above its place on the sheet. */
  private buildCloud() {
    const g = this.anchors.graph;
    if (!g) return;
    if (this.cloudDrag) {
      this.cloudDrag.x = g.x;
      this.cloudDrag.yc = g.y;
    }
    if (this.cloud) return;
    this.cloud = cloud3d(this.anchors.names.slice(1, 10).map((n) => n.name), this.cloudMat);
    this.cloud.materials.forEach((m) => this.themer.skip(m));
    this.cloud.labels.forEach((l) => this.themer.skip(l.material));
    this.cloud.group.scale.setScalar(Math.min(1, this.W / 9));
    this.castShadows(this.cloud.group);
    this.scene.add(this.cloud.group);
    this.cloudDrag = { group: this.cloud.group, x: g.x, yc: g.y, ox: 0, oy: 0, tx: 0, ty: 0 };
  }

  /** Hairline machines and solids down both sides, and a formula every so often. */
  private buildSideArt() {
    const step = 620;
    const count = Math.ceil(this.contentH / step);
    for (let i = this.arts.length; i < count; i++) {
      const art = sideArt(i, this.artMat);
      art.labels.forEach((l) => this.inked(l));
      this.scene.add(art.group);
      this.arts.push({ art, yc: 0, side: i % 2 ? 1 : -1, off: 3 + hash(i) * 2.4 });
      art.group.scale.setScalar(0.72);
      if (i % 2 === 0) {
        const l = label([{ text: FORMULAS[(i / 2) % FORMULAS.length], font: "mono", size: 30, color: "#ffffff", tracking: 1 }], 0.34, { pxW: 620, align: "center" });
        this.inked(l);
        this.scene.add(l.mesh);
        this.formulas.push({ l, yc: 0, side: 1 });
      }
    }
    this.arts.forEach((a, i) => (a.yc = 340 + i * step));
    this.formulas.forEach((f, i) => (f.yc = 640 + i * step * 2));
  }

  /** The section's name on both edges, and a callout title for each raised slab. */
  private buildTags(tiles: { y: number; h: number }[]) {
    if (!this.tags.length) {
      for (const n of this.anchors.names) {
        for (const sx of [-1, 1]) {
          const l = label([{ text: n.name, font: "mono", size: 36, color: "#ffffff", tracking: 2 }], 0.38, { pxW: 620, align: "center" });
          this.inked(l);
          this.scene.add(l.mesh);
          this.tags.push({ l, yc: 0, x: sx * (this.W / 2 + 1.9), tile: n.tile, callout: false });
        }
      }
      for (const s of this.anchors.slabs) {
        const l = label([{ text: s.name, font: "sans", size: 52, color: "#ffffff" }], 0.56, { pxW: 900, align: "left" });
        this.inked(l);
        this.scene.add(l.mesh);
        this.tags.push({ l, yc: 0, x: 0, tile: s.tile, callout: true });
      }
    }
    for (const t of this.tags) {
      if (t.callout) {
        const s = this.anchors.slabs.find((a) => a.tile === t.tile);
        if (!s) continue;
        t.yc = s.y0 - 70;
        t.x = this.W / 2 + 0.25 + 3.2;
      } else t.yc = (tiles[t.tile]?.y ?? 0) + 60;
    }
  }

  /** A label on the ground: drawn white, tinted with the theme's ink. */
  private inked(l: CanvasPlane) {
    this.themer.skip(l.material);
    (l.material as THREE.MeshBasicMaterial).color.set(this.inkColor);
    this.groundLabels.push(l.material as THREE.MeshBasicMaterial);
  }

  /** Content anchors for the left-hand index's lines. */
  pinsOf(tile: number) {
    return this.anchors.pins.filter((p) => p.tile === tile);
  }

  get height() {
    return this.contentH;
  }

  /** HTML-in-Canvas path: tile i's pixels live in `canvas`; call again after it repaints. */
  updateTile(i: number, canvas: HTMLCanvasElement) {
    const t = this.tiles[i];
    if (!t) return;
    const img = t.tex?.image as HTMLCanvasElement | undefined;
    if (!t.tex || img !== canvas || t.tex.userData.w !== canvas.width || t.tex.userData.h !== canvas.height) {
      t.tex?.dispose();
      t.tex = new THREE.CanvasTexture(canvas);
      t.tex.userData = { w: canvas.width, h: canvas.height };
      t.tex.colorSpace = THREE.SRGBColorSpace;
      t.tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      t.mat.map = t.tex;
      t.mat.visible = true;
      t.mat.needsUpdate = true;
    } else t.tex.needsUpdate = true;
  }

  /** Fallback path: the real DOM column, laid on the (flat) sheet by a CSS 3D renderer. */
  useCss(layer: HTMLElement, column: HTMLElement) {
    const renderer = new CSS3DRenderer({ element: layer });
    renderer.setSize(this.w, this.h);
    const scene = new THREE.Scene();
    const obj = new CSS3DObject(column);
    obj.rotation.x = -Math.PI / 2;
    obj.scale.setScalar(1 / PX);
    scene.add(obj);
    this.css = { renderer, scene, obj };
  }

  /* --------------------------------------------------------------- queries */

  /** What content is under a screen point (NDC): tile index and CSS px within it. */
  pick(x: number, y: number): SheetPick | null {
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.raycaster.intersectObjects(
      this.tiles.filter((t) => t.mesh.visible && t.mat.visible).map((t) => t.mesh),
      false,
    )[0];
    if (!hit || !hit.uv) return null;
    const i = hit.object.userData.tile as number;
    return { tile: i, x: hit.uv.x * this.W * PX, y: (1 - hit.uv.y) * this.tiles[i].h };
  }

  /** Screen position (CSS px) of a content point; `side` −1 / 1 is the left / right edge. */
  project(yc: number, side: number) {
    return this.projectAt(((side * this.W) / 2 + this.W / 2) * PX, yc);
  }

  /** Screen position (CSS px) of the content point (xc, yc). */
  projectAt(xc: number, yc: number) {
    this.path(this.sOf(yc), this.v);
    this.v.x = xc / PX - this.W / 2;
    this.v.project(this.camera);
    const x = (this.v.x * 0.5 + 0.5) * this.w;
    const y = (-this.v.y * 0.5 + 0.5) * this.h;
    return { x, y, visible: this.v.z < 1 && y > 60 && y < this.h && x > 0 && x < this.w };
  }

  /** Content y (px) that sits at a given height on screen (0 top … 1 bottom); used for "where am I". */
  get readingY() {
    return this.scroll;
  }

  /* -------------------------------------------------------------- dragging */

  private settle(d: Draggable) {
    d.ox += (d.tx - d.ox) * 0.16;
    d.oy += (d.ty - d.oy) * 0.16;
  }

  private ray(x: number, y: number) {
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    return this.raycaster.ray;
  }

  /** The nearest model under a screen point (NDC). Tests boxes, since some models are far too dense to raycast per move. */
  private modelAt(x: number, y: number) {
    if (!this.bend) return null;
    const ray = this.ray(x, y);
    const local = new THREE.Ray();
    const inv = new THREE.Matrix4();
    const hit = new THREE.Vector3();
    const now = performance.now();
    let best: Draggable | null = null;
    let bestD = Infinity;
    for (const d of [...this.stations, ...(this.cloudDrag ? [this.cloudDrag] : [])]) {
      if (!d.group.visible) continue;
      let b = this.bounds.get(d.group);
      if (!b || now - b.at > 1500) {
        const box = new THREE.Box3();
        for (const c of d.group.children) if (!c.userData.plinth && !(c as THREE.Mesh).userData.billboard) box.expandByObject(c);
        // expandByObject works in world space; bring it back to the group's own.
        inv.copy(d.group.matrixWorld).invert();
        b = { box: box.applyMatrix4(inv), at: now };
        this.bounds.set(d.group, b);
      }
      inv.copy(d.group.matrixWorld).invert();
      local.copy(ray).applyMatrix4(inv);
      if (b.box.isEmpty() || !local.intersectBox(b.box, hit)) continue;
      const dist = hit.applyMatrix4(d.group.matrixWorld).distanceTo(ray.origin);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  overModel(x: number, y: number) {
    return !!this.modelAt(x, y);
  }

  dragStart(x: number, y: number) {
    const item = this.modelAt(x, y);
    if (!item) return false;
    this.path(this.sOf(item.yc + item.oy), this.v, this.n);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.n.clone(), item.group.position);
    const from = new THREE.Vector3();
    if (!this.ray(x, y).intersectPlane(plane, from)) return false;
    this.drag = { item, plane, from, tan: new THREE.Vector3(0, this.n.z, -this.n.y), tx: item.tx, ty: item.ty };
    return true;
  }

  dragMove(x: number, y: number) {
    const g = this.drag;
    if (!g) return;
    const to = this.ray(x, y).intersectPlane(g.plane, this.v);
    if (!to) return;
    to.sub(g.from);
    const widthPx = this.W * PX;
    const margin = 50;
    g.item.tx = THREE.MathUtils.clamp(g.tx + to.x * PX, margin - g.item.x, widthPx - margin - g.item.x);
    // Further along the sheet means earlier in the content.
    g.item.ty = THREE.MathUtils.clamp(g.ty - to.dot(g.tan) * PX, -420, 420);
  }

  dragEnd() {
    this.drag = null;
  }

  /* ------------------------------------------------------------- settings */

  setTheme(dark: boolean) {
    const t = dark ? THEME.dark : THEME.light;
    (this.scene.background as THREE.Color).set(t.bg);
    this.groundMat.uniforms.uBg.value.set(t.bg);
    this.groundMat.uniforms.uLine.value.set(t.grid);
    this.artMat.color.set(t.art);
    this.inkColor = t.ink;
    this.groundLabels.forEach((m) => m.color.set(t.ink));
    this.tickMat.color.set(t.ink);
    // The models always stand in daylight on the paper, whatever the ground is doing.
    this.themer.apply(this.scene, false);
  }

  setPointer(x: number, y: number) {
    this.mouseT.set(x, y);
  }

  resize = () => {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    if (this.bend) this.buildFold();
    this.css?.renderer.setSize(this.w, this.h);
    this.wireMat.uniforms.uRes.value.set(this.w, this.h);
    this.cloudMat.uniforms.uRes.value.set(this.w, this.h);
  };

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.frame();
    };
    tick();
  }

  /* ----------------------------------------------------------------- frame */

  /** Camera rig, in units of a 10.8-wide sheet; scaled to the real sheet width and viewport. */
  cam = { y: 9, z: 9.5, lookY: 3.2, lookZ: -5, fov: 44, read: 6 };

  private placeCamera() {
    if (this.bend) {
      const k = this.fold.H / 5;
      this.camera.position.set(this.mouse.x * 0.28 * k, this.fold.camY + this.mouse.y * 0.14 * k, this.fold.camZ);
      this.camera.rotation.set(THREE.MathUtils.degToRad(FOLD.pitch), -this.mouse.x * 0.012, 0);
      return;
    }
    const aspect = this.w / this.h;
    const c = this.cam;
    // Narrow viewports need to stand further back to keep the sheet's width in frame.
    const k = (this.W / 10.8) * Math.max(1, 1.45 / aspect) ** 0.85;
    if (this.camera.fov !== c.fov) {
      this.camera.fov = c.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(this.mouse.x * 0.5 * k, c.y * k + this.mouse.y * 0.25 * k, c.z * k);
    this.camera.lookAt(0, c.lookY * k, c.lookZ * k);
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime * this.timeScale;
    this.mouse.lerp(this.mouseT, Math.min(dt * 2.5, 1));
    this.placeCamera();

    const W = this.W;
    const sNear = this.sNear;
    const sFar = this.sFar;
    if (!this.bend) this.sRead = this.cam.read;
    this.groundMat.uniforms.uTime.value = t;
    this.wireMat.uniforms.uTime.value = this.clock.elapsedTime;
    this.cloudMat.uniforms.uTime.value = this.clock.elapsedTime;
    this.drawGround();

    // Paper: a margin above and below the content.
    const top = -2600;
    const span = this.contentH + 3400;
    const paperSegs = (this.paper.geometry.getAttribute("position").count - 2) / 2;
    this.bendStrip(this.paper.geometry, top, span, paperSegs, -W / 2, W / 2, 0);
    if (this.bend) this.bendStrip(this.catcher.geometry, top, span, paperSegs, -W / 2, W / 2, 0.025);

    for (const tile of this.tiles) {
      const s0 = this.sOf(tile.y);
      const s1 = this.sOf(tile.y + tile.h);
      tile.mesh.visible = s0 > sNear && s1 < sFar;
      if (tile.mesh.visible) this.bendStrip(tile.mesh.geometry, tile.y, tile.h, tile.segs, -W / 2, W / 2, 0.015);
    }

    this.drawRuler(W, sNear, sFar);
    this.drawWires(W, sNear, sFar);
    this.placeDressing(W, sNear, sFar, t);

    this.stations.forEach((d) => {
      const { st, yc, side } = d;
      this.settle(d);
      const home = this.sOf(yc);
      const s = this.sOf(yc + d.oy);
      st.group.visible = s > sNear - 4 && s < sFar;
      if (!st.group.visible) return;
      this.path(s, this.v);
      if (this.bend) {
        this.seat(st.group.quaternion, s, true);
        st.group.quaternion.multiply(this.lean());
        st.group.position.set((d.x + d.ox) / PX - W / 2, this.v.y, this.v.z).addScaledVector(this.n, 0.02);
      } else st.group.position.set(side * (W / 2 + 7.8), this.v.y, this.v.z);
      // Stations play their story over local 0.18–0.72, so that span is what maps onto the screen.
      const local = this.bend ? 0.18 + 0.54 * ((this.sStoryStart - home) / (this.sStoryStart - this.sStoryEnd)) : 0.5 + (this.sRead - home) / 7;
      st.update(t, dt * this.timeScale, clamp01(local));
    });

    if (this.css) {
      const { obj } = this.css;
      this.path(this.sOf(this.contentH / 2), this.v);
      obj.position.set(0, 0.02, this.v.z);
    }

    this.renderer.render(this.scene, this.camera);
    if (this.css) this.css.renderer.render(this.css.scene, this.camera);
    this.onFrame?.();
  }

  /** The ground: the same fold, far wider than the sheet, a hair beneath it. */
  private drawGround() {
    const geo = this.ground.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const row = geo.getAttribute("aRow") as THREE.BufferAttribute;
    const segs = 180;
    const sA = this.sNear;
    const sB = this.sFar + 10;
    for (let j = 0; j <= segs; j++) {
      const s = sA + ((sB - sA) * j) / segs;
      this.path(s, this.v, this.n);
      this.v.addScaledVector(this.n, -0.04);
      pos.setXYZ(j * 2, -160, this.v.y, this.v.z);
      pos.setXYZ(j * 2 + 1, 160, this.v.y, this.v.z);
      const yc = this.scroll + (this.sRead - s) * PX;
      row.setX(j * 2, yc);
      row.setX(j * 2 + 1, yc);
    }
    pos.needsUpdate = true;
    row.needsUpdate = true;
  }

  /** Thin wires: cables arching from each model to its cards, loose spokes around it, callout leaders. */
  private drawWires(W: number, sNear: number, sFar: number) {
    const out: number[] = [];
    const flow: number[] = [];
    const inRange = (yc: number) => {
      const s = this.sOf(yc);
      return s > sNear && s < sFar;
    };
    const at = (xc: number, yc: number, lift: number, along: number) => {
      this.path(this.sOf(yc), this.v, this.n);
      this.v.addScaledVector(this.n, lift);
      out.push(xc / PX - W / 2, this.v.y, this.v.z);
      flow.push(along);
    };
    const arc = (x0: number, y0: number, x1: number, y1: number, h: number) => {
      const n = 16;
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const v = (i + 1) / n;
        at(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.03 + Math.sin(u * Math.PI) * h, u * len);
        at(x0 + (x1 - x0) * v, y0 + (y1 - y0) * v, 0.03 + Math.sin(v * Math.PI) * h, v * len);
      }
    };
    const dot = (x: number, y: number) => {
      const r = 6;
      const c: [number, number][] = [
        [x - r, y],
        [x, y - r],
        [x + r, y],
        [x, y + r],
      ];
      c.forEach((a, i) => {
        const b = c[(i + 1) % 4];
        at(a[0], a[1], 0.03, -1);
        at(b[0], b[1], 0.03, -1);
      });
    };
    if (this.bend) {
      for (const st of this.anchors.stages) {
        if (!inRange(st.y)) continue;
        // Wires start at the model wherever it has been dragged; their far ends stay put.
        const d = this.stations[st.tile - 2];
        const cx = st.x + (d?.ox ?? 0);
        const cy = st.y + (d?.oy ?? 0);
        for (const p of this.anchors.pins) {
          if (p.tile !== st.tile) continue;
          arc(cx, cy, p.x, p.y, 0.55);
          dot(p.x, p.y);
        }
        for (const q of this.spokes.get(st.tile) ?? []) {
          const x = Math.max(4, Math.min(W * PX - 4, st.x + q.x));
          arc(cx, cy, x, st.y + q.y, 0.12);
          dot(x, st.y + q.y);
        }
      }
      for (const s of this.anchors.slabs) {
        if (!inRange(s.y0)) continue;
        // The leader leaves the slab's corner and runs under the callout title, past the sheet edge.
        const y = s.y0 - 70;
        arc(s.x1, s.y0, W * PX + 25, y, 0);
        arc(W * PX + 25, y, W * PX + 700, y, 0);
        dot(s.x1, s.y0);
      }
    }
    ribbon(this.wires.geometry, out, flow);
  }

  private placeDressing(W: number, sNear: number, sFar: number, t: number) {
    const onSheet = (yc: number) => {
      const s = this.sOf(yc);
      return s > sNear + 3 && s < sFar ? s : null;
    };
    for (const g of this.titles) {
      const s = onSheet(g.yc);
      g.group.visible = g.shadow.visible = s !== null;
      if (s === null) continue;
      this.seat(g.shadow.quaternion, s, false);
      g.shadow.position.set(g.shadow.userData.x, this.v.y, this.v.z);
      // Always upright to the room, leaning back a touch, so they stand even where the sheet folds up.
      g.group.position.copy(g.shadow.position);
      g.group.rotation.x = -0.1;
    }
    if (this.cloud && this.cloudDrag) {
      const c = this.cloudDrag;
      this.settle(c);
      const s = onSheet(c.yc + c.oy);
      this.cloud.group.visible = s !== null;
      if (s !== null) {
        this.seat(this.cloud.group.quaternion, s, true);
        this.cloud.group.quaternion.multiply(this.lean());
        this.cloud.group.position.set((c.x + c.ox) / PX - W / 2, this.v.y, this.v.z);
        this.cloud.update(this.clock.elapsedTime, this.camera);
      }
    }
    for (const a of this.arts) {
      const s = onSheet(a.yc);
      a.art.group.visible = s !== null;
      if (s === null) continue;
      this.seat(a.art.group.quaternion, s, true);
      a.art.group.quaternion.multiply(this.lean());
      a.art.group.position.set(a.side * (W / 2 + a.off), this.v.y, this.v.z);
      const spin = a.art.group.userData.spinner as THREE.Object3D;
      spin.rotation.y = a.art.spin ? t * a.art.spin : a.side * -0.55;
      a.art.labels.forEach((l) => l.mesh.quaternion.copy(a.art.group.quaternion).invert().multiply(this.camera.quaternion));
    }
    for (const f of this.formulas) {
      const s = onSheet(f.yc);
      f.l.mesh.visible = s !== null;
      if (s === null) continue;
      this.path(s, this.v, this.n);
      f.l.mesh.position.set(f.side * (W / 2 + 3.2), this.v.y, this.v.z).addScaledVector(this.n, 0.1);
      f.l.mesh.quaternion.copy(this.camera.quaternion);
    }
    for (const g of this.tags) {
      const s = onSheet(g.yc);
      g.l.mesh.visible = s !== null;
      if (s === null) continue;
      this.path(s, this.v, this.n);
      g.l.mesh.position.set(g.x, this.v.y, this.v.z).addScaledVector(this.n, g.callout ? 0.34 : 0.1);
      g.l.mesh.quaternion.copy(this.camera.quaternion);
    }
  }

  private drawRuler(W: number, sNear: number, sFar: number) {
    const yFrom = Math.max(-500, this.scroll - (sFar - this.sRead) * PX);
    const yTo = Math.min(this.contentH + 600, this.scroll + (this.sRead - sNear) * PX);
    const edge: number[] = [];
    const tick: number[] = [];
    const step = 25;
    const p = (yc: number, x: number, lift: number, out: number[]) => {
      this.path(this.sOf(yc), this.v, this.n);
      this.v.addScaledVector(this.n, lift);
      out.push(x, this.v.y, this.v.z);
    };
    for (let y = yFrom; y < yTo; y += step) {
      for (const sx of [-1, 1]) {
        p(y, (sx * W) / 2, 0.02, edge);
        p(Math.min(y + step, yTo), (sx * W) / 2, 0.02, edge);
      }
    }
    const seen = new Set<number>();
    for (let y = Math.ceil(yFrom / 100) * 100; y < yTo; y += 100) {
      const major = y % 500 === 0;
      for (const sx of [-1, 1]) {
        p(y, sx * (W / 2 + 0.25), 0.01, tick);
        p(y, sx * (W / 2 + (major ? 1.1 : 0.55)), 0.01, tick);
      }
      if (major && y >= 0) {
        seen.add(y);
        let l = this.labels.get(y);
        if (!l) {
          l = label([{ text: String(y), font: "mono", size: 40, color: "#ffffff", tracking: 2 }], 0.27, { pxW: 240, align: "left" });
          this.inked(l);
          this.labels.set(y, l);
          this.scene.add(l.mesh);
        }
        this.path(this.sOf(y), this.v);
        l.mesh.position.set(-(W / 2 + 0.75), this.v.y + 0.3, this.v.z);
        l.mesh.quaternion.copy(this.camera.quaternion);
        l.mesh.visible = true;
      }
    }
    this.labels.forEach((l, y) => {
      if (!seen.has(y)) l.mesh.visible = false;
    });
    const set = (ls: THREE.LineSegments, a: number[]) => {
      ls.geometry.dispose(); // frees the last frame's GL buffer
      ls.geometry.setAttribute("position", new THREE.Float32BufferAttribute(a, 3));
    };
    set(this.edges, edge);
    set(this.ticks, tick);
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
    this.tiles.forEach((t) => t.tex?.dispose());
    this.renderer.dispose();
  }
}
