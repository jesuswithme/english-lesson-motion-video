import os as _os
WORK = _os.environ.get("WORK", "/home/claude/work")
import re, json, os, sys
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
from script import SCENES
from supertonic import TTS

OUT = WORK + "/audio"; os.makedirs(OUT + "/segs", exist_ok=True)
SR = 44100
TEACHER, NATIVE = "F1", "M1"
tts = TTS()
styles = {v: tts.get_voice_style(v) for v in (TEACHER, NATIVE)}

def parse(text):
    """-> list of (lang, say) parts, subtitle string"""
    parts, sub = [], ""
    pos = 0
    for m in re.finditer(r"\{en:([^}]*)\}|\[([^|\]]*)\|([^\]]*)\]", text):
        pre = text[pos:m.start()]
        if pre: parts.append(("ko", pre)); sub += pre
        if m.group(1) is not None:
            parts.append(("en", m.group(1))); sub += m.group(1)
        else:
            parts.append(("ko", m.group(2))); sub += m.group(3)
        pos = m.end()
    if text[pos:]: parts.append(("ko", text[pos:])); sub += text[pos:]
    # merge adjacent ko parts
    merged = []
    for l, t in parts:
        if merged and merged[-1][0] == l == "ko": merged[-1] = (l, merged[-1][1] + t)
        else: merged.append((l, t))
    merged = [(l, t.strip()) for l, t in merged if t.strip(" ,.")]
    sub = sub.strip().replace("P.P..", "P.P.")
    return merged, sub

def trim(w, thr=0.012):
    a = np.abs(w)
    k = 441
    env = np.convolve(a, np.ones(k) / k, mode="same")
    idx = np.where(env > thr)[0]
    if len(idx) == 0: return w
    s = max(0, idx[0] - 900); e = min(len(w), idx[-1] + 2200)
    return w[s:e]

def synth(text, voice, lang, speed):
    w, _ = tts.synthesize(text, voice_style=styles[voice], lang=lang, speed=speed, total_steps=12)
    w = np.asarray(w, dtype=np.float32).reshape(-1)
    return trim(w)

def norm(w, target_db=-19.0):
    rms = np.sqrt(np.mean(w ** 2) + 1e-12)
    g = 10 ** (target_db / 20) / rms
    w = w * g
    pk = np.max(np.abs(w))
    if pk > 0.95: w = w * 0.95 / pk
    return w

timeline = {"segments": [], "scenes": []}
t = 1.2  # lead-in
chunks = []
def place(w, at):
    chunks.append((at, w))

prevN = None
for si, (sid, title, segs) in enumerate(SCENES):
    if si > 0: t += 1.0
    sc = {"id": sid, "title": title, "start": round(t, 3)}
    for seg in segs:
        segid, kind, text = seg[0], seg[1], seg[2]
        if kind in ("P", "PR"):
            dur = float(text) if kind == "P" else round(prevN * 1.25 + 1.0, 2)
            timeline["segments"].append({"id": segid, "scene": sid, "kind": kind, "start": round(t, 3), "end": round(t + dur, 3), "sub": "", "label": text if kind == "PR" else ""})
            t += dur + 0.25
            continue
        if kind == "T":
            parts, sub = parse(text)
            ws, ptimes, cur = [], [], 0.0
            for i, (lang, say) in enumerate(parts):
                w = synth(say, TEACHER, lang, 1.06 if lang == "ko" else 0.95)
                if ws:
                    gap = np.zeros(int(SR * 0.10), np.float32); ws.append(gap); cur += 0.10
                ptimes.append({"lang": lang, "text": say, "start": round(cur, 3), "end": round(cur + len(w) / SR, 3)})
                ws.append(w); cur += len(w) / SR
            w = norm(np.concatenate(ws))
            lang = "ko"; gap_after = 0.32
        else:  # N
            w = norm(synth(text, NATIVE, "en", 0.8), -18.0)
            sub = text; ptimes = []; lang = "en"; gap_after = 0.55
            prevN = len(w) / SR
        sf.write(f"{OUT}/segs/{segid}.wav", w, SR)
        d = len(w) / SR
        timeline["segments"].append({"id": segid, "scene": sid, "kind": kind, "start": round(t, 3), "end": round(t + d, 3), "sub": sub, "lang": lang,
                                     "parts": [{**p, "start": round(t + p["start"], 3), "end": round(t + p["end"], 3)} for p in ptimes]})
        place(w, t)
        t += d + gap_after
        print(segid, round(d, 2), sub, flush=True)
    sc["end"] = round(t, 3)
    timeline["scenes"].append(sc)

t += 2.5
timeline["duration"] = round(t, 3)
total = np.zeros(int(SR * t) + SR, np.float32)
for at, w in chunks:
    i = int(at * SR); total[i:i + len(w)] += w
sf.write(f"{OUT}/narration.wav", total, SR)
json.dump(timeline, open(f"{OUT}/timeline.json", "w"), ensure_ascii=False, indent=1)
print("DURATION", t)
