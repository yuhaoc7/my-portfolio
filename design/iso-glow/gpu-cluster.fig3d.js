// GPU training cluster: the IBM–Illinois station of the portfolio (4 nodes × 4 GPUs, full-parameter
// training with DeepSpeed ZeRO-3), redrawn as an iso-glow 3D figure. Training runs in real steps:
// every GPU computes, then gradients travel the all-reduce ring between the nodes and the loss drops.
// Pull a node's power and the synchronous ring stalls until it comes back.
FIGS3D.push({ id: 'gc', name: 'GPU cluster', mod: (() => {
  // phones: the figure gets the screen; controls become a bottom toolbar above the readout
  document.head.insertAdjacentHTML('beforeend', `<style>@media (max-width: 720px) {
    #info { display: none !important; }
    #ctl-gc { top: auto !important; bottom: 56px !important; left: 12px !important; right: 12px !important; width: auto !important; flex-direction: row !important; overflow-x: auto; }
    #ctl-gc button { flex: 0 0 auto; min-height: 38px; padding: 0 14px; } #ctl-gc kbd { display: none; } #ctl-gc .sep { display: none; } }</style>`);
  const g0 = new THREE.Group(); g0.visible = false; scene.add(g0);
  const first = twMeshes.length;
  const PLZ = 7, NN = 4, RW = 62, GAP = 10, RX0 = 22, RY = 24, RD = 72, RF = RY + RD, RZ = 20;
  const UH = 28, BH = 26.5, UY = RY + 6, UD = RD - 8, UF = UY + UD, ZT = RZ + 2 + NN * UH + 1, RH = 22, TOPZ = ZT + RH;
  const CX = 24, CY = 110, CW = 272, CD = 50, CH = 16, CT = PLZ + CH;
  plateWith(g0, 320, 170, [[16, 16], [304, 16], [16, 154], [304, 154]]);

  // ── one rack per node ──
  const nodes = [];
  for (let i = 0; i < NN; i++) {
    const x0 = RX0 + i * (RW + GAP), grp = new THREE.Group(); grp.userData = { node: i + 1 }; g0.add(grp);
    rbox(x0 + 3, RY + 3, PLZ, RW - 6, RD - 6, 10, 2, bodyMat, grp);
    slitsUV(frontUV(x0 + 3, RF - 3, 17), 6, RW - 12, 3.4, 3, 7, grp);
    rbox(x0, RY, 17, RW, RD, 3, 1, bodyMat, grp);
    rbox(x0, RY, RZ, RW, 5, ZT - RZ, 1, bodyMat, grp);
    rbox(x0, RY, RZ, 5, RD, ZT - RZ, 1, bodyMat, grp);
    rbox(x0 + RW - 5, RY, RZ, 5, RD, ZT - RZ, 1, bodyMat, grp);
    { const f = sideUV(x0 + RW, RF, ZT); [[10, 30, 12, 50], [42, 62, 12, 50], [10, 30, 64, 102], [42, 62, 64, 102]].forEach(([a, b, c, e]) => slitsUV(f, a, b, 3, c, e, grp)); }

    // four GPU blades, G1 at the top
    const blades = [];
    for (let k = 0; k < NN; k++) {
      const n = k + 1, z = RZ + 2 + (NN - 1 - k) * UH, top = z + BH, UX = x0 + 6, f = frontUV(UX, UF, top);
      rbox(UX, UY, z, RW - 12, UD, BH, 1.5, bodyMat, grp);
      label(`G${n}`, 10, 6, 5, onFront(UX + 19, UF, top - 5.5), grp, { align: 'left' });
      const leds = [0, 1, 2, 3].map(j => dotFront(UX + 15 + j * 4.2, UF, top - 13, 1.15, grp));
      frontInset(grp, UX + 31, UF, top - 3, 16, BH - 6, 1.5);
      slitsUV(f, 33.5, 45, 2.1, 5, BH - 5, grp);
      const barPts = [f(3, BH - 4.5, 0.12), f(27, BH - 4.5, 0.12)];
      const barOff = polyLine(barPts, lineMat, grp), barOn = polyLine(barPts, accentLineMat, grp); barOn.visible = false;
      // power button: protrudes from the blade and pushes in
      const bx = UX + 3, bz = top - 11, btn = new THREE.Group(); btn.userData = { pressAxis: 'z', pressDepth: 2 }; grp.add(btn);
      const mat = capMat(); twCaps.push(mat); rbox(bx, UF, bz, 8, 3, 8, 1.5, mat, btn);
      const gf = frontUV(bx, UF + 3, bz + 8), arc = [];
      for (let a = 0; a <= 24; a++) { const t = (-50 + a * (280 / 24)) * Math.PI / 180; arc.push(gf(4 + 2 * Math.sin(t), 4.4 - 2 * Math.cos(t), 0.1)); }
      polyLine(arc, majorMat, btn); polyLine([gf(4, 1.6, 0.1), gf(4, 3.9, 0.1)], majorMat, btn);
      blades.push({ n, leds, barOff, barOn, btn, mat });
    }

    // roof: node label, status screen, fan, uplink box for the ring
    rbox(x0, RY, ZT, RW, RD, RH, 3, bodyMat, grp);
    label(`NODE ${i + 1}`, 26, 6, 4.4, onFront(x0 + 4 + 13, RF, TOPZ - 5.5), grp, { align: 'left', spacing: 0.4 });
    slitsUV(frontUV(x0, RF, TOPZ), 40, 56, 2.4, 3, 8, grp);
    frontInset(grp, x0 + 4, RF, TOPZ - 10, RW - 8, 10, 2);
    const scr = faceCanvas('front', x0 + 5, RF, TOPZ - 11, RW - 10, 8, 12, grp);
    const fc = [x0 + RW / 2, RY + 40];
    const ring = r => Array.from({ length: 64 }, (_, a) => { const t = a / 64 * Math.PI * 2; return W(fc[0] + r * Math.cos(t), fc[1] + r * Math.sin(t), TOPZ + 0.08); });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(21 * TS, 48), recessMat); disc.rotation.x = -Math.PI / 2; disc.position.copy(W(fc[0], fc[1], TOPZ + 0.05)); grp.add(disc);
    grp.add(loopL(ring(21), lineMat), loopL(ring(17), lineMat));
    const fan = new THREE.Group(); fan.position.copy(W(fc[0], fc[1], TOPZ + 0.1)); grp.add(fan);
    for (let b = 0; b < 7; b++) { const pts = []; for (let s = 0; s <= 10; s++) { const r = 4 + s * 1.3, t = b / 7 * Math.PI * 2 + s * 0.08; pts.push([r * Math.cos(t), r * Math.sin(t), 0]); } polyLine(pts, lineMat, fan); }
    const hub = new THREE.Mesh(new THREE.CircleGeometry(3 * TS, 24), bodyMat); hub.rotation.x = -Math.PI / 2; hub.position.y = 0.02 * TS; fan.add(hub);
    rbox(x0 + RW / 2 - 8, RY + 5, TOPZ, 16, 9, 6, 1.5, bodyMat, grp);
    const upLed = dotFront(x0 + RW / 2, RY + 14, TOPZ + 3, 1.1, grp);
    const glow = glowPoints([W(x0 + RW / 2, RF + 2, TOPZ - 6)], 0.3); grp.add(glow);
    nodes.push({ i, x0, cx: x0 + RW / 2, grp, blades, scr, fan, upLed, glow, on: true, util: 0 });
  }

  // ── all-reduce ring: node i → node i+1 over the roofs, and a high return arc behind ──
  const AZ = TOPZ + 6, AY = RY + 9;
  const links = nodes.map((a, i) => {
    const b = nodes[(i + 1) % NN];
    const path = i < NN - 1
      ? bezier([a.cx + 6, AY, AZ], [a.cx + 18, AY, AZ + 34], [b.cx - 18, AY, AZ + 34], [b.cx - 6, AY, AZ])
      : bezier([a.cx, AY - 4, AZ], [a.cx + 30, RY - 34, AZ + 92], [nodes[0].cx - 30, RY - 34, AZ + 92], [nodes[0].cx, AY - 4, AZ], 60);
    const wire = polyLine(path, majorMat, g0), bead = glowPoints([W(...path[0])], 0.22); g0.add(bead);
    return { a: i, b: (i + 1) % NN, path, cum: cumLen(path), wire, bead };
  });

  // ── console in front: loss curve on a top-face screen ──
  rbox(CX, CY, PLZ, CW, CD, CH, 4, bodyMat, g0);
  inset(CX + 6, CY + 5, CT, CW - 12, CD - 10, 3, g0);
  const lossScr = faceCanvas('top', CX + 8, CY + 7, CT, CW - 16, CD - 14, 8, g0);
  label('LLAMA-3.1-8B · FULL-PARAM · DEEPSPEED ZERO-3 · 4 × 4 GPU', 150, 6, 3.6, onFront(CX + 8 + 75, CY + CD, CT - 5), g0, { align: 'left', spacing: 0.3 });
  slitsUV(frontUV(CX, CY + CD, CT), 182, CW - 10, 2.6, 3, CH - 3, g0);
  const haze = hazeAndShadow(g0, 160, 85, 3.4, 1.9);
  creases(first);

  // ── state ──
  const COMPUTE = 560, REDUCE = 520;
  const st = { train: false, step: 0, phase: 'idle', t0: 0, hist: [], wait: 0 };
  const lossAt = s => 0.21 + 2.05 * Math.exp(-s / 700) + 0.05 * Math.exp(-s / 3000) * Math.sin(s * 0.37) + (Math.random() - 0.5) * 0.025;
  const up = () => nodes.filter(n => n.on).length;
  const down = () => nodes.filter(n => !n.on).map(n => n.i + 1);
  const loss = () => (st.hist.length ? st.hist[st.hist.length - 1] : lossAt(0));

  function drawNode(n) {
    const { x, P } = n.scr, lit = n.on && st.train, { C, A_ } = screenBg(n.scr, lit, 2);
    x.textBaseline = 'middle'; x.font = `${4.6 * P}px ${MONO3}`;
    const w = n.scr.c.width / P;
    if (!n.on) { x.fillStyle = C.ink; x.fillText('OFFLINE', 3 * P, 4.2 * P); }
    else if (!st.train) { x.fillStyle = C.ink; x.fillText('IDLE · 4 GPU', 3 * P, 4.2 * P); }
    else {
      const stalled = st.phase === 'stall';
      x.fillStyle = A_; if (theme !== 'light') { x.shadowColor = A_; x.shadowBlur = 0.8 * P; }
      x.fillText(stalled ? 'WAIT RING' : `GPU ${Math.round(n.util)}%`, 3 * P, 4.2 * P); x.shadowBlur = 0;
      const bw = 16, bx = w - bw - 3;
      x.lineWidth = 0.25 * P; x.strokeStyle = A_; x.beginPath(); x.roundRect(bx * P, 2.4 * P, bw * P, 3.4 * P, 1 * P); x.stroke();
      x.fillStyle = A_; x.beginPath(); x.roundRect(bx * P, 2.4 * P, bw * (stalled ? 0.08 : n.util / 100) * P, 3.4 * P, 1 * P); x.fill();
    }
    n.scr.tex.needsUpdate = true;
  }
  function drawLoss() {
    const s = lossScr, { x, P } = s, on = st.train || st.step > 0, { C, A_ } = screenBg(s, on, 3);
    const w = s.c.width / P, h = s.c.height / P, col = on ? A_ : C.ink, glow = on && theme !== 'light';
    x.textBaseline = 'alphabetic'; x.fillStyle = C.ink; x.font = `${4 * P}px ${MONO3}`;
    x.fillText('TRAIN LOSS', 6 * P, 8 * P); x.fillText(`STEP ${st.step.toLocaleString('en-US')}`, 6 * P, h * P - 4.5 * P);
    x.fillStyle = col; if (glow) { x.shadowColor = A_; x.shadowBlur = 1.2 * P; }
    x.font = `${13 * P}px ${MONO3}`; x.fillText(loss().toFixed(3), 5 * P, 22 * P); x.shadowBlur = 0;
    const gx = 72, gw = w - gx - 6, gy = 5, gh = h - 10;
    x.strokeStyle = C.detail; x.lineWidth = 0.2 * P;
    for (let k = 0; k <= 3; k++) { x.beginPath(); x.moveTo(gx * P, (gy + k * gh / 3) * P); x.lineTo((gx + gw) * P, (gy + k * gh / 3) * P); x.stroke(); }
    const H = st.hist, n = Math.max(90, H.length), hi = 2.3, lo = 0.1;
    if (H.length > 1) {
      x.strokeStyle = col; x.lineWidth = 0.8 * P; x.lineJoin = 'round'; if (glow) { x.shadowColor = A_; x.shadowBlur = 1 * P; }
      x.beginPath();
      const stepK = Math.max(1, Math.floor(H.length / 400));
      for (let k = 0; k < H.length; k += stepK) { const px = gx + (k / (n - 1)) * gw, py = gy + (1 - (H[k] - lo) / (hi - lo)) * gh; k ? x.lineTo(px * P, py * P) : x.moveTo(px * P, py * P); }
      x.stroke(); x.shadowBlur = 0;
      const k = H.length - 1, px = gx + (k / (n - 1)) * gw, py = gy + (1 - (H[k] - lo) / (hi - lo)) * gh;
      x.fillStyle = col; x.beginPath(); x.arc(px * P, py * P, 0.9 * P, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = C.ink; x.font = `${3.2 * P}px ${MONO3}`; x.textAlign = 'right';
    x.fillText(st.phase === 'stall' ? `RING STALLED · NODE ${down().join(', ')} DOWN` : st.train ? 'ALL-REDUCE · 16 RANKS' : 'READY', (gx + gw) * P, (gy + gh) * P - 1.2 * P);
    x.textAlign = 'left';
    s.tex.needsUpdate = true;
  }
  function readout() {
    if (active !== 'gc') return;
    const g = up() * NN, base = `step ${st.step.toLocaleString('en-US')} · loss ${loss().toFixed(2)} · ${g}/16 gpu`;
    document.getElementById('read').textContent = st.phase === 'stall' ? `stalled · node ${down().join(', ')} down · ${base}` : `${st.train ? 'training' : 'idle'} · ${base}`;
  }
  function render() {
    const any = st.train;
    nodes.forEach(n => {
      n.blades.forEach(b => {
        b.mat.userData.base = n.on ? 0.55 : 0;
        if (!twFlashes.some(f => f.mats.includes(b.mat))) b.mat.emissiveIntensity = b.mat.userData.base;
        if (!n.on || !any) b.leds.forEach((l, j) => l.material = n.on && j === 0 ? ledOnMat : ledOffMat);
        const lit = n.on && any && st.phase === 'compute';
        b.barOn.visible = lit; b.barOff.visible = !lit;
      });
      n.upLed.material = n.on && any ? ledOnMat : ledOffMat;
      n.glow.material.uniforms.intensity.value = n.on && any ? 0.3 : 0;
      drawNode(n);
    });
    links.forEach(l => {
      const live = any && nodes[l.a].on && nodes[l.b].on;
      l.wire.material = live ? accentLineMat : majorMat;
    });
    drawLoss(); readout();
  }

  function begin(phase, now) { st.phase = phase; st.t0 = now; render(); }
  function toggleTrain() {
    st.train = !st.train; SFX.switch();
    if (st.train) { tone(110, 0.8, 0.05, { type: 'sawtooth', to: 330 }); begin(up() === NN ? 'compute' : 'stall', performance.now()); }
    else { st.phase = 'idle'; links.forEach(l => l.bead.material.uniforms.intensity.value = 0); render(); }
    return true;
  }
  function toggleNode(k) {
    const n = nodes[k - 1]; if (!n) return false;
    n.on = !n.on; n.blades.forEach(b => flash(b.btn, 110)); SFX.switch();
    if (n.on) tone(150, 0.5, 0.04, { type: 'sawtooth', to: 380 });
    if (st.train) { if (!n.on) begin('stall', performance.now()); else if (up() === NN && st.phase === 'stall') begin('compute', performance.now()); }
    render(); return true;
  }
  function reset() { st.step = 0; st.hist = []; render(); return true; }

  function tick(now, dt) {
    if (st.train) {
      const el = now - st.t0;
      if (st.phase === 'compute') {
        nodes.forEach(n => { n.util += ((88 + Math.random() * 11) - n.util) * Math.min(1, dt * 6); });
        if (el > COMPUTE) begin('reduce', now);
      } else if (st.phase === 'reduce') {
        const t = Math.min(1, el / REDUCE);
        links.forEach(l => moveGlow(l.bead, alongPts(l.path, l.cum, t), Math.sin(t * Math.PI) * 1.1));
        nodes.forEach(n => { n.util += (12 - n.util) * Math.min(1, dt * 5); });
        if (el > REDUCE) {
          links.forEach(l => l.bead.material.uniforms.intensity.value = 0);
          const stride = 8; for (let s = 0; s < stride; s++) { st.step++; st.hist.push(lossAt(st.step)); }
          tap(1800, 0.025, 8);
          begin(up() === NN ? 'compute' : 'stall', now);
        }
      } else if (st.phase === 'stall') {
        nodes.forEach(n => { n.util += (0 - n.util) * Math.min(1, dt * 3); });
        if (now - st.wait > 400) { st.wait = now; render(); }
      }
      // LEDs: blink while computing; one rank-sweep per step
      if (st.phase === 'compute') {
        const sweep = Math.floor((now - st.t0) / (COMPUTE / NN));
        nodes.forEach(n => n.on && n.blades.forEach((b, k) => b.leds.forEach((l, j) => l.material = (k === sweep || Math.random() < 0.45) ? ledOnMat : ledOffMat)));
      }
      if (now - (st.scrT || 0) > 150) { st.scrT = now; nodes.forEach(drawNode); }
    }
    nodes.forEach(n => { n.fan.rotation.y -= dt * (n.on ? (st.train ? 9 : 1.2) : 0); });
    haze.uniforms.opacity.value += ((st.train ? 0.14 : 0) - haze.uniforms.opacity.value) * Math.min(1, dt * 4);
    tickFlashes(now);
  }
  function key(e) {
    if (e.key === ' ' && !e.repeat) return toggleTrain();
    if (/^[1-4]$/.test(e.key)) { if (!e.repeat) toggleNode(+e.key); return true; }
    if ((e.key === 'r' || e.key === 'R') && !e.repeat) return reset();
    return false;
  }
  function click(hit) { let o = hit?.object; while (o && !o.userData.node) o = o.parent; if (o) toggleNode(o.userData.node); }
  function demo() { if (!st.train) toggleTrain(); }
  themeHooks.push(() => render());
  render();
  return { group: g0, key, click, tick, readout, demo,
    stop: () => { if (st.train) toggleTrain(); },
    panel: [['Train', 'space', toggleTrain], ['Pull node 3', '3', () => toggleNode(3)], ['Reset steps', 'R', reset]],
    view: { target: W(160, 80, 105), dist: innerWidth < 720 ? 5.2 : 9.4 },     // the shell scales this up by 1.45 / aspect on tall screens
    info: '<h2>GPU training cluster</h2><p>Four nodes with four GPUs each, training Llama-3.1-8B with DeepSpeed ZeRO-3. Press <b>space</b> to train: every GPU computes, gradients travel the all-reduce ring over the roofs, and the loss curve on the console drops. Click a node or press 1–4 to pull its power: the synchronous ring stalls until it is back.</p>',
    hint: 'space trains · click a node or 1–4 to power it · R resets' };
})() });
