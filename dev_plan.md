# PaceKeeper MovMaker — 개발 계획서

## 앱 목적

**음원(MP3) + 배경 동영상 + 오버레이(비주얼라이저, 자막, 로고, BPM 표시)** 를 합성하여 하나의 영상 파일로 출력하는 브라우저 기반 편집 앱.

러닝/운동 페이스 영상 제작에 특화: BPM에 맞춰 시각적 요소가 동기화되는 것이 핵심.

---

## 트랙 구조 (고정)

| # | 트랙 | 수량 | 설명 |
|---|------|------|------|
| A | **배경 동영상** | × 1 | 영상의 기본 배경. 구간 자르기/이동 가능 |
| B | **음원 (MP3)** | × 1 | 전체 영상의 오디오 소스. 파형 표시 |
| C | **오디오 비주얼라이저** | × 1 | 음원 트랙(B)을 입력으로 삼아 영상 위에 실시간 시각화 오버레이 |
| D | **자막 / 로고** | × 1 ~ 3 | 텍스트 자막, 이미지 로고 등 복수 레인 허용 |
| E | **BPM 표시** | × 1 | 음원 BPM 분석 후 구간별 BPM 수치 또는 픽토그램을 영상에 오버레이 |

> 트랙 B(음원)는 트랙 C(비주얼라이저)와 트랙 E(BPM 표시)의 **공통 데이터 소스**다.  
> 타임라인은 이 5종의 레인으로 구성된다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | React + TypeScript |
| 영상 처리 | FFmpeg.wasm (최종 Export), `<video>` + Canvas (미리보기) |
| 오디오 분석 | Web Audio API (`AnalyserNode`, `AudioBuffer`) + Meyda.js (BPM) |
| 타임라인 UI | Canvas 또는 div+react-dnd |
| 비주얼라이저 렌더링 | Canvas 2D / WebGL |
| Export | `MediaRecorder` + `captureStream()` → WebM, 또는 FFmpeg.wasm → MP4 |

> ⚠️ FFmpeg.wasm은 SharedArrayBuffer 정책 이슈가 있어 배포 환경에서 별도 헤더 설정 필요.  
> 미리보기·프로토타입 단계는 브라우저 내장 API 위주로 먼저 구성.

---

## 개발 Phase

### Phase 1 — 프로젝트 뼈대 + 트랙 A (배경 동영상)

| 기능 | 구현 방법 |
|------|-----------|
| 배경 동영상 Import | `<input type="file">` + `URL.createObjectURL` |
| 영상 미리보기 플레이어 | `<video>` + Canvas 오버레이 스택 구조 확립 |
| 타임라인 레인 뼈대 | 5개 레인(A~E) 고정 레이아웃, 빈 상태로 렌더링 |
| 구간 자르기 / 이동 | 트랙 A 클립 블록에 좌우 드래그 핸들 |
| Playhead / 탐색 | 타임라인 클릭 시 영상 seek |

### Phase 2 — 트랙 B (음원 MP3)

| 기능 | 구현 방법 |
|------|-----------|
| MP3 Import | `<input type="file">` + `AudioContext.decodeAudioData` |
| 파형(Waveform) 시각화 | `AudioBuffer` → 샘플 다운샘플링 → Canvas 막대 렌더링 |
| 영상-음원 동기 재생 | `AudioContext` + `MediaElementSource` |
| 오디오 오프셋 조절 | 타임라인 상 트랙 B 클립 드래그로 시작점 조정 |

### Phase 3 — 트랙 C (오디오 비주얼라이저)

| 기능 | 구현 방법 |
|------|-----------|
| 비주얼라이저 유형 선택 | 바 차트형 / 원형 스펙트럼 / 파형 선형 |
| 실시간 렌더링 | `AnalyserNode` → `getByteFrequencyData` → Canvas 애니메이션 루프 |
| 영상 위 오버레이 | 미리보기 Canvas 레이어 위에 합성, 위치·크기·투명도 조절 |
| 음원 트랙(B)과 연동 | 트랙 B의 AudioNode를 트랙 C의 Analyser 입력으로 연결 |

### Phase 4 — 트랙 E (BPM 측정 + 구간별 표시)

| 기능 | 구현 방법 |
|------|-----------|
| BPM 자동 측정 | `Meyda.js` onset detection 또는 경량 peak-picking 알고리즘 |
| 수동 BPM 입력 | 입력값으로 비트 타임스탬프 계산 |
| 구간별 BPM 변화 감지 | 슬라이딩 윈도우 BPM 분석 → 구간 분할 |
| 타임라인 BPM 마커 | 비트마다 세로선 + 숫자, 구간 변화점에 강조 마커 |
| 영상 오버레이 표시 | BPM 수치 텍스트 또는 픽토그램(신호등/화살표 등)을 Canvas 레이어에 렌더링 |
| 표시 트리거 방식 | 비트 타이밍마다 플래시 / 구간 전환 시 fade-in 중 선택 |

### Phase 5 — 트랙 D (자막 / 로고)

| 기능 | 구현 방법 |
|------|-----------|
| 자막 추가 | 텍스트 + 시작·종료 시간 입력, 타임라인 D 레인에 블록 표시 |
| 로고 이미지 오버레이 | `<img>` → Canvas 합성, 위치·크기·투명도 조절 |
| 복수 레인 (D1~D3) | 자막 블록 겹침 시 자동 또는 수동으로 다른 서브레인 배정 |
| 폰트 / 색상 설정 | 선택된 자막 블록 우측 속성 패널 |
| 영상 위 렌더링 순서 | Canvas 레이어 Z-order: 배경 영상 → 비주얼라이저 → BPM → 자막/로고 |

### Phase 6 — Export

| 기능 | 구현 방법 |
|------|-----------|
| 미리보기 합성 확인 | 전 트랙 동시 재생 후 Canvas 최종 합성 상태 검증 |
| WebM Export (빠름) | `canvas.captureStream()` + `AudioDestinationNode` → `MediaRecorder` |
| MP4 Export (고품질) | FFmpeg.wasm으로 Canvas 프레임 + 오디오 인코딩 |
| 해상도 / 비트레이트 선택 | Export 설정 패널 (720p / 1080p) |

---

## Canvas 레이어 합성 순서

```
[ <video> 배경 영상 ]          ← 트랙 A
        ↓
[ Canvas Layer 1: 비주얼라이저 ] ← 트랙 C
        ↓
[ Canvas Layer 2: BPM 표시 ]   ← 트랙 E
        ↓
[ Canvas Layer 3: 자막/로고 ]  ← 트랙 D
        ↓
     최종 출력
```

실제 구현은 단일 Canvas에 위 순서대로 `drawImage` → 레이어별 렌더 함수 호출.

---

## Claude Artifacts 프로토타입용 프롬프트

```
Build a browser-based video editor as a single React component.
The app's purpose: combine a background video (Track A), MP3 audio (Track B),
audio visualizer overlay (Track C), BPM display overlay (Track E), and
subtitles/logo (Track D) into one exported video.

## Track Architecture:
- Track A — Background Video: single clip, trimmable
- Track B — Audio (MP3): waveform display, synced playback
- Track C — Audio Visualizer: driven by Track B's AnalyserNode, Canvas overlay
- Track D — Subtitles/Logo: 1~3 sub-lanes, text blocks with in/out times
- Track E — BPM Display: BPM auto-detect or manual input, per-section BPM overlay

## Core Features:

### 1. Video Import & Preview (Track A)
- File input for video (mp4, webm, mov)
- <video> element + Canvas overlay stack
- Trim handles on timeline clip block

### 2. Audio Import & Waveform (Track B)
- File input for audio (mp3, wav)
- Decode with AudioContext, render waveform bars on Track B lane
- Sync playback with video

### 3. Audio Visualizer Overlay (Track C)
- AnalyserNode connected to Track B source
- Bar-chart or circular spectrum drawn on Canvas overlay
- Position/size/opacity controls

### 4. BPM Display (Track E)
- Manual BPM input field
- Calculate beat timestamps → draw vertical markers on Track E lane
- Canvas overlay shows BPM number or pictogram at beat moments

### 5. Subtitles / Logo (Track D)
- Add subtitle button: text + start time + end time
- Blocks shown on Track D lane
- Rendered on topmost Canvas layer

## Canvas Layer Order (single Canvas, drawn each frame):
1. drawImage(video) — background
2. Visualizer bars — Track C
3. BPM text/pictogram — Track E
4. Subtitle/logo text — Track D

## UI Layout:
- Top: 16:9 preview area with stacked Canvas
- Middle: Toolbar (Import Video, Import Audio, Add Subtitle, BPM input, Visualizer toggle)
- Bottom: Timeline with 5 fixed lanes: [A] Video | [B] Audio | [C] Visualizer | [D] Subtitle | [E] BPM

## Style:
- Dark theme (#1a1a2e bg, #16213e panel, #0f3460 accent, #e94560 highlight)
- Professional NLE aesthetic

## Constraints:
- Single React component, useState/useRef/useEffect only
- No external libraries except Web Audio API
```
