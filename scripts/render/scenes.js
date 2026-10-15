const E = require('./engine');
const { S, E: En, Wt, SEG, clamp, lerp, prog, Ease, ep, win, C, rr, fillRR, shadowOn, shadowOff, text, measure, withT, pop, arrow, fatArrow, KIND, sentenceRow, karaoke, font } = E;
const P = require('./chars');
const { person } = P;

// ---------- shared helpers ----------
function card(ctx, x, y, w, h, fill = '#fff', r = 28, sh = true) {
  if (sh) shadowOn(ctx, 30, 10, 'rgba(30,40,70,0.12)'); fillRR(ctx, x, y, w, h, r, fill); shadowOff(ctx);
}
function pill(ctx, s, x, y, size, bg, fg, w = 7, align = 'center') {
  const tw = measure(s, size, w); const pw = tw + size * 1.1, ph = size * 1.7;
  const x0 = align === 'center' ? x - pw / 2 : align === 'left' ? x : x - pw;
  fillRR(ctx, x0, y - ph / 2, pw, ph, ph / 2, bg); text(ctx, s, x0 + pw / 2, y + 1, size, fg, w); return pw;
}
function walk(t, sp = 1, amp = 0.5) { const a = Math.sin(t * sp * 2 * Math.PI) * amp; return { legF: a, legB: -a, armF: -a * 0.9, armB: a * 0.9, knee: Math.max(0, -Math.cos(t * sp * 2 * Math.PI)) * 0.4, bob: -Math.abs(Math.sin(t * sp * 2 * Math.PI)) * 8 }; }
function run(t, sp = 1.6) { const a = Math.sin(t * sp * 2 * Math.PI) * 0.85; return { legF: a, legB: -a, armF: -a * 1.1, armB: a * 1.1, elbow: -1.2, elbowB: -1.2, knee: 0.9, bob: -Math.abs(Math.sin(t * sp * 2 * Math.PI)) * 14, tilt: 0.12 }; }
const blinkAt = (t, seed = 0) => ((t + seed) % 3.7) < 0.12;
function floor(ctx, y, x0 = 0, x1 = 1920, col = 'rgba(28,40,64,0.10)') { ctx.fillStyle = col; ctx.fillRect(x0, y, x1 - x0, 6); }
function stars(ctx, x, y, t, a, n = 8, r = 160) {
  if (a <= 0) return; for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2 + t * 0.6; const rr2 = r * (0.7 + 0.3 * Math.sin(t * 3 + i));
    ctx.save(); ctx.globalAlpha *= a; P.sparkle(ctx, x + Math.cos(ang) * rr2, y + Math.sin(ang) * rr2 * 0.6, 14 + 6 * Math.sin(t * 4 + i), i % 2 ? C.yellow : C.orange, t + i); ctx.restore(); }
}
function badge(ctx, s, x, y, col, t, at, size = 34) { const p = pop(t, at); withT(ctx, x, y, p.sc, 0, p.a, () => pill(ctx, s, 0, 0, size, col, '#fff', 8)); }
// arcs between sentence items
function arcAbove(ctx, R, from, to, col, k, label, bendOv) {
  const a = R[from], b = R[to]; if (!a || !b || k <= 0) return;
  const ap = arrow(ctx, a.cx, a.top - 8, b.cx, b.top - 8, -(bendOv || Math.min(140, Math.abs(a.cx - b.cx) * 0.35 + 40)) * Math.sign(b.cx - a.cx || 1), col, k, 6);
  if (label && ap && k > 0.7) { const p = clamp((k - 0.7) / 0.3); withT(ctx, ap.x, ap.y - 34, Ease.back(p), 0, p, () => pill(ctx, label, 0, 0, 26, col, '#fff', 8)); }
}
function arcBelow(ctx, R, from, to, col, k, label) {
  const a = R[from], b = R[to]; if (!a || !b || k <= 0) return;
  const ap = arrow(ctx, a.cx, a.bot + 8, b.cx, b.bot + 8, Math.min(140, Math.abs(a.cx - b.cx) * 0.35 + 40) * Math.sign(b.cx - a.cx || 1), col, k, 6);
  if (label && ap && k > 0.7) { const p = clamp((k - 0.7) / 0.3); withT(ctx, ap.x, ap.y + 34, Ease.back(p), 0, p, () => pill(ctx, label, 0, 0, 26, col, '#fff', 8)); }
}
function wheelsUnder(ctx, R, keys, t, a) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a;
  keys.forEach(([k1, k2]) => { const r1 = R[k1], r2 = R[k2]; if (!r1 || !r2) return; const x0 = r1.x - 20, x1 = r2.x + r2.w + 20;
    [x0 + 34, x1 - 34].forEach(wx => { ctx.fillStyle = '#2A2F3E'; ctx.beginPath(); ctx.arc(wx, r1.bot + 14, 16, 0, 7); ctx.fill(); ctx.strokeStyle = '#9AA2B5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx, r1.bot + 14); ctx.lineTo(wx + Math.cos(t * 5) * 11, r1.bot + 14 + Math.sin(t * 5) * 11); ctx.stroke(); }); });
  // couplers
  for (let i = 0; i + 1 < keys.length; i++) { const r1 = R[keys[i][1]], r2 = R[keys[i + 1][0]]; if (!r1 || !r2) continue; ctx.fillStyle = '#2A2F3E'; ctx.fillRect(r1.x + r1.w + 18, r1.y - 4, r2.x - r1.x - r1.w - 36, 8); }
  ctx.restore();
}
function practiceUI(ctx, t, segN, segP, cx, cy) {
  // listen phase then your-turn ring
  const n = SEG[segN], p = SEG[segP];
  if (t >= n.start - 0.3 && t < n.end + 0.3) {
    const a = win(t, n.start - 0.3, n.end + 0.3, 0.2, 0.2);
    withT(ctx, cx, cy, 1, 0, a, () => { pill(ctx, 'Listen', 0, 0, 30, C.navy, '#fff', 8); });
  }
  if (t >= p.start - 0.1 && t < p.end + 0.2) {
    const a = win(t, p.start - 0.1, p.end + 0.2, 0.2, 0.25); const k = clamp((t - p.start) / (p.end - p.start));
    withT(ctx, cx, cy, 1 + 0.04 * Math.sin(t * 8), 0, a, () => {
      ctx.fillStyle = '#fff'; shadowOn(ctx, 20, 6); ctx.beginPath(); ctx.arc(-150, 0, 46, 0, 7); ctx.fill(); shadowOff(ctx);
      ctx.strokeStyle = '#E8ECF3'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(-150, 0, 46, 0, 7); ctx.stroke();
      ctx.strokeStyle = C.orange; ctx.beginPath(); ctx.arc(-150, 0, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); ctx.stroke();
      P.mic(ctx, -150, 12, 0.42, C.orange);
      text(ctx, 'Your turn!', -80, -14, 40, C.orangeD, 9, 'left');
      text(ctx, '따라 말해 보세요', -80, 26, 26, C.ink2, 6, 'left');
    });
  }
}
function sfxPopsForRow(items, name = 'pop', g = 0.7) { return items.filter(i => i.at !== undefined).map(i => [i.at, name, g]); }

// =====================================================================
// 0. HOOK
// =====================================================================
const HOOK_WORDS = ['Open', 'the', 'door', 'with', 'a', 'smile', 'for', 'the', 'man', 'standing', 'outside.'];
const hookWordT = i => S('h1') + 0.25 + i * 0.26;
const hook = {
  id: 'hook',
  draw(ctx, t) {
    const h3 = S('h3'), reg = Wt('h3', '아주 짧은'), chunkT = Wt('h3', '설명 덩어리');
    // phase A: scattered long sentence
    const aA = 1 - ep(t, reg - 0.2, 0.5);
    if (aA > 0) {
      const size = 62, y = 400; const full = HOOK_WORDS.join(' '); let x = 960 - measure(full, size, 8) / 2;
      const stress = clamp((t - S('h1') - 2.5) / 3); const scatter = ep(t, S('h2'), 1.5, 'inOut') * (1 - ep(t, reg - 0.6, 0.5));
      HOOK_WORDS.forEach((w, i) => {
        const ww = measure(w, size, 8); const p = pop(t, hookWordT(i), 0.35);
        const jx = Math.sin(t * 23 + i * 3) * 3 * stress, jy = Math.cos(t * 19 + i) * 3 * stress;
        const sx = Math.sin(i * 7.1) * 90 * scatter, sy = Math.cos(i * 3.7) * 110 * scatter, rot = Math.sin(i * 5.3) * 0.25 * scatter;
        const col = scatter > 0.3 ? C.mute : C.ink;
        withT(ctx, x + ww / 2 + jx + sx, y + jy + sy, p.sc, rot, p.a * aA, () => text(ctx, w, 0, 0, size, col, 8));
        x += ww + measure(' ', size, 8);
      });
      // question marks
      const qa = ep(t, S('h2') + 0.3, 0.4) * aA;
      [[520, 250, -0.3], [1380, 270, 0.25], [760, 590, 0.15], [1220, 600, -0.2], [960, 210, 0]].forEach(([qx, qy, r], i) => {
        const p = pop(t, S('h2') + 0.4 + i * 0.25); withT(ctx, qx, qy + Math.sin(t * 3 + i) * 8, p.sc, r, p.a * aA, () => text(ctx, '?', 0, 0, 90, i % 2 ? C.orange : C.blue, 9));
      });
    }
    // learner character
    const la = win(t, S('h1') + 1.5, Wt('h4', '오늘은'), 0.5, 0.5);
    if (la > 0) {
      const happy = t > reg; const lx = 300, ly = 900;
      withT(ctx, 0, 0, 1, 0, la, () => {
        person(ctx, { x: lx, y: ly, s: 0.95, shirt: C.teal, hair: '#2F2622', hairStyle: 'short', mood: happy ? '' : 'worried', mouth: happy ? 'big' : 'wavy', armF: happy ? -2.6 : -2.2, elbow: happy ? 0 : -1.6, armB: -0.2, blink: blinkAt(t), tilt: happy ? 0 : -0.1 });
        if (!happy) { ctx.fillStyle = '#8CC8FF'; ctx.beginPath(); ctx.ellipse(lx + 52, ly - 360 + Math.sin(t * 4) * 4, 9, 14, 0, 0, 7); ctx.fill(); }
        else stars(ctx, lx, ly - 330, t, ep(t, reg, 0.5), 6, 90);
      });
    }
    // phase B: chunked sentence
    if (t > reg - 0.4 && t < Wt('h4', '그림으로') + 0.6) {
      const aB = 1 - ep(t, Wt('h4', '오늘은'), 0.6);
      const items = [
        { key: 'open', text: 'Open', kind: 'core', g: 0, at: reg }, { key: 'door', text: 'the door', kind: 'core', g: 0, at: reg },
        { key: 'smile', text: 'with a smile', kind: 'act', g: 1, at: chunkT }, { key: 'for', text: 'for the man', kind: 'act', g: 2, at: chunkT + 0.35 },
        { key: 'stand', text: 'standing outside.', kind: 'noun', g: 3, at: chunkT + 0.7 }];
      withT(ctx, 0, 0, 1, 0, aB, () => {
        const R = sentenceRow(ctx, t, items, 960, 420, 54);
        wheelsUnder(ctx, R, [['open', 'door'], ['smile', 'smile'], ['for', 'for'], ['stand', 'stand']], t, ep(t, chunkT + 1.2, 0.5));
        const lb = ep(t, reg + 0.3, 0.5); text(ctx, '짧은 핵심 문장', R.open.x + 80, R.open.top - 46, 30, C.navy, 8, 'center', lb);
        text(ctx, '+ 설명 덩어리', (R.smile.x + R.stand.x + R.stand.w) / 2, R.smile.top - 46, 30, C.orangeD, 8, 'center', ep(t, chunkT + 0.4, 0.5));
      });
    }
    // phase C: title
    const tT = Wt('h4', '오늘은');
    if (t > tT) {
      const k = ep(t, tT + 0.2, 0.7, 'back'); const up = ep(t, S('h5'), 0.8, 'inOut');
      const ty = lerp(430, 260, up), sc = lerp(1, 0.78, up);
      withT(ctx, 960, ty, sc * k, 0, clamp(k), () => {
        text(ctx, '영어 문장 확장의 원리', 0, -20, 104, C.ink, 9);
        const g = ctx.createLinearGradient(-420, 0, 420, 0); g.addColorStop(0, C.blue); g.addColorStop(1, C.orange);
        ctx.fillStyle = g; const ul = ep(t, tT + 0.7, 0.6); fillRR(ctx, -420, 50, 840 * ul, 14, 7, g);
      });
      const sk = ep(t, tT + 1.0, 0.6) * (1 - up);
      withT(ctx, 960, 610, 1, 0, sk, () => {
        let x = -360; [['핵심 문장', C.navy], ['+', null], ['설명 덩어리', C.orange], ['=', null], ['긴 문장', C.blue]].forEach(([s, c]) => {
          if (!c) { text(ctx, s, x + 24, 0, 52, C.ink2, 8); x += 48; return; }
          const w = pill(ctx, s, x, 0, 34, c, '#fff', 8, 'left'); x += w + 16; });
      });
      text(ctx, 'Easy to Understand · Easy to Remember · Easy to Use', 960, 720, 28, C.ink2, 6, 'center', sk);
    }
    // phase D: preview growth
    if (t > S('h5')) {
      const a = 1 - ep(t, En('h5') + 0.3, 0.4); const t0 = S('h5') + 0.6;
      const items = [{ key: 'i', text: 'I saw a man.', kind: 'core', g: 0, at: t0 },
        { key: 'st', text: 'standing outside', kind: 'noun', g: 1, at: t0 + 1.4 }, { key: 'um', text: 'with an umbrella', kind: 'noun', g: 2, at: t0 + 2.8 }];
      if (t > t0 + 1.4) items[0].text = 'I saw a man';
      withT(ctx, 0, 0, 1, 0, a, () => {
        const R = sentenceRow(ctx, t, items, 960, 560, 50);
        text(ctx, '짧게', R.i.cx, R.i.bot + 50, 30, C.ink2, 7, 'center', ep(t, t0, 0.4));
        text(ctx, '→ 길게!', R.um.cx, R.um.bot + 50, 30, C.blueD, 8, 'center', ep(t, t0 + 3, 0.4));
      });
    }
  },
  sfx() {
    const L = HOOK_WORDS.map((_, i) => [hookWordT(i), 'pop', 0.35]);
    L.push([Wt('h3', '아주 짧은') - 0.1, 'thud', 0.8], [Wt('h3', '설명 덩어리'), 'click', 0.6], [Wt('h3', '설명 덩어리') + 0.35, 'click', 0.6], [Wt('h3', '설명 덩어리') + 0.7, 'click', 0.6]);
    L.push([Wt('h4', '오늘은') - 0.6, 'riser', 0.7], [Wt('h4', '오늘은') + 0.25, 'sparkle', 0.8]);
    const t0 = S('h5') + 0.6; L.push([t0, 'pop', 0.5], [t0 + 1.4, 'click', 0.6], [t0 + 2.8, 'click', 0.6]);
    return L;
  },
};

// =====================================================================
// 1. FORMULA (train)
// =====================================================================
const formula = {
  id: 'formula',
  draw(ctx, t) {
    const f2 = S('f2'), f3 = S('f3'), car1T = Wt('f3', '설명 칸'), car2T = car1T + 0.9, f5 = S('f5'), f6 = S('f6'), f7 = S('f7');
    // label
    text(ctx, '오늘의 핵심 공식', 960, 190, 34, C.ink2, 7, 'center', win(t, S('f1') + 0.2, f3 + 1, 0.4, 0.5));
    // formula
    const up = ep(t, f3 + 0.2, 0.8, 'inOut'); const fa = 1 - ep(t, f5 - 0.3, 0.5);
    const fy = lerp(380, 175, up), fsc = lerp(1, 0.62, up);
    withT(ctx, 960, fy, fsc, 0, fa, () => {
      const p1 = pop(t, Wt('f2', '핵심')), p2 = pop(t, Wt('f2', '더하기')), p3 = pop(t, Wt('f2', '추가'));
      withT(ctx, -330, 0, p1.sc, 0, p1.a, () => { shadowOn(ctx); fillRR(ctx, -210, -70, 420, 140, 34, C.navy); shadowOff(ctx); text(ctx, '핵심 문장', 0, -8, 62, '#fff', 9); text(ctx, 'Core Sentence', 0, 42, 24, '#AFC0E0', 6); });
      withT(ctx, 0, 0, p2.sc, 0, p2.a, () => text(ctx, '+', 0, 0, 100, C.ink, 9));
      withT(ctx, 330, 0, p3.sc, 0, p3.a, () => { shadowOn(ctx); fillRR(ctx, -210, -70, 420, 140, 34, '#fff'); shadowOff(ctx); rr(ctx, -210, -70, 420, 140, 34); ctx.setLineDash([14, 10]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); text(ctx, '추가 정보', 0, -8, 62, C.ink, 9); text(ctx, 'Extra Information', 0, 42, 24, C.ink2, 6); });
    });
    // train
    if (t > f3) {
      const groundY = 800; const ex = lerp(-500, 330, ep(t, Wt('f3', '맨 앞에'), 1.4, 'out'));
      const moving = t < car2T + 1.2;
      // track
      ctx.fillStyle = '#C9B79C'; ctx.fillRect(0, groundY + 22, 1920, 10);
      ctx.fillStyle = 'rgba(140,110,80,0.35)'; for (let x = -((t * (moving ? 200 : 0)) % 60); x < 1920; x += 60) ctx.fillRect(x, groundY + 30, 30, 12);
      const ew = 380, eh = 170;
      P.engine(ctx, ex, groundY, ew, eh, C.navy); P.wheels(ctx, ex, ew, groundY, moving ? t : car2T + 1.2, 3); P.smoke(ctx, ex + ew * 0.78, groundY - eh - 75, t, 1);
      text(ctx, '핵심 문장', ex + ew * 0.42, groundY - eh / 2 - 4, 44, '#fff', 9, 'center', ep(t, Wt('f3', '핵심 문장'), 0.4));
      const cars = [[car1T, 'noun', f5, '명사 설명'], [car2T, 'act', f6, '동작 설명']];
      const cw = 330, ch = 140;
      cars.forEach(([at, kind, colT, lab], i) => {
        const targetX = ex + ew + 40 + i * (cw + 40);
        const cx = lerp(1920 + 200 + i * 300, targetX, ep(t, at, 1.0, 'out'));
        if (t < at) return;
        const ck = ep(t, colT, 0.6);
        const col = kind === 'noun' ? C.blue : C.orange;
        const wig = (t > S('f4') && t < f5 + 0.3) ? Math.sin(t * 9 + i) * 0.03 : 0;
        withT(ctx, cx + cw / 2, groundY - ch / 2, 1, wig, 1, () => {
          fillRR(ctx, -cw / 2, -ch / 2, cw, ch, 22, '#fff', '#C9D0DE', 4);
          if (ck > 0) { ctx.save(); ctx.globalAlpha *= ck; fillRR(ctx, -cw / 2, -ch / 2, cw, ch, 22, col); ctx.restore(); }
          text(ctx, ck > 0.5 ? lab : '설명 칸', 0, -2, 42, ck > 0.5 ? '#fff' : C.ink2, 8);
        });
        ctx.fillStyle = '#2A2F3E'; ctx.fillRect(cx - 40, groundY - 30, 40, 10);
        P.wheels(ctx, cx, cw, groundY, moving ? t : car2T + 1.2, 2);
        // question marks
        const qa = win(t, S('f4') + 0.4, f5 + 0.2 + i * (f6 - f5), 0.3, 0.3);
        withT(ctx, cx + cw / 2, groundY - ch - 50 + Math.sin(t * 5 + i) * 6, 1, 0, qa, () => text(ctx, '누구를 꾸밀까?', 0, 0, 30, C.ink2, 8));
        // target cards
        const cardX = i === 0 ? 560 : 1360, cardY = 300;
        const cp = pop(t, colT + 0.35, 0.5);
        withT(ctx, cardX, cardY, cp.sc, 0, cp.a, () => {
          card(ctx, -330, -120, 660, 240, '#fff'); fillRR(ctx, -330, -120, 18, 240, 9, col);
          if (i === 0) { // noun icon: person + box
            person(ctx, { x: -230, y: 70, s: 0.5, shirt: C.blue, hair: '#3A2A22', blink: blinkAt(t) });
            fillRR(ctx, -175, 10, 56, 56, 8, '#F2C14E'); ctx.strokeStyle = '#C99A2E'; ctx.lineWidth = 3; ctx.strokeRect(-175, 30, 56, 4);
          } else { // action icon: running figure
            person(ctx, { x: -210, y: 70, s: 0.5, shirt: C.orange, hair: '#3A2A22', ...run(t) });
            ctx.strokeStyle = C.orange; ctx.lineWidth = 5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-290, -30 + k * 22); ctx.lineTo(-260, -30 + k * 22); ctx.stroke(); }
          }
          text(ctx, i === 0 ? '명사 설명' : '동작 설명', -90, -60, 48, col, 9, 'left');
          text(ctx, i === 0 ? '사람·물건을 꾸며요' : '행동을 꾸며요', -90, -6, 28, C.ink2, 6, 'left');
          const qk = ep(t, f7 + (i === 0 ? 1.2 : 3.2), 0.5);
          const qs = i === 0 ? ['어떤 사람?', '어떤 물건?', '어떤 상태?'] : ['어떻게?', '언제?', '왜?'];
          qs.forEach((q, j) => { const k2 = ep(t, f7 + (i === 0 ? 1.2 : 3.2) + j * 0.15, 0.4); withT(ctx, -90 + j * 165, 62, Ease.back(k2), 0, k2, () => pill(ctx, q, 0, 0, 26, i === 0 ? C.blueL : C.orangeL, i === 0 ? C.blueD : C.orangeD, 7, 'left')); });
        });
        // arrow from car to card
        arrow(ctx, cx + cw / 2, groundY - ch - 16, cardX + (i === 0 ? 0 : -60), cardY + 128, i === 0 ? -60 : 60, col, ep(t, colT + 0.1, 0.6), 7);
      });
    }
  },
  sfx() {
    const c1 = Wt('f3', '설명 칸');
    return [[Wt('f2', '핵심'), 'pop', 0.7], [Wt('f2', '더하기'), 'pop', 0.6], [Wt('f2', '추가'), 'pop', 0.7], [Wt('f3', '맨 앞에'), 'whoosh', 0.6],
      [c1 + 0.85, 'click', 0.9], [c1 + 1.75, 'click', 0.9], [S('f5') + 0.35, 'pop', 0.7], [S('f6') + 0.35, 'pop', 0.7], [S('f7') + 1.2, 'swish', 0.5], [S('f7') + 3.2, 'swish', 0.5]];
  },
};

// =====================================================================
// 2. DOOR (action expansion)
// =====================================================================
function livingRoom(ctx, t, o) {
  // wall panel
  fillRR(ctx, 90, 360, 1740, 500, 30, '#F4E7D3');
  ctx.fillStyle = '#EAD8BE'; ctx.fillRect(90, 800, 1740, 60);
  // window
  fillRR(ctx, 230, 420, 220, 170, 12, '#CFE8FF', '#fff', 8);
  // picture frame
  fillRR(ctx, 760, 430, 120, 90, 8, '#FFD9A8', '#B98D5E', 6);
  floor(ctx, 860, 90, 1830);
}
const doorScene = {
  id: 'door',
  draw(ctx, t) {
    const ding = Wt('d1', '딩동'), d3 = S('d3'), rowT = En('d3') + 0.2;
    const runT = S('d11'), arriveT = S('d11') + 1.6;
    const tipT = S('d13');
    const stageA = 1 - ep(t, tipT, 0.5);
    // ---- stage ----
    withT(ctx, 0, 0, 1, 0, stageA, () => {
      livingRoom(ctx, t);
      // door
      const shake = (t > ding && t < ding + 1.2) ? Math.sin(t * 60) * 4 * (1 - (t - ding) / 1.2) : 0;
      const open = ep(t, arriveT, 0.8);
      ctx.save(); ctx.translate(shake, 0);
      P.door(ctx, 1450, 860, 210, 390, { open });
      if (open > 0) { ctx.save(); ctx.globalAlpha = open * 0.5; const g = ctx.createRadialGradient(1555, 680, 10, 1555, 680, 300); g.addColorStop(0, '#FFF4C2'); g.addColorStop(1, 'rgba(255,244,194,0)'); ctx.fillStyle = g; ctx.fillRect(1250, 380, 600, 480); ctx.restore(); }
      ctx.restore();
      P.doorbellIcon(ctx, 1730, 600, 0.9, t, win(t, ding - 0.1, ding + 1.6, 0.1, 0.4));
      const db = pop(t, ding, 0.4); withT(ctx, 1560, 430, db.sc, -0.1, db.a * (1 - ep(t, ding + 1.8, 0.4)), () => { text(ctx, '딩동!', 0, 0, 84, C.orange, 9); });
      // sofa + dad
      P.sofa(ctx, 520, 860, 1.0);
      const dadTalk = (t > S('d3') && t < En('d3')) || (t > S('d7') && t < En('d7')) || (t > S('d10') && t < En('d10'));
      person(ctx, { x: 470, y: 838, s: 0.95, shirt: '#4B6BD6', pants: '#2E3550', hair: '#2B2222', glasses: true, mustache: true, legF: 1.45, legB: 1.35, knee: 1.5, armF: 0.6, elbow: -0.8, armB: 0.3,
        mouth: dadTalk ? 'open' : 'smile', talk: dadTalk ? Math.abs(Math.sin(t * 14)) : 0, blink: blinkAt(t, 1.3) });
      // son
      let sx = 980, pose = {};
      if (t > runT) { const k = ep(t, runT, 1.6, 'inOut'); sx = lerp(980, 1330, k); if (k < 1) pose = run(t, 2.2); }
      const smiling = t > Wt('d7', 'with a smile');
      person(ctx, { x: sx, y: 860, s: 0.95, kid: true, shirt: C.orange, pants: '#3D5A80', hair: '#4A3426', hairStyle: 'spiky', face: t > runT ? 1 : -1, mouth: smiling ? 'big' : 'smile', blink: blinkAt(t, 0.4), ...pose });
      if (smiling && t < runT) { const k = ep(t, Wt('d7', 'with a smile'), 0.5); stars(ctx, sx, 860 - 300, t, k * (1 - ep(t, runT, 0.4)), 6, 80); }
      // clock
      const ck = pop(t, Wt('d10', 'without delay'));
      withT(ctx, 1220, 520, ck.sc, 0, ck.a * (1 - ep(t, S('d12') + 1, 0.5)), () => P.clock(ctx, 0, 0, 70, t, 8));
      // dad speech bubble
      const ba = win(t, S('d2') + 0.8, rowT + 0.1, 0.35, 0.3);
      if (ba > 0) withT(ctx, 0, 0, 1, 0, ba, () => {
        P.bubble(ctx, 150, 420, 700, 120, 480, 590);
        if (t < d3) { for (let i = 0; i < 3; i++) { ctx.fillStyle = C.mute; ctx.beginPath(); ctx.arc(460 + i * 34, 480 - Math.abs(Math.sin(t * 5 + i)) * 10, 10, 0, 7); ctx.fill(); } }
        else karaoke(ctx, t, 'You should get the door.', 'd3', 500, 480, 46, C.ink, C.orange, 8);
      });
    });
    // ---- sentence row ----
    if (t > rowT) {
      const a7 = Wt('d7', 'with a smile'), a10 = Wt('d10', 'without delay');
      const items = [
        { key: 'you', text: 'You should', kind: 'core', g: 0, at: rowT }, { key: 'get', text: 'get', kind: 'core', g: 0, at: rowT, mark: { at: S('d12') + 0.8, color: C.orange } },
        { key: 'door', text: t < a7 ? 'the door.' : 'the door', kind: 'core', g: 0, at: rowT },
        { key: 'smile', text: t < a10 ? 'with a smile.' : 'with a smile,', kind: 'act', g: 1, at: a7 },
        { key: 'delay', text: 'without delay.', kind: 'act', g: 2, at: a10 }];
      const rowY = lerp(250, 240, 0);
      const rowA = 1 - ep(t, tipT, 0.4);
      withT(ctx, 0, 0, 1, 0, rowA, () => {
        const R = sentenceRow(ctx, t, items, 960, rowY + 40, 50);
        // engine tag
        const ek = ep(t, S('d5'), 0.5);
        withT(ctx, R._x0 - 70, rowY + 40, Ease.back(ek), 0, ek, () => { fillRR(ctx, -44, -30, 70, 54, 10, C.navy); fillRR(ctx, -4, -56, 26, 30, 5, '#3B4B70'); ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(-46, 10); ctx.lineTo(-68, 24); ctx.lineTo(-46, 24); ctx.fill(); ctx.fillStyle = '#2A2F3E'; ctx.beginPath(); ctx.arc(-24, 28, 10, 0, 7); ctx.arc(10, 28, 10, 0, 7); ctx.fill(); });
        text(ctx, '기관차 = 핵심 문장', (R.you.x + R.door.x + R.door.w) / 2, rowY + 40 + 70, 28, C.navy, 8, 'center', win(t, S('d5') + 0.2, S('d7'), 0.4, 0.4));
        // arcs
        arcAbove(ctx, R, 'smile', 'get', C.orange, ep(t, Wt('d8', '어떻게'), 0.7), '어떻게?');
        arcAbove(ctx, R, 'delay', 'get', C.orange, ep(t, Wt('d11', '얼마나'), 0.7), '얼마나 빨리?');
        // noun vs action badges
        const bk = ep(t, Wt('d12', '명사가'), 0.4);
        if (bk > 0) { withT(ctx, R.door.cx, R.door.bot + 46, Ease.back(bk), 0, bk * (1 - ep(t, tipT - 0.3, 0.3)), () => { P.cross(ctx, -70, 0, 20); text(ctx, '명사 X', 10, 0, 28, C.red, 8); }); }
        const gk = ep(t, Wt('d12', '행동에'), 0.4);
        if (gk > 0) { withT(ctx, R.get.cx, R.get.bot + 46, Ease.back(gk), 0, gk, () => { P.check(ctx, -64, 0, 20); text(ctx, '동작 O', 14, 0, 28, C.green, 8); }); }
        const st = pop(t, Wt('d12', '동작 확장'), 0.5);
        withT(ctx, 960, 470, st.sc, -0.05, st.a, () => { shadowOn(ctx); pill(ctx, '동작 확장!', 0, 0, 56, C.orange, '#fff', 9); shadowOff(ctx); });
      });
      // get the door meaning callout
      const ca = win(t, Wt('d4', '이 표현은') - 0.4, S('d6'), 0.4, 0.4);
      if (ca > 0) withT(ctx, 960, 500, 0.9 + 0.1 * ca, 0, ca, () => {
        card(ctx, -470, -60, 940, 120, '#fff'); fillRR(ctx, -470, -60, 16, 120, 8, C.navy);
        text(ctx, 'get the door', -420, -2, 46, C.navy, 9, 'left');
        text(ctx, '= (초인종·노크에) 나가서 문을 열어 주다', -80, -2, 32, C.ink, 7, 'left');
      });
    }
    // ---- tip card ----
    if (t > tipT - 0.2) {
      const k = ep(t, tipT, 0.6, 'back');
      withT(ctx, lerp(2400, 960, k), 560, 1, 0, 1, () => {
        card(ctx, -640, -280, 1280, 560, '#fff');
        pill(ctx, '회화 Tip', -500, -200, 32, C.navy, '#fff', 8);
        text(ctx, 'without delay', -330, -60, 56, C.mute, 8);
        ctx.strokeStyle = C.red; ctx.lineWidth = 6; const sk = ep(t, tipT + 0.8, 0.4); ctx.beginPath(); ctx.moveTo(-520, -60); ctx.lineTo(-520 + 380 * sk, -60); ctx.stroke();
        fatArrow(ctx, -90, -60, 120, C.ink2, ep(t, tipT + 1.1, 0.4));
        const rk = pop(t, tipT + 1.4); withT(ctx, 270, -60, rk.sc, 0, rk.a, () => pill(ctx, 'right away', 0, 0, 52, C.orange, '#fff', 9));
        text(ctx, '일상 대화에서 더 자연스러워요', 270, 20, 28, C.ink2, 6, 'center', ep(t, tipT + 1.6, 0.4));
        if (t > S('d14') - 0.2) karaoke(ctx, t, 'Get the door with a smile. Right away!', 'd14', 0, 150, 58, C.ink, C.orange, 8);
      });
    }
  },
  sfx() { return [[Wt('d1', '딩동') - 0.05, 'doorbell', 1.0], [En('d3') + 0.2, 'pop', 0.6], [Wt('d7', 'with a smile'), 'click', 0.8], [Wt('d7', 'with a smile') + 0.1, 'sparkle', 0.5],
    [Wt('d8', '어떻게'), 'draw', 0.7], [Wt('d10', 'without delay'), 'click', 0.8], [Wt('d10', 'without delay'), 'pop', 0.5], [Wt('d11', '얼마나'), 'draw', 0.7], [S('d11'), 'whoosh', 0.5],
    [Wt('d12', '동작 확장'), 'thud', 0.7], [S('d13'), 'whoosh', 0.6], [S('d13') + 0.8, 'swish', 0.4], [S('d13') + 1.4, 'pop', 0.6]]; },
};

// =====================================================================
// 3. NOUN 6 WAYS
// =====================================================================
const N6 = [
  { a: 'n1a', b: 'n1b', name: '형용사', items: [['a', 'plain'], ['beautiful', 'noun'], ['house', 'ghost']], from: 'beautiful', to: 'house', ko: '아름다운 집', pos: '앞' },
  { a: 'n2a', b: 'n2b', name: '전치사 + 명사', items: [['the house', 'ghost'], ['on the hill', 'noun']], from: 'on the hill', to: 'the house', ko: '언덕 위의 집', pos: '뒤' },
  { a: 'n3a', b: 'n3b', name: 'V-ing (현재분사)', items: [['the boy', 'ghost'], ['standing there', 'noun']], from: 'standing there', to: 'the boy', ko: '저기 서 있는 소년', pos: '뒤' },
  { a: 'n4a', b: 'n4b', name: 'P.P. (과거분사)', items: [['the door', 'ghost'], ['painted blue', 'noun']], from: 'painted blue', to: 'the door', ko: '파란색으로 칠해진 문', pos: '뒤' },
  { a: 'n5a', b: 'n5b', name: 'to부정사', items: [['something', 'ghost'], ['to drink', 'noun']], from: 'to drink', to: 'something', ko: '마실 것', pos: '뒤' },
  { a: 'n6a', b: 'n6b', name: '관계대명사절', items: [['the man', 'ghost'], ['who lives next door', 'noun']], from: 'who lives next door', to: 'the man', ko: '옆집에 사는 남자', pos: '뒤' },
];
function n6Illus(ctx, i, t, kb) {
  // panel center (510, 520)
  const cx = 510, gy = 780;
  if (i === 0) {
    floor(ctx, gy, 200, 820, 'rgba(60,140,80,0.25)');
    ctx.save(); ctx.globalAlpha *= 1 - kb; P.house(ctx, cx, gy, 1.05, { wall: '#E6E2DA', roof: '#B7B2AA', door: '#9D978E' }); ctx.restore();
    ctx.save(); ctx.globalAlpha *= kb; P.house(ctx, cx, gy, 1.05, { lit: true }); ctx.restore();
    for (let k = 0; k < 6; k++) { const fk = ep(kb, k * 0.1, 0.5); if (fk > 0) P.flower(ctx, 260 + k * 95 + (k > 2 ? 90 : 0), gy, fk, [C.red, C.yellow, C.violet, C.orange, '#FF7FB0', C.blue][k]); }
    stars(ctx, cx, gy - 160, t, kb, 7, 230);
  } else if (i === 1) {
    const hh = 230 * kb; P.hill(ctx, cx, gy, 600, hh);
    floor(ctx, gy, 200, 820, 'rgba(60,140,80,0.25)');
    P.house(ctx, cx, gy - hh * 0.98, 0.75);
  } else if (i === 2) {
    floor(ctx, gy, 200, 820);
    person(ctx, { x: 640, y: gy, s: 1.0, kid: true, shirt: C.teal, hair: '#4A3426', hairStyle: 'spiky', face: -1, blink: blinkAt(t), armF: 0.05, armB: -0.05 });
    // pointing from viewer
    const k = kb; arrow(ctx, 260, 400, 560, 520, -60, C.blue, k, 7, true);
    withT(ctx, 300, 360, Ease.back(clamp(k)), 0, clamp(k), () => pill(ctx, 'there!', 0, 0, 30, C.blue, '#fff', 8));
  } else if (i === 3) {
    floor(ctx, gy, 200, 820);
    P.door(ctx, cx - 110, gy, 220, 400, { paint: kb });
    const by = gy - 400 + 400 * kb; P.brush(ctx, cx + 30 + Math.sin(t * 9) * 80, by + 30, 1.0, 0.25, C.blue);
  } else if (i === 4) {
    P.cup(ctx, cx, gy - 40, 1.25, {});
    arrow(ctx, 230, 360, 420, 470, -40, C.blue, kb, 6, true);
    withT(ctx, 300, 320, Ease.back(clamp(kb)), 0, clamp(kb), () => pill(ctx, '앞으로 마실 것', 0, 0, 28, C.blue, '#fff', 8));
  } else if (i === 5) {
    floor(ctx, gy, 200, 820);
    P.house(ctx, 340, gy, 0.6, { wall: '#E9EEF8', roof: '#8EA2C8' }); P.house(ctx, 680, gy, 0.6, { lit: true });
    text(ctx, 'my house', 340, gy + 40, 26, C.ink2, 7);
    person(ctx, { x: 690, y: gy, s: 0.8, shirt: '#3BA55C', hair: '#2B2222', armF: -2.6 + Math.sin(t * 6) * 0.25, elbow: -0.4, blink: blinkAt(t, 2), mouth: 'big' });
    arrow(ctx, 380, gy - 230, 650, gy - 300, -80, C.blue, kb, 6, true);
    withT(ctx, 510, gy - 360, Ease.back(clamp(kb)), 0, clamp(kb), () => pill(ctx, 'next door', 0, 0, 28, C.blue, '#fff', 8));
  }
}
const noun6 = {
  id: 'noun6',
  draw(ctx, t) {
    const n7 = S('n7');
    // title (n0)
    const ta = win(t, S('n0') - 0.3, S('n1a') + 0.2, 0.4, 0.4);
    withT(ctx, 960, 470, 1, 0, ta, () => {
      text(ctx, '명사를 설명하는', 0, -60, 64, C.ink, 8); text(ctx, '6가지 방법', 0, 30, 96, C.blue, 9);
    });
    // progress dots
    const cur = N6.findIndex((n, i) => t >= S(n.a) && (i === 5 ? t < n7 : t < S(N6[i + 1].a)));
    const da = win(t, S('n0') + 0.6, n7, 0.4, 0.4);
    for (let i = 0; i < 6; i++) { const on = i <= cur; withT(ctx, 960 - 150 + i * 60, 160, 1, 0, da, () => { ctx.fillStyle = on ? C.blue : '#D5DCE8'; ctx.beginPath(); ctx.arc(0, 0, i === cur ? 14 : 10, 0, 7); ctx.fill(); }); }
    // items
    N6.forEach((n, i) => {
      const st = S(n.a), en = i === 5 ? n7 : S(N6[i + 1].a);
      if (t < st - 0.5 || t > en + 0.5) return;
      const a = win(t, st - 0.2, en + 0.1, 0.45, 0.45); const slide = (1 - ep(t, st - 0.2, 0.6)) * 80 - ep(t, en - 0.35, 0.45) * 80;
      const kb = ep(t, S(n.b), 1.6, 'inOut');
      withT(ctx, slide, 0, 1, 0, a, () => {
        card(ctx, 160, 220, 700, 620, '#fff');
        ctx.save(); rr(ctx, 160, 220, 700, 620, 28); ctx.clip(); n6Illus(ctx, i, t, kb); ctx.restore();
        // right side
        withT(ctx, 1000, 300, 1, 0, 1, () => {
          fillRR(ctx, 0, -40, 80, 80, 22, C.blue); text(ctx, String(i + 1), 40, 2, 48, '#fff', 9);
          text(ctx, n.name, 110, 2, 56, C.ink, 9, 'left');
        });
        const items = n.items.map(([s, k], j) => ({ key: s, text: s, kind: k, g: j, at: k === 'noun' ? S(n.b) - 0.1 : st + 0.3 }));
        const R = sentenceRow(ctx, t, items, 1330, 480, 54);
        arcBelow(ctx, R, n.from, n.to, C.blue, ep(t, S(n.b) + 0.5, 0.6));
        text(ctx, n.ko, 1330, 640, 44, C.ink2, 7, 'center', ep(t, S(n.a.replace('a', 'c')), 0.4));
        // position badge
        const pk = pop(t, S(n.a.replace('a', 'c')) + 0.4);
        withT(ctx, 1330, 740, pk.sc, 0, pk.a, () => pill(ctx, n.pos === '앞' ? '◀ 명사 앞에 붙어요' : '명사 뒤에 붙어요 ▶', 0, 0, 30, n.pos === '앞' ? C.navy : C.blue, '#fff', 8));
      });
    });
    // summary
    if (t > n7 - 0.3) {
      const a = ep(t, n7 - 0.1, 0.5);
      withT(ctx, 0, 0, 1, 0, a, () => {
        const nx = 760, ny = 520;
        const np = pop(t, n7); withT(ctx, nx, ny, np.sc, 0, np.a, () => { shadowOn(ctx); fillRR(ctx, -110, -60, 220, 120, 30, C.navy); shadowOff(ctx); text(ctx, '명사', 0, 0, 56, '#fff', 9); });
        const lp = pop(t, Wt('n7', '형용사만')); withT(ctx, nx - 330, ny, lp.sc, 0, lp.a, () => { pill(ctx, '형용사', 0, 0, 40, C.blue, '#fff', 8); });
        fatArrow(ctx, nx - 230, ny, 90, C.blue, ep(t, Wt('n7', '형용사만') + 0.3, 0.4));
        const R5 = ['전치사 + 명사', 'V-ing', 'P.P.', 'to부정사', '관계대명사절'];
        R5.forEach((s, j) => {
          const p = pop(t, Wt('n7', '나머지') + j * 0.18);
          const yy = ny - 240 + j * 120;
          arrow(ctx, nx + 380, yy, nx + 120, ny, 0, C.blue, ep(t, Wt('n7', '나머지') + j * 0.18 + 0.15, 0.4), 5);
          withT(ctx, nx + 500, yy, p.sc, 0, p.a, () => pill(ctx, s, 0, 0, 34, C.blueL, C.blueD, 8));
        });
        const sk = pop(t, Wt('n7', '전부'), 0.5);
        withT(ctx, 960, 190, sk.sc, 0, sk.a, () => { text(ctx, '앞 1  :  뒤 5', 0, 0, 72, C.ink, 9); });
      });
    }
  },
  sfx() { const L = [[S('n0'), 'sparkle', 0.6]]; N6.forEach(n => { L.push([S(n.a) - 0.2, 'swish', 0.5], [S(n.b) - 0.1, 'pop', 0.7], [S(n.b) + 0.5, 'draw', 0.6]); });
    L.push([S('n7'), 'pop', 0.7], [Wt('n7', '형용사만'), 'pop', 0.6]); for (let j = 0; j < 5; j++) L.push([Wt('n7', '나머지') + j * 0.18, 'pop', 0.45]); L.push([Wt('n7', '전부'), 'thud', 0.7]); return L; },
};

// =====================================================================
// 4. GROW
// =====================================================================
const grow = {
  id: 'grow',
  draw(ctx, t) {
    const g1 = S('g1'), boyT = Wt('g1', 'the boy'), g2 = S('g2'), g3 = S('g3'), g4 = S('g4'), g5 = S('g5'), g6 = S('g6'), g7 = S('g7'), g9 = S('g9');
    // ---- part 1: building ----
    const a1 = 1 - ep(t, g7 - 0.3, 0.5);
    if (a1 > 0) withT(ctx, 0, 0, 1, 0, a1, () => {
      const col = ep(t, g2, 0.8);
      const stageA = 1 - ep(t, g5, 0.5);
      withT(ctx, 0, 0, 1, 0, stageA, () => {
        floor(ctx, 860, 400, 1520);
        const dk = ep(t, g3, 0.7, 'back'); if (dk > 0) withT(ctx, 1150, 860, 1, 0, clamp(dk), () => { ctx.translate(0, (1 - dk) * 60); P.door(ctx, 0, 0, 200, 380, { color: '#7E9CD8' }); });
        const bp = pop(t, boyT, 0.5);
        withT(ctx, 960, 860, bp.sc, 0, bp.a, () => {
          // grey silhouette -> colored
          ctx.save(); ctx.globalAlpha *= 1 - col;
          person(ctx, { x: 0, y: 0, s: lerp(1.15, 1.15, col), shirt: '#B9BFCB', pants: '#A2A9B7', skin: '#D4D8E0', hair: '#9AA0AE', hairStyle: 'spiky', mouth: 'flat', shoe: '#8D93A1' });
          ctx.restore();
          ctx.save(); ctx.globalAlpha *= col;
          const gift = ep(t, g4, 0.5);
          person(ctx, { x: 0, y: 0, s: 1.15, kid: true, shirt: C.orange, pants: '#3D5A80', hair: '#4A3426', hairStyle: 'spiky', mouth: 'big', blink: blinkAt(t), armF: lerp(0.15, -1.1, gift), elbow: lerp(0, -0.6, gift), armB: lerp(-0.15, -1.0, gift), elbowB: lerp(0, -0.6, gift),
            hand: gift > 0 ? (c, x, y) => withT(c, x + 12, y - 4, gift, 0, 1, () => P.giftBox(c, 0, 0, 0.9)) : null });
          ctx.restore();
        });
        stars(ctx, 960, 560, t, win(t, g2, g2 + 2.2, 0.3, 0.5), 8, 170);
      });
      // row
      const toSubj = ep(t, g6 - 0.1, 0.6, 'inOut');
      const items = [{ key: 'the', text: 'the', kind: 'ghost', g: 0, at: boyT }, { key: 'young', text: 'young', kind: 'noun', g: 1, at: g2 },
        { key: 'boy', text: 'boy', kind: 'ghost', g: 2, at: boyT }, { key: 'door', text: 'at the door', kind: 'noun', g: 3, at: g3 }, { key: 'gift', text: 'holding a gift', kind: 'noun', g: 4, at: g4 },
        { key: 'is', text: 'is my nephew.', kind: 'core', g: 5, at: g6 + 0.9 * (Wt('g6', 'is') - g6) }];
      const rowY = lerp(250, 470, ep(t, g5, 0.7, 'inOut'));
      const size = lerp(54, 50, toSubj);
      const R = sentenceRow(ctx, t, items, 960, rowY, size);
      const ak = 1 - ep(t, g5, 0.4);
      arcAbove(ctx, R, 'young', 'boy', C.blue, ep(t, Wt('g2t', '형용사'), 0.5) * ak);
      arcBelow(ctx, R, 'door', 'boy', C.blue, ep(t, Wt('g3t', '전치사구'), 0.5) * ak, '뒤에');
      arcBelow(ctx, R, 'gift', 'boy', C.blue, ep(t, Wt('g4t', 'V-ing'), 0.5) * ak, '뒤에');
      text(ctx, '앞에', R.young.cx, R.young.top - 70, 28, C.blueD, 8, 'center', ep(t, Wt('g2t', '형용사'), 0.5) * ak);
      // subject bracket
      const sb = ep(t, g6 + 0.2, 0.6);
      if (sb > 0) {
        const x0 = R.the.x - 30, x1 = R.gift.x + R.gift.w + 30, by = R.boy.bot + 26;
        ctx.save(); ctx.globalAlpha *= sb; ctx.strokeStyle = C.blue; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, by - 10); ctx.lineTo(x0, by); ctx.lineTo(lerp(x0, x1, sb), by); if (sb > 0.99) ctx.lineTo(x1, by - 10); ctx.stroke(); ctx.restore();
        text(ctx, '주어 = 긴 명사 덩어리', (x0 + x1) / 2, by + 44, 32, C.blueD, 8, 'center', sb);
        const kt = ep(t, S('g6t'), 0.5);
        text(ctx, '선물을 들고 문 앞에 있는 그 어린 소년이, 바로 내 조카예요.', 960, by + 150, 40, C.ink, 7, 'center', kt);
      }
    });
    // ---- part 2: KO vs EN mirror ----
    if (t > g7 - 0.4 && t < g9 + 0.6) {
      const a = win(t, g7 - 0.2, g9 + 0.2, 0.5, 0.5);
      withT(ctx, 0, 0, 1, 0, a, () => {
        const ah = pop(t, g7 + 0.1); withT(ctx, 960, 190, ah.sc, 0, ah.a, () => pill(ctx, '아하 포인트!', 0, 0, 40, C.yellow, C.ink, 9));
        // Korean row
        const kT = Wt('g7', '한국어는'), eT = Wt('g7', '영어는');
        card(ctx, 140, 290, 1640, 230, '#fff'); card(ctx, 140, 560, 1640, 230, '#fff');
        pill(ctx, '한국어', 270, 405, 32, C.ink2, '#fff', 8);
        pill(ctx, 'English', 270, 675, 32, C.navy, '#fff', 8);
        const kChunks = ['선물을 들고', '문 앞에 있는', '어린'];
        // noun fixed at right for KO
        const kNx = 1500; withT(ctx, kNx, 405, 1, 0, ep(t, kT - 0.3, 0.4), () => { shadowOn(ctx); fillRR(ctx, -80, -44, 160, 88, 22, C.navy); shadowOff(ctx); text(ctx, '소년', 0, 0, 44, '#fff', 9); });
        let x = kNx - 100;
        kChunks.slice().reverse().forEach((s, j) => { const w = measure(s, 38, 8) + 50; const k = ep(t, kT + 0.4 + j * 0.45, 0.6, 'back');
          const xx = lerp(x - w / 2 - 500, x - w / 2, k); withT(ctx, xx, 405, 1, 0, clamp(k), () => { fillRR(ctx, -w / 2, -40, w, 80, 20, C.blueL, C.blue, 3); text(ctx, s, 0, 0, 38, C.blueD, 8); }); x -= w + 18; });
        fatArrow(ctx, 500, 470, 900, 'rgba(47,123,246,0.25)', ep(t, kT + 1.6, 0.8), 1, 18);
        text(ctx, '설명이 명사 앞에 쌓여요', 960, 470, 26, C.blueD, 8, 'center', ep(t, kT + 1.8, 0.4));
        // English row
        const eNx = 560; withT(ctx, eNx, 675, 1, 0, ep(t, eT - 0.3, 0.4), () => { shadowOn(ctx); fillRR(ctx, -170, -44, 340, 88, 22, C.navy); shadowOff(ctx); text(ctx, 'the young boy', 0, 0, 40, '#fff', 9); });
        let ex = eNx + 190;
        ['at the door', 'holding a gift'].forEach((s, j) => { const w = measure(s, 38, 8) + 50; const k = ep(t, Wt('g7', '설명을 뒤에') - 0.6 + j * 0.45, 0.6, 'back');
          const xx = lerp(ex + w / 2 + 500, ex + w / 2, k); withT(ctx, xx, 675, 1, 0, clamp(k), () => { fillRR(ctx, -w / 2, -40, w, 80, 20, C.blueL, C.blue, 3); text(ctx, s, 0, 0, 38, C.blueD, 8); }); ex += w + 18; });
        fatArrow(ctx, 1450, 740, 900, 'rgba(47,123,246,0.25)', ep(t, Wt('g7', '설명을 뒤에') + 0.4, 0.8), -1, 18);
        text(ctx, '명사 먼저, 설명은 뒤에', 960, 740, 26, C.blueD, 8, 'center', ep(t, Wt('g7', '설명을 뒤에') + 0.6, 0.4));
        // g8: who first
        const wk = pop(t, Wt('g8', '먼저'), 0.5);
        withT(ctx, eNx, 590, wk.sc, 0, wk.a, () => pill(ctx, '① 누구?', 0, 0, 28, C.orange, '#fff', 8));
        const wk2 = pop(t, Wt('g8', '궁금증'), 0.5);
        withT(ctx, 1260, 590, wk2.sc, 0, wk2.a, () => pill(ctx, '② 어떤? 어디? 뭘 하는?', 0, 0, 28, C.orange, '#fff', 8));
      });
    }
    // ---- part 3: practice ----
    if (t > g9 - 0.3) {
      const a = win(t, g9 - 0.2, En('g13') + 5, 0.5, 0.5);
      withT(ctx, 0, 0, 1, 0, a, () => {
        const hk = pop(t, g9); withT(ctx, 960, 210, hk.sc, 0, hk.a, () => { pill(ctx, 'Repeat after me', 0, 0, 40, C.navy, '#fff', 9); });
        const sets = [['g10', 'g10p', 'the boy at the door'], ['g11', 'g11p', 'the boy at the door holding a gift'], ['g12', 'g12p', 'The boy at the door holding a gift is my nephew.']];
        sets.forEach(([n, p, s], j) => {
          const st = S(n) - 0.4, en = j < 2 ? S(sets[j + 1][0]) - 0.4 : En('g12p') + 0.3;
          if (t < st - 0.2 || t > en + 0.4) return;
          const k = win(t, st, en, 0.35, 0.35);
          withT(ctx, 0, (1 - ep(t, st, 0.5)) * 40, 1, 0, k, () => {
            card(ctx, 160, 330, 1600, 220, '#fff');
            pill(ctx, `${j + 1} / 3`, 260, 380, 24, C.blueL, C.blueD, 8);
            const sz = s.length > 40 ? 60 : 72;
            if (t < En(n) + 0.3) karaoke(ctx, t, s, n, 960, 455, sz, C.ink, C.orange, 8);
            else text(ctx, s, 960, 455, sz, C.ink, 8);
          });
          practiceUI(ctx, t, n, p, 960, 680);
        });
        const gj = pop(t, S('g13'), 0.5);
        withT(ctx, 960, 470, gj.sc, 0, gj.a, () => { text(ctx, 'Great job!', 0, 0, 110, C.orange, 9); });
        stars(ctx, 960, 470, t, ep(t, S('g13'), 0.5), 10, 380);
      });
    }
  },
  sfx() { const L = [[Wt('g1', 'the boy'), 'pop', 0.7], [S('g2'), 'sparkle', 0.7], [S('g3'), 'click', 0.8], [S('g4'), 'click', 0.8], [S('g4'), 'pop', 0.5], [S('g5'), 'whoosh', 0.4], [Wt('g6', 'is'), 'click', 0.7],
    [S('g7') + 0.1, 'sparkle', 0.6]];
    for (let j = 0; j < 3; j++) L.push([Wt('g7', '한국어는') + 0.4 + j * 0.45, 'swish', 0.4]);
    for (let j = 0; j < 2; j++) L.push([Wt('g7', '설명을 뒤에') - 0.6 + j * 0.45, 'swish', 0.4]);
    L.push([S('g9'), 'pop', 0.6], [S('g13'), 'correct', 0.8]);
    return L; },
};

// =====================================================================
// 5. V-ing vs P.P.
// =====================================================================
function vPanel(ctx, x, y, w, h, col, colL, title, sub) {
  card(ctx, x, y, w, h, '#fff'); fillRR(ctx, x, y, w, 90, 28, colL); ctx.fillStyle = colL; ctx.fillRect(x, y + 60, w, 30);
  text(ctx, title, x + 40, y + 48, 46, col, 9, 'left'); text(ctx, sub, x + w - 40, y + 48, 30, col, 7, 'right');
}
const ving = {
  id: 'ving',
  draw(ctx, t) {
    const v1 = S('v1'), v3 = S('v3'), v4 = S('v4'), v5 = S('v5'), v9 = S('v9'), v10 = S('v10'), v11 = S('v11'), v12 = S('v12');
    // part 1: two panels
    const a1 = win(t, v1 - 0.3, v5 + 0.1, 0.5, 0.5);
    if (a1 > 0) withT(ctx, 0, 0, 1, 0, a1, () => {
      const lk = ep(t, v1 + 0.4, 0.6, 'back'), rk = ep(t, Wt('v1', 'P.P.'), 0.6, 'back');
      withT(ctx, 0, (1 - lk) * 60, 1, 0, clamp(lk), () => {
        vPanel(ctx, 120, 170, 820, 680, C.teal, C.tealL, 'V-ing', '동작을 하는 쪽');
      });
      withT(ctx, 0, (1 - rk) * 60, 1, 0, clamp(rk), () => {
        vPanel(ctx, 980, 170, 820, 680, C.violet, C.violetL, 'P.P.', '동작을 받는 쪽');
      });
      // v2 icons: noun circle with arrow out / in
      const ik = ep(t, Wt('v2', '하는 쪽'), 0.5), ik2 = ep(t, Wt('v2', '받는 쪽'), 0.5);
      const iconA = 1 - ep(t, v3 - 0.2, 0.4), iconB = 1 - ep(t, v4 - 0.2, 0.4);
      withT(ctx, 530, 500, Ease.back(ik), 0, ik * iconA, () => { ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(-120, 0, 70, 0, 7); ctx.fill(); text(ctx, '명사', -120, 0, 36, '#fff', 9); fatArrow(ctx, -40, 0, 200, C.teal, ik, 1, 30); text(ctx, '내가 한다!', 60, -70, 34, C.teal, 8); });
      withT(ctx, 1390, 500, Ease.back(ik2), 0, ik2 * iconB, () => { ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(120, 0, 70, 0, 7); ctx.fill(); text(ctx, '명사', 120, 0, 36, '#fff', 9); fatArrow(ctx, -170, 0, 200, C.violet, ik2, 1, 30); text(ctx, '내가 받는다!', -60, -70, 34, C.violet, 8); });
      // v3 running boy
      if (t > v3 - 0.3) {
        const k = ep(t, v3 - 0.2, 0.5);
        withT(ctx, 0, 0, 1, 0, k, () => {
          ctx.save(); rr(ctx, 120, 260, 820, 590, 28); ctx.clip();
          floor(ctx, 700, 120, 940);
          const bx = 300 + ((t - v3) * 120) % 600;
          person(ctx, { x: bx, y: 700, s: 0.95, kid: true, shirt: C.teal, hair: '#4A3426', hairStyle: 'spiky', mouth: 'big', ...run(t, 2) });
          for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(17,167,160,0.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - 110 - i * 10, 560 + i * 30); ctx.lineTo(bx - 60 - i * 10, 560 + i * 30); ctx.stroke(); }
          ctx.restore();
          const R = sentenceRow(ctx, t, [{ key: 'b', text: 'the boy', kind: 'ghost', g: 0, at: v3 }, { key: 'r', text: 'running', kind: 'ving', g: 1, at: v3 + 0.3 }], 530, 780, 46);
          withT(ctx, 530, 320, 1, 0, ep(t, Wt('v3t', '직접'), 0.4), () => pill(ctx, '소년이 직접 달린다 → V-ing', 0, 0, 28, C.teal, '#fff', 8));
        });
      }
      if (t > v4 - 0.3) {
        const k = ep(t, v4 - 0.2, 0.5); const pk = ep(t, v4 + 0.2, 2.6, 'inOut');
        withT(ctx, 0, 0, 1, 0, k, () => {
          ctx.save(); rr(ctx, 980, 260, 820, 590, 28); ctx.clip();
          floor(ctx, 700, 980, 1800);
          P.door(ctx, 1290, 700, 200, 360, { paint: pk });
          P.brush(ctx, 1420 + Math.sin(t * 9) * 70, 340 + 360 * pk + 30, 1.0, 0.25, C.blue);
          person(ctx, { x: 1640, y: 700, s: 0.75, shirt: C.violet, hair: '#2B2222', face: -1, armF: 1.3, elbow: 0.3, blink: blinkAt(t, 1) });
          ctx.restore();
          sentenceRow(ctx, t, [{ key: 'd', text: 'the door', kind: 'ghost', g: 0, at: v4 }, { key: 'p', text: 'painted blue', kind: 'pp', g: 1, at: v4 + 0.3 }], 1390, 780, 46);
          withT(ctx, 1390, 320, 1, 0, ep(t, Wt('v4t', '누군가에게'), 0.4), () => pill(ctx, '문이 칠해진다 → P.P.', 0, 0, 28, C.violet, '#fff', 8));
        });
      }
    });
    // part 2: pairs table
    const a2 = win(t, v5 - 0.2, v9 + 0.1, 0.5, 0.45);
    if (a2 > 0) withT(ctx, 0, 0, 1, 0, a2, () => {
      fillRR(ctx, 120, 160, 830, 80, 24, C.teal); text(ctx, 'V-ing · 하는 쪽', 535, 200, 40, '#fff', 9);
      fillRR(ctx, 970, 160, 830, 80, 24, C.violet); text(ctx, 'P.P. · 받는 쪽', 1385, 200, 40, '#fff', 9);
      const rows = [['v6a', 'v6b', 'a girl singing', 'a song sung by her'], ['v7a', 'v7b', 'a man driving a car', 'a car driven by him'], ['v8a', 'v8b', 'a chef cooking dinner', 'dinner cooked by a chef']];
      rows.forEach(([na, nb, sa, sb], j) => {
        const y = 330 + j * 190; const ka = pop(t, S(na) - 0.1), kb = pop(t, S(nb) - 0.1);
        withT(ctx, 535, y, ka.sc, 0, ka.a, () => {
          card(ctx, -415, -80, 830, 160, '#fff', 24);
          ctx.save(); rr(ctx, -415, -80, 830, 160, 24); ctx.clip();
          if (j === 0) { person(ctx, { x: -320, y: 120, s: 0.55, shirt: '#FF7FB0', hair: '#4A3426', hairStyle: 'long', mouth: 'o', armF: -1.2, elbow: -1, blink: blinkAt(t) }); for (let q = 0; q < 3; q++) P.note(ctx, -250 + q * 30, -20 - ((t * 40 + q * 30) % 60), 0.6, C.teal); }
          if (j === 1) { P.car(ctx, -310, 70, 0.45, C.teal, { driver: true }); }
          if (j === 2) { person(ctx, { x: -340, y: 125, s: 0.5, shirt: '#fff', hair: '#2B2222', hat: 'chef', armF: -0.9, elbow: -0.6, blink: blinkAt(t, 2) }); P.pot(ctx, -250, 60, 0.5, t); }
          ctx.restore();
          karaoke(ctx, t, sa, na, 90, 0, 44, C.ink, C.teal, 8);
        });
        withT(ctx, 1385, y, kb.sc, 0, kb.a, () => {
          card(ctx, -415, -80, 830, 160, '#fff', 24);
          ctx.save(); rr(ctx, -415, -80, 830, 160, 24); ctx.clip();
          if (j === 0) { fillRR(ctx, -360, -50, 90, 110, 8, '#fff', '#D5DCE8', 3); for (let q = 0; q < 3; q++) P.note(ctx, -340 + q * 26, 30 - q * 12, 0.5, C.violet); }
          if (j === 1) { P.car(ctx, -310, 70, 0.45, C.violet, { driver: true }); }
          if (j === 2) { P.plate(ctx, -310, 30, 0.6); }
          ctx.restore();
          karaoke(ctx, t, sb, nb, 90, 0, 44, C.ink, C.violet, 8);
        });
        // arrows: out vs in
        const ak = ep(t, S(nb) + 0.6, 0.4);
        fatArrow(ctx, 900, y, 0.001, C.teal, 0);
      });
    });
    // part 3: exceptions
    const a3 = win(t, v9 - 0.2, v12 + 0.2, 0.45, 0.45);
    if (a3 > 0) withT(ctx, 0, 0, 1, 0, a3, () => {
      const wk = pop(t, v9, 0.5); const wUp = ep(t, v10 - 0.2, 0.6, 'inOut');
      withT(ctx, 960, lerp(470, 190, wUp), lerp(1, 0.75, wUp) * wk.sc, 0, wk.a, () => { shadowOn(ctx); pill(ctx, '⚠ 절대 규칙은 아니에요!', 0, 0, 52, C.yellow, C.ink, 9); shadowOff(ctx); });
      // sleeping bag
      const sk = ep(t, v10, 0.6);
      withT(ctx, 0, (1 - sk) * 60, 1, 0, sk, () => {
        card(ctx, 120, 270, 820, 590, '#fff');
        sentenceRow(ctx, t, [{ key: 's', text: 'a sleeping bag', kind: 'ving', g: 0 }], 530, 350, 50);
        const wrongK = ep(t, Wt('v10', '자고 있는'), 0.4), rightK = ep(t, Wt('v10', '잠잘 때'), 0.5);
        // wrong: sleeping bag with face
        withT(ctx, 530, 560, 0.85, 0, 1, () => {
          P.sleepingBag(ctx, 0, 0, 1, rightK);
          if (wrongK > 0 && rightK < 1) { ctx.save(); ctx.globalAlpha *= wrongK * (1 - rightK); ctx.strokeStyle = '#25202A'; ctx.lineWidth = 4; for (const sx of [-30, 30]) { ctx.beginPath(); ctx.arc(sx, -30, 10, 0.1, Math.PI - 0.1); ctx.stroke(); } text(ctx, 'z Z', 120, -110, 40, C.teal, 9); ctx.restore(); }
        });
        withT(ctx, 530, 700, 1, 0, wrongK * (1 - rightK * 0.6), () => { P.cross(ctx, -190, 0, 22); text(ctx, '자고 있는 가방', -150, 0, 34, C.red, 8, 'left'); });
        withT(ctx, 530, 770, Ease.back(rightK), 0, rightK, () => { P.check(ctx, -230, 0, 22); text(ctx, '잠잘 때 쓰는 가방 = 침낭', -190, 0, 34, C.green, 8, 'left'); });
        const lk = pop(t, Wt('v10', '용도')); withT(ctx, 760, 440, lk.sc, 0.06, lk.a, () => pill(ctx, '-ing = 용도', 0, 0, 30, C.teal, '#fff', 9));
      });
      // fallen leaves
      const fk = ep(t, v11, 0.6);
      withT(ctx, 0, (1 - fk) * 60, 1, 0, fk, () => {
        card(ctx, 980, 270, 820, 590, '#fff');
        sentenceRow(ctx, t, [{ key: 'f', text: 'fallen leaves', kind: 'pp', g: 0 }], 1390, 350, 50);
        ctx.save(); rr(ctx, 980, 270, 820, 590, 28); ctx.clip();
        P.tree(ctx, 1250, 700, 0.85, '#F0A04B'); floor(ctx, 700, 980, 1800, 'rgba(120,90,50,0.2)');
        for (let i = 0; i < 14; i++) { const ph = ((t - v11) * 0.35 + i / 14) % 1; const lx = 1150 + (i * 53) % 260 + Math.sin(ph * 8 + i) * 30; const ly = lerp(480, 700, ph);
          if (t > v11) P.leaf(ctx, lx, ly, 0.9, ph * 6 + i, i % 3 ? '#E8873A' : '#D9591A'); }
        for (let i = 0; i < 12; i++) P.leaf(ctx, 1150 + i * 26, 698 - (i % 3) * 6, 0.8, 1.4 + i, i % 2 ? '#E8873A' : '#C9662A');
        ctx.restore();
        const wrongK = ep(t, Wt('v11', '누가'), 0.4), rightK = ep(t, Wt('v11', '이미'), 0.5);
        withT(ctx, 1390, 770, 1, 0, wrongK * (1 - rightK), () => { P.cross(ctx, -190, 0, 22); text(ctx, '누가 떨어뜨린 잎', -150, 0, 34, C.red, 8, 'left'); });
        withT(ctx, 1390, 770, Ease.back(rightK), 0, rightK, () => { P.check(ctx, -220, 0, 22); text(ctx, '이미 떨어진 잎 = 낙엽', -180, 0, 34, C.green, 8, 'left'); });
        const lk = pop(t, Wt('v11', '완료')); withT(ctx, 1600, 440, lk.sc, 0.06, lk.a, () => pill(ctx, 'P.P. = 완료 상태', 0, 0, 30, C.violet, '#fff', 9));
      });
    });
    // part 4: key question
    if (t > v12 - 0.3) {
      const a = ep(t, v12, 0.5);
      withT(ctx, 0, 0, 1, 0, a, () => {
        ctx.fillStyle = 'rgba(251,247,239,0.94)'; ctx.fillRect(0, 0, 1920, 1080);
        text(ctx, '명사 뒤의 분사를 만나면?', 960, 300, 52, C.ink2, 8);
        const k1 = pop(t, Wt('v12', '하는 쪽')), k2 = pop(t, Wt('v12', '받는 쪽'));
        withT(ctx, 640, 520, k1.sc, -0.03, k1.a, () => { shadowOn(ctx); fillRR(ctx, -260, -110, 520, 220, 40, C.teal); shadowOff(ctx); text(ctx, '하는 쪽?', 0, -20, 64, '#fff', 9); text(ctx, '→ V-ing', 0, 50, 40, '#DFFBF8', 8); });
        withT(ctx, 1280, 520, k2.sc, 0.03, k2.a, () => { shadowOn(ctx); fillRR(ctx, -260, -110, 520, 220, 40, C.violet); shadowOff(ctx); text(ctx, '받는 쪽?', 0, -20, 64, '#fff', 9); text(ctx, '→ P.P.', 0, 50, 40, '#EEE8FF', 8); });
      });
    }
  },
  sfx() { return [[S('v1') + 0.4, 'swish', 0.5], [Wt('v1', 'P.P.'), 'swish', 0.5], [Wt('v2', '하는 쪽'), 'pop', 0.6], [Wt('v2', '받는 쪽'), 'pop', 0.6], [S('v3') + 0.3, 'pop', 0.6], [S('v4') + 0.3, 'pop', 0.6],
    [S('v4') + 0.2, 'draw', 0.5], [S('v5') - 0.2, 'whoosh', 0.4], ...['v6a', 'v6b', 'v7a', 'v7b', 'v8a', 'v8b'].map(s => [S(s) - 0.1, 'pop', 0.6]), [S('v9'), 'thud', 0.8],
    [S('v10'), 'swish', 0.5], [Wt('v10', '잠잘 때'), 'correct', 0.4], [S('v11'), 'swish', 0.5], [Wt('v11', '이미'), 'correct', 0.4], [Wt('v12', '하는 쪽'), 'pop', 0.7], [Wt('v12', '받는 쪽'), 'pop', 0.7]]; },
};

// =====================================================================
// 6. COMBINE
// =====================================================================
const combine = {
  id: 'combine',
  draw(ctx, t) {
    const c2 = S('c2'), c3 = S('c3'), c4 = S('c4'), c5 = S('c5'), c6 = S('c6'), c7 = S('c7');
    const anat = ep(t, c6 - 0.2, 0.7, 'inOut');
    // stage
    withT(ctx, 0, 0, 1, 0, 1 - anat * 0.95, () => {
      // inside
      fillRR(ctx, 90, 380, 1000, 480, 30, '#F4E7D3');
      // outside
      fillRR(ctx, 1130, 380, 700, 480, 30, '#DCEEFF');
      ctx.fillStyle = '#9ED39B'; ctx.fillRect(1130, 800, 700, 60);
      P.tree(ctx, 1730, 820, 0.55, '#7CCB7A');
      floor(ctx, 860, 90, 1830);
      const open = ep(t, Wt('c5t', '미소를'), 0.8);
      P.door(ctx, 1010, 860, 190, 380, { open, color: '#7E9CD8' });
      const smile = (t > Wt('c3', 'with a smile') && t < c4) || t > c5;
      person(ctx, { x: 760, y: 860, s: 0.95, kid: true, shirt: C.orange, pants: '#3D5A80', hair: '#4A3426', hairStyle: 'spiky', mouth: smile ? 'big' : 'smile', blink: blinkAt(t), armF: open > 0 ? -1.2 : 0.1 });
      // man outside
      const mk = ep(t, Wt('c4', 'the man') - 0.3, 0.6);
      const glow = win(t, Wt('c4', 'standing'), c5 + 2, 0.3, 0.5);
      if (glow > 0) { ctx.save(); ctx.globalAlpha = glow * 0.6; const g = ctx.createRadialGradient(1480, 680, 10, 1480, 680, 240); g.addColorStop(0, 'rgba(47,123,246,0.45)'); g.addColorStop(1, 'rgba(47,123,246,0)'); ctx.fillStyle = g; ctx.fillRect(1200, 400, 560, 460); ctx.restore(); }
      withT(ctx, 0, 0, 1, 0, Math.max(mk, t > c5 ? 1 : 0), () => person(ctx, { x: 1480, y: 860, s: 1.0, coat: '#8B6A4A', shirt: '#8B6A4A', pants: '#3A3F52', hair: '#2B2222', hat: 'fedora', face: -1, blink: blinkAt(t, 1.5), mouth: 'smile' }));
      if (smile) stars(ctx, 760, 560, t, 0.8, 5, 70);
    });
    // row
    const a3 = Wt('c3', 'with a smile'), a4 = Wt('c4', 'for'), a5 = Wt('c5', 'with a smile');
    const items = [
      { key: 'open', text: 'Open', kind: 'core', g: 0, at: c2 - 0.1 }, { key: 'door', text: (t < a3 || (t > c4 - 0.2 && t < a4)) ? 'the door.' : 'the door', kind: 'core', g: 0, at: c2 - 0.1 },
      { key: 'smile1', text: 'with a smile.', kind: 'act', g: 1, at: a3, out: c4 - 0.3 },
      { key: 'smile', text: 'with a smile', kind: 'act', g: 2, at: a5 },
      { key: 'for', text: 'for', kind: 'act', g: 3, at: a4 }, { key: 'man', text: 'the man', kind: 'act', g: 3, at: a4 },
      { key: 'stand', text: 'standing outside.', kind: 'noun', g: 4, at: Wt('c4', 'standing') - 0.1 }];
    const rowY = lerp(250, 470, anat), size = lerp(48, 56, anat);
    const R = sentenceRow(ctx, t, items, 960, rowY, size);
    const preA = 1 - anat;
    arcAbove(ctx, R, 'smile1', 'open', C.orange, ep(t, Wt('c3t', '동작'), 0.5) * (1 - ep(t, c4 - 0.4, 0.3)), '동작 설명');
    arcBelow(ctx, R, 'stand', 'man', C.blue, ep(t, Wt('c4t', '남자를 설명'), 0.6) * (1 - ep(t, c5 - 0.3, 0.3)), '명사 설명');
    // anatomy
    if (anat > 0) {
      arcAbove(ctx, R, 'smile', 'open', C.orange, ep(t, Wt('c6', '웃는 얼굴'), 0.7), '동작 설명: 어떻게?', 90);
      arcBelow(ctx, R, 'stand', 'man', C.blue, ep(t, Wt('c6', '서 있는'), 0.7), '명사 설명: 어떤 남자?');
      arcAbove(ctx, R, 'for', 'open', 'rgba(255,122,47,0.6)', ep(t, Wt('c6', '화살표'), 0.6) * 1, '누구를 위해?', 230);
      const hk = pop(t, c6); withT(ctx, 960, 190, hk.sc, 0, hk.a, () => pill(ctx, '문장 해부', 0, 0, 40, C.navy, '#fff', 9));
      text(ctx, '밖에 서 있는 남자를 위해 미소를 지으며 문을 열어 줘.', 960, 760, 38, C.ink, 7, 'center', ep(t, c6 + 0.4, 0.5) * (1 - ep(t, c7, 0.4)));
      wheelsUnder(ctx, R, [['open', 'door'], ['smile', 'smile'], ['for', 'man'], ['stand', 'stand']], t, ep(t, c7 + 0.2, 0.5));
      const tk = ep(t, c7 + 0.6, 0.5);
      text(ctx, '핵심 문장 1개 + 설명 칸 = 긴 문장 완성!', 960, 760, 42, C.navy, 9, 'center', tk);
    }
  },
  sfx() { return [[S('c2') - 0.1, 'pop', 0.7], [Wt('c3', 'with a smile'), 'click', 0.8], [Wt('c3t', '동작'), 'draw', 0.6], [S('c4') - 0.3, 'swish', 0.4], [Wt('c4', 'for'), 'click', 0.7], [Wt('c4', 'standing'), 'click', 0.8],
    [Wt('c4t', '남자를 설명'), 'draw', 0.6], [Wt('c5', 'with a smile'), 'click', 0.8], [Wt('c5t', '미소를'), 'sparkle', 0.5], [S('c6'), 'whoosh', 0.5], [Wt('c6', '웃는 얼굴'), 'draw', 0.6], [Wt('c6', '서 있는'), 'draw', 0.6], [S('c7') + 0.2, 'click', 0.7], [S('c7') + 0.6, 'sparkle', 0.6]]; },
};

// =====================================================================
// 7. TALK (practice)
// =====================================================================
const talk = {
  id: 'talk',
  draw(ctx, t) {
    const p1 = S('p1'), p2 = S('p2'), p6 = S('p6');
    // stairs intro
    const sa = win(t, p1 - 0.2, p2 - 0.2, 0.5, 0.5);
    if (sa > 0) withT(ctx, 0, 0, 1, 0, sa, () => {
      const labels = [['짧게 시작', C.navy], ['+ 한 칸', C.blue], ['+ 한 칸', C.blue]];
      labels.forEach(([s, c], i) => { const k = ep(t, Wt('p1', '짧게') + i * 0.6, 0.6, 'back');
        const x = 560 + i * 300, h = 140 + i * 130; withT(ctx, x, 860, 1, 0, clamp(k), () => { ctx.translate(0, (1 - k) * 80); shadowOn(ctx); fillRR(ctx, -140, -h, 280, h, 18, c); shadowOff(ctx); text(ctx, s, 0, -h + 50, 36, '#fff', 9); }); });
      const step = clamp(Math.floor((t - Wt('p1', '짧게')) / 0.6 + 0.5), 0, 2);
      const hop = Math.abs(Math.sin((t - Wt('p1', '짧게')) * Math.PI / 0.6)) * 40;
      if (t > Wt('p1', '짧게')) person(ctx, { x: 560 + step * 300, y: 860 - (140 + step * 130) - hop, s: 0.7, shirt: C.teal, hair: '#2F2622', mouth: 'big', armF: -2.4, armB: -2.4 });
      text(ctx, '처음부터 길게? NO!', 960, 250, 48, C.red, 9, 'center', ep(t, Wt('p1', '처음부터'), 0.4) * (1 - ep(t, Wt('p1', '짧게'), 0.4)));
    });
    // part A: I saw a man
    const aA = win(t, p2 - 0.4, p6 - 0.2, 0.5, 0.5);
    if (aA > 0) withT(ctx, 0, 0, 1, 0, aA, () => {
      const outK = ep(t, Wt('p3', 'standing') - 0.2, 0.8), umK = ep(t, Wt('p4', 'umbrella') - 0.3, 0.9);
      // scene card
      card(ctx, 1020, 330, 780, 520, '#fff');
      ctx.save(); rr(ctx, 1020, 330, 780, 520, 28); ctx.clip();
      ctx.save(); ctx.globalAlpha = outK; ctx.fillStyle = '#C8D6EC'; ctx.fillRect(1020, 330, 780, 520); // rainy sky
      fillRR(ctx, 1060, 450, 230, 360, 8, '#E3D2BC'); P.door(ctx, 1110, 810, 130, 260, {});
      ctx.fillStyle = '#5B667E'; ctx.fillRect(1700, 430, 10, 380); ctx.fillStyle = '#FFE680'; ctx.beginPath(); ctx.arc(1705, 425, 24, 0, 7); ctx.fill();
      ctx.restore();
      // rain
      if (umK > 0) { ctx.strokeStyle = `rgba(80,120,190,${0.5 * umK})`; ctx.lineWidth = 3; for (let i = 0; i < 40; i++) { const x = 1030 + (i * 97) % 770, y = 330 + ((t * 600 + i * 131) % 520); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 22); ctx.stroke(); } }
      ctx.fillStyle = 'rgba(28,40,64,0.12)'; ctx.fillRect(1020, 810, 780, 40);
      const mp = pop(t, p2, 0.5);
      withT(ctx, 1460, 812, mp.sc, 0, mp.a, () => {
        person(ctx, { x: 0, y: 0, s: 1.0, coat: '#556B8E', shirt: '#556B8E', pants: '#2E3550', hair: '#2B2222', blink: blinkAt(t), armF: lerp(0.1, -0.5, umK), elbow: lerp(0, -1.0, umK), mouth: 'smile',
          hand: umK > 0 ? (c, x, y) => P.umbrella(c, x, y + 40, 1.0, umK, C.yellow) : null });
      });
      ctx.restore();
      const items = [{ key: 'i', text: t < Wt('p3', 'standing') ? 'I saw a man.' : 'I saw a man', kind: 'core', g: 0, at: p2 - 0.2 },
        { key: 'st', text: t < Wt('p4', 'with') ? 'standing outside.' : 'standing outside', kind: 'noun', g: 1, at: Wt('p3', 'standing') - 0.1 },
        { key: 'um', text: 'with an umbrella.', kind: 'noun', g: 2, at: Wt('p4', 'with') - 0.1 }];
      const R = sentenceRow(ctx, t, items, 960, 230, 50);
      // target 'a man' approx: arc to core center-right
      const man = R.i ? { cx: R.i.x + R.i.w - measure('a man', 50, 7) / 2, bot: R.i.bot, top: R.i.top } : null;
      if (man) { const RR = { ...R, man }; arcBelow(ctx, RR, 'st', 'man', C.blue, ep(t, Wt('p5', '두 칸'), 0.6), '어떤 남자?'); arcBelow(ctx, RR, 'um', 'man', C.blue, ep(t, Wt('p5', '두 칸') + 0.4, 0.6)); }
      text(ctx, '우산을 들고 밖에 서 있는 남자를 봤어.', 520, 600, 38, C.ink, 7, 'center', win(t, S('p5'), p6, 0.4, 0.3));
      [['p2', 'p2p'], ['p3', 'p3p'], ['p4', 'p4p']].forEach(([n, p]) => practiceUI(ctx, t, n, p, 560, 520));
    });
    // part B: cafe
    const aB = win(t, p6 - 0.3, En('p9') + 3, 0.5, 0.5);
    if (aB > 0) withT(ctx, 0, 0, 1, 0, aB, () => {
      const ck = pop(t, p6 + 0.2); withT(ctx, 960, 190, ck.sc, 0, ck.a, () => pill(ctx, '카페에서', 0, 0, 36, C.navy, '#fff', 9));
      const iceK = ep(t, Wt('p8', 'cold'), 0.6);
      card(ctx, 1180, 330, 560, 500, '#fff');
      fillRR(ctx, 1180, 700, 560, 130, 0, '#C99A68'); ctx.save(); rr(ctx, 1180, 330, 560, 500, 28); ctx.clip(); ctx.fillStyle = '#B88A58'; ctx.fillRect(1180, 700, 560, 14); ctx.restore();
      const cp = pop(t, S('p7'), 0.5);
      withT(ctx, 1460, 700, cp.sc, 0, cp.a, () => { P.cup(ctx, 0, 0, 1.1, { ice: iceK, drink: iceK > 0.5 ? '#E8873A' : '#F2A541' }); });
      for (let i = 0; i < 6; i++) { if (iceK > 0) P.sparkle(ctx, 1460 + Math.cos(i + t) * 150, 520 + Math.sin(i * 2 + t) * 110, 12, '#8FD3FF', t + i); }
      const items = [{ key: 'like', text: "I'd like", kind: 'core', g: 0, at: S('p7') - 0.2 }, { key: 'some', text: 'something', kind: 'core', g: 0, at: S('p7') - 0.2 },
        { key: 'cold', text: 'cold', kind: 'noun', g: 1, at: Wt('p8', 'cold') - 0.15 }, { key: 'drink', text: 'to drink.', kind: 'noun', g: 2, at: S('p7') + 0.4 }];
      const R = sentenceRow(ctx, t, items, 620, 460, 50);
      arcBelow(ctx, R, 'drink', 'some', C.blue, ep(t, S('p7') + 0.8, 0.5));
      arcAbove(ctx, R, 'cold', 'some', C.blue, ep(t, Wt('p8', 'cold') + 0.4, 0.5), '뒤에서 꾸며요!');
      [['p7', 'p7p'], ['p8', 'p8p']].forEach(([n, p]) => practiceUI(ctx, t, n, p, 640, 680));
      // rule card
      const rk = ep(t, S('p9'), 0.6);
      withT(ctx, 620, 700, Ease.back(rk), 0, rk, () => {
        card(ctx, -460, -110, 920, 220, '#fff'); fillRR(ctx, -460, -110, 16, 220, 8, C.blue);
        text(ctx, 'something / anything + 형용사', -410, -50, 38, C.ink, 9, 'left');
        P.check(ctx, -385, 30, 20); text(ctx, 'something cold', -350, 30, 36, C.green, 8, 'left');
        P.cross(ctx, 85, 30, 20); text(ctx, 'cold something', 120, 30, 36, C.red, 8, 'left');
      });
    });
  },
  sfx() { const L = [[Wt('p1', '짧게'), 'pop', 0.6], [Wt('p1', '짧게') + 0.6, 'pop', 0.6], [Wt('p1', '짧게') + 1.2, 'pop', 0.6], [S('p2') - 0.2, 'pop', 0.7], [Wt('p3', 'standing') - 0.1, 'click', 0.8], [Wt('p4', 'with') - 0.1, 'click', 0.8],
    [Wt('p4', 'umbrella'), 'swish', 0.5], [Wt('p5', '두 칸'), 'draw', 0.6], [S('p6'), 'whoosh', 0.5], [S('p7'), 'pop', 0.6], [Wt('p8', 'cold') - 0.15, 'click', 0.8], [Wt('p8', 'cold'), 'sparkle', 0.6], [S('p9'), 'swish', 0.5]];
    ['p2p', 'p3p', 'p4p', 'p7p', 'p8p'].forEach(p => L.push([S(p), 'tick', 0.5])); return L; },
};

// =====================================================================
// 8. QUIZ
// =====================================================================
function countdown(ctx, t, pid, x, y) {
  const p = SEG[pid]; if (t < p.start - 0.1 || t > p.end + 0.2) return;
  const k = clamp((t - p.start) / (p.end - p.start)); const a = win(t, p.start - 0.1, p.end + 0.2, 0.2, 0.2);
  const n = Math.max(1, Math.ceil(3 * (1 - k)));
  withT(ctx, x, y, 1, 0, a, () => {
    ctx.fillStyle = '#fff'; shadowOn(ctx, 16, 5); ctx.beginPath(); ctx.arc(0, 0, 58, 0, 7); ctx.fill(); shadowOff(ctx);
    ctx.strokeStyle = '#E8ECF3'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 58, 0, 7); ctx.stroke();
    ctx.strokeStyle = C.orange; ctx.beginPath(); ctx.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); ctx.stroke();
    const pk = 1 + 0.25 * (1 - ((3 * (1 - k)) % 1)); withT(ctx, 0, 0, pk, 0, 1, () => text(ctx, String(n), 0, 2, 56, C.ink, 9));
  });
}
function option(ctx, t, x, y, w, label, s, correct, revealT, sizeT = 44) {
  const rev = ep(t, revealT, 0.4);
  const bg = rev > 0 ? (correct ? C.greenL : '#F3F4F7') : '#fff', bd = rev > 0 ? (correct ? C.green : '#DDE1EA') : '#D5DCE8';
  const sc = correct ? 1 + 0.06 * Ease.back(rev) * (1 - ep(t, revealT + 0.6, 0.4)) : 1;
  withT(ctx, x, y, sc, 0, correct ? 1 : 1 - rev * 0.5, () => {
    shadowOn(ctx, 16, 5, 'rgba(30,40,70,0.1)'); fillRR(ctx, -w / 2, -60, w, 120, 26, bg); shadowOff(ctx); rr(ctx, -w / 2, -60, w, 120, 26); ctx.strokeStyle = bd; ctx.lineWidth = 4; ctx.stroke();
    fillRR(ctx, -w / 2 + 24, -32, 64, 64, 18, rev > 0 && correct ? C.green : C.navy); text(ctx, label, -w / 2 + 56, 2, 36, '#fff', 9);
    text(ctx, s, -w / 2 + 120, 2, sizeT, C.ink, 8, 'left');
    if (rev > 0 && correct) P.check(ctx, w / 2 - 50, 0, 26, C.green, rev);
  });
}
const quiz = {
  id: 'quiz',
  draw(ctx, t) {
    const q0 = S('q0');
    const ta = win(t, q0 - 0.3, S('q1') - 0.1, 0.4, 0.4);
    if (ta > 0) withT(ctx, 960, 470, Ease.back(ep(t, q0, 0.6)), Math.sin(t * 3) * 0.02, ta, () => {
      shadowOn(ctx, 30, 10); fillRR(ctx, -420, -130, 840, 260, 60, C.navy); shadowOff(ctx);
      text(ctx, 'QUIZ TIME', 0, -10, 120, C.yellow, 9); text(ctx, '3초 안에 답해 보세요!', 0, 80, 34, '#fff', 7);
    });
    if (ta > 0) stars(ctx, 960, 470, t, ta, 12, 520);
    const Q = [
      { s: 'q1', p: 'q1p', a: 'q1a', n: 2, ko: '노래하고 있는 소녀', en: ['the girl', '______', 'a song'], ans: 'singing', opts: [['A', 'singing', true], ['B', 'sung', false]] },
      { s: 'q2', p: 'q2p', a: 'q2a', n: 3, ko: '영어로 쓰인 편지', en: ['a letter', '______', 'in English'], ans: 'written', opts: [['A', 'writing', false], ['B', 'written', true]] },
      { s: 'q3', p: 'q3p', a: 'q3a', n: 4, ko: '노란색 표현은 무엇을 설명할까요?', q3: true, opts: [['A', 'Open  (동작)', false], ['B', 'the man  (명사)', true]] },
      { s: 'q4', p: 'q4p', a: 'q4a', n: 5, ko: '선물을 들고 문 앞에 있는 소년', q4: true },
    ];
    Q.forEach((q, i) => {
      const st = S(q.s), en = i < 3 ? S(Q[i + 1].s) : TL_END();
      if (t < st - 0.6 || t > en + 0.3) return;
      const a = win(t, st - 0.4, en - 0.05, 0.4, 0.35); const slide = (1 - ep(t, st - 0.4, 0.6)) * 120;
      const rev = S(q.a);
      withT(ctx, slide, 0, 1, 0, a, () => {
        card(ctx, 200, 150, 1520, 720, '#fff', 36);
        fillRR(ctx, 250, 195, 120, 64, 20, C.orange); text(ctx, `Q${i + 1}`, 310, 228, 38, '#fff', 9);
        text(ctx, q.ko, 400, 228, 42, C.ink, 8, 'left');
        if (q.en) {
          const items = [{ key: 'a', text: q.en[0], kind: 'ghost', g: 0 }, { key: 'b', text: t < rev ? q.en[1] : q.ans, kind: t < rev ? 'hl' : 'good', g: 1 }, { key: 'c', text: q.en[2], kind: 'ghost', g: 2 }];
          sentenceRow(ctx, t, items, 960, 400, 60, { noPop: true });
          q.opts.forEach(([l, s, c], j) => option(ctx, t, 640 + j * 640, 640, 560, l, s, c, rev));
        }
        if (q.q3) {
          const items = [{ key: 'open', text: 'Open', kind: 'ghost', g: 0 }, { key: 'door', text: 'the door', kind: 'ghost', g: 0 }, { key: 'smile', text: 'with a smile', kind: 'ghost', g: 1 }, { key: 'for', text: 'for', kind: 'ghost', g: 2 }, { key: 'man', text: 'the man', kind: 'ghost', g: 2 }, { key: 'stand', text: 'standing outside.', kind: t < rev ? 'hl' : 'noun', g: 3 }];
          const R = sentenceRow(ctx, t, items, 960, 390, 46, { noPop: true });
          arcBelow(ctx, R, 'stand', 'man', C.blue, ep(t, rev + 0.6, 0.6));
          q.opts.forEach(([l, s, c], j) => option(ctx, t, 640 + j * 640, 680, 560, l, s, c, rev, 40));
        }
        if (q.q4) {
          const chunks = ['the boy', 'at the door', 'holding a gift']; const shuf = [2, 0, 1];
          const size = 50; const ws = chunks.map(c => measure(c, size, 8) + 60);
          const gap = 30; const total = ws.reduce((x, y) => x + y, 0) + gap * 2;
          const orderX = []; let x = 960 - total / 2; chunks.forEach((c, j) => { orderX[j] = x + ws[j] / 2; x += ws[j] + gap; });
          const shufX = []; x = 960 - total / 2; shuf.forEach((ci) => { shufX[ci] = x + ws[ci] / 2; x += ws[ci] + gap; });
          const mk = ep(t, rev - 0.1, 0.9, 'inOut');
          chunks.forEach((c, j) => {
            const cx = lerp(shufX[j], orderX[j], mk), cy = 470 + Math.sin(mk * Math.PI) * (j === 0 ? -90 : j === 2 ? 90 : 0);
            const col = j === 0 ? C.navy : C.blue;
            withT(ctx, cx, cy, 1, 0, 1, () => { shadowOn(ctx, 16, 6); fillRR(ctx, -ws[j] / 2, -48, ws[j], 96, 22, j === 0 ? C.navy : C.blueL); shadowOff(ctx); if (j) { rr(ctx, -ws[j] / 2, -48, ws[j], 96, 22); ctx.strokeStyle = C.blue; ctx.lineWidth = 3.5; ctx.stroke(); } text(ctx, c, 0, 2, size, j === 0 ? '#fff' : C.blueD, 8); });
          });
          text(ctx, '덩어리를 순서대로 배열하세요', 960, 330, 34, C.ink2, 7, 'center', 1 - ep(t, rev, 0.4));
          const ok = pop(t, S('q4b'), 0.5);
          withT(ctx, 960, 680, ok.sc, 0, ok.a, () => { P.check(ctx, -260, 0, 34); text(ctx, '명사 먼저, 설명은 뒤로!', 30, 0, 50, C.green, 9); });
        }
        countdown(ctx, t, q.p, 1600, 228 + 0);
        if (t > rev) { const ck = ep(t, rev, 0.5); withT(ctx, 1600, 228, 1, 0, ck, () => { P.check(ctx, 0, 0, 44 * Ease.back(ck), C.green, 1); }); }
      });
    });
  },
  sfx() { const L = [[S('q0'), 'sparkle', 0.8], [S('q0') + 0.1, 'thud', 0.7]];
    ['q1', 'q2', 'q3', 'q4'].forEach(q => { L.push([S(q) - 0.4, 'whoosh', 0.5]); const p = SEG[q + 'p']; for (let k = 0; k < 3; k++) L.push([p.start + k * (p.end - p.start) / 3, 'tick', 0.8]); L.push([S(q + 'a'), 'correct', 0.9]); });
    L.push([S('q4a') - 0.1, 'swish', 0.5]); return L; },
};
function TL_END() { return E.TL.scenes[8].end + 0.6; }

// =====================================================================
// 9. RECAP
// =====================================================================
const recap = {
  id: 'recap',
  draw(ctx, t) {
    const r1 = S('r1'), r5 = S('r5'), r6 = S('r6'), r7 = S('r7');
    const ha = 1 - ep(t, r5 - 0.2, 0.5);
    const hk = pop(t, r1); withT(ctx, 960, 190, hk.sc, 0, hk.a * ha, () => pill(ctx, '오늘의 핵심 3줄 정리', 0, 0, 40, C.navy, '#fff', 9));
    const cards = [
      ['r2', '1', '영어 문장 = 핵심 문장 + 추가 정보', '기관차(핵심 문장)에 설명 칸을 연결하는 기차', C.navy],
      ['r3', '2', '화살표 방향을 찾자', '명사 설명(파랑)인가? 동작 설명(주황)인가?', C.blue],
      ['r4', '3', '명사 설명: 형용사만 앞, 나머지는 뒤', '하는 쪽은 V-ing · 받는 쪽은 P.P.', C.orange],
    ];
    cards.forEach(([id, n, h, s, col], i) => {
      const k = ep(t, S(id), 0.6, 'back'); const y = 330 + i * 175;
      withT(ctx, lerp(-600, 0, clamp(k)), 0, 1, 0, clamp(k) * ha, () => {
        card(ctx, 260, y - 75, 1400, 150, '#fff', 30); fillRR(ctx, 260, y - 75, 20, 150, 10, col);
        fillRR(ctx, 310, y - 40, 80, 80, 24, col); text(ctx, n, 350, y + 2, 46, '#fff', 9);
        text(ctx, h, 430, y - 22, 44, C.ink, 9, 'left'); text(ctx, s, 430, y + 32, 30, C.ink2, 6, 'left');
        if (i === 0) { P.engine(ctx, 1450, y + 28, 90, 50, C.navy); fillRR(ctx, 1550, y - 22, 70, 50, 10, C.blue); }
        if (i === 1) { arrow(ctx, 1450, y + 10, 1600, y + 10, -40, C.orange, 1, 6); arrow(ctx, 1450, y + 30, 1600, y + 30, 40, C.blue, 1, 6); }
      });
    });
    // slogan
    if (t > r5 - 0.3) {
      const sa = 1 - ep(t, r6 - 0.2, 0.5);
      const k1 = pop(t, r5, 0.6), k2 = pop(t, Wt('r5', '단어를'), 0.6);
      withT(ctx, 960, 400, k1.sc, 0, k1.a * sa, () => { text(ctx, '짧게 말하고,', 0, -70, 90, C.ink, 9); text(ctx, '한 칸씩 붙이자!', 0, 50, 100, C.orange, 9); });
      withT(ctx, 960, 650, k2.sc, 0, k2.a * sa, () => pill(ctx, '외우지 말고, 장면을 그리세요', 0, 0, 40, C.blue, '#fff', 8));
      stars(ctx, 960, 420, t, k1.a * sa, 10, 480);
    }
    // outro
    if (t > r6 - 0.3) {
      const oa = ep(t, r6, 0.5);
      withT(ctx, 0, 0, 1, 0, oa, () => {
        const b1 = pop(t, Wt('r6', '구독')), b2 = pop(t, Wt('r6', '좋아요'));
        withT(ctx, 760, 330, b1.sc, 0, b1.a, () => { shadowOn(ctx); fillRR(ctx, -170, -55, 340, 110, 55, '#E5322D'); shadowOff(ctx); text(ctx, '구독', 0, 2, 46, '#fff', 9); });
        withT(ctx, 1160, 330, b2.sc, 0, b2.a, () => { shadowOn(ctx); fillRR(ctx, -170, -55, 340, 110, 55, '#fff'); shadowOff(ctx); text(ctx, '좋아요', 0, 2, 46, C.ink, 9); });
        const cast = [
          { x: 420, o: { shirt: '#4B6BD6', hair: '#2B2222', glasses: true, mustache: true } },
          { x: 680, o: { kid: true, shirt: C.orange, hair: '#4A3426', hairStyle: 'spiky' } },
          { x: 940, o: { shirt: '#FF7FB0', hair: '#4A3426', hairStyle: 'long' } },
          { x: 1200, o: { shirt: '#fff', hair: '#2B2222', hat: 'chef' } },
          { x: 1460, o: { coat: '#8B6A4A', shirt: '#8B6A4A', hair: '#2B2222', hat: 'fedora' } }];
        cast.forEach((c, i) => { const k = ep(t, r6 + 0.3 + i * 0.15, 0.6, 'back'); withT(ctx, 0, (1 - k) * 300, 1, 0, clamp(k * 2), () => person(ctx, { x: c.x, y: 860, s: 0.85, mouth: 'big', blink: blinkAt(t, i), armF: -2.7 + Math.sin(t * 7 + i) * 0.3, elbow: -0.3, ...c.o })); });
        floor(ctx, 860, 200, 1720);
        const sk = pop(t, r7 - 0.1, 0.6); withT(ctx, 960, 510, sk.sc, 0, sk.a, () => text(ctx, 'See you next time!', 0, 0, 84, C.navy, 9));
      });
    }
  },
  sfx() { return [[S('r1'), 'pop', 0.7], [S('r2'), 'swish', 0.6], [S('r3'), 'swish', 0.6], [S('r4'), 'swish', 0.6], [S('r5'), 'sparkle', 0.8], [Wt('r5', '단어를'), 'pop', 0.6], [Wt('r6', '구독'), 'pop', 0.7], [Wt('r6', '좋아요'), 'pop', 0.7], [S('r7') - 0.1, 'correct', 0.7]]; },
};

module.exports = [hook, formula, doorScene, noun6, grow, ving, combine, talk, quiz, recap];
