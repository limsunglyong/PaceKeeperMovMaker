# PaceKeeper MovMaker 개발 계획

## 변경 기록

### 2026-05-29

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
- 비디오 cover-fit 배경 렌더링
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

### 1. Native FFmpeg export

가장 중요한 다음 단계다.

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
