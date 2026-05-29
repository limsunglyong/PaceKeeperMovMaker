# PaceKeeper Movie Maker — 설계 문서

데스크탑 기반 5-트랙 비디오 에디터. UI는 React로 유지하되, 최종 Export와 파일 관리는 데스크탑 런타임에서 처리한다. 브라우저 기반 프로토타입의 Canvas 미리보기 구조는 살리고, 화질 저하가 발생하던 `MediaRecorder`/`captureStream()`/`FFmpeg.wasm` 중심 내보내기는 로컬 네이티브 FFmpeg 파이프라인으로 교체한다.

---

## 1. 앱 구조

| 영역 | 역할 |
|---|---|
| Desktop shell | Electron 또는 Tauri. 파일 다이얼로그, 로컬 파일 접근, FFmpeg 실행, 앱 설정 관리 |
| Renderer | React + TypeScript 기반 편집 UI, 미리보기 Canvas, 타임라인, 인스펙터 |
| Bridge/API | Renderer에서 안전하게 호출 가능한 파일/프로젝트/Export API |
| FFmpeg worker | 로컬 FFmpeg 실행, 진행률 파싱, 취소 처리, 출력 파일 생성 |

초기 전환은 현재 HTML/Babel 프로토타입을 기준으로 하되, 장기 구조는 모듈형 TypeScript 앱으로 정리한다.

---

## 2. 파일 구조 목표

| 파일/폴더 | 역할 |
|---|---|
| `src/main/` | 데스크탑 main process. 앱 창, 파일 다이얼로그, FFmpeg 실행, 설정 저장 |
| `src/preload/` | Renderer에 노출할 안전한 API. `window.pacekeeper` 형태 권장 |
| `src/renderer/` | React UI. editor, timeline, inspector, preview 컴포넌트 |
| `src/renderer/helpers/` | 시간 포맷, 파형, BPM, Canvas 렌더 유틸 |
| `src/renderer/components/` | 트랜스포트, LED 시계, 슬라이더, 프로젝트 레일, 비주얼라이저 피커 |
| `src/export/` | Export job 모델, FFmpeg 명령 생성, 프레임/오버레이 렌더 전략 |
| `projects/` 또는 사용자 선택 폴더 | `.pkmm.json`, 섬네일, 선택적 assets 복사본 |

현재 파일의 대응:

| 현재 파일 | 이전 방향 |
|---|---|
| `PaceKeeper Movie Maker.html` | Vite/Electron/Tauri 앱 진입점으로 대체 |
| `helpers.jsx` | `src/renderer/helpers/*`로 분리 |
| `ui.jsx` | `src/renderer/components/*`로 분리 |
| `editor.jsx` | `src/renderer/editor/VideoEditor.tsx` 중심으로 이전 |

---

## 3. 트랙 아키텍처

- **Track A — 배경 비디오:** 단일 클립, 트림 가능. 미리보기는 `<video>`를 Canvas에 cover-fit 렌더링.
- **Track B — 오디오(MP3/WAV):** `AudioContext` 디코드, 파형 막대 렌더, 재생 동기화.
- **Track C — 비주얼라이저:** `AnalyserNode` 기반 미리보기. Export에서는 동일 설정을 시간 기반으로 재현 가능한 렌더 함수로 처리.
- **Track D — 자막/로고:** 텍스트 블록 + 이미지 로고, in/out 시간, 최상단 레이어.
- **Track E — BPM:** 자동 감지/수동 입력/탭 템포, 비트 마커 + 박동 픽토그램.

---

## 4. 미리보기 Canvas 레이어 순서

매 프레임 `renderFrame(T)`에서 단일 Canvas에 아래 순서로 그린다.

1. `drawCover(video)` — 배경 영상. 없으면 그리드 플레이스홀더.
2. 비주얼라이저 — Track C.
3. BPM 숫자/박동 도트 — Track E.
4. 자막/로고 — Track D.

내부 캔버스 기본값은 1280×720(16:9). CSS는 `aspect-ratio` 래퍼 + `position:absolute; inset:0`로 안정적인 레터박스를 유지한다.

---

## 5. 핵심 로직

### 오디오 그래프

`<audio>` → `MediaElementAudioSourceNode` → `AnalyserNode`(fftSize 512) → `destination`. 소스 노드는 엘리먼트당 1회만 생성(ref 가드), 이후 `src`만 교체해 재사용한다.

### 트랜스포트(논리 클록)

`clockRef = { t0, perf0 }`, 재생 시 `T = t0 + (now - perf0) / 1000`. `requestAnimationFrame` 루프가 `T` 갱신 + 미디어 드리프트(>0.12s) 보정(`syncMedia`)을 수행한다. 비디오는 `trim.start + min(T, trimDur)` 위치를 표시한다.

- 단축키: Space=재생/정지, Home=처음으로.
- Stop 버튼: 정지 후 0으로 이동.
- `duration = max(trimDur, audioDuration)`.

### 일시정지 프리뷰

정지·스크럽 중에는 파형 피크 기반 의사 스펙트럼(`staticSpectrum`)으로 비주얼라이저를 그려 프리뷰를 유지한다.

### 상태 미러링

`requestAnimationFrame` stale-closure 방지를 위해 매 렌더마다 `liveRef.current`에 전체 상태를 미러링한다. 정지 시 같은 effect에서 `renderFrame(time)`을 재호출한다.

---

## 6. 데스크탑 API 경계

Renderer는 로컬 파일 시스템과 FFmpeg를 직접 다루지 않고, 데스크탑 브리지 API만 호출한다.

```ts
window.pacekeeper.openMediaFile(): Promise<MediaFileRef>
window.pacekeeper.openImageFile(): Promise<MediaFileRef>
window.pacekeeper.saveProject(project): Promise<ProjectSaveResult>
window.pacekeeper.loadProject(): Promise<ProjectDocument>
window.pacekeeper.exportVideo(job): Promise<ExportResult>
window.pacekeeper.cancelExport(jobId): Promise<void>
window.pacekeeper.getSettings(): Promise<AppSettings>
window.pacekeeper.updateSettings(patch): Promise<AppSettings>
```

`MediaFileRef`는 Blob 복사보다 로컬 경로 참조를 우선한다. 프로젝트를 다른 위치로 옮길 수 있게 하려면 assets 폴더로 복사하는 옵션을 별도로 제공한다.

---

## 7. 프로젝트 저장/로드 + 섬네일 레일

브라우저 IndexedDB 대신 로컬 프로젝트 문서를 사용한다.

기본 구조:

```json
{
  "version": 1,
  "id": "project-id",
  "name": "Morning Run",
  "updatedAt": "2026-05-29T00:00:00.000Z",
  "media": {
    "video": { "path": "D:/media/run.mp4", "name": "run.mp4" },
    "audio": { "path": "D:/media/song.mp3", "name": "song.mp3" }
  },
  "timeline": {
    "trim": { "start": 0, "end": 30 },
    "audioOffset": 0,
    "subs": []
  },
  "effects": {
    "viz": {},
    "bpm": {}
  },
  "export": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "crf": 18
  }
}
```

- **저장**: `.pkmm.json`에 타임라인/효과/파일 경로/Export 설정 저장.
- **로드**: 파일 경로 유효성 검사 후 미디어 재연결. 누락된 파일은 사용자에게 재지정 요청.
- **섬네일**: Canvas에서 JPEG 생성 후 프로젝트 폴더에 저장.
- **프로젝트 레일**: 최근 프로젝트 목록 + 섬네일 표시. 최근 목록은 앱 설정에 저장.

---

## 8. 비주얼라이저 이펙트

`viz.style` 값:

- **bars** — 하단 기준 막대 + 반사.
- **mirror** — 중앙 기준 상하 대칭 막대.
- **wave** — 연결 라인 + 채움.
- **circle** — 원형 스펙트럼 라인.
- **dots** — 진폭 비례 원형 점.

공통 컨트롤:

- Position X/Y
- Size
- Opacity
- Color

미리보기에서는 `AnalyserNode` 실시간 데이터를 사용한다. Export에서는 오디오 버퍼를 기준으로 시간 `T`에서 재현 가능한 스펙트럼/파형 데이터를 계산하거나 캐시한다.

---

## 9. 프로 NLE 스타일

채도를 낮춘 중립 다크 그레이 팔레트로 유지한다. 플랫 버튼 + 미세 그림자, 절제된 액센트.

```css
--bg: #0c0d10;
--panel: #14151a;
--panel-2: #1a1c22;
--elev: #22242c;
--accent: #5b8cff;
--hi: #ff4d5e;
--cyan: #2dd4bf;
--led: #58ffd0;
```

트랙 색:

- A Video: blue
- B Audio: teal
- C Visualizer: violet
- D Subtitle/Logo: amber
- E BPM: red

---

## 10. 타임라인 확대/축소

`pxPerSec`(6~400) 기준 줌. 푸터에 `-` / `Fit` / `+` 버튼.

- **휠 줌**: `Ctrl/Alt + 스크롤` → 커서 위치 시간을 고정한 채 줌.
- **가로 패닝**: 모디파이어 없는 세로 휠은 가로 스크롤로 매핑.
- **Fit**(`fitZoom`): 전체 길이를 보이는 폭에 맞춤.
- 줌 변경 시 파형 캔버스 재렌더, 룰러 틱 간격 자동 조정(10/5/1s).

---

## 11. 상단 트랜스포트 + LED 타임코드

- **트랜스포트**: Rewind / Stop / Play·Pause / Forward 아이콘 버튼.
- **LED 시계**: `MM:SS:FF`(30fps), 언릿 세그먼트 고스트, 재생 중 인디케이터, 총 길이 `DUR`.

---

## 12. 고품질 내보내기(Export)

최종 Export는 로컬 FFmpeg를 사용한다. 브라우저 `MediaRecorder`는 품질 검증용 임시 기능으로만 둘 수 있으며, 정식 출력 경로로 사용하지 않는다.

### 기본 출력

- 컨테이너: MP4
- 비디오: H.264 (`libx264`)
- 오디오: AAC
- 품질: CRF 18~23 범위 기본 제공
- FPS: 원본 유지 또는 30fps 선택
- 해상도: 원본 유지, 720p, 1080p, 사용자 지정

### Export 파이프라인 후보

1. **프레임 시퀀스 방식**
   - Renderer 또는 headless 렌더러가 합성 프레임을 PNG/WebP 시퀀스로 생성.
   - FFmpeg가 프레임 시퀀스 + 오디오를 MP4로 인코딩.
   - 구현이 단순하고 결과가 예측 가능하지만 디스크 사용량이 크다.

2. **프레임 파이프 방식**
   - Canvas 프레임을 rawvideo 또는 이미지 스트림으로 FFmpeg stdin에 전달.
   - 중간 파일을 줄일 수 있지만 구현 난도가 높다.

3. **FFmpeg 필터 그래프 방식**
   - 배경 영상, 자막, 이미지 오버레이 일부를 FFmpeg 필터로 직접 처리.
   - 성능과 품질이 좋지만 Canvas 비주얼라이저 재현이 어렵다.

초기 구현은 **프레임 시퀀스 방식**을 우선한다. 이후 성능 개선 단계에서 프레임 파이프 방식으로 확장한다.

### 진행률

FFmpeg stderr에서 `time=HH:MM:SS.xx`를 파싱해 전체 duration 대비 진행률을 계산한다. Export job은 취소 가능해야 하며, 취소 시 임시 프레임/출력 파일을 정리한다.

---

## 13. UI 레이아웃

```text
┌─ Header ─ 브랜드 · [Rewind Stop Play Fwd] LED시계 · Export ──────┐
├─ Body ───────────┬───────────────────────────┬─ Inspector(300) ─┤
│ Projects 레일(168)│ Preview(16:9 캔버스)        │ 선택 대상 속성    │
│ 최근 프로젝트/저장 │ Toolbar(Import/Add/Viz/BPM) │ (Viz/BPM/자막)   │
├───────────────────┴───────────────────────────┴──────────────────┤
│ Timeline(280) ─ 라벨(A~E) · 룰러 · 플레이헤드 · 5레인 · 줌/상태 풋터│
└────────────────────────────────────────────────────────────────────┘
```

### 타임라인 상호작용

룰러/레인 클릭=시킹, Track A 좌/우 핸들 드래그=트림, Track D 블록 드래그=in/out 이동.

---

## 14. helpers API 목표

| 함수 | 설명 |
|---|---|
| `fmtTC(t, withFrames)` | 초 → `MM:SS:FF` 또는 `MM:SS.mmm` |
| `decodeAudioFile(blob, ctx)` | Blob/File → `AudioBuffer` |
| `buildPeaks(buffer, buckets)` | 파형 min/max 버킷 |
| `detectBPM(buffer)` | 온셋 자기상관 템포 추정(60~180) |
| `drawCover / wrapText` | 캔버스 cover 드로잉 / 텍스트 줄바꿈 |
| `makeThumb(canvas, w)` | 캔버스 → JPEG 섬네일 |
| `renderFrameAt(time, state)` | 미리보기/Export 공용 프레임 렌더 |
| `buildExportJob(project, settings)` | FFmpeg Export job 생성 |

---

## 15. 알려진 한계 / 향후 작업

- 초기 Export는 프레임 시퀀스 방식이므로 긴 영상에서 임시 저장 공간을 많이 사용한다.
- BPM 자동 감지는 best-effort이며 수동/탭 템포 보정 UI가 필요하다.
- 로컬 파일 경로 기반 프로젝트는 파일 이동 시 재연결 UX가 필요하다.
- 비주얼라이저 Export는 실시간 `AnalyserNode` 결과와 완전히 동일하지 않을 수 있으므로 시간 기반 재현 로직을 검증해야 한다.
- 이후 GPU/WebGL 렌더링 또는 FFmpeg 파이프 방식으로 Export 성능 개선 여지가 있다.
