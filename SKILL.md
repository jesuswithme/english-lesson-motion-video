---
name: "english-lesson-motion-video"
description: "영어 학습 자료(PDF·대화 내보내기·노트)를 나레이션·BGM·자막이 들어간 1080p 30fps 모션그래픽 YouTube 교육 영상(MP4)과 SRT·업로드 패키지로 만들 때 사용."
---

# 영어 교육 모션그래픽 영상 제작

입력 자료(PDF, ChatGPT 대화 HTML, 메모 등)를 분석해 **한국인 성인 학습자용 영어 교육 영상**을 처음부터 끝까지 코드로 만든다. 결과물: MP4(H.264/AAC, 1920×1080, 30fps), SRT, YouTube 패키지(제목 5·설명란·썸네일 카피 3·챕터).

핵심 원칙: Easy to Understand / Remember / Use. 화려함보다 "아하!"가 우선. 영어 표현은 장면·움직임·방향으로 시각화한다.

## 0. 환경 점검 (먼저, 조용히)
- `ffmpeg`, `node`, `python3`, Noto CJK 폰트 확인. `npm i @napi-rs/canvas pretendard` (Pretendard = 한글+라틴, OFL).
- **edge-tts는 쓰지 않는다**: 프록시가 WebSocket을 지원하지 않아 실패한다(CA 번들 지정해도 동일).
- **TTS = Supertone Supertonic (오프라인 ONNX, ko+en)**: `pip install --break-system-packages supertonic` → `TTS().synthesize(text, voice_style=tts.get_voice_style('F1'), lang='ko'|'en', speed, total_steps=12)`. HF에서 모델 자동 다운로드. 라이선스 Open RAIL-M(출력물 상업 이용 가능, 금지 용도만 피함). speed 범위 0.7~2.0.
- 품질 검수용 ASR: `pip install faster-whisper`. **오디오는 파일 경로 대신 numpy 배열로 전달**(av 버전 충돌 회피: ffmpeg로 16k mono s16le 디코딩 후 float32).
- 외부 사이트 curl이 막히면 우회하지 말 것. 단, huggingface/pypi/npm은 대체로 열려 있다.

## 1. 자료 분석 & 대본
- HTML 대화 내보내기는 script/style/svg 제거 후 태그 제거로 텍스트 추출, 이미지 alt 보존.
- 구성: 훅(질문·고민) → 핵심 공식 → 상황 장면(개념 시각화) → 유형 정리 → 단계적 확장 → 대조(예: V-ing vs P.P.) → 결합/해부 → 따라 말하기 → 퀴즈 3~4개 → 3줄 복습 → 아웃트로. 총 7~9분.
- **정확성 검토**: 원본 오류·어색한 표현을 고치고(예: without delay → 회화에선 right away 팁), 예외를 구체 예시로 보충(a sleeping bag, fallen leaves). 수정 사항은 패키지 문서에 기록.
- 색 규칙을 하나 정해 끝까지 유지(예: 명사 설명=파랑, 동작 설명=주황; 명사 화살표는 문장 아래, 동작 화살표는 위).
- 대본은 `script.py`의 구조화 데이터로 작성:
  - `(id, 'T', text)` 교사(한국어). 인라인 영어는 `{en:with a smile}` → 같은 목소리 en 모드로 따로 합성해 0.1s 간격으로 이어붙임. **영어 조각 바로 뒤에 조사로 시작하지 않게** 문장을 짠다("여기서 {en:get the door}, 이 표현은…").
  - `[say|sub]` = TTS 발음용/자막용 분리. 예: `[브이 아이엔지|V-ing]`, `[피피|P.P.]`, `[투 부정사|to부정사]`.
  - `(id, 'N', text)` 원어민 예문(영어 전용 목소리, 영어 자막 스타일).
  - `(id, 'PR', label)` 따라 말하기 무음 = 직전 N 길이×1.25+1.0s. `(id, 'P', '3.6')` 퀴즈 생각 시간.
- 목소리: 교사 F1(ko speed 1.06, en 0.95), 원어민 M1(en 0.8).

## 2. 오디오 생성 → 타임라인 (모든 싱크의 기준)
- 세그먼트별 합성 → 앞뒤 무음 trim(이동평균 엔벨로프 임계 0.012, 앞 900/뒤 2200 샘플 여유) → RMS 정규화(T −19 dBFS, N −18) → `audio/segs/{id}.wav`.
- 간격: T 뒤 0.32s, N 뒤 0.55s, 장면 사이 +1.0s, 시작 리드인 1.2s, 끝 2.5s.
- `timeline.json`: segments[{id, scene, kind, start, end, sub, parts[{lang,text,start,end}]}], scenes[{id,title,start,end}], duration. **narration.wav는 반드시 이 반올림된 start로 배치**(나중에 개별 세그먼트 교체 시 샘플 어긋남 방지 — 교체는 항상 전체 재조립으로).
- **ASR로 전 세그먼트 검수** 후 대본과 대조. 주의: 한국어 모드 Whisper는 영어 단어를 한글로 음차("singing"→"쌩잉")하므로, 의심되면 해당 단어를 en 모드로 따로 인식해 확인. 진짜 오류(예: "마실 것"→"맛일 것")만 문장 표현을 바꿔 재합성하고 슬롯 길이 내인지 확인.
- 자막: 문장 단위 분할, 38자 초과 시 가운데 쉼표에서 분할, 글자 수 비례로 시간 배분, 다음 자막 직전까지 0.35s 연장 → `subs.json` + SRT.

## 3. BGM·효과음 (직접 합성 = 저작권 안전)
- numpy/scipy로 작곡: 96 BPM, Cmaj7–Am7–Fmaj7–G7… 8마디 루프, FM 일렉피아노 컴핑, 사인 베이스(tanh), 8분 플럭 아르페지오, 킥/스네어/햇(노이즈 필터), 패드, 합성 IR 리버브. 섹션: intro/full/light/outro.
- SFX: doorbell(벨 부분음 E5→C5), whoosh/swish(대역통과 스윕 노이즈), pop, click, tick, correct(아르페지오 벨), sparkle, riser, thud, draw.
- 믹스: 나레이션 엔벨로프로 덕킹(공백 −11.5 dB, 발화 중 −18 dB, attack 빠르게/release 느리게) → BGM이 음성보다 평균 약 12 LU 낮게. SFX 게인×0.42. 최종 `loudnorm` 2-pass linear로 −15 LUFS, TP −1.5.

## 4. 모션그래픽 렌더러 (Node + @napi-rs/canvas → ffmpeg 파이프)
파일 구조: `engine.js`(폰트·타이밍·이징·프리미티브), `chars.js`(캐릭터·소품), `scenes.js`(장면별 draw/sfx), `main.js`(프레임 루프·오버레이·전환·출력 모드).
- 폰트: Pretendard 각 웨이트를 별칭 `P4…P9`로 등록 → `ctx.font = '700 54px'` 대신 `` `${size}px P7` ``.
- **이모지 금지**(컬러 이모지 폰트 없음 → 네모 박스). ✕도 Pretendard에 없음. ①②→▶◀⚠✓·은 OK. 아이콘은 벡터로 그린다.
- 타이밍 헬퍼: `S(id)`, `E(id)`, `Wt(id, '부분문자열')`(영어 part면 정확, 아니면 글자 비례 추정)로 **모든 애니메이션을 나레이션 단어에 동기화**. `ep(t,a,d,ease)`, `win(t,a,b)`, `pop(t,a)`(back 이징).
- 핵심 프리미티브:
  - `sentenceRow(items)`: 청크 칩 행. item {key,text,kind(core/noun/act/ghost/hl/ving/pp/good),g(그룹=한 캡슐),at,out}. 등장 진행도로 폭을 보간해 **칩 삽입 시 자동 리플로우**(something → something cold to drink). 위치 맵 반환 → 화살표 연결.
  - `arcAbove/arcBelow(R, from, to, color, k, label, bend)`: 진행도로 그려지는 곡선 화살표 + 꼭짓점 라벨. 같은 대상으로 가는 화살표가 겹치면 bend를 다르게.
  - `karaoke(text, segId)`: 발화 진행에 맞춰 단어 하이라이트.
  - `practiceUI(N, PR)`: Listen 배지 → Your turn! 마이크 + 원형 카운트다운.
  - 기차 비유(기관차=핵심 문장, 칸=설명), 바퀴(`wheelsUnder`)로 칩 행을 기차로 변신.
- 캐릭터 `person({x,y,s,kid,shirt,hair,hairStyle,hat,glasses,mouth,blink,armF,armB,elbow,legF,legB,knee,hand})`: 2관절 팔다리, 표정(smile/big/open/o/wavy), `walk()/run()` 포즈 함수, 앉기(legF≈1.45, knee≈1.5). 소품: door(open/paint 진행), house, hill, car, clock, sofa, giftBox, umbrella(open), cup(ice), pot, plate, letter, sleepingBag, tree/leaf, brush, mic, engine/wheels/smoke, bubble, check/cross.
- "설명을 붙일수록 그림이 선명해진다": 회색 실루엣 → 형용사에서 컬러 → 전치사구에서 배경 등장 → V-ing에서 소품.
- 오버레이: 좌상단 챕터 필(번호+제목), 우상단 브랜드, 하단 자막 박스(한국어 흰색 / 영어는 노란 글씨+EN 태그), 맨 아래 진행 바+챕터 눈금, 크림색 배경+도트 그리드+부유 블롭, 장면 미세 카메라 줌.
- 장면 경계 `B[i] = scene.start − 0.62`; 경계 ±0.5s에 3색 대각 밴드 와이프 + 챕터 번호/제목 카드, whoosh SFX.
- 모드: `node main.js still t1,t2,... dir`(PNG), `sfx`(큐 JSON), `video t0 t1 out.mp4`(rgba raw → libx264 crf 19, drain 처리).

## 5. 검수 루프 (렌더 전 필수)
- 세그먼트 끝 −0.15s 시점 스틸 50여 장 + 전환 시점을 렌더 → PIL로 3×3 컨택트 시트 → 직접 보고 수정(겹침, 작은 글씨, 깨진 글리프, 캐릭터 가림).
- 자주 나온 수정: 콜아웃이 라벨 가림 → 위치 이동, 같은 대상 화살표 라벨 겹침 → bend 차등, 해부 장면 배경 알파 0.05로, 작은 pill 22→26px.

## 6. 렌더 & 출력
- 2코어면 장면 경계에서 둘로 나눠 `nohup` 병렬 렌더(각 ~12 fps, 8분 영상 ≈10분). 긴 ffmpeg 작업은 항상 백그라운드 + sleep 폴링(도구 타임아웃 10분).
- `concat -c copy` → 오디오 mux(AAC 192k 48kHz, `+faststart`).
- QA: 최종 MP4에서 프레임 추출 시트, 구간 ASR(음악 위에서도 또렷한지), ebur128로 −15 LUFS 확인.

## 7. 전달
- 채팅 업로드 한도 30 MiB. 초과 시 `-preset slow -tune animation` 2-pass ~330 kbps + AAC 128k로 재인코딩(플랫 그래픽은 SSIM ≈0.997, 사실상 무손실 체감) → SendUserFile.
- 사용자 컴퓨터 저장: `device_request_folder_access(['~/Videos'])` → 작은 파일은 `/mnt/user-data/outputs/`의 stagedPath로, **큰 MP4는 SendUserFile의 fileUuid로** `device_commit_files`.
- 패키지 MD: 제목 5, 설명란(배우는 것·예문·챕터·해시태그·댓글 유도), 썸네일 카피 3, 챕터 표(첫 챕터 0:00, 각 10초 이상), 원본 대비 보완 메모, 음성·음악·폰트 라이선스.
- 마무리 보고: 무엇을 만들었는지, 보완한 내용, 제약(오프라인 TTS라 억양 세밀 조정 불가, 직접 청취 대신 ASR 검수 → 업로드 전 1회 청취 권장).
## 8. 참조 구현 (이 저장소의 `scripts/`)
첫 영상(「영어 문장 확장」)에서 실제로 쓴 코드다. 새 영상은 이 코드를 복사해 `scenes.js`와 대본만 바꾸는 것이 가장 빠르다.
- `scripts/gen_audio.py` — 대본 파싱({en:}, [say|sub]), Supertonic 합성, trim/정규화, `timeline.json`·`narration.wav`
- `scripts/prep_subs.py` — 자막 분할·타이밍 → `subs.json`, SRT
- `scripts/gen_music.py` — 오리지널 BGM·SFX 합성
- `scripts/mix.py` — 덕킹 + SFX 배치 믹스
- `scripts/asr.py` — Whisper 검수(numpy 입력)
- `scripts/render/` — `engine.js`·`chars.js`·`scenes.js`·`main.js` (`npm install` 후 사용)
- `examples/script_sentence_expansion.py` — 대본 예시(→ `scripts/script.py`로 복사해 수정)
- 모든 경로는 환경변수 `WORK`(기본 `/home/claude/work`) 기준.
