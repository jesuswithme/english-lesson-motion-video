# english-lesson-motion-video

영어 학습 자료(PDF·ChatGPT 대화 내보내기·노트)를 **나레이션 + 모션그래픽 + BGM + 자막**이 들어간
YouTube 교육 영상(1920×1080, 30fps, H.264/AAC)으로 만드는 Claude 스킬과 참조 구현입니다.

- `SKILL.md` — 스킬 본문 (작업 순서, 연출 원칙, 검수 루프, 알려진 함정)
- `scripts/` — 실제 제작 파이프라인 코드
- `examples/` — 첫 영상 「영어 문장 확장의 원리」(8분 36초)의 대본, SRT, YouTube 패키지, 화면 샘플

## 파이프라인

```bash
export WORK=/path/to/work && mkdir -p $WORK/{audio,vid,out}
pip install --break-system-packages supertonic faster-whisper soundfile scipy
cp examples/script_sentence_expansion.py scripts/script.py   # 대본 수정
python3 scripts/gen_audio.py        # 나레이션 + timeline.json
python3 scripts/prep_subs.py        # 자막 + SRT
python3 scripts/gen_music.py        # BGM + SFX
cd scripts/render && npm install
node main.js still 10,60,120 $WORK/stills   # 화면 검수
node main.js sfx                             # 효과음 큐
node main.js video 0 9999 $WORK/vid/video.mp4
cd ../.. && python3 scripts/mix.py           # 오디오 믹스
ffmpeg -i $WORK/vid/video.mp4 -i $WORK/vid/mix.wav -af loudnorm=I=-15:TP=-1.5 \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart $WORK/out/final.mp4
```

`scenes.js`는 첫 영상 전용 장면 코드입니다. 새 주제에서는 대본 id에 맞춰 장면을 새로 작성하세요.

## 라이선스 메모
- 나레이션: Supertone Supertonic 2 (BigScience Open RAIL-M) — 출력물 상업 이용 가능, 금지 용도 제외
- BGM·효과음: 코드로 직접 합성한 오리지널
- 폰트: Pretendard (SIL OFL)
