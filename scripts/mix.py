import os as _os
WORK = _os.environ.get("WORK", "/home/claude/work")
import numpy as np, soundfile as sf, json
from scipy.ndimage import uniform_filter1d
SR = 44100
A = WORK + "/audio"
nar, _ = sf.read(A + "/narration.wav", dtype="float32")
bgm, _ = sf.read(A + "/bgm_raw.wav", dtype="float32")
dur = json.load(open(A + "/timeline.json"))["duration"]
N = int(dur * SR)
def fit(x, n):
    if len(x) >= n: return x[:n]
    pad = np.zeros((n - len(x),) + x.shape[1:], x.dtype); return np.concatenate([x, pad])
nar = fit(nar, N); bgm = fit(bgm, N)
# speech envelope -> ducking gain
env = np.sqrt(uniform_filter1d(nar.astype(np.float64) ** 2, int(0.05 * SR)))
speech = (env > 0.01).astype(np.float64)
# attack fast / release slow smoothing
hop = 441; s = speech[::hop]; g = np.zeros_like(s); cur = 0.0
for i, v in enumerate(s):
    cur = cur + (v - cur) * (0.5 if v > cur else 0.06); g[i] = cur
g = np.repeat(g, hop)[:N]
db_gap, db_speech = -11.5, -18.0
gain = 10 ** ((db_gap + (db_speech - db_gap) * g) / 20)
mix = bgm * gain[:, None]
mix += np.stack([nar, nar], 1)
# sfx
cues = json.load(open(A + "/sfx_cues.json"))
cache = {}
for t, name, gg in cues:
    if name not in cache:
        x, _ = sf.read(f"{A}/sfx/{name}.wav", dtype="float32"); cache[name] = x
    x = cache[name] * gg * 0.42
    i = int(max(0, t) * SR); j = min(N, i + len(x))
    if j > i: mix[i:j] += x[: j - i, None]
pk = np.max(np.abs(mix)); print("peak", pk)
if pk > 0.98: mix *= 0.98 / pk
sf.write(WORK + "/vid/mix.wav", mix.astype(np.float32), SR)
print("ok", len(mix) / SR)
