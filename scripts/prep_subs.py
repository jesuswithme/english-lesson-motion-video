import os as _os
WORK = _os.environ.get("WORK", "/home/claude/work")
import json, re
tl = json.load(open(WORK + "/audio/timeline.json"))
MAX = 38

def split_piece(p):
    if len(p) <= MAX: return [p]
    # split at comma nearest the middle
    idxs = [m.end() for m in re.finditer(r",\s", p)]
    if not idxs:
        idxs = [m.start() for m in re.finditer(r"\s", p)]
    mid = len(p) / 2
    k = min(idxs, key=lambda i: abs(i - mid))
    return split_piece(p[:k].strip()) + split_piece(p[k:].strip())

subs = []
for s in tl["segments"]:
    if not s.get("sub"): continue
    text = s["sub"]
    if s["kind"] == "N":
        pieces = [text]
    else:
        sents = [x.strip() for x in re.split(r"(?<=[.?!])\s+", text) if x.strip()]
        pieces = []
        for x in sents: pieces += split_piece(x)
        # merge very short pieces into the following one
        merged = []
        for p in pieces:
            if merged and (len(merged[-1]) < 9 or len(p) < 6) and len(merged[-1]) + len(p) <= MAX + 8:
                merged[-1] = merged[-1] + " " + p
            else:
                merged.append(p)
        pieces = merged
    total = sum(len(p) for p in pieces)
    t = s["start"]; dur = s["end"] - s["start"]
    for p in pieces:
        d = dur * len(p) / total
        subs.append({"start": round(t, 3), "end": round(t + d, 3), "text": p, "lang": "en" if s["kind"] == "N" else "ko", "seg": s["id"]})
        t += d
# extend each subtitle a little into following gap (but not overlapping next)
for i, x in enumerate(subs):
    nxt = subs[i + 1]["start"] if i + 1 < len(subs) else x["end"] + 1
    x["end"] = round(min(x["end"] + 0.35, nxt - 0.02), 3)
json.dump(subs, open(WORK + "/audio/subs.json", "w"), ensure_ascii=False, indent=0)

def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}".replace(",1000", ",999")
with open((_os.makedirs(WORK + "/out", exist_ok=True) or WORK + "/out/subtitles.srt"), "w", encoding="utf-8") as f:
    for i, x in enumerate(subs, 1):
        f.write(f"{i}\n{ts(x['start'])} --> {ts(x['end'])}\n{x['text']}\n\n")
print(len(subs), max(len(x["text"]) for x in subs))
for x in subs[:12]: print(x)
