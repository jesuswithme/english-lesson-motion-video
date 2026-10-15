const WORK = process.env.WORK || '/home/claude/work';
const fs = require('fs');
const { spawn } = require('child_process');
const E_ = require('./engine');
const { createCanvas, WIDTH, HEIGHT, FPS, TL, SUBS, C, clamp, ep, Ease, text, fillRR, rr, measure, shadowOn, shadowOff, font, lerp } = E_;
const SCENES = require('./scenes');

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// scene boundaries
const B = TL.scenes.map((s, i) => i === 0 ? 0 : s.start - 0.62);
function sceneIndex(t) { let i = 0; while (i + 1 < B.length && t >= B[i + 1]) i++; return i; }

function background(t) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // soft blobs
  const blobs = [[0.15, 0.2, 380, 'rgba(47,123,246,0.07)'], [0.85, 0.75, 420, 'rgba(255,122,47,0.07)'], [0.7, 0.15, 260, 'rgba(255,200,61,0.08)']];
  blobs.forEach(([x, y, r, c], i) => {
    const bx = x * WIDTH + Math.sin(t * 0.13 + i * 2) * 60, by = y * HEIGHT + Math.cos(t * 0.11 + i) * 40;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  });
  // dot grid
  ctx.fillStyle = 'rgba(28,40,64,0.075)';
  const off = (t * 8) % 48;
  for (let y = -48 + off; y < HEIGHT + 48; y += 48) for (let x = -48 + off * 0.5; x < WIDTH + 48; x += 48) { ctx.fillRect(x, y, 3, 3); }
}

function overlays(t, si) {
  const sc = TL.scenes[si];
  // chapter pill top-left
  if (si > 0) {
    const k = ep(t, B[si] + 0.5, 0.6);
    const label = sc.title; const num = String(si).padStart(2, '0');
    const w = measure(label, 28, 6) + 110;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(lerp(-40, 0, k), 0);
    shadowOn(ctx, 14, 4, 'rgba(30,40,70,0.10)'); fillRR(ctx, 48, 38, w, 58, 29, '#fff'); shadowOff(ctx);
    fillRR(ctx, 54, 44, 70, 46, 23, C.navy); text(ctx, num, 89, 68, 26, '#fff', 8);
    text(ctx, label, 140, 68, 28, C.ink, 6, 'left'); ctx.restore();
  }
  // brand top-right
  ctx.save(); ctx.globalAlpha = 0.9;
  const bw = measure('문장 확장 원리', 24, 7) + 74;
  ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(WIDTH - 48 - bw + 22, 67, 9, 0, 7); ctx.fill();
  ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(WIDTH - 48 - bw + 44, 67, 9, 0, 7); ctx.fill();
  text(ctx, '문장 확장 원리', WIDTH - 48, 67, 24, C.ink2, 7, 'right'); ctx.restore();
  // progress bar
  const p = clamp(t / TL.duration);
  ctx.fillStyle = 'rgba(28,40,64,0.08)'; ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);
  const g = ctx.createLinearGradient(0, 0, WIDTH, 0); g.addColorStop(0, C.blue); g.addColorStop(1, C.orange);
  ctx.fillStyle = g; ctx.fillRect(0, HEIGHT - 8, WIDTH * p, 8);
  TL.scenes.forEach((s, i) => { if (i) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(WIDTH * (B[i] / TL.duration) - 1.5, HEIGHT - 8, 3, 8); } });
  // subtitles
  const cur = SUBS.find(s => t >= s.start && t < s.end);
  if (cur) {
    const k = clamp((t - cur.start) / 0.12) * clamp((cur.end - t) / 0.12);
    const en = cur.lang === 'en'; const size = en ? 44 : 42;
    const w = measure(cur.text, size, en ? 7 : 6);
    const bw = w + 64 + (en ? 70 : 0), bh = 72, bx = WIDTH / 2 - bw / 2, by = HEIGHT - 120;
    ctx.save(); ctx.globalAlpha = k;
    fillRR(ctx, bx, by, bw, bh, 18, en ? 'rgba(26,36,60,0.86)' : 'rgba(20,26,40,0.78)');
    if (en) { fillRR(ctx, bx + 18, by + 18, 52, 36, 9, C.yellow); text(ctx, 'EN', bx + 44, by + 37, 20, C.navy, 9); }
    text(ctx, cur.text, bx + 32 + (en ? 70 : 0) + w / 2, by + bh / 2 + 1, size, en ? '#FFE08A' : '#fff', en ? 7 : 6);
    ctx.restore();
  }
}

// diagonal band wipe transition
function transition(t) {
  for (let i = 1; i < B.length; i++) {
    const d = t - B[i];
    if (d > -0.5 && d < 0.5) {
      const k = (d + 0.5); // 0..1
      const cols = [C.blue, C.orange, C.navy];
      cols.forEach((c, j) => {
        const kk = Ease.inOut(clamp(k * 1.25 - j * 0.1));
        const x = lerp(-WIDTH * 1.4, WIDTH * 1.4, kk);
        ctx.save(); ctx.fillStyle = c; ctx.beginPath();
        ctx.moveTo(x - 200, 0); ctx.lineTo(x + WIDTH * 0.75, 0); ctx.lineTo(x + WIDTH * 0.75 - 400, HEIGHT); ctx.lineTo(x - 600, HEIGHT); ctx.closePath(); ctx.fill(); ctx.restore();
      });
      // chapter card on the wipe
      const ta = clamp((k - 0.3) / 0.12) * clamp((0.68 - k) / 0.12);
      if (ta > 0) {
        ctx.save(); ctx.globalAlpha = ta;
        text(ctx, String(i).padStart(2, '0'), WIDTH / 2, HEIGHT / 2 - 70, 90, C.yellow, 9);
        text(ctx, TL.scenes[i].title, WIDTH / 2, HEIGHT / 2 + 40, 60, '#fff', 8);
        ctx.restore();
      }
    }
  }
}

function frame(t) {
  ctx.save();
  background(t);
  const si = sceneIndex(t);
  const scn = SCENES[si];
  const lt = t - B[si];
  // camera
  const cam = scn.cam ? scn.cam(t) : { z: 1 + 0.025 * Math.sin(lt * 0.15), x: 0, y: 0 };
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2); ctx.scale(cam.z, cam.z); ctx.translate(-WIDTH / 2 - cam.x, -HEIGHT / 2 - cam.y);
  try { scn.draw(ctx, t, lt); } catch (e) { console.error('scene error', scn.id, t, e); throw e; }
  ctx.restore();
  overlays(t, si);
  transition(t);
  ctx.restore();
}

// SFX list
function sfxList() {
  const L = [];
  for (let i = 1; i < B.length; i++) L.push([B[i] - 0.45, 'whoosh', 0.8]);
  SCENES.forEach(s => (s.sfx ? s.sfx() : []).forEach(x => L.push(x)));
  return L.sort((a, b) => a[0] - b[0]);
}

const mode = process.argv[2];
if (mode === 'still') {
  const times = process.argv[3].split(',').map(Number); const dir = process.argv[4] || WORK + '/stills';
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) { frame(t); fs.writeFileSync(`${dir}/f_${t.toFixed(2)}.png`, canvas.toBuffer('image/png')); }
} else if (mode === 'sfx') {
  fs.writeFileSync(WORK + '/audio/sfx_cues.json', JSON.stringify(sfxList()));
  console.log('cues', sfxList().length);
} else if (mode === 'video') {
  const t0 = parseFloat(process.argv[3]), t1 = parseFloat(process.argv[4]), out = process.argv[5];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${WIDTH}x${HEIGHT}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', process.env.PRESET || 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const f0 = Math.round(t0 * FPS), f1 = Math.round(t1 * FPS);
  let f = f0; const st = Date.now();
  function next() {
    while (f < f1) {
      frame(f / FPS);
      const buf = canvas.data();
      f++;
      if (f % 300 === 0) console.error(`[${out}] frame ${f - f0}/${f1 - f0} ${((Date.now() - st) / 1000).toFixed(0)}s`);
      if (!ff.stdin.write(buf)) { ff.stdin.once('drain', next); return; }
    }
    ff.stdin.end();
  }
  ff.on('close', c => { console.error('done', out, c, ((Date.now() - st) / 1000).toFixed(1) + 's'); });
  next();
}
module.exports = { B };
