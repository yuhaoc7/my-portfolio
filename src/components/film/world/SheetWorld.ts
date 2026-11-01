import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { clamp01, label, type CanvasPlane, type Station } from "./kit";
import { Themer } from "./theme";
import { campus } from "./campus";
import { evalPipeline } from "./evalPipeline";
import { gpuCluster } from "./gpuCluster";
import { dashboards } from "./dashboards";
import { sdxlServing } from "./sdxlServing";
import { vgiGallery } from "./vgiGallery";
import { retrievalFunnel } from "./retrievalFunnel";

/**
 * The page as one long sheet. Content is laid out in CSS pixels down the
 * sheet; the sheet lies flat on the floor near the camera and bends up into a
 * wall in the distance. Scrolling slides the content along the sheet, so it
 * comes in from under the camera, crosses the floor, and climbs the wall.
 *
 *   s — distance along the sheet in world units (0 = where the bend starts)
 *   yc — content y in CSS px (0 = top of the page)
 */
export const PX = 100; // CSS px per world unit

const THEME = {
  light: { bg: "#e9e7e1", grid: "#c4bfb4", ink: "#24242a" },
  dark: { bg: "#0b0c0e", grid: "#2a2d33", ink: "#24242a" },
};
export const PAPER = "#2340e3";

type Tile = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  tex: THREE.CanvasTexture | null;
  y: number;
  h: number;
  segs: number;
};

export type SheetPick = { tile: number; x: number; y: number };

const BUILDERS = [campus, evalPipeline, gpuCluster, dashboards, sdxlServing, () => vgiGallery("/media/vgi"), retrievalFunnel];

export class SheetWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  private themer = new Themer();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private grid: THREE.GridHelper;
  private wall: THREE.GridHelper;
  private paper: THREE.Mesh;
  private paperMat: THREE.MeshBasicMaterial;
  private edges: THREE.LineSegments;
  private ticks: THREE.LineSegments;
  private tickMat: THREE.LineBasicMaterial;
  private labels = new Map<number, CanvasPlane>();
  private tiles: Tile[] = [];
  private stations: { st: Station; yc: number; side: number }[] = [];
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
  readonly R = 9;
  private sRead = 2.2;
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
    this.scene.fog = new THREE.Fog(THEME.light.bg, 45, 140);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.hemi = new THREE.HemisphereLight("#ffffff", "#d8d2c6", 0.9);
    this.sun = new THREE.DirectionalLight("#fff6ea", 2);
    this.sun.position.set(20, 40, 18);
    this.scene.add(this.hemi, this.sun);

    // Floor and wall grids, so the bend reads as a room.
    this.grid = new THREE.GridHelper(400, 100, THEME.light.grid, THEME.light.grid);
    this.grid.position.y = -0.02;
    this.wall = new THREE.GridHelper(400, 100, THEME.light.grid, THEME.light.grid);
    this.wall.rotation.x = Math.PI / 2;
    this.wall.position.set(0, 0, -this.R - 0.6);
    this.wall.visible = this.bend;
    for (const g of [this.grid, this.wall]) {
      const m = g.material as THREE.LineBasicMaterial;
      m.transparent = true;
      m.opacity = 0.35;
      this.themer.skip(m);
      this.scene.add(g);
    }

    this.paperMat = new THREE.MeshBasicMaterial({ color: PAPER, toneMapped: false, side: THREE.DoubleSide });
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.paperMat);
    this.paper.frustumCulled = false;
    this.themer.skip(this.paperMat);
    this.scene.add(this.paper);

    const edgeMat = new THREE.LineBasicMaterial({ color: "#9fb0ff", transparent: true, opacity: 0.9, toneMapped: false });
    this.themer.skip(edgeMat);
    this.edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMat);
    this.edges.frustumCulled = false;
    this.tickMat = new THREE.LineBasicMaterial({ color: THEME.light.ink, transparent: true, opacity: 0.45 });
    this.themer.skip(this.tickMat);
    this.ticks = new THREE.LineSegments(new THREE.BufferGeometry(), this.tickMat);
    this.ticks.frustumCulled = false;
    this.scene.add(this.edges, this.ticks);

    BUILDERS.forEach((b, i) => {
      const st = b();
      st.group.scale.setScalar(0.4);
      st.group.rotation.y = i % 2 ? -0.55 : 0.55;
      this.scene.add(st.group);
      this.stations.push({ st, yc: 0, side: i % 2 ? 1 : -1 });
    });

    this.timeScale = opts.reducedMotion ? 0.3 : 1;
    this.resize();
  }
  private timeScale = 1;

  /* ------------------------------------------------------------------ path */

  /** Point on the sheet's centre line at distance s, and its normal. */
  private path(s: number, out: THREE.Vector3, n?: THREE.Vector3) {
    const R = this.R;
    if (!this.bend || s <= 0) {
      out.set(0, 0, -s);
      n?.set(0, 1, 0);
    } else if (s < (R * Math.PI) / 2) {
      const a = s / R;
      out.set(0, R * (1 - Math.cos(a)), -R * Math.sin(a));
      n?.set(0, Math.cos(a), Math.sin(a));
    } else {
      out.set(0, R + (s - (R * Math.PI) / 2), -R);
      n?.set(0, 0, 1);
    }
    return out;
  }

  private sOf(yc: number) {
    return this.sRead + (this.scroll - yc) / PX;
  }

  /** The s range worth drawing: from under the camera to the top of the wall. */
  private get sNear() {
    return -this.camera.position.z - 3;
  }
  private get sFar() {
    return this.bend ? (this.R * Math.PI) / 2 + 26 : 140;
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
  setLayout(width: number, tiles: { y: number; h: number }[]) {
    this.W = width / PX;
    this.contentH = tiles.length ? tiles[tiles.length - 1].y + tiles[tiles.length - 1].h : 1;
    const paperSegs = Math.ceil((this.contentH + 1200) / 40);
    this.paper.geometry.dispose();
    this.paper.geometry = new THREE.PlaneGeometry(1, 1, 1, paperSegs);
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
      const t = tiles[i + 2]; // the seven stations sit beside sections 2–8
      if (t) s.yc = t.y + t.h * 0.4;
    });
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
    const s = this.sOf(yc);
    this.path(s, this.v);
    this.v.x = (side * this.W) / 2;
    this.v.project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * this.w, y: (-this.v.y * 0.5 + 0.5) * this.h, visible: s > this.sNear + 2 && s < this.sFar - 10 && this.v.z < 1 };
  }

  /** Content y (px) that sits at a given height on screen (0 top … 1 bottom); used for "where am I". */
  get readingY() {
    return this.scroll;
  }

  /* ------------------------------------------------------------- settings */

  setTheme(dark: boolean) {
    const t = dark ? THEME.dark : THEME.light;
    (this.scene.background as THREE.Color).set(t.bg);
    this.scene.fog!.color.set(t.bg);
    for (const g of [this.grid, this.wall]) {
      const m = g.material as THREE.LineBasicMaterial;
      m.color.set(t.grid);
      m.vertexColors = false;
      m.needsUpdate = true;
    }
    this.tickMat.color.set(dark ? "#c9ccd2" : t.ink);
    this.hemi.color.set(dark ? "#aab3c0" : "#ffffff");
    this.hemi.groundColor.set(dark ? "#121314" : "#d8d2c6");
    this.hemi.intensity = dark ? 0.5 : 0.9;
    this.sun.intensity = dark ? 1 : 2;
    this.scene.environmentIntensity = dark ? 0.25 : 0.55;
    this.themer.apply(this.scene, dark);
    this.labels.forEach((l) => this.themer.material(l.material));
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
    this.css?.renderer.setSize(this.w, this.h);
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
    this.sRead = this.cam.read;

    // Paper: a margin above and below the content.
    const top = -500;
    const span = this.contentH + 1100;
    const paperSegs = (this.paper.geometry.getAttribute("position").count - 2) / 2;
    this.bendStrip(this.paper.geometry, top, span, paperSegs, -W / 2, W / 2, 0);

    for (const tile of this.tiles) {
      const s0 = this.sOf(tile.y);
      const s1 = this.sOf(tile.y + tile.h);
      tile.mesh.visible = s0 > sNear && s1 < sFar;
      if (tile.mesh.visible) this.bendStrip(tile.mesh.geometry, tile.y, tile.h, tile.segs, -W / 2, W / 2, 0.015);
    }

    this.drawRuler(W, sNear, sFar);

    this.stations.forEach(({ st, yc, side }) => {
      const s = this.sOf(yc);
      st.group.visible = s > sNear - 4 && s < sFar;
      if (!st.group.visible) return;
      this.path(s, this.v);
      st.group.position.set(side * (W / 2 + 7.8), this.v.y, this.v.z);
      st.update(t, dt * this.timeScale, clamp01(0.5 + (s - this.sRead) / 7));
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

  /** Edge lines plus a ruler down both sides: a tick every 100 px, a number every 500. */
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
          l = label([{ text: String(y), font: "mono", size: 44, color: "#24242a", tracking: 2 }], 0.42, { pxW: 240, align: "left" });
          this.themer.material(l.material);
          this.labels.set(y, l);
          this.scene.add(l.mesh);
        }
        this.path(this.sOf(y), this.v);
        l.mesh.position.set(-(W / 2 + 2.15), this.v.y + 0.3, this.v.z);
        l.mesh.quaternion.copy(this.camera.quaternion);
        l.mesh.visible = true;
      }
    }
    this.labels.forEach((l, y) => {
      if (!seen.has(y)) l.mesh.visible = false;
    });
    const set = (ls: THREE.LineSegments, a: number[]) => {
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
