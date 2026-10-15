// Flat-style characters and props
const { C, rr, fillRR, clamp, lerp, Ease, text, shadowOn, shadowOff } = require('./engine');

function limb(ctx, x1, y1, len, ang, lw, col) {
  const x2 = x1 + Math.sin(ang) * len, y2 = y1 + Math.cos(ang) * len;
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  return [x2, y2];
}
// two-segment limb (with elbow/knee)
function limb2(ctx, x1, y1, l1, a1, l2, a2, lw, col) {
  const [ex, ey] = limb(ctx, x1, y1, l1, a1, lw, col);
  return limb(ctx, ex, ey, l2, a2, lw * 0.92, col);
}

/**
 * person: o.x,o.y = feet center; o.s scale. Angles: 0 = straight down, positive = toward facing direction (forward).
 */
function person(ctx, o) {
  const s = o.s ?? 1, f = o.face ?? 1;
  const kid = !!o.kid;
  const H = kid ? 0.72 : 1;
  ctx.save(); ctx.translate(o.x, o.y + (o.bob || 0)); ctx.scale(s * f, s);
  const skin = o.skin || C.skin, shirt = o.shirt || C.blue, pants = o.pants || '#36415E', shoe = o.shoe || '#2A2F3E';
  const hipY = -125 * H, shY = -235 * H, legL = 125 * H, armL = 100 * H;
  const torsoW = (kid ? 74 : 88), lw = kid ? 22 : 25;
  const aL = o.armB ?? -0.15, aR = o.armF ?? 0.15, lB = o.legB ?? 0, lF = o.legF ?? 0;
  const elb = o.elbow ?? 0, elbB = o.elbowB ?? 0, knee = o.knee ?? 0;
  // back limbs (darker)
  const dk = c => shade(c, -0.18);
  // back leg
  limb2(ctx, -14, hipY, legL * 0.52, lB, legL * 0.5, lB - knee, lw + 2, dk(pants));
  const bl = footPos(-14, hipY, legL, lB, knee);
  ctx.fillStyle = shoe; ctx.beginPath(); ctx.ellipse(bl[0] + 9, bl[1] + 2, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
  // back arm
  const ba = limb2(ctx, -torsoW / 2 + 10, shY + 14, armL * 0.5, aL, armL * 0.5, aL + elbB, lw - 3, dk(shirt));
  ctx.fillStyle = dk(skin); ctx.beginPath(); ctx.arc(ba[0], ba[1], 12, 0, 7); ctx.fill();
  if (o.backHand) o.backHand(ctx, ba[0], ba[1]);
  // torso
  if (o.coat) { fillRR(ctx, -torsoW / 2 - 4, shY - 6, torsoW + 8, (hipY - shY) + 40, 30, o.coat); }
  else fillRR(ctx, -torsoW / 2, shY - 6, torsoW, (hipY - shY) + 22, 30, shirt);
  if (o.apron) { fillRR(ctx, -torsoW / 2 + 10, shY + 30, torsoW - 20, (hipY - shY) + 0, 12, '#fff'); }
  if (o.tie) { ctx.fillStyle = o.tie; ctx.beginPath(); ctx.moveTo(-6, shY); ctx.lineTo(6, shY); ctx.lineTo(9, shY + 55); ctx.lineTo(0, shY + 66); ctx.lineTo(-9, shY + 55); ctx.closePath(); ctx.fill(); }
  // front leg
  limb2(ctx, 12, hipY, legL * 0.52, lF, legL * 0.5, lF - knee, lw + 2, pants);
  const fl = footPos(12, hipY, legL, lF, knee);
  ctx.fillStyle = shoe; ctx.beginPath(); ctx.ellipse(fl[0] + 9, fl[1] + 2, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
  // hips cover
  fillRR(ctx, -torsoW / 2 + 4, hipY - 18, torsoW - 8, 30, 12, o.coat || pants);
  // head
  const hr = kid ? 44 : 42; const hy = shY - hr - 6;
  ctx.save(); ctx.translate(0, hy); ctx.rotate(o.tilt || 0);
  drawHair(ctx, o, hr, 'back');
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
  // ear
  ctx.beginPath(); ctx.arc(-hr * 0.9, 4, 9, 0, 7); ctx.fill();
  face(ctx, o, hr);
  drawHair(ctx, o, hr, 'front');
  if (o.hat) hat(ctx, o.hat, hr);
  ctx.restore();
  // front arm (on top)
  const fa = limb2(ctx, torsoW / 2 - 10, shY + 14, armL * 0.5, aR, armL * 0.5, aR + elb, lw - 3, shirt === o.coat ? shirt : (o.coat || shirt));
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(fa[0], fa[1], 12, 0, 7); ctx.fill();
  if (o.hand) o.hand(ctx, fa[0], fa[1]);
  ctx.restore();
}
function footPos(x, y, L, a, knee) {
  const kx = x + Math.sin(a) * L * 0.52, ky = y + Math.cos(a) * L * 0.52;
  return [kx + Math.sin(a - knee) * L * 0.5, ky + Math.cos(a - knee) * L * 0.5];
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}
function face(ctx, o, hr) {
  const ex = o.look || 0; const blink = o.blink ? 0.12 : 1;
  ctx.fillStyle = '#25202A';
  // eyes
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(hr * 0.22 + sx * hr * 0.33 + ex, -4, 5.5, 7.5 * blink, 0, 0, 7); ctx.fill();
  }
  if (o.glasses) {
    ctx.strokeStyle = '#2B2B33'; ctx.lineWidth = 3.5;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(hr * 0.22 + sx * hr * 0.33, -4, 13, 0, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(hr * 0.22 - hr * 0.33 + 13, -5); ctx.lineTo(hr * 0.22 + hr * 0.33 - 13, -5); ctx.stroke();
  }
  // brows
  ctx.strokeStyle = '#3A2A22'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const br = o.mood === 'worried' ? 0.25 : o.mood === 'surprised' ? -0.15 : 0;
  for (const sx of [-1, 1]) {
    ctx.beginPath(); const bx = hr * 0.22 + sx * hr * 0.33;
    ctx.moveTo(bx - 9, -20 - (o.mood === 'surprised' ? 6 : 0) + sx * br * 10); ctx.lineTo(bx + 9, -20 - (o.mood === 'surprised' ? 6 : 0) - sx * br * 10); ctx.stroke();
  }
  // cheeks
  ctx.fillStyle = 'rgba(255,120,120,0.28)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(hr * 0.22 + sx * hr * 0.45, 12, 8, 0, 7); ctx.fill(); }
  // mouth
  const mx = hr * 0.22, my = 18; const m = o.mouth || 'smile';
  ctx.strokeStyle = '#5A2A2A'; ctx.lineWidth = 4;
  if (m === 'smile') { ctx.beginPath(); ctx.arc(mx, my - 6, 10, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  else if (m === 'big') { ctx.fillStyle = '#7A2E35'; ctx.beginPath(); ctx.arc(mx, my - 4, 14, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(mx - 10, my - 4, 20, 5); }
  else if (m === 'open' || m === 'o') { ctx.fillStyle = '#7A2E35'; ctx.beginPath(); ctx.ellipse(mx, my, m === 'o' ? 7 : 9, m === 'o' ? 9 : 7 + (o.talk || 0) * 5, 0, 0, 7); ctx.fill(); }
  else if (m === 'flat') { ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.stroke(); }
  else if (m === 'wavy') { ctx.beginPath(); ctx.moveTo(mx - 11, my); ctx.quadraticCurveTo(mx - 5, my - 6, mx, my); ctx.quadraticCurveTo(mx + 5, my + 6, mx + 11, my); ctx.stroke(); }
  if (o.mustache) { ctx.fillStyle = '#3A2A22'; ctx.beginPath(); ctx.ellipse(mx - 7, my - 9, 9, 4, 0.2, 0, 7); ctx.ellipse(mx + 7, my - 9, 9, 4, -0.2, 0, 7); ctx.fill(); }
}
function drawHair(ctx, o, hr, layer) {
  const hc = o.hair || '#3A2A22', st = o.hairStyle || 'short';
  ctx.fillStyle = hc;
  if (layer === 'back') {
    if (st === 'long') { rr(ctx, -hr * 1.05, -hr * 0.6, hr * 2.1, hr * 2.0, hr * 0.7); ctx.fill(); }
    if (st === 'bun') { ctx.beginPath(); ctx.arc(-hr * 0.5, -hr * 0.95, hr * 0.42, 0, 7); ctx.fill(); }
    return;
  }
  if (st === 'none') return;
  ctx.beginPath();
  if (st === 'spiky') {
    ctx.moveTo(-hr * 1.02, -2);
    const n = 6; for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; const r = i % 2 ? hr * 1.28 : hr * 1.05; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 4); }
    ctx.lineTo(hr * 1.0, -6); ctx.quadraticCurveTo(0, -hr * 0.55, -hr * 1.02, -2); ctx.fill(); return;
  }
  ctx.arc(0, 0, hr * 1.06, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(hr * 0.5, -hr * 0.5, -hr * 0.1, -hr * 0.45);
  ctx.quadraticCurveTo(-hr * 0.7, -hr * 0.3, -hr * 1.04, -2); ctx.fill();
  if (st === 'long') { ctx.beginPath(); ctx.ellipse(-hr * 0.8, hr * 0.3, hr * 0.32, hr * 0.8, 0.1, 0, 7); ctx.fill(); }
}
function hat(ctx, kind, hr) {
  if (kind === 'chef') {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#E3E6EE'; ctx.lineWidth = 3;
    fillRR(ctx, -hr * 0.8, -hr * 1.35, hr * 1.6, hr * 0.55, 8, '#fff', '#E3E6EE');
    ctx.beginPath(); ctx.arc(-hr * 0.45, -hr * 1.55, hr * 0.48, 0, 7); ctx.arc(hr * 0.1, -hr * 1.75, hr * 0.55, 0, 7); ctx.arc(hr * 0.55, -hr * 1.5, hr * 0.45, 0, 7); ctx.fill();
  } else if (kind === 'fedora') {
    ctx.fillStyle = '#4A3B33'; ctx.beginPath(); ctx.ellipse(0, -hr * 0.72, hr * 1.35, hr * 0.22, 0, 0, 7); ctx.fill();
    fillRR(ctx, -hr * 0.78, -hr * 1.45, hr * 1.56, hr * 0.8, 18, '#4A3B33');
    ctx.fillStyle = '#C0583A'; ctx.fillRect(-hr * 0.78, -hr * 0.92, hr * 1.56, hr * 0.16);
  } else if (kind === 'cap') {
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, -hr * 0.3, hr * 1.02, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hr * 0.8, -hr * 0.32, hr * 0.7, hr * 0.15, 0, 0, 7); ctx.fill();
  }
}

// ---------------- props ----------------
function door(ctx, x, y, w, h, o = {}) {
  // x,y bottom-left of opening
  const frame = o.frame ?? '#8B6A4A';
  fillRR(ctx, x - 14, y - h - 14, w + 28, h + 14, 6, frame);
  fillRR(ctx, x, y - h, w, h, 3, '#2B2622');
  const open = o.open || 0; const dw = w * (1 - open * 0.75);
  const col = o.color || C.wood;
  ctx.save();
  fillRR(ctx, x, y - h, dw, h, 3, col);
  if (o.paint) { // paint from top
    const ph = h * clamp(o.paint);
    ctx.save(); rr(ctx, x, y - h, dw, h, 3); ctx.clip();
    ctx.fillStyle = o.paintColor || C.blue; ctx.beginPath(); ctx.moveTo(x, y - h);
    ctx.lineTo(x + dw, y - h); ctx.lineTo(x + dw, y - h + ph);
    for (let i = 10; i >= 0; i--) { const xx = x + dw * i / 10; ctx.lineTo(xx, y - h + ph + Math.sin(i * 1.7) * 8); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // panels
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 4;
  rr(ctx, x + dw * 0.15, y - h * 0.9, dw * 0.7, h * 0.35, 6); ctx.stroke();
  rr(ctx, x + dw * 0.15, y - h * 0.48, dw * 0.7, h * 0.38, 6); ctx.stroke();
  ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.arc(x + dw * 0.86, y - h * 0.5, Math.max(5, w * 0.045), 0, 7); ctx.fill();
  ctx.restore();
  if (o.shake) { /* handled by caller transform */ }
}
function house(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const wall = o.wall || '#FFE3C2', roof = o.roof || '#E8644A';
  fillRR(ctx, -110, -170, 220, 170, 10, wall);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-140, -160); ctx.lineTo(0, -270); ctx.lineTo(140, -160); ctx.closePath(); ctx.fill();
  fillRR(ctx, -95, -165, 190, 14, 4, shade(roof, -0.15));
  fillRR(ctx, -25, -95, 50, 95, 6, o.door || '#8B5E3C');
  for (const sx of [-1, 1]) { fillRR(ctx, sx * 70 - 25, -130, 50, 46, 6, o.lit ? '#FFE680' : '#BFE1FF'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx * 70, -130); ctx.lineTo(sx * 70, -84); ctx.moveTo(sx * 70 - 25, -107); ctx.lineTo(sx * 70 + 25, -107); ctx.stroke(); }
  if (o.chimney !== false) fillRR(ctx, 55, -260, 30, 60, 4, shade(roof, -0.25));
  ctx.restore();
}
function sparkle(ctx, x, y, r, col = C.yellow, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const rr2 = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function flower(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#3BA55C'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke();
  ctx.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 11, -40 + Math.sin(a) * 11, 9, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#FFD84D'; ctx.beginPath(); ctx.arc(0, -40, 7, 0, 7); ctx.fill(); ctx.restore();
}
function hill(ctx, cx, y, w, h, col = '#7CCB7A') {
  if (h <= 1) return;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - w / 2, y);
  ctx.bezierCurveTo(cx - w * 0.3, y - h * 1.05, cx + w * 0.3, y - h * 1.05, cx + w / 2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, 0.15); ctx.beginPath(); ctx.ellipse(cx - w * 0.12, y - h * 0.62, w * 0.12, h * 0.1, -0.2, 0, 7); ctx.fill();
}
function car(ctx, x, y, s = 1, col = C.orange, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.face || 1), s);
  ctx.fillStyle = col; rr(ctx, -150, -95, 300, 70, 26); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-90, -92); ctx.lineTo(-55, -150); ctx.lineTo(55, -150); ctx.lineTo(100, -92); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#CFE8FF'; ctx.beginPath(); ctx.moveTo(-72, -95); ctx.lineTo(-48, -138); ctx.lineTo(-5, -138); ctx.lineTo(-5, -95); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -95); ctx.lineTo(5, -138); ctx.lineTo(48, -138); ctx.lineTo(80, -95); ctx.closePath(); ctx.fill();
  if (o.driver) { // simple head in window
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(30, -112, 18, 0, 7); ctx.fill();
    ctx.fillStyle = '#3A2A22'; ctx.beginPath(); ctx.arc(30, -118, 18, Math.PI, 0); ctx.fill();
  }
  ctx.fillStyle = '#FFE680'; fillRR(ctx, 135, -80, 16, 18, 5, '#FFE680');
  for (const wx of [-90, 90]) { ctx.fillStyle = '#2A2F3E'; ctx.beginPath(); ctx.arc(wx, -25, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#BFC6D6'; ctx.beginPath(); ctx.arc(wx, -25, 12, 0, 7); ctx.fill(); }
  ctx.restore();
}
function clock(ctx, x, y, r, t, speed = 1) {
  ctx.save(); ctx.translate(x, y);
  shadowOn(ctx, 16, 6); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); shadowOff(ctx);
  ctx.strokeStyle = C.orange; ctx.lineWidth = r * 0.1; ctx.stroke();
  ctx.fillStyle = C.ink; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.04, 0, 7); ctx.fill(); }
  ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
  const a1 = t * speed * 0.5, a2 = t * speed * 6;
  ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a1) * r * 0.45, -Math.cos(a1) * r * 0.45); ctx.stroke();
  ctx.lineWidth = r * 0.05; ctx.strokeStyle = C.orange; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a2) * r * 0.7, -Math.cos(a2) * r * 0.7); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, r * 0.07, 0, 7); ctx.fill();
  ctx.restore();
}
function sofa(ctx, x, y, s = 1, col = '#6C8CD5') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -170, -170, 340, 110, 30, shade(col, -0.1));
  fillRR(ctx, -190, -100, 380, 80, 26, col);
  fillRR(ctx, -205, -140, 50, 120, 22, shade(col, -0.18)); fillRR(ctx, 155, -140, 50, 120, 22, shade(col, -0.18));
  ctx.fillStyle = '#5A4636'; ctx.fillRect(-170, -22, 16, 22); ctx.fillRect(154, -22, 16, 22);
  ctx.restore();
}
function giftBox(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -32, -26, 64, 52, 6, '#F0525A'); fillRR(ctx, -36, -36, 72, 16, 5, '#D63A44');
  ctx.fillStyle = C.yellow; ctx.fillRect(-6, -36, 12, 62);
  ctx.beginPath(); ctx.ellipse(-12, -42, 13, 8, -0.5, 0, 7); ctx.ellipse(12, -42, 13, 8, 0.5, 0, 7); ctx.fill();
  ctx.restore();
}
function umbrella(ctx, x, y, s = 1, open = 1, col = C.blue) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#3A3F52'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -170); ctx.stroke();
  ctx.beginPath(); ctx.arc(-10, 0, 10, 0, Math.PI); ctx.stroke();
  const wdt = lerp(18, 120, open);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-wdt, -150 + (1 - open) * 40);
  ctx.quadraticCurveTo(0, -260 + (1 - open) * 40, wdt, -150 + (1 - open) * 40);
  const n = 4; for (let i = n; i >= 0; i--) { const xx = -wdt + 2 * wdt * i / n; ctx.quadraticCurveTo(xx + wdt / n, -138 + (1 - open) * 40, xx, -150 + (1 - open) * 40); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function cup(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(200,230,255,0.55)'; ctx.strokeStyle = '#9CC7EA'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-55, -150); ctx.lineTo(55, -150); ctx.lineTo(42, 0); ctx.lineTo(-42, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.drink || '#F2A541'; ctx.beginPath(); ctx.moveTo(-50, -110); ctx.lineTo(50, -110); ctx.lineTo(42, -4); ctx.lineTo(-42, -4); ctx.closePath(); ctx.fill();
  if (o.ice) { const k = o.ice; ctx.globalAlpha *= k; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.strokeStyle = '#BFE2FF';
    [[-22, -95, 0.2], [14, -88, -0.3], [-4, -60, 0.1]].forEach(([ix, iy, r]) => { ctx.save(); ctx.translate(ix, iy); ctx.rotate(r); fillRR(ctx, -16, -16, 32, 32, 6, 'rgba(255,255,255,0.85)', '#BFE2FF', 3); ctx.restore(); }); ctx.globalAlpha /= (k || 1); }
  ctx.strokeStyle = '#E8644A'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(20, -150); ctx.lineTo(40, -215); ctx.stroke();
  ctx.restore();
}
function note(ctx, x, y, s, col = C.violet) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, -0.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(10, -48); ctx.quadraticCurveTo(22, -40, 28, -26); ctx.stroke(); ctx.restore();
}
function pot(ctx, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -70, -80, 140, 80, 18, '#8B95A8'); fillRR(ctx, -80, -92, 160, 18, 8, '#6D778A');
  fillRR(ctx, -100, -70, 30, 12, 6, '#6D778A'); fillRR(ctx, 70, -70, 30, 12, 6, '#6D778A');
  ctx.strokeStyle = 'rgba(160,170,190,0.6)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const ph = t * 2 + i; ctx.beginPath(); ctx.moveTo(-30 + i * 30, -100);
    ctx.bezierCurveTo(-45 + i * 30 + Math.sin(ph) * 10, -130, -15 + i * 30 - Math.sin(ph) * 10, -150, -30 + i * 30, -180); ctx.stroke(); }
  ctx.restore();
}
function plate(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#DDE2EC'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 120, 40, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#F2A541'; ctx.beginPath(); ctx.ellipse(-20, -14, 55, 22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3BA55C'; ctx.beginPath(); ctx.arc(40, -16, 16, 0, 7); ctx.arc(55, -8, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#E8644A'; ctx.beginPath(); ctx.arc(20, -22, 10, 0, 7); ctx.fill();
  ctx.restore();
}
function letter(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shadowOn(ctx, 14, 5); fillRR(ctx, -90, -120, 180, 240, 10, '#fff'); shadowOff(ctx);
  text(ctx, 'Dear Mom,', -70, -88, 22, C.ink, 7, 'left');
  ctx.strokeStyle = '#C9D0DE'; ctx.lineWidth = 4; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-70, -50 + i * 28); ctx.lineTo(70 - (i === 5 ? 60 : 0), -50 + i * 28); ctx.stroke(); }
  ctx.restore();
}
function sleepingBag(ctx, x, y, s = 1, person = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -170, -70, 340, 90, 45, '#11A7A0');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5; for (let i = -120; i <= 120; i += 60) { ctx.beginPath(); ctx.moveTo(i, -66); ctx.lineTo(i, 16); ctx.stroke(); }
  fillRR(ctx, -190, -76, 80, 100, 40, '#0E8C86');
  if (person > 0) { ctx.globalAlpha *= person; ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(-150, -40, 36, 0, 7); ctx.fill(); ctx.fillStyle = '#3A2A22'; ctx.beginPath(); ctx.arc(-158, -48, 36, Math.PI * 0.9, Math.PI * 1.9); ctx.fill();
    ctx.strokeStyle = '#25202A'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(-150, -36, 6, 0.1, Math.PI - 0.1); ctx.stroke(); ctx.beginPath(); ctx.arc(-132, -36, 6, 0.1, Math.PI - 0.1); ctx.stroke(); }
  ctx.restore();
}
function leaf(ctx, x, y, s, rot, col = '#E8873A') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(16, 0, 0, 20); ctx.quadraticCurveTo(-16, 0, 0, -20); ctx.fill();
  ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); ctx.restore();
}
function tree(ctx, x, y, s = 1, col = '#F0A04B') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -18, -160, 36, 160, 10, '#8B5E3C');
  ctx.fillStyle = col; [[0, -230, 90], [-70, -190, 65], [70, -190, 65], [-40, -270, 60], [45, -265, 62]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); });
  ctx.restore();
}
function brush(ctx, x, y, s = 1, rot = 0, col = C.blue) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  fillRR(ctx, -10, -150, 20, 110, 8, '#C99A68'); fillRR(ctx, -24, -48, 48, 22, 4, '#AEB6C6'); fillRR(ctx, -24, -28, 48, 40, 8, col);
  ctx.restore();
}
function mic(ctx, x, y, s = 1, col = C.orange) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -24, -70, 48, 80, 24, col);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -10, 38, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, 52); ctx.moveTo(-22, 52); ctx.lineTo(22, 52); ctx.stroke();
  ctx.restore();
}
// train pieces
function engine(ctx, x, y, w, h, col = C.navy) {
  // x,y = bottom-left
  fillRR(ctx, x, y - h, w, h, 18, col);
  fillRR(ctx, x + w * 0.62, y - h - 70, w * 0.32, 80, 12, shade(col, 0.12));
  fillRR(ctx, x + w * 0.66, y - h - 58, w * 0.24, 40, 6, '#BFE1FF');
  fillRR(ctx, x + w * 0.12, y - h - 46, 36, 52, 6, shade(col, 0.2));
  ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(x - 6, y - h * 0.15); ctx.lineTo(x - 40, y); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
}
function wheels(ctx, x, w, y, t, n = 2) {
  for (let i = 0; i < n; i++) {
    const wx = x + w * (0.22 + 0.56 * i / Math.max(1, n - 1));
    ctx.fillStyle = '#2A2F3E'; ctx.beginPath(); ctx.arc(wx, y, 24, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9AA2B5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx, y); ctx.lineTo(wx + Math.cos(t * 6) * 16, y + Math.sin(t * 6) * 16); ctx.stroke();
  }
}
function smoke(ctx, x, y, t, a = 1) {
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.7 + i / 4) % 1; ctx.fillStyle = `rgba(190,198,214,${(1 - ph) * 0.6 * a})`;
    ctx.beginPath(); ctx.arc(x - ph * 60, y - ph * 120, 14 + ph * 26, 0, 7); ctx.fill();
  }
}
function bubble(ctx, x, y, w, h, tailX, tailY, fill = '#fff', stroke = '#D5D9E3') {
  shadowOn(ctx, 18, 6, 'rgba(30,40,70,0.12)');
  ctx.fillStyle = fill; rr(ctx, x, y, w, h, 26); ctx.fill(); shadowOff(ctx);
  ctx.beginPath(); ctx.moveTo(x + w * 0.25, y + h - 2); ctx.lineTo(tailX, tailY); ctx.lineTo(x + w * 0.42, y + h - 2); ctx.closePath(); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 26); ctx.stroke(); }
}
function check(ctx, x, y, r, col = C.green, k = 1) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 0.1, r * 0.35); if (k > 0.5) ctx.lineTo(r * 0.5, -r * 0.35); ctx.stroke(); ctx.restore();
}
function cross(ctx, x, y, r, col = C.red) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.38, -r * 0.38); ctx.lineTo(r * 0.38, r * 0.38); ctx.moveTo(r * 0.38, -r * 0.38); ctx.lineTo(-r * 0.38, r * 0.38); ctx.stroke(); ctx.restore();
}
function doorbellIcon(ctx, x, y, s, t, ringing) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -26, -40, 52, 80, 14, '#fff', '#C9D0DE', 3);
  ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
  if (ringing > 0) { ctx.strokeStyle = C.orange; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; ctx.globalAlpha = (1 - ph) * ringing; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(0, 0, 40 + ph * 60, sx > 0 ? -0.6 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke(); } } }
  ctx.restore();
}
module.exports = { person, shade, door, house, sparkle, flower, hill, car, clock, sofa, giftBox, umbrella, cup, note, pot, plate, letter, sleepingBag, leaf, tree, brush, mic, engine, wheels, smoke, bubble, check, cross, doorbellIcon };
