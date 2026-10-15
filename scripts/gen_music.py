import os as _os
WORK = _os.environ.get("WORK", "/home/claude/work")
"""Original BGM + SFX, synthesized from scratch (no samples, no third-party audio)."""
import numpy as np, soundfile as sf, json, os
from scipy.signal import fftconvolve, butter, sosfilt
SR = 44100
rng = np.random.default_rng(7)
OUT = WORK + "/audio"; os.makedirs(OUT + "/sfx", exist_ok=True)
DUR = json.load(open(OUT + "/timeline.json"))["duration"]

def midi(n): return 440 * 2 ** ((n - 69) / 12)
def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def adsr(n, a=0.005, tau=0.6):
    e = env_exp(n, tau); k = max(1, int(a * SR)); e[:k] *= np.linspace(0, 1, k); return e

def ep_note(f, dur, vel=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 1.0 * t) * 1.2 * env_exp(n, 0.25)  # FM bell-ish tine
    s = np.sin(2 * np.pi * f * t + mod) * 0.6 + np.sin(2 * np.pi * f * 2 * t) * 0.12 * env_exp(n, 0.3)
    s *= adsr(n, 0.004, 0.9) * (1 + 0.04 * np.sin(2 * np.pi * 4.5 * t))
    return s * vel

def pluck(f, dur, vel=0.4):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * env_exp(n, 0.05)
    return s * adsr(n, 0.002, 0.22) * vel

def bass(f, dur, vel=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    s = np.tanh(1.5 * s) * adsr(n, 0.01, 0.5)
    rel = int(0.03 * SR); s[-rel:] *= np.linspace(1, 0, rel)
    return s * vel

def pad(freqs, dur, vel=0.12):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) + 0.3 * np.sin(2 * np.pi * f * 1.003 * t) for f in freqs)
    a = int(0.8 * SR); e = np.ones(n); e[:a] = np.linspace(0, 1, a); e[-a:] = np.linspace(1, 0, a)
    return s * e * vel / len(freqs)

def kick(vel=0.9):
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 45 + 90 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(n, 0.09) * vel

def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos"); return sosfilt(sos, x)
def hp(x, fc):
    sos = butter(2, fc, btype="high", fs=SR, output="sos"); return sosfilt(sos, x)
def lp(x, fc):
    sos = butter(2, fc, btype="low", fs=SR, output="sos"); return sosfilt(sos, x)

def snare(vel=0.45):
    n = int(0.22 * SR); t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 6000) * env_exp(n, 0.05)
    body = np.sin(2 * np.pi * 190 * t) * env_exp(n, 0.03) * 0.5
    return (nz + body) * vel
def hat(vel=0.18):
    n = int(0.05 * SR); return hp(rng.standard_normal(n), 7000) * env_exp(n, 0.012) * vel

# ---- arrangement ----
BPM = 96; BEAT = 60 / BPM; BAR = 4 * BEAT
# chords (root midi for bass, voicing midi for EP)
CH = [
    (48, [60, 64, 67, 71]),  # Cmaj7
    (45, [57, 60, 64, 67]),  # Am7
    (41, [57, 60, 64, 65]),  # Fmaj7 (A C E F)
    (43, [55, 59, 62, 65]),  # G7
    (41, [57, 60, 64, 69]),  # Fmaj7/ add
    (40, [55, 59, 62, 64]),  # Em7
    (38, [57, 60, 62, 65]),  # Dm7
    (43, [55, 60, 62, 67]),  # Gsus
]
nbars = int(np.ceil(DUR / BAR)) + 1
L = np.zeros((int((nbars + 2) * BAR * SR), 2))
def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR); j = min(len(L), i + len(sig)); sig = sig[: j - i] * gain
    L[i:j, 0] += sig * np.sqrt(0.5 * (1 - pan)); L[i:j, 1] += sig * np.sqrt(0.5 * (1 + pan))

for b in range(nbars):
    t0 = b * BAR
    root, voic = CH[b % 8]
    section = "intro" if b < 2 else ("light" if (b // 8) % 3 == 2 else "full")
    if b >= nbars - 3: section = "outro"
    # pad always
    add(pad([midi(n) for n in voic], BAR + 0.6), t0, 0, 1.0)
    # EP comping: 1, 2&, 4
    for beat, v in ((0, 0.55), (1.5, 0.4), (3, 0.45)):
        for k, n in enumerate(voic):
            add(ep_note(midi(n), 1.6, v * 0.22), t0 + beat * BEAT + k * 0.008, pan=-0.25 + 0.15 * k)
    if section in ("full", "light", "outro"):
        # bass
        for beat, d in ((0, 1.4), (1.5, 0.45), (2, 0.9), (3.5, 0.45)):
            add(bass(midi(root), d * BEAT, 0.55), t0 + beat * BEAT)
    if section in ("full", "light"):
        # arp plucks (8ths) up the chord, octave up
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        for k, p in enumerate(pat):
            if section == "light" or k % 2 == 0 or b % 2 == 1:
                add(pluck(midi(voic[p] + 12), 0.4, 0.13), t0 + k * BEAT / 2, pan=0.35 if k % 2 else -0.35)
    if section == "full":
        for beat in (0, 2.5):
            add(kick(0.75), t0 + beat * BEAT)
        for beat in (1, 3):
            add(snare(0.28), t0 + beat * BEAT, pan=0.05)
        for k in range(8):
            add(hat(0.10 if k % 2 else 0.06), t0 + k * BEAT / 2 + (0.012 if k % 2 else 0), pan=0.3)
    elif section == "light":
        for beat in (0,):
            add(kick(0.5), t0 + beat * BEAT)
        for k in range(8):
            add(hat(0.06), t0 + k * BEAT / 2, pan=0.3)

# reverb (synthetic IR)
n = int(1.6 * SR); ir = rng.standard_normal((n, 2)) * env_exp(n, 0.35)[:, None]; ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000)
wet = np.stack([fftconvolve(L[:, c], ir[:, c])[: len(L)] for c in range(2)], 1)
mix = L + 0.012 * wet
mix = mix[: int((DUR) * SR)]
# fade in/out
fi = int(1.5 * SR); fo = int(4 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]; mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.max(np.abs(mix)) * 0.8
sf.write(OUT + "/bgm_raw.wav", mix.astype(np.float32), SR)

# ---- SFX ----
def save(name, x, peak=0.8):
    x = np.asarray(x, np.float64); x = x / (np.max(np.abs(x)) + 1e-9) * peak
    sf.write(f"{OUT}/sfx/{name}.wav", x.astype(np.float32), SR)

def bell(f, dur, tau=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    parts = [(1, 1), (2.0, 0.45), (2.76, 0.25), (5.4, 0.12)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * env_exp(n, tau / (1 + r * 0.3)) for r, a in parts) * adsr(n, 0.002, tau)

# doorbell ding-dong
db = np.zeros(int(1.9 * SR)); a = bell(659.25, 1.2, 0.7); b = bell(523.25, 1.4, 0.8)
db[: len(a)] += a; i = int(0.5 * SR); db[i:i + len(b)] += b
save("doorbell", db, 0.75)
# whoosh
def whoosh(dur=0.5, lo=300, hi=3000, up=True):
    n = int(dur * SR); x = rng.standard_normal(n)
    out = np.zeros(n); seg = 1024
    for k in range(0, n, seg):
        fr = k / n; fc = lo + (hi - lo) * (fr if up else 1 - fr)
        out[k:k + seg] = bp(x[k:k + seg + 0], max(60, fc * 0.6), min(SR / 2 - 100, fc * 1.6))[:len(out[k:k + seg])]
    out = lp(out, 8000)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return out * e
save("whoosh", whoosh(0.55, 250, 2600), 0.5)
save("swish", whoosh(0.28, 1200, 5000), 0.35)
# pop
n = int(0.09 * SR); t = np.arange(n) / SR
save("pop", np.sin(2 * np.pi * (500 + 900 * t / 0.09) * t) * env_exp(n, 0.025), 0.45)
# click (coupling)
n = int(0.12 * SR); t = np.arange(n) / SR
clk = hp(rng.standard_normal(n), 2000) * env_exp(n, 0.006) + np.sin(2 * np.pi * 140 * t) * env_exp(n, 0.03) * 0.8
save("click", clk, 0.55)
# tick (woodblock)
n = int(0.08 * SR); t = np.arange(n) / SR
save("tick", (np.sin(2 * np.pi * 1250 * t) + 0.4 * np.sin(2 * np.pi * 2600 * t)) * env_exp(n, 0.015), 0.4)
# correct chime (C6 E6 G6 C7 arpeggio)
c = np.zeros(int(1.4 * SR))
for k, m in enumerate([72, 76, 79, 84]):
    s = bell(midi(m), 1.0, 0.45); i = int(k * 0.07 * SR); c[i:i + len(s)] += s * (0.8 if k < 3 else 1)
save("correct", c, 0.5)
# sparkle
sp = np.zeros(int(1.0 * SR))
for k, m in enumerate([84, 88, 91, 96, 100]):
    s = bell(midi(m), 0.6, 0.18); i = int(k * 0.05 * SR); sp[i:i + len(s)] += s
save("sparkle", sp, 0.3)
# soft riser into title
save("riser", whoosh(1.2, 200, 4000), 0.35)
# low thud for impact
n = int(0.35 * SR); t = np.arange(n) / SR
save("thud", np.sin(2 * np.pi * (40 + 60 * np.exp(-t * 20)) * t) * env_exp(n, 0.1), 0.6)
# pen/scribble (for arrows)
n = int(0.35 * SR); sc = bp(rng.standard_normal(n), 2500, 7000) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * np.arange(n) / SR)) * np.sin(np.linspace(0, np.pi, n))
save("draw", sc, 0.22)
print("ok", DUR)
