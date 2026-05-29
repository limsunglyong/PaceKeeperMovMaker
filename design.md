# PaceKeeper Movie Maker — 설계 문서 (design.md)

브라우저 기반 5-트랙 비디오 에디터. React 단일 컴포넌트(`VideoEditor`) + 순수 함수 모듈(`helpers.jsx`) + 프레젠테이션 컴포넌트(`ui.jsx`)로 구성. 외부 라이브러리는 React/Babel(부트스트랩)과 Web Audio / IndexedDB(브라우저 내장 API)만 사용.

---

## 1. 파일 구조

| 파일 | 역할 |
|---|---|
| `PaceKeeper Movie Maker.html` | 부트스트랩 + 전체 CSS(프로 NLE 다크 테마). React/Babel(pinned) 로드 후 `helpers.jsx` → `ui.jsx` → `editor.jsx` 순 주입 |
| `helpers.jsx` | 순수 유틸 + IndexedDB 헬퍼. `window`에 노출 |
| `ui.jsx` | 무상태 프레젠테이션 컴포넌트(트랜스포트 아이콘, LED 시계, 인스펙터 컨트롤, 비주얼라이저 피커, 프로젝트 레일). `window`에 노출 |
| `editor.jsx` | `VideoEditor` 단일 컴포넌트(상태·로직·캔버스 렌더링·레이아웃) |

> 스코프 공유: 각 `text/babel` 스크립트는 독립 스코프이므로 공통 함수/컴포넌트는 `Object.assign(window, …)`로 노출하고, `editor.jsx` 상단에서 `const { … } = window`로 가져옴. 로드 순서(helpers→ui→editor)가 보장됨.

---

## 2. 트랙 아키텍처

- **Track A — 배경 비디오:** 단일 클립, 트림 가능 (`<video>` → 캔버스 cover-fit)
- **Track B — 오디오(MP3):** `AudioContext` 디코드, 파형 막대 렌더, 재생 동기화
- **Track C — 비주얼라이저:** `AnalyserNode` 기반, 캔버스 오버레이 — **5종 이펙트 선택**
- **Track D — 자막/로고:** 텍스트 블록 + 이미지 로고, in/out 시간, 최상단 레이어
- **Track E — BPM:** 자동 감지/수동 입력/탭 템포, 비트 마커 + 박동 픽토그램

---

## 3. 단일 캔버스 레이어 순서 (매 프레임 `renderFrame(T)`)

1. `drawCover(video)` — 배경 (없으면 그리드 플레이스홀더)
2. 비주얼라이저 — Track C
3. BPM 숫자/박동 도트 — Track E
4. 자막/로고 — Track D

내부 캔버스 1280×720(16:9). CSS는 `aspect-ratio` 래퍼 + `position:absolute; inset:0`로 레터박스(퍼센트 `max-height` 미해결 이슈 회피).

---

## 4. 핵심 로직

### 오디오 그래프
`<audio>` → `MediaElementAudioSourceNode` → `AnalyserNode`(fftSize 512) → `destination`. 소스 노드는 엘리먼트당 1회만 생성(ref 가드), 이후 `src`만 교체해 재사용.

### 트랜스포트(논리 클록)
`clockRef = { t0, perf0 }`, 재생 시 `T = t0 + (now-perf0)/1000`. `rAF` 루프(`loop`)가 `T` 갱신 + 미디어 드리프트(>0.12s) 보정(`syncMedia`). 비디오는 `trim.start + min(T, trimDur)` 위치 표시. `duration = max(trimDur, audioDuration)`.
- 단축키: Space=재생/정지, Home=처음으로. **Stop 버튼**=정지 후 0으로 이동.

### 일시정지 프리뷰
정지·스크럽 중에는 파형 피크 기반 의사 스펙트럼(`staticSpectrum`)으로 비주얼라이저를 그려 프리뷰 유지.

### 상태 미러링
`rAF` stale-closure 방지를 위해 매 렌더마다 `liveRef.current`에 전체 상태 미러링. 정지 시 같은 effect에서 `renderFrame(time)` 재호출. 토글류는 함수형 `setState`로 처리.

---

## 5. 비주얼라이저 이펙트 (요청 1)

`viz.style` ∈ `bars | mirror | wave | circle | dots`. 인스펙터의 `VizStylePicker`(아이콘 그리드)로 선택. `drawViz`가 스타일별 분기:
- **bars** — 하단 기준 막대 + 반사
- **mirror** — 중앙 기준 상하 대칭 막대
- **wave** — 연결 라인 + 채움
- **circle** — 원형 스펙트럼 라인
- **dots** — 진폭 비례 원형 점

공통 컨트롤: Position X/Y, Size, Opacity, Color.

---

## 6. 프로젝트 저장/로드 + 섬네일 레일 (요청 2)

**IndexedDB**(`pacekeeper_db` / `projects` 스토어)에 프로젝트를 통째로 저장. 헬퍼: `idbOpen/idbPut/idbAll/idbGet/idbDel`.

레코드 스키마:
```
{ id, name, updatedAt, thumb(dataURL),
  videoBlob, audioBlob, videoName, audioName,
  trim, bpm, viz, bpmOv,
  subs: [직렬화본(_img/_blob/url 제거)],
  logoBlobs: { [subId]: Blob } }
```
- **저장(`saveProject`)**: `makeThumb`로 캔버스 256px 섬네일 생성 → 미디어 블롭 + 설정 저장. 현재 id가 있으면 덮어쓰기.
- **로드(`loadProject`)**: 블롭에서 객체 URL/오디오 디코드 재생성, 로고 이미지 복원, 트림 보존(`loadVideo(blob,name,presetTrim)`).
- **새 프로젝트(`newProject`)** / **삭제(`deleteProject`)**.
- 좌측 **프로젝트 레일**(`ProjectsRail`): 이름 입력 + Save, 섬네일 카드 목록(클릭=로드, 호버=삭제), 활성 카드 하이라이트.

> 저장 위치는 브라우저 로컬(IndexedDB) — 동일 브라우저에서만 노출.

---

## 7. 프로 NLE 스타일 (요청 3)

채도를 낮춘 중립 다크 그레이 팔레트로 재설계. 플랫 버튼 + 미세 그림자, 절제된 액센트.
```
--bg #0c0d10  --panel #14151a  --panel-2 #1a1c22  --elev #22242c
--accent #5b8cff(선택)  --hi #ff4d5e(녹화/활성)  --cyan #2dd4bf(오디오)
--led #58ffd0(타임코드)   글꼴: Inter(UI) / JetBrains Mono(수치·타임코드)
```
트랙 색: A 블루 · B 틸 · C 바이올렛 · D 앰버 · E 레드.

---

## 8. 타임라인 확대/축소 (요청 4)

`pxPerSec`(6~400) 기준 줌. 푸터에 `−` / `Fit` / `＋` 버튼.
- **휠 줌**: `⌘/Ctrl/Alt + 스크롤` → 커서 위치 시간을 고정한 채 줌(앵커링). 모디파이어 없는 세로 휠은 가로 패닝.
- **Fit**(`fitZoom`): 전체 길이를 보이는 폭에 맞춤.
- 줌 변경 시 파형 캔버스 재렌더, 룰러 틱 간격 자동 조정(10/5/1s).

---

## 9. 상단 트랜스포트 + LED 타임코드 (요청 5)

- **트랜스포트**: Rewind / Stop / Play·Pause / Forward를 SVG 아이콘(`TIcon`)으로. Play는 블루 강조 버튼.
- **LED 시계**(`LedClock`): 7세그먼트풍 패널 — 글로우 + 언릿 세그먼트 고스트(`88:88:88`), `MM:SS:FF`(30fps). 좌측 녹화 인디케이터(재생 중 점멸), 우측 `DUR`(총 길이).

---

## 10. 내보내기 (Export)

`canvas.captureStream(30)` 비디오 트랙 + `MediaStreamAudioDestinationNode`(analyser 분기) 오디오 트랙을 합쳐 `MediaRecorder`로 실시간 녹화 → 프로젝트명.webm 다운로드. 코덱 `vp9,opus` → `vp8,opus` → `webm` 폴백. 결과물은 브라우저 네이티브 WebM.

---

## 11. UI 레이아웃

```
┌─ Header ─ 브랜드 · [Rewind Stop Play Fwd] LED시계 · Export ──────┐
├─ Body ───────────┬───────────────────────────┬─ Inspector(300) ─┤
│ Projects 레일(168)│ Preview(16:9 캔버스)        │ 선택 대상 속성    │
│  이름+Save / 카드 │ Toolbar(Import/Add/Viz/BPM) │ (Viz/BPM/자막)   │
├───────────────────┴───────────────────────────┴──────────────────┤
│ Timeline(280) ─ 라벨(A~E) · 룰러 · 플레이헤드 · 5레인 · 줌/상태 풋터│
└────────────────────────────────────────────────────────────────────┘
```

### 타임라인 상호작용
룰러/레인 클릭=시킹, Track A 좌/우 핸들 드래그=트림, Track D 블록 드래그=in/out 이동.

---

## 12. helpers.jsx API

| 함수 | 설명 |
|---|---|
| `fmtTC(t, withFrames)` | 초 → `MM:SS:FF` 또는 `MM:SS.mmm` |
| `decodeAudioFile(blob, ctx)` | Blob → `AudioBuffer` |
| `buildPeaks(buffer, buckets)` | 파형 min/max 버킷 |
| `detectBPM(buffer)` | 온셋 자기상관 템포 추정(60~180) |
| `drawCover / wrapText` | 캔버스 cover 드로잉 / 텍스트 줄바꿈 |
| `makeThumb(canvas, w)` | 캔버스 → JPEG 섬네일 dataURL |
| `idbOpen/idbPut/idbAll/idbGet/idbDel` | IndexedDB 프로젝트 CRUD |

---

## 13. ui.jsx 컴포넌트

`TIcon`(트랜스포트 SVG), `LedClock`, `Row`/`Slider`/`Swatches`(인스펙터), `VizStylePicker`(이펙트), `ProjectsRail`(좌측 레일).

---

## 14. 알려진 한계 / 향후 작업

- 내보내기는 실시간 녹화 → 영상 길이만큼 소요, 출력은 WebM(MP4 아님).
- BPM 자동 감지는 best-effort — 수동/탭으로 보정.
- 프로젝트는 브라우저 로컬(IndexedDB) 저장이라 기기·브라우저 간 동기화는 미지원.
- 자막 서브레인(`lane` 0~2) 확장 여지.
