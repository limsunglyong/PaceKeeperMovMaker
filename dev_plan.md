# PaceKeeper MovMaker 개발 계획

## 변경 기록

### 2026-06-02

- 품질 노트 추가: Electron 구조 자체는 고화질 최종 동영상 생성에 문제가 없지만, 현재 Canvas `MediaRecorder` 기반 WebM export는 미리보기/검증용으로만 취급해야 한다. 최종 결과물은 원본 영상/오디오를 기반으로 native FFmpeg export를 사용해 H.264/H.265, AAC, CRF, preset, 해상도, bitrate를 직접 제어해야 화질 저하를 줄일 수 있다.
- 미해결 버그 기록: `Video Track 1`에 영상을 로딩한 뒤 `Video Track 2`에 다른 영상을 로딩하면 Track 1의 영상이 삭제되고 Track 2 영상만 남는다. 현재 내부 구조가 단일 `state.video`/`state.audio` 중심이라 track별 media clip 배열로 확장해야 한다. Audio track도 동일하게 `state.audio` 단일 구조 때문에 같은 문제가 발생한다.
- 개선 요청 기록: 영상/음악 import 시 현재 play bar 위치를 무시하고 항상 timeline 0초부터 로딩된다. import 시점의 `state.time`을 기본 clip start로 사용해 playhead 위치부터 배치되도록 변경해야 한다.
- 기능 요청 기록: Video track과 Audio track 삭제 기능을 추가해야 한다. 삭제 시 해당 track에 연결된 media clip 처리 방식도 함께 정의해야 한다. 예: track만 삭제, clip도 삭제, 다른 track으로 이동 중 선택.
- BPM 알고리즘 개선 요청 기록: 테스트 MP3 조건이 `0~10초: 90 BPM`, `10~40초: 120 BPM`, `40~60초: 160 BPM`일 때 현재 감지 결과가 `0~36초: 120`, `36~60초: 159`로 나온다. 짧은 첫 10초 90 BPM 구간이 병합/누락되는 문제가 있으므로 구간 경계 감지, 분석 window/hop 크기, 짧은 section 보존 규칙을 개선해야 한다.
- 버그 수정: 화면을 크게 키울 때 preview Canvas가 폭 기준으로 커져 Y축이 잘려 보이는 문제를 수정했다. preview 영역의 실제 가로/세로 여유를 계산해, 가로가 제한이면 가로 기준으로, 세로가 제한이면 세로 기준으로 16:9 Canvas 표시 크기를 맞추도록 했다.
- 버그 수정: 새 Video/Audio track을 추가한 뒤 import해도 미디어 블록이 항상 첫 번째 기본 track에 표시되던 문제를 수정했다. 현재 선택된 video/audio track을 `videoTrackId`/`audioTrackId`로 저장하고, timeline 렌더링과 프로젝트 저장/불러오기에서 해당 track에 미디어가 표시되도록 했다.
- 버그 수정: 브라우저 캐시 회피를 위해 `index.html`의 CSS/JS 버전 쿼리를 `v=20260602-fit-track-import`로 갱신했다.
- 기능 추가: 자막 Overlay item을 선택했을 때 Inspector에 Font 드롭다운, Normal/Bold/Italic 스타일 버튼, Font size 슬라이더를 추가했다. 저장/불러오기 데이터에도 `fontFamily`, `fontWeight`, `fontStyle`을 포함하도록 확장했다.
- 버그 수정: Italic 버튼 내부 텍스트를 클릭해도 스타일 토글이 정상 동작하도록 Inspector 클릭 이벤트가 실제 `data-sub-style` 버튼을 찾도록 보정했다.
- BPM 알고리즘 개선: 180 BPM 구간이 60 BPM으로 감지되는 문제를 줄이기 위해 빠른 BPM 후보 범위를 200까지 확장하고, 60/75/80처럼 낮게 잡히는 alias 값이 직전 구간 흐름과 맞는 경우 2배/3배 빠른 템포로 보정하도록 했다. 예: 직전 구간이 약 150 BPM이고 다음 구간이 60으로 잡히면 180 BPM 후보를 우선 적용한다.
- 버그 수정: 브라우저 캐시 회피를 위해 `index.html`의 CSS/JS 버전 쿼리를 `v=20260602-font-bpm`으로 갱신했다.

### 2026-05-29

- 기능 변경: 배경 동영상 Canvas 렌더링을 `cover-fit`에서 `contain-fit`으로 변경했다. 이제 영상은 x축 기준으로 꽉 채우며 잘리는 방식이 아니라, 전체 동영상 프레임이 Canvas 안에 들어오도록 스케일링된다. 남는 영역은 기존 Canvas 배경색/letterbox로 유지된다.
- 버그 수정/원인 판정: F12 DevTools를 열면 자막이 보이고 닫으면 사라지는 현상은 자막이 실제로 미렌더링된 것이 아니라 기본 `Position Y=82%`가 너무 낮아 동영상 하단/아래쪽에 붙어 보인 것이 원인이었다.
- UX 개선: 새 텍스트 자막과 텍스트 자막 fallback 기본 위치를 `Position Y=74%`로 올려 하단 safe area 안에 더 안정적으로 표시되도록 했다. 기존 자막은 사용자가 설정한 위치를 유지하므로 필요 시 Inspector의 `Position Y`에서 조정한다.
- 버그 수정: DevTools 열기/닫기처럼 viewport가 바뀔 때 Canvas preview가 현재 상태로 다시 그려지도록 `resize`, `visualViewport.resize`, `ResizeObserver`, `focus`, `visibilitychange` 이벤트에서 가벼운 재렌더를 예약하도록 했다.
- 버그 수정: 브라우저 캐시 회피를 위해 `index.html`의 CSS/JS 버전 쿼리를 `v=20260602-subtitle-safe-area`로 갱신했다.
- 버그 수정/원인 판정: `window.pacekeeperDebug()` 결과에서 `activeSubtitles: []`가 확인되어, 텍스트 렌더 실패가 아니라 현재 playhead가 자막 in/out 구간 밖에 있어 활성 자막이 없는 상태로 판정되는 문제임을 확인했다.
- 버그 수정: 편집 중 선택된 자막은 playhead가 in/out 구간 밖에 있어도 preview-only로 Canvas에 표시되도록 했다. 이 preview-only 렌더는 재생 중이나 export 중에는 적용하지 않아 최종 출력 타이밍은 기존 in/out 규칙을 유지한다.
- UX 개선: 타임라인에서 자막 블록을 선택/드래그할 때 playhead가 해당 자막 구간 밖에 있으면 자동으로 자막 시작 지점 근처로 이동하도록 했다.
- 버그 수정: 브라우저 캐시 회피를 위해 `index.html`의 CSS/JS 버전 쿼리를 `v=20260602-subtitle-preview`로 갱신했다.
- 버그 수정/진단: 로고 이미지는 보이지만 텍스트 자막만 보이지 않는 상황을 분리하기 위해 텍스트 전용 `drawTextSubtitle()` 렌더 함수를 추가했다. 활성 텍스트 자막은 기존 `drawSub()` 경로 외에도 최종 overlay pass에서 한 번 더 직접 렌더링한다.
- 진단 추가: 브라우저 콘솔에서 `window.pacekeeperDebug()`를 호출하면 현재 시간, 선택 항목, 전체 자막 수, 활성 자막 목록, Canvas 크기를 확인할 수 있도록 했다. 자막이 계속 보이지 않을 경우 활성 자막 데이터 존재 여부를 우선 확인한다.
- 조사/버그 수정: 이전 자막 수정 흔적을 `git log -p`, `editor.jsx`, `5f6edb5:src/renderer/app.js`에서 확인했다. 이전 구현은 `drawSub()`에서 단순히 `strokeText()` 후 `fillText()`를 호출하고 모든 오버레이 뒤에 자막을 마지막으로 그리는 방식이었다.
- 버그 수정: 현재 `drawSub()`를 이전 구현에 가깝게 단순화하고, `renderFrame()` 시작과 자막 렌더 직전에 Canvas transform/alpha/composite/shadow 상태를 강제로 초기화하도록 했다. 비주얼라이저/BPM 렌더링 상태가 자막 렌더링에 영향을 주는 가능성을 줄였다.
- 버그 수정: 자막이 계속 보이지 않는 문제에 대응해 `renderFrame()`의 자막 렌더링을 `drawActiveSubtitles()` 최상단 overlay pass로 분리했다. 현재 시간의 활성 자막을 렌더 직전에 다시 정규화하고, Visualizer/BPM/트랙 순서와 무관하게 마지막에 그리도록 했다.
- 버그 수정: 브라우저가 이전 `app.js`/`app.css`를 캐시해 수정 사항이 반영되지 않을 가능성을 줄이기 위해 `index.html`의 CSS/JS 링크에 `v=20260602-subtitle-fix` 캐시 무효화 쿼리를 추가했다.
- 버그 수정: 자막 item이 타임라인과 Inspector에는 존재하지만 Canvas preview에 보이지 않는 문제를 다시 보강했다. 새 자막, 저장된 자막, JSON/IndexedDB에서 불러온 자막을 `normalizeSubtitle()`로 정규화해 `text`, `start/end`, `trackId`, `x/y`, `size`, `color`, `background` 기본값이 누락되어도 흰 글자와 배경으로 표시되도록 했다.
- 버그 수정: 자막 렌더링 시 `size`, `color`, `x/y` 값이 비어 있거나 오래된 프로젝트 데이터에서 누락된 경우에도 안전한 fallback을 사용하도록 `drawSub()`를 보강했다. Canvas 합성 상태도 자막 렌더 직전에 `source-over`, `globalAlpha=1`로 재설정한다.
- 기능 추가: BPM 자동 측정을 단일 전체 BPM에서 구간별 BPM 분석으로 확장했다. 오디오 import 시 16초 분석 창과 8초 hop을 사용해 구간별 BPM을 추정하고, 같은 BPM 단계 또는 근접 BPM은 하나의 구간으로 병합한다.
- 기능 추가: BPM track lane에 `bpmSections`를 시각화하도록 변경했다. 각 구간은 `Slow`, `Normal`, `Fast`, `Sprint` 단계와 BPM 값을 표시하고, beat marker는 해당 구간의 BPM 기준으로 생성된다.
- 기능 추가: BPM overlay는 4개 단계 아이콘을 항상 `Slow`, `Normal`, `Fast`, `Sprint` 순서로 표시한다. 기본 상태는 회색 PNG를 사용하고, 현재 재생 위치의 BPM 구간에 해당하는 아이콘과 텍스트만 컬러 PNG/강조 텍스트로 표시한다.
- 기능 추가: 프로젝트 저장 데이터에 `bpmSections`를 포함해 저장/불러오기 후에도 구간별 BPM 분석 결과가 유지되도록 했다.
- 구현 메모: BPM 수동 입력 또는 Tap BPM을 사용하면 자동 구간 분석값은 초기화하고 사용자가 입력한 단일 BPM을 기준으로 표시한다.
- 기능 추가: BPM 단계별 PNG preset을 프로그램에 연결했다. 기본 경로는 `assets/bpm/gray-slow.png`, `gray-normal.png`, `gray-fast.png`, `gray-sprint.png`, `color-slow.png`, `color-normal.png`, `color-fast.png`, `color-sprint.png`이다.
- 기능 추가: BPM overlay가 현재 BPM을 `Slow`, `Normal`, `Fast`, `Sprint` 4단계로 판정하고, 선택된 이미지 세트의 PNG 아이콘과 단계 텍스트를 Canvas에 표시하도록 확장했다.
- 기능 추가: BPM Inspector에 `Image set(color/gray)`, `Show icon`, `Show label`, `Show BPM number` 옵션을 추가했다.
- 구현 메모: 현재 BPM 단계 기준은 `Slow < 110`, `Normal 110~139`, `Fast 140~169`, `Sprint >= 170`으로 두었다. 추후 BPM Subtitle 생성 UI에서 threshold를 사용자 설정값으로 확장한다.
- 버그 수정: 자막을 추가해도 보이지 않는 문제를 다시 점검하고, 새 자막이 기본 배경과 더 큰 기본 크기를 가진 상태로 즉시 표시되도록 조정했다. 새 자막은 현재 playhead 위치에서 3초 길이로 생성되며, 생성 직후 playhead를 해당 구간에 맞춰 미리보기 렌더링을 갱신한다.
- 기능 추가: Visualizer 트랙 블록 안에 현재 선택된 visualizer 스타일을 보여주는 미니 모양 표시를 추가했다. bars/mirror/wave/circle/dots 스타일에 따라 다른 형태가 표시된다.
- 기능 추가: Overlay 트랙의 자막/로고 블록을 마우스로 좌우 이동할 수 있는 기존 동작에 더해, 좌우 핸들로 in/out 구간 길이를 조정할 수 있게 했다.
- 기능 추가: Overlay 트랙 블록 표시를 개선했다. 자막 블록은 실제 자막 텍스트를 표시하고, 로고 블록은 작은 이미지 썸네일과 파일명을 함께 표시한다.
- 버그 수정: Inspector에서 slider 조작 중 포커스를 유지하도록 하면서도 `%` 값 표시가 갱신되지 않던 문제를 수정했다. 입력 중에도 label 값 표시만 즉시 업데이트한다.
- 기능 추가: 색상 swatch 끝에 `RGB` full color 버튼을 추가했다. 버튼을 누르면 native color picker를 열어 swatch에 없는 임의 색상을 선택할 수 있다.
- 버그 수정: Inspector 입력값을 수정할 때마다 전체 Inspector DOM을 다시 렌더링해 포커스가 사라지던 문제를 수정했다. 입력 중에는 Inspector를 다시 만들지 않고 타임라인/미리보기만 갱신한다.
- 버그 수정: playhead가 프로젝트 끝에 있을 때 자막을 추가하면 `start`와 `end`가 같아져 화면에 보이지 않을 수 있던 문제를 수정했다. 새 자막은 기본 3초, 새 로고는 기본 6초 길이로 생성되며 필요하면 프로젝트 길이를 늘린다.
- 기능 추가: 비디오 import 후 10초 간격으로 스틸샷 썸네일을 생성하고, 타임라인의 비디오 클립 안에 필름스트립처럼 표시한다.
- 사용 메모: 자막은 `Add Subtitle` 버튼으로 추가한 뒤 playhead가 자막의 `In`/`Out` 구간 안에 있을 때 Canvas preview에 표시된다. 자막이 보이지 않으면 Inspector에서 해당 자막의 `In`, `Out`, `Track`, `Position Y`, `Color`를 먼저 확인한다.
- 기능 추가: `Add Track` 버튼 클릭 시 트랙 타입 선택 모달을 띄우도록 변경했다.
- 기능 추가: 선택 가능한 트랙 타입을 `Video`, `Audio`, `Overlay`로 확장했다.
- 기능 추가: 동영상 클립과 오디오 클립을 타임라인에서 좌우 드래그해 시작 위치를 조정할 수 있게 했다.
- 기능 추가: Video/Audio 트랙 Inspector에 `Timeline start` 값을 추가해 숫자로도 시작 위치를 조정할 수 있게 했다.
- 버그 수정: 타임라인에 세로 스크롤이 생겼을 때 Track label과 실제 Track lane 위치가 어긋나는 문제를 수정했다. Track label 목록을 내부 컨테이너로 렌더링하고 타임라인 `scrollTop`에 맞춰 transform 동기화한다.
- 구현 메모: 현재 추가 Video/Audio 트랙은 레인 타입과 옵션을 추가하는 단계이며, 실제 다중 비디오/오디오 소스 import와 track별 media binding은 다음 단계 작업으로 남겨둔다.

## 1. 목표

PaceKeeper MovMaker는 배경 동영상, 음악 파일, 오디오 비주얼라이저, BPM 표시, 자막/로고 오버레이를 합성해 하나의 영상으로 내보내는 데스크톱 편집기이다.

현재 구현은 Electron 기반 데스크톱 앱 골격과 브라우저에서 바로 열 수 있는 렌더러를 함께 제공한다. 빠른 테스트는 `index.html`을 직접 열어 수행할 수 있고, 데스크톱 실행과 배포는 Electron을 사용한다.

최종 목표는 로컬 native FFmpeg를 사용해 MP4/H.264/AAC 영상을 고품질로 export하는 것이다. 현재 export는 미리보기 검증용 WebM 실시간 export이며, native FFmpeg export는 다음 주요 단계로 남아 있다.

---

## 2. 현재 기술 스택

| 영역 | 현재 선택 |
|---|---|
| Desktop shell | Electron |
| Main process | `src/main/main.js` |
| Preload bridge | `src/preload/preload.js`, `window.pacekeeper` |
| Renderer | Vanilla HTML/CSS/JS, Canvas 2D |
| Preview | `<video>`, `<audio>`, Web Audio API, Canvas |
| Project storage | IndexedDB 저장 + Electron `.pkmm.json` 저장/열기 브리지 |
| Packaging | `electron-builder` |
| Preview export | `MediaRecorder` WebM |
| 최종 export 목표 | native FFmpeg MP4 |

React/TypeScript 전환은 여전히 가능한 방향이지만, 현재 구현은 빠른 검증을 위해 의존성 없는 Vanilla renderer로 진행되어 있다.

---

## 3. 실행 및 배포

### 빠른 실행

브라우저에서 직접 연다.

```powershell
D:\roseWorks\programming\PaceKeeperMovMaker\index.html
```

### Electron 실행

```powershell
cd D:\roseWorks\programming\PaceKeeperMovMaker
npm.cmd install
npm.cmd start
```

PowerShell 실행 정책 때문에 `npm` 대신 `npm.cmd` 사용을 권장한다.

### Windows 배포

```powershell
cd D:\roseWorks\programming\PaceKeeperMovMaker
npm.cmd install
npm.cmd run dist
```

결과물은 `release/` 폴더에 생성된다.

- NSIS 설치형 `.exe`
- portable `.exe`

---

## 4. 현재 파일 구조

| 파일/폴더 | 역할 |
|---|---|
| `index.html` | 앱 HTML 진입점. 브라우저 직접 실행도 가능 |
| `src/renderer/app.js` | 편집기 상태, 미디어 로드, 렌더링, 타임라인, 저장, export |
| `src/renderer/app.css` | NLE 스타일 UI |
| `src/main/main.js` | Electron BrowserWindow, 프로젝트 파일 저장/열기 IPC |
| `src/preload/preload.js` | 안전한 renderer API 노출 |
| `package.json` | Electron 실행, electron-builder 배포 설정 |
| `PaceKeeper Movie Maker.html`, `editor.jsx`, `helpers.jsx`, `ui.jsx` | 이전 프로토타입/legacy 참고 파일 |

legacy 파일은 현재 앱 실행 경로가 아니며, 필요한 로직은 새 renderer로 옮기는 방향이다.

---

## 5. 트랙 구조

초기 계획의 “고정 5트랙” 구조는 현재와 맞지 않는다. 지금은 시스템 트랙과 추가 가능한 오버레이 트랙을 함께 사용한다.

| 타입 | 수량 | 역할 |
|---|---:|---|
| Video | 1 | 배경 동영상. trim 가능. 트랙 옵션에서 동영상 원본 음성 mute/volume 조절 |
| Audio | 1 | 음악/음원. waveform 표시. 트랙 옵션에서 mute/volume 조절 |
| Visualizer | 1 | 음악 트랙 기반 오디오 비주얼라이저 |
| Overlay | 1개 이상 | 자막/로고를 배치하는 추가 가능 트랙 |
| BPM | 1 | BPM 값, beat marker, BPM overlay |

오버레이 트랙은 `Add Track` 버튼으로 추가할 수 있다. 자막/로고는 선택된 오버레이 트랙에 들어가며, Inspector에서 다른 오버레이 트랙으로 이동할 수 있다.

---

## 6. 현재 구현된 기능

### 미디어

- 비디오 파일 import
- 오디오 파일 import
- 로고 이미지 import
- 오디오 디코딩 및 waveform peak 생성
- BPM 자동 추정
- Tap BPM 입력

### 미리보기

- 1280x720 16:9 Canvas preview
- 비디오 contain-fit 배경 렌더링
- 오디오 비주얼라이저 렌더링
- BPM pulse overlay 렌더링
- 자막/로고 overlay 렌더링
- 재생/정지/처음/끝 transport
- Space, Home 단축키

### 타임라인

- 동적 track model
- Add Track으로 오버레이 트랙 추가
- 트랙 라벨 클릭 시 트랙별 Inspector 표시
- playhead seek
- timeline zoom, fit
- 비디오 trim handle
- 자막/로고 block drag
- BPM beat marker 표시

### Inspector

트랙 라벨 또는 클립을 선택하면 오른쪽 Inspector가 타입별로 바뀐다.

| 선택 대상 | 옵션 |
|---|---|
| Video track | 동영상 내 음성 mute, volume |
| Audio track | 음악 mute, volume |
| Visualizer track | bars/mirror/wave/circle/dots 스타일, 위치, 크기, 투명도, 색상 |
| Overlay track | 트랙 이름, 트랙 색상, 자막 효과, 그림자, 배경, 정렬 |
| Subtitle item | 텍스트, in/out, 위치, 폰트 크기, 색상, 트랙 이동, 개별 효과 |
| Logo item | in/out, 위치, 로고 크기, 트랙 이동 |
| BPM track | BPM, beat offset, 위치, 색상 |

### 저장/불러오기

- IndexedDB 프로젝트 저장
- 최근 프로젝트 rail 표시
- 썸네일 생성
- Electron 환경에서 `.pkmm.json` 파일 저장/열기 브리지
- 트랙 모델, 오디오 옵션, 비주얼라이저 옵션, 자막 효과 옵션 저장

### Export

- 현재: Canvas `captureStream()` + `MediaRecorder` 기반 WebM preview export
- 목표: native FFmpeg 기반 MP4 export

---

## 7. Canvas 렌더링 순서

현재 preview와 export preview는 같은 Canvas 렌더링 함수를 사용한다.

1. 배경 비디오
2. 오디오 비주얼라이저
3. BPM overlay
4. 오버레이 트랙 순서에 따른 자막/로고

오버레이 트랙은 timeline track order에 따라 Canvas 합성 순서가 결정된다.

---

## 8. 프로젝트 데이터 모델 초안

현재 저장 레코드는 IndexedDB에서 Blob까지 포함할 수 있고, `.pkmm.json` 저장 시에는 설정 중심으로 저장한다.

```json
{
  "version": 1,
  "id": "project-id",
  "name": "Untitled",
  "updatedAt": 0,
  "trim": { "start": 0, "end": 30 },
  "tracks": [
    { "id": "video", "label": "Video", "type": "video", "locked": true },
    { "id": "audio", "label": "Audio", "type": "audio", "locked": true },
    { "id": "viz", "label": "Visualizer", "type": "viz", "locked": true },
    { "id": "overlay-1", "label": "Overlay 1", "type": "overlay" },
    { "id": "bpm", "label": "BPM", "type": "bpm", "locked": true }
  ],
  "videoAudio": { "muted": true, "volume": 0.8 },
  "musicAudio": { "muted": false, "volume": 1 },
  "viz": {},
  "bpm": 120,
  "bpmOv": {},
  "subtitleFx": {
    "effect": "none",
    "shadow": true,
    "background": false,
    "align": "center"
  },
  "subs": [
    {
      "id": "s1",
      "type": "text",
      "trackId": "overlay-1",
      "text": "New subtitle",
      "start": 0,
      "end": 3,
      "x": 0.5,
      "y": 0.86,
      "size": 52,
      "color": "#ffffff"
    }
  ]
}
```

다음 단계에서는 로컬 파일 경로 기반 media reference와 assets 복사 정책을 명확히 해야 한다.

---

## 9. 다음 작업 우선순위

### 0. 긴급 버그/구조 개선 대기 항목

#### Track별 media clip 구조화

현재 Video/Audio import는 선택된 track에 표시되도록 일부 보정되어 있지만, 실제 media 데이터는 여전히 단일 `state.video`, `state.audio` 중심이다. 그래서 `Video Track 1`에 영상을 로딩한 뒤 `Video Track 2`에 다른 영상을 로딩하면 첫 번째 영상이 사라진다. Audio도 같은 구조적 문제가 있다.

수정 방향:

- `state.video` 단일 객체를 `state.videoClips[]` 구조로 변경한다.
- `state.audio` 단일 객체를 `state.audioClips[]` 구조로 변경한다.
- 각 clip은 `id`, `trackId`, `name`, `url`, `duration`, `start`, `trimStart`, `trimEnd`, `volume`, `muted`를 가진다.
- timeline 렌더링은 track별 clip 배열을 필터링해 표시한다.
- preview/export 렌더링은 현재 시간에 활성화된 video clip/audio clip을 track 순서와 compositing 규칙에 따라 처리한다.
- 기존 프로젝트와의 호환을 위해 구버전 `state.video`, `state.audio`, `videoTrackId`, `audioTrackId`를 새 clip 배열로 migration한다.

#### Import 위치 기본값 변경

영상/음악 import 시 clip 시작 위치를 항상 0초로 두지 않고 현재 playhead 위치(`state.time`)를 기본 start로 사용한다. 단, 사용자가 track label을 선택한 상태에서 import하면 해당 track의 playhead 위치에 clip을 생성한다.

#### Video/Audio track 삭제

Video/Audio track 삭제 기능을 추가한다. 삭제 UX는 다음 중 하나로 결정해야 한다.

- track과 해당 track의 clip을 함께 삭제한다.
- track 삭제 전 clip 이동 대상 track을 선택하게 한다.
- 기본 Video/Audio system track은 유지하고 사용자가 추가한 track만 삭제 가능하게 한다.

초기 구현은 추가 track만 삭제 가능하게 하고, 해당 track의 clip도 함께 삭제하는 방식이 가장 단순하다.

#### BPM 구간 감지 개선

현재 BPM 구간 감지는 긴 window와 병합 규칙 때문에 짧은 앞구간이 누락될 수 있다. 확인된 테스트 케이스:

| 실제 구간 | 실제 BPM | 현재 감지 |
|---|---:|---|
| 0~10초 | 90 | 0~36초 120에 병합/누락 |
| 10~40초 | 120 | 0~36초 120 |
| 40~60초 | 160 | 36~60초 159 |

개선 방향:

- 초반/짧은 구간 감지를 위해 `windowSec`와 `hopSec`를 더 작게 하거나 adaptive window를 사용한다.
- section merge 시 BPM level이 다르면 짧은 구간이라도 보존하는 규칙을 둔다.
- onset novelty curve 변화량으로 BPM 변화 경계 후보를 먼저 찾고, 후보 구간별 BPM을 다시 계산한다.
- 최소 section 길이와 신뢰도 score를 함께 저장해 Inspector/Debug에서 확인 가능하게 한다.

### 0. BPM 기반 자막 시스템 설계

사용자가 실제 구현 여부를 결정하기 전까지는 계획 단계로 유지한다.

목표는 MP3/Audio 트랙에서 측정된 BPM과 beat timestamp를 이용해 자막을 자동 생성하거나, 기존 자막을 beat grid에 맞춰 배치/보정하는 것이다. 이 기능은 일반 자막 트랙과 별개로 "BPM Subtitle" 생성 흐름을 제공하되, 생성 결과는 기존 Overlay track의 subtitle item으로 들어가도록 설계한다.

BPM 자막은 단순 숫자 표시가 아니라, 페이스 상태를 보여주는 "아이콘 + 단계 텍스트" 조합을 기본 표현으로 한다. 예를 들어 `Slow`, `Normal`, `Fast` 같은 문구와 함께 속도감을 나타내는 아이콘을 표시한다.

#### 핵심 사용자 흐름

1. 사용자가 MP3/WAV 오디오를 import한다.
2. 앱이 오디오를 decode하고 BPM을 추정한다.
3. BPM 값과 `audioOffset`을 기준으로 beat grid를 만든다.
4. 사용자가 "BPM Subtitle" 생성 옵션을 연다.
5. 사용자가 자막 생성 모드를 선택한다.
6. 앱이 beat 구간에 맞춰 subtitle item을 생성한다.
7. 생성된 자막은 Overlay track에 일반 자막처럼 표시되고, 기존 Inspector에서 수정 가능하다.

#### Beat timestamp 계산

기본 공식:

```js
beatInterval = 60 / bpm
beatTime(n) = audioOffset + bpmOffset + n * beatInterval
```

필요한 상태값:

| 값 | 설명 |
|---|---|
| `bpm` | 자동 측정 또는 수동 입력 BPM |
| `audioOffset` | 타임라인에서 오디오 클립이 시작되는 시간 |
| `bpmOv.offset` 또는 별도 `beatOffset` | 첫 beat 보정값 |
| `duration` | 프로젝트 전체 길이 |
| `beatInterval` | beat 간격 |

자동 BPM은 현재 단일 BPM 추정값을 사용한다. 향후 구간별 BPM 분석이 들어오면 `bpmSections` 배열로 확장한다.

```json
{
  "bpmSections": [
    { "start": 0, "end": 32, "bpm": 128, "offset": 0 },
    { "start": 32, "end": 64, "bpm": 132, "offset": 0.04 }
  ]
}
```

#### 자막 생성 모드

| 모드 | 설명 | 생성 방식 |
|---|---|---|
| Beat Count | beat마다 숫자 또는 카운트 텍스트 표시 | `1, 2, 3, 4` 반복 |
| BPM Label | 일정 간격마다 현재 BPM 표시 | 예: `128 BPM` |
| Phrase Sync | 사용자가 입력한 문구 배열을 beat 단위로 배치 | beat마다 다음 문구 표시 |
| Section Marker | 4/8/16 beat마다 구간 자막 생성 | 예: `Verse`, `Run`, `Sprint` |
| Metronome Cue | 짧은 cue 자막 생성 | 예: `GO`, `STEP`, `UP` |
| Pace Status | BPM 범위에 따라 아이콘 + 단계 텍스트 표시 | 예: `Fast`, `Normal`, `Slow` |

초기 구현 우선순위는 `Pace Status`, `BPM Label`, `Beat Count`, `Phrase Sync` 순서가 적절하다.

#### Pace Status 표현

BPM 기반 자막의 기본 모드는 `Pace Status`로 둔다. 이 모드는 BPM 값을 4~5단계로 나누고, 각 단계에 아이콘과 텍스트를 매핑한다.

예시 단계:

| 단계 | BPM 예시 | 텍스트 | 아이콘 방향 |
|---|---:|---|---|
| Very Slow | `< 90` | `Very Slow` | 느림, 휴식, 아래 방향 |
| Slow | `90~109` | `Slow` | 완만한 움직임 |
| Normal | `110~139` | `Normal` | 안정적인 박자 |
| Fast | `140~169` | `Fast` | 빠른 이동, 위 방향 |
| Sprint | `>= 170` | `Sprint` | 강한 가속, 번개/불꽃 계열 |

실제 threshold는 사용자 설정 가능해야 한다. BPM 장르와 운동 목적에 따라 120 BPM이 Normal일 수도 있고 Fast일 수도 있기 때문이다.

설정 모델 예시:

```json
{
  "paceLevels": [
    { "id": "very-slow", "min": 0, "max": 89, "label": "Very Slow", "icon": "rest", "color": "#5b8cff" },
    { "id": "slow", "min": 90, "max": 109, "label": "Slow", "icon": "down", "color": "#2dd4bf" },
    { "id": "normal", "min": 110, "max": 139, "label": "Normal", "icon": "pulse", "color": "#ffffff" },
    { "id": "fast", "min": 140, "max": 169, "label": "Fast", "icon": "up", "color": "#ffb020" },
    { "id": "sprint", "min": 170, "max": 999, "label": "Sprint", "icon": "bolt", "color": "#ff4d5e" }
  ]
}
```

#### 아이콘 구현 방식

초기 구현은 외부 이미지 파일보다 내장 Canvas/SVG 아이콘이 적합하다.

- subtitle item에 `icon` 필드를 저장한다.
- `drawSub()` 또는 별도 `drawBpmSubtitle()`에서 icon + text를 함께 그린다.
- 아이콘은 `rest`, `down`, `pulse`, `up`, `bolt` 같은 semantic id로 관리한다.
- 추후 사용자가 직접 아이콘 이미지를 지정할 수 있도록 확장한다.

생성 subtitle item 예시:

```json
{
  "id": "bpm-sub-001",
  "type": "text",
  "trackId": "overlay-1",
  "text": "Fast",
  "icon": "up",
  "start": 12.0,
  "end": 16.0,
  "x": 0.5,
  "y": 0.18,
  "size": 46,
  "color": "#ffb020",
  "background": true,
  "source": {
    "kind": "bpm-subtitle",
    "mode": "pace-status",
    "bpm": 148,
    "paceLevel": "fast"
  }
}
```

#### 표시 주기

Pace Status 자막은 beat마다 표시하면 너무 산만할 수 있다. 기본은 일정 beat 묶음마다 하나씩 생성한다.

권장 기본값:

- 4 beat 또는 8 beat마다 상태 표시
- 각 자막 duration은 2~4 beat
- BPM 단계가 바뀌는 시점에는 즉시 새 자막 표시
- 같은 단계가 반복되면 중복 생성을 줄이는 옵션 제공

#### UI 옵션

Pace Status 생성 UI에는 다음 옵션이 필요하다.

- 단계 수: 3단계 / 4단계 / 5단계
- 각 단계 label
- 각 단계 BPM threshold
- 각 단계 color
- 각 단계 icon
- 표시 간격: 4 beat / 8 beat / 16 beat
- 단계 변경 시 즉시 표시 여부
- BPM 숫자 함께 표시 여부: `Fast` 또는 `Fast 148 BPM`
- 기존 BPM subtitle 교체 여부

#### 생성 옵션

UI는 별도 modal 또는 Inspector 확장 패널로 제공한다.

필수 옵션:

- 대상 Overlay track
- 생성 시작 시간
- 생성 종료 시간
- beat subdivision: `1 beat`, `2 beat`, `4 beat`, `8 beat`
- subtitle duration: beat 길이 기준 또는 고정 초 단위
- text template
- 기존 BPM subtitle 삭제 후 재생성 여부

예시 옵션:

```json
{
  "targetTrackId": "overlay-1",
  "mode": "beat-count",
  "start": 0,
  "end": 60,
  "subdivision": 4,
  "durationBeats": 1,
  "template": "{count}",
  "replaceExisting": true
}
```

#### 생성되는 subtitle item 구조

기존 subtitle item과 같은 구조를 사용하되 BPM 생성 자막임을 구분하기 위한 metadata를 추가한다.

```json
{
  "id": "bpm-sub-001",
  "type": "text",
  "trackId": "overlay-1",
  "text": "128 BPM",
  "start": 12.0,
  "end": 12.45,
  "x": 0.5,
  "y": 0.18,
  "size": 42,
  "color": "#ff4d5e",
  "background": true,
  "source": {
    "kind": "bpm-subtitle",
    "mode": "bpm-label",
    "beatIndex": 32,
    "bpm": 128
  }
}
```

`source.kind === "bpm-subtitle"`를 사용하면 재생성 시 기존 BPM 자막만 선택적으로 삭제할 수 있다.

#### 기존 자막 시스템과의 관계

- BPM 자막은 별도 렌더러를 만들지 않고 기존 `drawSub()`를 사용한다.
- 생성 결과는 `state.subs`에 들어간다.
- 사용자는 생성 후 일반 자막처럼 위치, 색상, 크기, in/out을 수정할 수 있다.
- 재생성 시 사용자가 수동 수정한 BPM 자막을 덮어쓸 수 있으므로 확인 UX가 필요하다.

#### 구현 함수 초안

```js
function buildBeatGrid({ bpm, start, end, audioOffset, beatOffset }) {
  const interval = 60 / bpm;
  const beats = [];
  for (let t = audioOffset + beatOffset; t <= end; t += interval) {
    if (t >= start) beats.push({ time: t, index: beats.length });
  }
  return beats;
}

function generateBpmSubtitles(options, state) {
  const beats = buildBeatGrid(...);
  return beats
    .filter((beat, i) => i % options.subdivision === 0)
    .map((beat) => makeSubtitleFromBeat(beat, options, state));
}
```

#### 주의할 점

- BPM 자동 측정은 octave error가 생길 수 있다. 예: 64 BPM과 128 BPM 혼동.
- 그래서 생성 전 BPM 수동 보정 UI가 반드시 필요하다.
- `audioOffset`이 있는 경우 beat grid는 프로젝트 시간 기준으로 변환해야 한다.
- 자막이 너무 많이 생성되면 timeline 렌더링이 느려질 수 있으므로 최대 생성 개수 제한 또는 경고가 필요하다.
- 1 beat마다 자막을 생성하는 경우 긴 곡에서는 수백 개 이상 생길 수 있다.

#### 단계별 구현 계획

1. BPM subtitle option modal 추가
2. beat grid 계산 함수 추가
3. `source.kind = "bpm-subtitle"` metadata를 가진 subtitle 생성
4. replace existing 옵션 구현
5. 생성된 자막을 Overlay track에 표시
6. 자막 수가 많을 때 timeline 성능 점검
7. 구간별 BPM 분석이 생기면 `bpmSections` 기반으로 확장

### 1. Native FFmpeg export

가장 중요한 다음 단계다.

품질 원칙:

- 현재 Canvas `MediaRecorder`/WebM export는 미리보기 확인용으로만 유지한다.
- 최종 납품용 export는 Electron main process에서 native FFmpeg를 실행한다.
- 원본 영상/오디오 파일을 기반으로 합성하고, Canvas 1280x720 preview를 그대로 녹화한 파일을 최종본으로 사용하지 않는다.
- 출력 해상도는 원본 해상도 또는 사용자 지정 해상도를 사용한다. 예: 1920x1080 원본은 1080p로 export 가능해야 한다.
- H.264 기준 기본 품질은 CRF 16~20 범위를 사용한다. 품질 우선은 CRF 16~18, 용량 균형은 CRF 20 전후를 기본 후보로 둔다.
- preset은 `medium`을 기본값으로 두고, 고품질/시간 허용 시 `slow`를 선택할 수 있게 한다.
- AAC audio bitrate, video bitrate/CRF, frame rate, pixel format(`yuv420p`)을 명시적으로 제어한다.

- FFmpeg 경로 설정 UI
- export 설정 패널: 해상도, FPS, CRF, bitrate, audio codec
- renderer 또는 headless window에서 frame sequence 생성
- FFmpeg로 frame sequence + audio를 MP4로 인코딩
- progress parsing: `time=HH:MM:SS.xx`
- cancel export
- 임시 frame 파일 정리

초기 구현은 frame sequence 방식이 가장 단순하고 예측 가능하다.

### 2. Electron 파일 import 강화

브라우저 File 객체 기반 import는 빠른 테스트에는 좋지만, 최종 앱은 로컬 path reference가 필요하다.

- `window.pacekeeper.openMediaFile()`
- `window.pacekeeper.openImageFile()`
- 파일 경로와 표시 이름 저장
- 프로젝트 이동 시 missing media relink UX

### 3. 트랙 시스템 고도화

- 오버레이 트랙 reorder
- track hide/solo/lock
- track별 opacity
- visualizer track 다중 추가 여부 결정
- BPM overlay를 여러 섹션으로 나눌지 결정

### 4. 자막/로고 편집 강화

- 자막 block resize handle
- 로고 opacity
- font family/weight/stroke 옵션
- subtitle preset 저장
- safe area guide

### 5. Timeline UX

- item snap
- beat snap
- shift/alt modifier drag
- selected item keyboard 이동
- zoom cursor 고정 개선

### 6. 패키징 품질

- 앱 아이콘
- 버전 정보
- code signing 준비
- FFmpeg binary 포함 시 `extraResources` 설정
- release artifact 이름/채널 정리

---

## 10. 완료된 검증

현재까지 수행한 정적 검증:

```powershell
node --check src/renderer/app.js
node --check src/main/main.js
node --check src/preload/preload.js
```

브라우저 자동화 검증은 샌드박스 런타임 문제로 수행하지 못했다. 수동 실행 검증은 다음 명령 또는 `index.html` 직접 열기로 진행한다.

```powershell
cd D:\roseWorks\programming\PaceKeeperMovMaker
npm.cmd install
npm.cmd start
```

---

## 11. 현재 한계

- 최종 MP4 export는 아직 native FFmpeg가 아니다.
- Electron 파일 dialog import는 아직 프로젝트 저장/열기 중심이며, media import는 renderer file input 중심이다.
- React/TypeScript 모듈 구조는 아직 적용되지 않았다.
- 프로젝트 JSON만 이동하면 media Blob은 함께 가지 않는다. assets 폴더 정책이 필요하다.
- 기존 legacy prototype 파일은 아직 정리되지 않았다.

---

## 12. 설계 원칙

- 미리보기와 export는 같은 렌더링 모델을 공유한다.
- UI는 전문 NLE처럼 어둡고 밀도 있게 유지한다.
- 트랙은 고정 개수로 제한하지 않는다. 단, video/audio/bpm 같은 시스템 트랙은 기본 제공하고, overlay track은 사용자가 추가한다.
- 최종 export는 브라우저 녹화 API가 아니라 native FFmpeg를 사용한다.
- 로컬 프로젝트는 `.pkmm.json`과 assets 폴더 구조로 발전시킨다.
