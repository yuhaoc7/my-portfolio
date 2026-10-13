// GPU cluster, built by scrolling. One shot, no buttons: the camera starts on an open 4U server,
// eight GPU cards drop into its PCIe slots, the camera pulls back while the other 56 cards seat
// across eight servers, the lids close, the nodes slide into two racks, the cabling is run the way
// a real row is cabled (two NIC links per node through the vertical manager to the top-of-rack
// switch, uplinks in the overhead tray), and the cluster powers on.
FIGS3D.push({ id: 'gc', name: 'GPU cluster', mod: (() => {
  const g0 = new THREE.Group(); g0.visible = false; scene.add(g0);
  const first = twMeshes.length;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // ── page: scroll reel, captions, counter; the figure's own controls are not used ──
  document.head.insertAdjacentHTML('beforeend', `<style>
    html, body { height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; }
    body > canvas { position: fixed !important; inset: 0; z-index: 0; }
    .ui:not(#credit) { display: none !important; }
    #credit { z-index: 3; }
    #reel { position: relative; z-index: 2; height: 1000vh; }
    .gc-cap { position: fixed; z-index: 3; left: 24px; bottom: 28px; max-width: min(460px, calc(100vw - 48px)); pointer-events: none; }
    .gc-cap h2 { margin: 0 0 8px; font: 600 clamp(22px, 3vw, 34px)/1.08 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: -.02em; color: var(--ink); text-wrap: balance; }
    .gc-cap p { margin: 0; color: var(--dim); font-size: 13px; line-height: 1.5; max-width: 52ch; }
    .gc-cap .k { display: block; margin-bottom: 10px; color: var(--accent); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
    .gc-cap.swap { animation: gcIn .7s cubic-bezier(.2,.8,.2,1); }
    @keyframes gcIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    .gc-top { position: fixed; z-index: 3; top: 20px; left: 24px; right: 24px; display: flex; justify-content: space-between; align-items: baseline; pointer-events: none;
      font: 11px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); }
    .gc-top b { color: var(--ink); font-weight: 500; }
    .gc-count { text-align: right; }
    .gc-count b { display: block; margin-top: 6px; font-size: clamp(30px, 4.4vw, 54px); letter-spacing: -.03em; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--ink); }
    .gc-count b i { font-style: normal; color: var(--dim); }
    .gc-count.on b { color: var(--accent); text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent); }
    .gc-bar { position: fixed; z-index: 3; left: 0; top: 0; height: 2px; width: 100%; transform-origin: 0 50%; transform: scaleX(0); background: var(--accent); pointer-events: none; }
    .gc-cue { position: fixed; z-index: 3; left: 50%; bottom: 26px; transform: translateX(-50%); color: var(--dim); font: 11px ui-monospace, Menlo, monospace; letter-spacing: .2em; text-transform: uppercase; transition: opacity .4s; pointer-events: none; }
    .gc-cue.off { opacity: 0; }
    @media (max-width: 720px) { .gc-cap { left: 16px; right: 16px; bottom: 22px; max-width: none; } .gc-top { left: 16px; right: 16px; top: 16px; } .gc-cue { display: none; } .gc-sub { display: none; } #credit { display: none; } }
    @media (prefers-reduced-motion: reduce) { .gc-cap.swap { animation: none; } }
  </style>`);
  document.body.insertAdjacentHTML('beforeend', `<div id="reel" aria-hidden="true"></div>
    <div class="gc-bar" id="gc-bar"></div>
    <div class="gc-top"><span><b>GPU cluster</b><span class="gc-sub"> · 8 nodes × 8 GPUs</span></span><span class="gc-count" id="gc-count">GPUs seated<b>00<i>/64</i></b></span></div>
    <div class="gc-cap" id="gc-cap" aria-live="polite"><span class="k"></span><h2></h2><p></p></div>
    <div class="gc-cue" id="gc-cue">Scroll to build</div>`);
  renderer.domElement.style.touchAction = 'pan-y';
  controls.enabled = false; controls.enableDamping = false; controls.autoRotate = false;

  // ── geometry (units: 1 = 5 mm; a 4U server is 88 wide, 150 deep, 34 tall) ──
  const FZ = 7, SW = 88, SD = 150, SH = 34, NS = 8, NG = 8;
  const RKW = 110, RKD = 176, RKH = 196, RACKX = [100, 240], RY0 = 24;
  const slotZ = s => FZ + 10 + s * 40;
  const SWZ = slotZ(4);
  const floorPos = j => [20 + (j % 4) * 112, 400 + Math.floor(j / 4) * 190, FZ];
  const rackPos = j => [RACKX[j >> 2] + 11, RY0 + 14, slotZ(j % 4)];

  // raised floor: one big plate with a 60 cm tile grid; perforated tiles in the cold aisle
  plateWith(g0, 480, 780, [[18, 18], [462, 18], [18, 762], [462, 762]]);
  { const s = []; for (let x = 30; x < 470; x += 120) s.push([[x, 10, FZ + 0.06], [x, 770, FZ + 0.06]]); for (let y = 30; y < 770; y += 120) s.push([[10, y, FZ + 0.06], [470, y, FZ + 0.06]]); seg(s, g0);
    [[150, 270], [270, 270]].forEach(([x, y]) => slitsUV(topUV(x, y, FZ), 10, 110, 6, 10, 110, g0)); }

  // ── racks: open frame (posts, plinth, cap, back and left panels), vertical cable manager, ToR switch ──
  const managers = [];
  RACKX.forEach((x0, k) => {
    const y0 = RY0;
    rbox(x0, y0, FZ, RKW, RKD, 8, 2, bodyMat, g0);
    rbox(x0, y0, FZ, RKW, 4, RKH, 1, bodyMat, g0);
    rbox(x0, y0, FZ, 4, RKD, RKH, 1, bodyMat, g0);
    [[x0 + RKW - 6, y0], [x0 + RKW - 6, y0 + RKD - 6], [x0, y0 + RKD - 6]].forEach(([x, y]) => rbox(x, y, FZ, 6, 6, RKH, 1, bodyMat, g0));
    rbox(x0, y0, FZ + RKH, RKW, RKD, 6, 2, bodyMat, g0);
    label(`RACK ${'AB'[k]}`, 30, 6, 4.4, onFront(x0 + 22, y0 + RKD, FZ + RKH + 3), g0, { align: 'left', spacing: 0.5 });
    { const s = []; for (let q = 0; q < 5; q++) { const z = slotZ(q) - 1; s.push([[x0 + RKW - 6, y0 + 6, z], [x0 + RKW - 6, y0 + RKD - 6, z]]); } seg(s, g0); }
    // cable manager standing in front of the right posts, with fingers
    rbox(x0 + RKW - 12, y0 + RKD, FZ + 8, 12, 6, RKH - 8, 1.5, bodyMat, g0);
    { const s = []; for (let z = FZ + 16; z < FZ + RKH - 6; z += 8) s.push([[x0 + RKW - 12, y0 + RKD + 6.1, z], [x0 + RKW - 9, y0 + RKD + 6.1, z]], [[x0 + RKW - 3, y0 + RKD + 6.1, z], [x0 + RKW, y0 + RKD + 6.1, z]]); seg(s, g0); }
    // top-of-rack switch
    const sx = x0 + 11, sy = y0 + 14;
    rbox(sx, sy, SWZ, SW, SD, 10, 1.5, bodyMat, g0);
    label('TOR-' + 'AB'[k], 16, 5, 3.6, onFront(sx + 9, sy + SD, SWZ + 5), g0, { align: 'left' });
    const ports = [];
    for (let q = 0; q < 8; q++) { frontInset(g0, sx + 22 + q * 5.6, sy + SD, SWZ + 7.4, 4.4, 4.4, 0.6); ports.push(dotFront(sx + 24.2 + q * 5.6, sy + SD, SWZ + 1.6, 0.6, g0)); }
    slitsUV(frontUV(sx, sy + SD, SWZ + 10), 70, 84, 2.2, 2, 8, g0);
    const swLed = dotFront(sx + 4, sy + SD, SWZ + 5, 1, g0);
    managers.push({ x0, y0, sx, sy, ports, swLed });
  });

  // overhead ladder tray between the racks
  const TRZ = FZ + RKH + 30, TRY = RY0 + 70;
  [TRY, TRY + 22].forEach(y => rbox(RACKX[0] + 20, y, TRZ, RACKX[1] + 90 - RACKX[0] - 20, 2, 3, 0.5, bodyMat, g0));
  { const s = []; for (let x = RACKX[0] + 24; x < RACKX[1] + 90; x += 9) s.push([[x, TRY + 1, TRZ + 3.1], [x, TRY + 23, TRZ + 3.1]]); seg(s, g0, majorMat); }
  [RACKX[0] + 24, RACKX[1] + 84].forEach(x => [TRY, TRY + 22].forEach(y => polyLine([[x, y + 1, TRZ], [x, y + 1, FZ + RKH + 6]], majorMat, g0)));

  // ── servers ──
  const ledOnTop = (x, y, z, r, parent) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r * TS, 16), ledOffMat); m.rotation.x = -Math.PI / 2; m.position.copy(W(x, y, z + 0.15)); parent.add(m); return m; };
  const servers = [];
  for (let j = 0; j < NS; j++) {
    const grp = new THREE.Group(); g0.add(grp);
    // chassis tray, walls, front panel
    rbox(0, 0, 0, SW, SD, 3, 1.5, bodyMat, grp);
    rbox(0, 0, 0, 2, SD, SH, 0.5, bodyMat, grp);
    rbox(SW - 2, 0, 0, 2, SD, SH, 0.5, bodyMat, grp);
    rbox(0, 0, 0, SW, 2, SH, 0.5, bodyMat, grp);
    rbox(0, SD - 3, 0, SW, 3, SH, 0.8, bodyMat, grp);
    slitsUV(sideUV(SW, SD, SH), 12, 40, 2.4, 6, SH - 6, grp);
    // rear: two PSUs, two CPU heatsinks, DIMM rows
    rbox(58, 3, 3, 13, 26, 18, 1, bodyMat, grp); rbox(72, 3, 3, 13, 26, 18, 1, bodyMat, grp);
    [8, 32].forEach(x => { rbox(x, 6, 3, 16, 16, 12, 1, bodyMat, grp); slitsUV(topUV(x, 6, 15), 2, 14, 2, 2, 14, grp); });
    slitsUV(topUV(4, 24, 3), 2, 50, 1.6, 0, 4, grp, true);
    // eight x16 slots: connector strips on the board
    for (let k = 0; k < NG; k++) { const x = 6 + k * 9.6; inset(x - 0.4, 34, 3, 7.8, 56, 0.6, grp); }
    // fan wall and drive cage behind the front panel
    rbox(2, 100, 3, SW - 4, 8, 28, 0.8, bodyMat, grp);
    slitsUV(topUV(2, 100, 31), 4, SW - 8, 3, 1.5, 6.5, grp);
    rbox(2, 116, 3, SW - 4, 30, 22, 0.8, bodyMat, grp);
    slitsUV(topUV(2, 116, 25), 4, SW - 8, 10.5, 3, 27, grp);
    // front panel detail
    const ff = frontUV(0, SD, SH);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { frontInset(grp, 4 + c * 10, SD, SH - 3 - r * 15, 8.6, 13, 0.8); seg([[ff(5.5 + c * 10, 6 + r * 15, 0.12), ff(10.5 + c * 10, 6 + r * 15, 0.12)]], grp); }
    label(`N${j + 1}`, 10, 6, 5, onFront(48 + 5, SD, SH - 6), grp, { align: 'left' });
    const leds = [0, 1, 2, 3].map(q => dotFront(50 + q * 4, SD, SH - 13, 1, grp));
    frontInset(grp, 49, SD, SH - 21, 7, 6, 0.8); frontInset(grp, 59, SD, SH - 21, 7, 6, 0.8);
    slitsUV(ff, 72, 84, 2.2, 16, 30, grp);
    { const cx = 79, cz = SH - 7, pts = []; for (let a = 0; a <= 24; a++) { const t = (-50 + a * (280 / 24)) * Math.PI / 180; pts.push([cx + 2.6 * Math.sin(t), SD + 0.12, cz + 2.6 * Math.cos(t)]); } polyLine(pts, majorMat, grp); polyLine([[cx, SD + 0.12, cz + 3], [cx, SD + 0.12, cz]], majorMat, grp); }
    // lid (hidden until it drops in)
    const lid = new THREE.Group(); lid.visible = false; grp.add(lid);
    rbox(0, 0, SH, SW, SD, 2, 1.5, bodyMat, lid);
    slitsUV(topUV(0, 0, SH + 2), 10, SW - 10, 3, 104, 112, lid);
    label('8× GPU', 22, 6, 4.4, onTop(20, 130, SH + 2), lid, { align: 'left', spacing: 0.4 });
    // GPU cards
    const cards = [];
    for (let k = 0; k < NG; k++) {
      const cg = new THREE.Group(); grp.add(cg);
      const x = 6 + k * 9.6, y = 30, z = 4, w = 7, d = 64, h = 24;
      rbox(x, y, z, w, d, h, 1, bodyMat, cg);
      slitsUV(sideUV(x + w, y + d, z + h), 8, 56, 2, 4, h - 4, cg);
      slitsUV(topUV(x, y, z + h), 2.2, 4.8, 2.6, 8, 52, cg);
      rbox(x + 1.5, y + 4, z + h, 4, 7, 2.5, 0.6, bodyMat, cg);
      rbox(x - 0.5, y + d, z - 2, w + 1, 1.4, h + 4, 0.3, bodyMat, cg);
      const led = ledOnTop(x + 3.5, y + d - 4, z + h, 1.1, cg);
      cg.visible = false;
      cards.push({ g: cg, led });
    }
    servers.push({ j, grp, lid, cards, leds, from: floorPos(j), to: rackPos(j) });
  }

  // ── cabling: two NIC links per node, port → forward → manager lane → up → switch port ──
  const route = (pts, r = 2.4) => {           // rounded corners on an orthogonal path
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const da = Math.hypot(...b.map((v, q) => v - a[q])), dc = Math.hypot(...c.map((v, q) => v - b[q]));
      const ra = Math.min(r, da / 2), rc = Math.min(r, dc / 2);
      const p0 = b.map((v, q) => v + (a[q] - v) * ra / da), p2 = b.map((v, q) => v + (c[q] - v) * rc / dc);
      for (let s = 0; s <= 6; s++) { const t = s / 6; out.push(p0.map((v, q) => (1 - t) ** 2 * v + 2 * (1 - t) * t * b[q] + t * t * p2[q])); }
    }
    out.push(pts[pts.length - 1]); return out;
  };
  const cables = [];
  servers.forEach(sv => {
    const m = managers[sv.j >> 2], s = sv.j % 4, [sx, sy, sz] = sv.to;
    for (let p = 0; p < 2; p++) {
      const idx = s * 2 + p, px = sx + 52.5 + p * 10, pz = sz + SH - 24, fy = sy + SD + 0.3, cy = RY0 + RKD + 6.6;
      const lane = m.x0 + RKW - 9 + idx * 0.85, spx = m.sx + 24.2 + idx * 5.6, spz = SWZ + 5.2;
      const pts = route([[px, fy, pz], [px, cy, pz], [lane, cy, pz], [lane, cy, spz], [spx, cy, spz], [spx, fy, spz]]);
      const off = polyLine(pts, majorMat, g0), on = polyLine(pts, accentLineMat, g0);
      off.geometry.instanceCount = 0; on.visible = false;
      const bead = glowPoints([W(...pts[0])], 0.12); g0.add(bead);
      cables.push({ off, on, n: pts.length - 1, pts, cum: cumLen(pts), bead, ph: Math.random() });
    }
  });
  // uplinks: four links from switch A, up into the tray, across, down into switch B
  const uplinks = [];
  for (let q = 0; q < 4; q++) {
    const a = managers[0], b = managers[1], y = TRY + 6 + q * 3.2, za = SWZ + 10, zt = TRZ + 3.4;
    const xa = a.sx + 58 + q * 2.2, xb = b.sx + 30 - q * 2.2;
    const pts = route([[xa, y, za], [xa, y, zt], [xb, y, zt], [xb, y, za]], 5);
    const off = polyLine(pts, majorMat, g0), on = polyLine(pts, accentLineMat, g0);
    off.geometry.instanceCount = 0; on.visible = false;
    const bead = glowPoints([W(...pts[0])], 0.14); g0.add(bead);
    uplinks.push({ off, on, n: pts.length - 1, pts, cum: cumLen(pts), bead, ph: q / 4 });
  }
  const haze = hazeAndShadow(g0, 240, 390, 6, 8);
  creases(first);

  // ── timeline (T = scroll progress 0 → 1) ──
  const cardWindow = (j, k) => j === 0 ? [0.07 + k * 0.026, 0.07 + k * 0.026 + 0.03]
    : (() => { const a = 0.33 + (j - 1) / 7 * 0.11 + k * 0.011; return [a, a + 0.03]; })();
  const lidWindow = j => [0.53 + j * 0.008, 0.53 + j * 0.008 + 0.035];
  const moveWindow = j => [0.6 + j * 0.022, 0.6 + j * 0.022 + 0.06];
  const cableWindow = i => { const a = 0.79 + (i >> 1) * 0.012 + (i & 1) * 0.004; return [a, a + 0.04]; };
  const POWER = 0.935;
  const CAPS = [
    [0, 'One node', 'Eight empty slots.', 'A 4U GPU server with the lid off: power supplies and CPUs at the back, fans and drives at the front, eight PCIe x16 slots in between.'],
    [0.065, 'Seating', 'The first eight GPUs.', 'Each card drops straight into its x16 slot; its status LED lights once it is seated.'],
    [0.3, 'Eight nodes', 'Sixty-four GPUs.', 'The same build across eight servers, eight cards each.'],
    [0.52, 'Racking', 'Lids on, into the racks.', 'Four nodes per rack, slid in on rails under a top-of-rack switch.'],
    [0.77, 'Cabling', 'Cabled like a real row.', 'Two NIC links per node, dressed through the vertical manager to the switch. Rack-to-rack uplinks ride the overhead ladder tray.'],
    [POWER - 0.01, 'Power on', '64 GPUs, one fabric.', 'Eight nodes, sixteen node links, four uplinks, all live.'],
  ];
  const capEl = document.getElementById('gc-cap'), countEl = document.getElementById('gc-count'), barEl = document.getElementById('gc-bar'), cueEl = document.getElementById('gc-cue');
  let capIdx = -1, lastCount = -1;
  function setCap(i) {
    if (i === capIdx) return; capIdx = i; const [, k, h, p] = CAPS[i];
    capEl.querySelector('.k').textContent = k; capEl.querySelector('h2').textContent = h; capEl.querySelector('p').textContent = p;
    capEl.classList.remove('swap'); void capEl.offsetWidth; capEl.classList.add('swap');
  }

  // camera keyframes: target (iso units), distance, azimuth offset, elevation
  const C0 = [floorPos(0)[0] + 44, floorPos(0)[1] + 70, FZ + 20];
  const KEYS = [
    { t: 0.00, tg: C0, d: 3.9, az: 0.32, el: 0.95 },
    { t: 0.06, tg: C0, d: 3.6, az: 0.22, el: 1.0 },
    { t: 0.28, tg: C0, d: 3.2, az: -0.18, el: 1.1 },
    { t: 0.40, tg: [232, 560, 30], d: 9.6, az: 0.05, el: 0.9 },
    { t: 0.52, tg: [232, 560, 30], d: 9.0, az: -0.05, el: 0.95 },
    { t: 0.70, tg: [225, 300, 80], d: 11.5, az: 0.0, el: 0.78 },
    { t: 0.78, tg: [220, 130, 105], d: 8.2, az: -0.1, el: 0.62 },
    { t: 0.90, tg: [240, 175, 100], d: 6.4, az: 0.3, el: 0.5 },
    { t: 1.00, tg: [235, 150, 105], d: 8.2, az: -0.12, el: 0.62 },
  ];
  const camPos = new THREE.Vector3(), camTg = new THREE.Vector3(), want = new THREE.Vector3(), wantT = new THREE.Vector3();
  let camInit = false;
  function shot(T) {
    let i = 0; while (i < KEYS.length - 2 && T > KEYS[i + 1].t) i++;
    const A = KEYS[i], B = KEYS[i + 1], f = sm(A.t, B.t, T);
    const tg = A.tg.map((v, q) => lerp(v, B.tg[q], f)), d = lerp(A.d, B.d, f), az = lerp(A.az, B.az, f), el = lerp(A.el, B.el, f);
    const k = Math.max(1, 0.95 / persp.aspect);
    wantT.copy(W(...tg));
    want.set(Math.sin(Math.PI / 4 + az), el, Math.cos(Math.PI / 4 + az)).normalize().multiplyScalar(d * k).add(wantT);
  }

  const P = (a, b, t) => a.map((v, q) => lerp(v, b[q], t));
  function serverPose(sv, T) {
    const [a, b] = moveWindow(sv.j), t = clamp((T - a) / (b - a)), [fx, fy, fz] = sv.from, [rx, ry, rz] = sv.to, LZ = FZ + 60, pre = ry + 180;
    const A = [fx, fy, fz], B = [fx, fy, LZ], C = [rx, pre, LZ], D = [rx, pre, rz], E = [rx, ry, rz];
    if (t < 0.14) return P(A, B, sm(0, 0.14, t));
    if (t < 0.55) return P(B, C, sm(0.14, 0.55, t));
    if (t < 0.7) return P(C, D, sm(0.55, 0.7, t));
    return P(D, E, sm(0.7, 1, t));
  }

  function update(T, now) {
    let seated = 0;
    servers.forEach(sv => {
      sv.grp.position.copy(W(...serverPose(sv, T)));
      let n = 0;
      sv.cards.forEach((c, k) => {
        const [a, b] = cardWindow(sv.j, k), t = clamp((T - a) / (b - a));
        c.g.visible = T > a - 0.02;
        const e = 1 - (1 - t) ** 3;
        c.g.position.copy(W(0, 0, (1 - e) * 120));
        const on = t >= 1; if (on) { n++; seated++; }
        c.led.material = on ? ledOnMat : ledOffMat;
      });
      const [la, lb] = lidWindow(sv.j), lt = clamp((T - la) / (lb - la));
      sv.lid.visible = T > la; sv.lid.position.copy(W(0, 0, (1 - sm(0, 1, lt)) * 70));
      const pw = T > POWER + sv.j * 0.004;
      sv.leds.forEach((l, q) => l.material = pw && (q === 0 || Math.sin(now / 90 + q * 2.1 + sv.j) > 0) ? ledOnMat : ledOffMat);
    });
    const lines = (list, win, pwAt, period) => list.forEach((c, i) => {
      const [a, b] = win(i), t = clamp((T - a) / (b - a));
      c.off.geometry.instanceCount = Math.round(t * c.n);
      const pw = T > pwAt;
      c.on.visible = pw; c.off.visible = !pw;
      if (pw) { const u = ((now / period) + c.ph) % 1; moveGlow(c.bead, alongPts(c.pts, c.cum, u), 0.85 * Math.sin(u * Math.PI)); }
      else c.bead.material.uniforms.intensity.value = 0;
    });
    lines(cables, cableWindow, POWER + 0.02, 1400);
    lines(uplinks, i => [0.86 + i * 0.01, 0.9 + i * 0.01], POWER + 0.03, 2200);
    managers.forEach(m => { const pw = T > POWER; m.swLed.material = pw ? ledOnMat : ledOffMat; m.ports.forEach((p, q) => p.material = pw && Math.sin(now / 70 + q * 1.7) > -0.3 ? ledOnMat : ledOffMat); });
    haze.uniforms.opacity.value = T > POWER ? 0.16 : (T < 0.55 ? seated / 64 * 0.08 : 0);
    if (seated !== lastCount) {
      lastCount = seated;
      countEl.querySelector('b').innerHTML = `${String(seated).padStart(2, '0')}<i>/64</i>`;
      countEl.classList.toggle('on', seated === 64);
    }
    let ci = 0; CAPS.forEach((c, i) => { if (T >= c[0]) ci = i; }); setCap(ci);
    barEl.style.transform = `scaleX(${T})`;
    cueEl.classList.toggle('off', T > 0.02);
  }

  function progress() { const h = document.documentElement.scrollHeight - innerHeight; return h > 0 ? clamp(scrollY / h) : 0; }
  let Ts = 0;
  function tick(now, dt) {
    const T = progress();
    Ts += (T - Ts) * Math.min(1, dt * 7);
    if (Math.abs(T - Ts) < 1e-4) Ts = T;
    shot(Ts);
    if (!camInit) { camPos.copy(want); camTg.copy(wantT); camInit = true; }
    const k = Math.min(1, dt * 5);
    camPos.lerp(want, k); camTg.lerp(wantT, k);
    camera.position.copy(camPos); controls.target.copy(camTg); camera.lookAt(camTg);
    update(Ts, now);
    tickFlashes(now);
  }
  return { group: g0, key: () => false, click: () => {}, tick, readout: () => {}, demo: () => {}, stop: () => {},
    panel: [], view: { target: W(...C0), dist: 2.5 }, info: '', hint: '' };
})() });
