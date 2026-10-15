const WORK = process.env.WORK || '/home/claude/work';
// Core engine: canvas, fonts, timing, easing, drawing primitives
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const FD = path.join(__dirname, 'node_modules/pretendard/dist/public/static/');
const W = { 4: 'Regular', 5: 'Medium', 6: 'SemiBold', 7: 'Bold', 8: 'ExtraBold', 9: 'Black' };
for (const [k, v] of Object.entries(W)) GlobalFonts.registerFromPath(FD + `Pretendard-${v}.otf`, 'P' + k);
const font = (w, size) => `${size}px P${w}`;

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const TL = JSON.parse(fs.readFileSync(WORK + '/audio/timeline.json', 'utf8'));
const SUBS = JSON.parse(fs.readFileSync(WORK + '/audio/subs.json', 'utf8'));
const SEG = {}; TL.segments.forEach(s => SEG[s.id] = s);
const S = id => { if (!SEG[id]) throw new Error('no seg ' + id); return SEG[id].start; };
const E = id => SEG[id].end;
// time at which a substring is spoken inside segment (estimated)
function Wt(id, sub, frac = 0) {
  const s = SEG[id];
  if (s.parts) for (const p of s.parts) if (p.lang === 'en' && p.text.includes(sub)) return p.start + (p.end - p.start) * frac;
  const txt = s.sub || ''; let i = txt.indexOf(sub); if (i < 0) i = 0;
  if (s.kind === 'N') { // english: weight by chars
    return s.start + (s.end - s.start) * ((i + sub.length * frac) / txt.length);
  }
  return s.start + (s.end - s.start) * ((i + sub.length * frac) / Math.max(1, txt.length));
}

// ---------- math / easing ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, d = 0.5) => clamp((t - a) / d);
const Ease = {
  out: k => 1 - Math.pow(1 - k, 3),
  inOut: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  in: k => k * k * k,
  back: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  elastic: k => k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};
const ep = (t, a, d = 0.5, e = 'out') => Ease[e](prog(t, a, d));
// fade window: in at a, out at b
const win = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(ep(t, a, fi), 1 - ep(t, b - fo, fo, 'inOut'));

// ---------- palette ----------
const C = {
  bg: '#FBF7EF', bg2: '#F3EDE2', ink: '#1C2840', ink2: '#56607A', mute: '#9AA2B5',
  navy: '#1F2A44', blue: '#2F7BF6', blueL: '#E1EDFF', blueD: '#1A56C4',
  orange: '#FF7A2F', orangeL: '#FFE7D6', orangeD: '#D9591A',
  yellow: '#FFC83D', yellowL: '#FFF2C7', green: '#20B07A', greenL: '#DDF6EC', red: '#F0525A', redL: '#FFE1E2',
  teal: '#11A7A0', tealL: '#D9F5F3', violet: '#7B5CF5', violetL: '#ECE6FF',
  white: '#FFFFFF', skin: '#F6CFAE', skin2: '#E9B48C', wood: '#C99A68', woodD: '#A97B4C',
};

// ---------- primitives ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, fill, stroke, lw = 3) {
  rr(ctx, x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function shadowOn(ctx, blur = 24, oy = 8, col = 'rgba(30,40,70,0.16)') { ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; ctx.shadowOffsetX = 0; }
function shadowOff(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function text(ctx, s, x, y, size, color = C.ink, w = 7, align = 'center', alpha = 1, base = 'middle') {
  if (alpha <= 0) return 0;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font(w, size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y); const m = ctx.measureText(s).width; ctx.restore(); return m;
}
const _mc = createCanvas(10, 10).getContext('2d');
function measure(s, size, w = 7) { _mc.font = font(w, size); return _mc.measureText(s).width; }
// text with typewriter reveal (chars)
function typeText(ctx, s, x, y, size, color, w, k, align = 'center') {
  const n = Math.floor(s.length * clamp(k)); text(ctx, s.slice(0, n), x, y, size, color, w, align);
}
// scale around point
function withT(ctx, x, y, sc, rot, alpha, fn) {
  if (alpha <= 0.001 || sc <= 0.001) return;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sc !== 1) ctx.scale(sc, sc); ctx.globalAlpha *= alpha; fn(); ctx.restore();
}
// popping element: returns {sc, a} given appear time
function pop(t, a, d = 0.45) { const k = prog(t, a, d); return { sc: k <= 0 ? 0 : Ease.back(k) * 0.999 + 0.001, a: clamp(k * 2.5) }; }

// quadratic arrow; returns point at apex for labels
function arrow(ctx, x1, y1, x2, y2, bend, color, k = 1, lw = 6, dashed = false, head = 20) {
  if (k <= 0) return null;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const cx = mx - dy / L * bend, cy = my + dx / L * bend;
  const N = 40, pts = [];
  for (let i = 0; i <= N * k; i++) { const u = i / N; pts.push([(1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2]); }
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash([lw * 2, lw * 1.8]);
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
  if (k > 0.85 && pts.length > 2) {
    const a = pts[pts.length - 1], b = pts[pts.length - 3]; const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
    const hs = head * Ease.back(clamp((k - 0.85) / 0.15));
    ctx.beginPath(); ctx.moveTo(a[0] + Math.cos(ang) * hs * 0.3, a[1] + Math.sin(ang) * hs * 0.3);
    ctx.lineTo(a[0] - Math.cos(ang - 0.5) * hs, a[1] - Math.sin(ang - 0.5) * hs);
    ctx.lineTo(a[0] - Math.cos(ang + 0.5) * hs, a[1] - Math.sin(ang + 0.5) * hs); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const u = 0.5; return { x: (1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2, y: (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2 };
}
// straight block arrow (fat)
function fatArrow(ctx, x, y, len, color, k = 1, dir = 1, th = 26) {
  if (k <= 0) return; const l = len * k;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(0, -th / 2); ctx.lineTo(Math.max(0, l - th), -th / 2); ctx.lineTo(Math.max(0, l - th), -th); ctx.lineTo(l, 0);
  ctx.lineTo(Math.max(0, l - th), th); ctx.lineTo(Math.max(0, l - th), th / 2); ctx.lineTo(0, th / 2); ctx.closePath(); ctx.fill(); ctx.restore();
}

// chip styles
const KIND = {
  core: { bg: C.navy, fg: '#fff', bd: null },
  noun: { bg: C.blueL, fg: C.blueD, bd: C.blue },
  act: { bg: C.orangeL, fg: C.orangeD, bd: C.orange },
  plain: { bg: null, fg: C.ink, bd: null },
  ghost: { bg: '#fff', fg: C.ink, bd: '#D5D9E3' },
  hl: { bg: C.yellowL, fg: '#8A5A00', bd: C.yellow },
  ving: { bg: C.tealL, fg: '#0B6F6A', bd: C.teal },
  pp: { bg: C.violetL, fg: '#4B32B8', bd: C.violet },
  good: { bg: C.greenL, fg: '#0E7A52', bd: C.green },
  bad: { bg: C.redL, fg: '#B4232B', bd: C.red },
  kor: { bg: '#fff', fg: C.ink, bd: '#CBD2DF' },
};

/**
 * Sentence row with grouped capsules and smooth reflow.
 * items: [{key, text, kind, g (group), at (appear time), out (disappear time)}]
 * returns map key -> {x,y,w,h,cx,top,bot,a}
 */
function sentenceRow(ctx, t, items, cx, cy, size = 54, opt = {}) {
  const padX = opt.padX ?? size * 0.42, h = opt.h ?? size * 1.65, gapG = opt.gapG ?? size * 0.32, w8 = opt.weight ?? 7;
  const sp = measure(' ', size, w8);
  // presence
  const pr = items.map(it => {
    let p = it.at === undefined ? 1 : ep(t, it.at, 0.55, 'inOut');
    if (it.out !== undefined) p *= 1 - ep(t, it.out, 0.45, 'inOut');
    return p;
  });
  // widths
  const tw = items.map(it => measure(it.text, size, w8));
  // compute layout with groups
  let x = 0; const pos = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i], prev = items[i - 1];
    const sameG = prev && prev.g !== undefined && prev.g === it.g;
    const lead = i === 0 ? 0 : (sameG ? sp : gapG + (KIND[it.kind]?.bg || KIND[prev?.kind]?.bg ? padX * 2 : 0));
    // first in group gets left pad
    x += lead * pr[i];
    pos.push({ x, w: tw[i] });
    x += tw[i] * pr[i];
  }
  const total = x; const x0 = cx - total / 2;
  const out = {};
  // draw capsules per group run
  let i = 0;
  while (i < items.length) {
    let j = i; while (j + 1 < items.length && items[j + 1].g !== undefined && items[j + 1].g === items[i].g) j++;
    const k = items[i].kind, st = KIND[k] || KIND.plain;
    const a = Math.max(...pr.slice(i, j + 1));
    if (st.bg && a > 0.01) {
      const left = x0 + pos[i].x - padX, right = x0 + pos[j].x + pos[j].w * pr[j] + padX;
      const sc = opt.noPop ? 1 : (0.75 + 0.25 * Ease.back(clamp(pr[i])));
      ctx.save(); ctx.globalAlpha *= clamp(a * 1.5);
      const cxg = (left + right) / 2; ctx.translate(cxg, cy); ctx.scale(sc, sc); ctx.translate(-cxg, -cy);
      if (opt.shadow !== false) shadowOn(ctx, 18, 6, 'rgba(30,40,70,0.13)');
      fillRR(ctx, left, cy - h / 2, right - left, h, opt.r ?? 18, st.bg); shadowOff(ctx);
      if (st.bd) { rr(ctx, left, cy - h / 2, right - left, h, opt.r ?? 18); ctx.strokeStyle = st.bd; ctx.lineWidth = 3.5; ctx.stroke(); }
      ctx.restore();
    }
    i = j + 1;
  }
  items.forEach((it, i) => {
    const st = KIND[it.kind] || KIND.plain; const p = pr[i];
    const X = x0 + pos[i].x;
    if (p > 0.02) {
      ctx.save(); ctx.globalAlpha *= clamp(p * 1.4); ctx.font = font(w8, size); ctx.fillStyle = it.color || st.fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      // clip text while growing
      ctx.beginPath(); ctx.rect(X - 4, cy - h, pos[i].w * p + 8, h * 2); ctx.clip();
      ctx.fillText(it.text, X, cy + size * 0.03); ctx.restore();
      if (it.mark) { // underline mark
        const mk = ep(t, it.mark.at, 0.4); ctx.save(); ctx.strokeStyle = it.mark.color; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(X, cy + size * 0.62); ctx.lineTo(X + pos[i].w * mk, cy + size * 0.62); ctx.stroke(); ctx.restore();
      }
    }
    out[it.key || it.text] = { x: X, w: pos[i].w, cx: X + pos[i].w / 2, y: cy, top: cy - h / 2, bot: cy + h / 2, a: p };
  });
  out._total = total; out._x0 = x0;
  return out;
}

// karaoke-style highlight of an english sentence while spoken
function karaoke(ctx, t, s, segId, cx, cy, size, base = C.ink, hi = C.orange, w = 7) {
  const seg = SEG[segId]; const k = clamp((t - seg.start) / (seg.end - seg.start));
  const words = s.split(' '); const total = s.length;
  const tw = measure(s, size, w); let x = cx - tw / 2; let acc = 0;
  ctx.save(); ctx.font = font(w, size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  words.forEach((wd, i) => {
    const st = acc / total, en = (acc + wd.length) / total; acc += wd.length + 1;
    const on = k >= st && k > 0 && t < seg.end + 0.3 ? 1 : 0;
    const done = t > seg.end + 0.3;
    ctx.fillStyle = (on && !done) ? hi : base;
    const lift = (on && !done && k < en + 0.05) ? -6 : 0;
    ctx.fillText(wd, x, cy + lift); x += measure(wd + ' ', size, w);
  });
  ctx.restore();
}

module.exports = { createCanvas, font, WIDTH, HEIGHT, FPS, TL, SUBS, SEG, S, E, Wt, clamp, lerp, prog, Ease, ep, win, C, rr, fillRR, shadowOn, shadowOff, text, measure, typeText, withT, pop, arrow, fatArrow, KIND, sentenceRow, karaoke };
