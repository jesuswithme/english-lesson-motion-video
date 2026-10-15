import sys,subprocess,numpy as np
from faster_whisper import WhisperModel
m=WhisperModel("small",device="cpu",compute_type="int8")
def load(f):
    b=subprocess.run(["ffmpeg","-v","error","-i",f,"-f","s16le","-ac","1","-ar","16000","-"],capture_output=True).stdout
    return np.frombuffer(b,np.int16).astype(np.float32)/32768
for f in sys.argv[1:]:
    lang="en" if "/en" in f or f.startswith("en") else "ko"
    segs,_=m.transcribe(load(f),language=lang)
    print(f,"|","".join(s.text for s in segs),flush=True)
