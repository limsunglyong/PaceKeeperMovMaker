# PaceKeeper MovMaker 개발 계획

## 변경 기록

### 2026-06-04

- Overlay 이미지 Background layer 추가 및 버전 증가: Overlay track에 로드한 이미지(`logo` item)를 Inspector의 `Layer`에서 `Overlay` 또는 `Background`로 선택할 수 있게 했다. `Background`로 선택한 이미지는 video clip보다 먼저 Canvas에 그려지며, `cover` 방식으로 1280x720 화면을 100% 채운다. Background 이미지는 위치 이동과 크기 조절을 할 수 없도록 Inspector의 X/Y/Logo size 조절을 숨기고, Canvas 직접 드래그 hit-test에서도 제외했다. 기존 이미지 overlay는 기본값 `Overlay`로 유지된다. 앱 버전은 `0.4.1`로 올리고 CSS/JS cache query를 `20260604-bg-layer-047`로 갱신했다.
- Native export 다중 clip 연동 1차 및 버전 증가: 1순위 작업으로 preview/export frame render에서 같은 시간에 활성화된 여러 video clip을 track 순서대로 합성하도록 변경했다. renderer는 clip별 hidden video element cache를 사용해 각 video clip을 해당 프로젝트 시간의 source time으로 sync/seek하고, 하위 track부터 상위 track 순서로 Canvas에 그린다. Native FFmpeg export는 여러 audio clip을 전달받아 main process에서 `atrim`, `asetpts`, `volume`, `adelay`, `amix` 기반 `filter_complex`로 합성한다. clip별 `start`, `trimStart`, `trimEnd`, `volume`, `muted`를 반영하며, preview audio는 안정성을 위해 기존 대표 audio clip 재생 방식을 유지한다. 앱 버전은 `0.4.0`으로 올리고 CSS/JS cache query를 `20260604-multiclip-export-046`으로 갱신했다.
- 후속과제 정리: 다음 고도화 작업은 `Native export + 다중 clip 연동`을 1순위로 둔다. 1차 범위는 preview/export frame render에서 같은 시간에 활성화된 여러 video clip을 track 순서대로 합성하고, native FFmpeg export에서 여러 audio clip을 `atrim`/`adelay`/`volume`/`amix` filter graph로 섞는 것이다. Preview audio는 안정성을 위해 당분간 기존 대표 audio clip 재생을 유지하고, 이후 Web Audio 기반 다중 audio preview mixer를 별도 과제로 진행한다. 후속 과제는 다중 video clip의 opacity/transform/PIP 옵션, track별 mute/volume, missing media relink UX, assets 폴더 복사 정책, export 해상도/원본 해상도 선택, BPM 구간 감지 confidence/onset 경계 개선, overlay track reorder로 정리한다.
- Subtitle font 변경 후 redraw 보강 및 버전 증가: Font 드롭다운 변경 직후 값은 바뀌었지만 Canvas preview가 즉시 새 폰트로 다시 그려지지 않고, 자막을 다시 클릭해야 정상 표시되는 간헐 문제를 수정했다. `drawTextSubtitle()`에서 `ctx.font`를 먼저 적용한 뒤 줄바꿈/텍스트 폭을 측정하도록 순서를 바로잡고, `sub.fontFamily` 변경 시 현재 프레임을 즉시 redraw한 뒤 `requestAnimationFrame`, `document.fonts.load()`, `document.fonts.ready` 완료 시점에도 다시 redraw하도록 보강했다. 앱 버전은 `0.3.15`로 올리고 CSS/JS cache query를 `20260604-font-redraw-045`로 갱신했다.
- Subtitle font 변경 반영 버그 수정 및 버전 증가: 기존 자막을 선택한 뒤 Font 드롭다운에서 폰트를 변경하면 일부 환경에서 `input` 이벤트가 발생하지 않아 Canvas preview에 새 폰트가 즉시 반영되지 않던 문제를 수정했다. Inspector의 `data-bind`/`data-color-input` 처리 경로를 공통 함수로 통합하고, `change` 이벤트에서도 일반 Inspector binding을 처리하도록 보강해 select 기반 font 변경이 `sub.fontFamily`와 preview refresh에 확실히 반영되게 했다. 앱 버전은 `0.3.14`로 올리고 CSS/JS cache query를 `20260604-font-change-refresh-044`로 갱신했다.
- Subtitle color Inspector 순서 조정 및 버전 증가: 자막 개별 Inspector에서 font 색상 설정을 배경 관련 설정 위로 올리고, 라벨을 `Color`에서 `Font color`로 변경했다. `Background`, `Background color`, `Background opacity`는 font color 아래쪽 하단 그룹으로 배치해 자막 글자 색상과 배경 설정의 구분을 더 명확히 했다. 앱 버전은 `0.3.13`으로 올리고 CSS/JS cache query를 `20260604-subtitle-color-order-043`으로 갱신했다.
- Export Settings 버튼 추가 및 버전 증가: `Export` 버튼을 두 번 눌러야 설정 화면 진입과 실제 export가 분리되는 UX가 어색해, topbar의 `Export` 왼쪽에 `Export Settings` 버튼을 추가했다. `Export Settings`는 선택 상태를 해제하고 오른쪽 Inspector에 `Native Export` 설정을 표시하며, `Export` 버튼은 다시 즉시 export 실행 역할만 담당한다. 앱 버전은 `0.3.12`로 올리고 CSS/JS cache query를 `20260604-export-settings-button-042`로 갱신했다.
- Export 설정 Inspector 진입 UX 및 버전 증가: 편집 후 subtitle/clip/track 선택 상태가 남아 있으면 오른쪽 Inspector의 `Native Export` 설정 화면으로 돌아가기 어려웠던 문제를 정리했다. 1차로 `Export` 버튼이 먼저 설정 화면을 표시하고 두 번째 클릭에서 export를 시작하도록 변경했으나, 이 UX는 `0.3.12`의 별도 `Export Settings` 버튼으로 대체되었다. 앱 버전은 `0.3.11`로 올리고 CSS/JS cache query를 `20260604-export-inspector-041`로 갱신했다.
- Color modal 드래그/자막 배경 색상 설정 및 버전 증가: 앱 내부 `Select Color` 모달을 화면 위에 떠 있는 이동 가능한 창으로 바꾸고, color picker 안쪽 안내 문구로 `Click to change color`를 표시했다. Subtitle overlay에는 `backgroundColor`와 `backgroundOpacity`를 추가해 자막별 배경 색상과 투명도를 Inspector에서 조정할 수 있게 했으며, 기존 검정 배경은 기본값 `#000000`/`0.72` opacity로 migration된다. 자막 저장/불러오기와 debug snapshot에도 새 배경 속성을 포함한다. 앱 버전은 `0.3.10`으로 올리고 CSS/JS cache query를 `20260604-subtitle-bg-color-040`으로 갱신했다.
- BPM Logo overlay 복구/Tap BPM 동작 분리 및 버전 증가: `BPM Logo` overlay track과 `source.kind = "bpm-logo"` 항목이 normalize, 저장, undo snapshot, 프로젝트 불러오기 경로에서 필터링되어 사라지던 문제를 수정했다. Audio import 후 BPM 분석이 끝나면 해당 audio clip 기준으로 BPM Logo overlay를 자동 생성하고, 이전 버전에서 저장되어 overlay 항목이 빠진 프로젝트도 불러올 때 audio clip의 BPM 분석값으로 누락된 BPM Logo overlay를 재생성한다. `Tap` 버튼은 수동 BPM 측정기로만 동작하도록 바꿔 history/state/timeline을 갱신하지 않고 BPM input 표시와 status만 갱신한다. BPM lane은 audio clip의 BPM 분석값만 표시하며, 빈 track에서 Tap 또는 전역 수동 BPM 값만으로 section/beat line을 쓰지 않는다. 앱 버전은 `0.3.9`로 올리고 CSS/JS cache query를 `20260604-bpm-overlay-tap-039`로 갱신했다.
- BPM track 복구 및 버전 증가: Project/Track/Color/BPM UI 정리 과정에서 화면 중앙의 수동 BPM 메뉴/Canvas BPM overlay 노출을 제거하려던 의도와 달리 하단 timeline의 BPM track까지 사라진 문제를 수정했다. 기본 track 목록과 저장/불러오기 normalize 경로에 `BPM` system track을 복구하고, `renderTimeline()`의 BPM lane 렌더링 분기와 section/beat line 표시를 되살렸다. Canvas BPM overlay 비노출 정책은 유지한다. 앱 버전은 `0.3.8`로 올리고 CSS/JS cache query를 `20260604-bpm-track-restore-038`로 갱신했다.
- Projects 썸네일 스크롤바 제거 및 버전 증가: Projects 썸네일 목록 오른쪽에 표시되던 custom navigator thumb를 제거했다. 목록은 native scrollbar를 숨긴 상태로 유지하고, 위/아래 chevron hint와 mouse wheel scroll만 남겨 시각적으로 스크롤바가 보이지 않도록 정리했다. 앱 버전은 `0.3.7`로 올리고 CSS/JS cache query를 `20260604-project-scrollbar-remove-037`로 갱신했다.
- Project save 확인/Export progress modal 구현 및 버전 증가: 좌측 Projects 썸네일로 연 프로젝트를 같은 이름으로 저장하려는 경우 즉시 새 항목을 만들지 않고 `Save Project` 확인 모달을 띄우도록 변경했다. `YES`는 현재 프로젝트 ID로 overwrite 저장하고, `NO`/닫기는 저장을 취소한다. 프로젝트 이름을 변경한 상태에서 Save하면 기존 정책대로 새 프로젝트 항목으로 저장된다. Export는 native FFmpeg/브라우저 WebM 공통 진행 모달을 추가해 진행률과 남은 시간을 표시하고, 진행 중에는 `CANCEL`, 완료 또는 취소 후에는 `CLOSE` 버튼을 표시한다. 브라우저 WebM export는 cancel 시 다운로드를 생성하지 않으며, native export는 frame rendering loop에서 cancel 요청을 감지하고 FFmpeg 인코딩 중에는 main process의 active FFmpeg child process를 종료해 중단한다. 앱 버전은 `0.3.6`으로 올리고 CSS/JS cache query를 `20260604-save-export-modal-036`으로 갱신했다.
- Undo/Redo 10단계 구현 및 버전 증가: renderer에 최대 10단계 `historyPast`/`historyFuture` stack을 추가하고, `projectRecord(true)` 기반 상태 스냅샷으로 편집 상태를 복원하도록 했다. topbar에 `Undo`/`Redo` 버튼을 추가하고, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z` 단축키를 연결했다. history 대상은 import, subtitle/logo/track 추가, clip/track/subtitle 삭제, clip trim/move, subtitle/overlay drag, Inspector 입력/색상/스타일 변경, BPM input/Tap 변경이다. slider/drag는 조작 시작 시 한 번만 기록해 history가 과도하게 쌓이지 않도록 했다. 프로젝트 open/load/new는 프로젝트 경계가 바뀌므로 history를 초기화한다. 앱 버전은 `0.3.5`로 올리고 CSS/JS cache query를 `20260604-undo-redo-035`로 갱신했다.
- Project/Track/Color/BPM UI 정리 및 버전 증가: 프로젝트 썸네일 카드가 목록 높이에 맞춰 압축되어 이름이 사라지지 않도록 카드 최소 높이와 flex shrink 방지를 추가했다. Projects 목록은 기존 Track Label 방식처럼 목록 영역 안에서만 스크롤된다. 하단 Track label 영역에도 wheel 이벤트를 연결해 label 위에서 위/아래 스크롤해도 timeline track viewport가 같이 이동하도록 했다. RGB 색상 선택은 앱 내부 `Select Color` 모달로 열고, 색상 변경 후 `OK`로 닫을 수 있게 했으며 `CANCEL`/닫기는 기존 색상으로 되돌린다. 상단 `BPM` toggle, Canvas BPM overlay, BPM Inspector/BPM Logo 생성 노출은 제거하고, BPM 수동 입력과 `Tap` tempo 기능은 유지했다. 앱 버전은 `0.3.4`로 올리고 CSS/JS cache query를 `20260604-project-scroll-color-bpm-034`로 갱신했다.
- Project switch/save UX/버전 증가: 좌측 Projects 썸네일을 눌러 다른 프로젝트를 열 때 현재 작업이 저장 이후 변경된 상태라면 `Save Project?` 확인 모달을 표시하도록 변경했다. `YES`는 현재 작업을 새 프로젝트 ID로 저장한 뒤 선택한 프로젝트를 열고, `NO`는 저장하지 않고 전환하며, `CANCEL`은 전환을 취소한다. `Save` 버튼도 기존 썸네일 프로젝트를 덮어쓰지 않고 항상 새 저장본을 만들도록 바꿔, 이전 프로젝트를 남긴 상태로 새 버전을 저장할 수 있게 했다. 앱 버전은 `0.3.3`으로 올리고 CSS/JS cache query를 `20260604-project-switch-save-033`으로 갱신했다.
- Projects 스크롤 UX/버전 증가: 좌측 Projects 패널에서 `Projects` 타이틀, 프로젝트명 입력, Save/Open 버튼은 고정하고, 아래 프로젝트 썸네일 목록만 별도 스크롤되도록 구조를 변경했다. 썸네일 목록은 Track Label 스크롤 방식과 맞춰 native scrollbar를 숨기고, 위/아래 chevron hint와 오른쪽 navigator thumb를 표시한다. mouse wheel은 썸네일 목록 영역 안에서 세로 이동만 처리하며, navigator drag로 빠르게 이동할 수 있다. 앱 버전은 `0.3.2`로 올리고 CSS/JS cache query를 `20260604-project-list-scroll-032`로 갱신했다.
- 프로젝트 삭제/자막 폰트/버전 증가: 좌측 Projects 썸네일 카드 오른쪽 상단에 `x` 삭제 버튼을 추가했다. 삭제 버튼을 누르면 YES/NO 확인 모달이 열리고, YES 선택 시 IndexedDB `projects` store에서 해당 프로젝트를 삭제한 뒤 목록을 갱신한다. 자막 Font 드롭다운에는 Imperial Script, Google Sans, Raleway, Kings, Snowburst One, Bitcount Grid Single, Story Script, Uncial Antiqua, Tapestry, Audiowide, Tektur, Dongle, Orbit, Asta Sans, Gowun Batang을 추가했다. Google Fonts stylesheet를 `index.html`에 연결했으며, Google Sans는 Google Fonts CSS API에 없는 경우를 고려해 `Google Sans, Product Sans, Arial, sans-serif` fallback으로 등록한다. 새 자막의 font style 기본값은 Normal(`fontWeight: 400`, `fontStyle: normal`)로 변경했다. 앱 버전은 `0.3.1`로 올리고 CSS/JS cache query를 `20260604-project-delete-fonts-031`로 갱신했다.
- Native FFmpeg export 1차/버전 증가: Electron main/preload/renderer에 native FFmpeg export 골격을 추가했다. renderer는 Canvas preview를 FPS 기준 PNG frame sequence로 임시 폴더에 저장하고, main process가 FFmpeg를 실행해 MP4/H.264(`libx264`, `yuv420p`, CRF, preset)로 인코딩한다. Electron Inspector 기본 화면에는 FPS, CRF, preset, audio bitrate, FFmpeg 선택 버튼을 추가했다. FFmpeg 경로는 `Select FFmpeg`로 선택하거나 `FFMPEG_PATH`/PATH `ffmpeg`를 사용할 수 있고, userData settings에 저장된다. 첫 번째 `sourcePath` audio clip은 AAC audio input으로 연결하며, audio clip start가 0보다 크면 `adelay`를 적용한다. 아직 다중 audio mix, audio trim, export cancel, 원본 해상도 선택, headless renderer 분리는 후속 작업으로 남긴다. 앱 버전은 `0.3.0`으로 올리고 CSS/JS cache query를 `20260604-native-export-030`으로 갱신했다.
- Electron 빌드 설정 정리: `package.json`의 기본 Windows artifactName이 nsis/portable에서 같은 이름을 사용할 수 있던 문제를 정리했다. `nsis.artifactName`은 `${productName}-${version}-${arch}-Setup.${ext}`, `portable.artifactName`은 `${productName}-${version}-${arch}-Portable.${ext}`로 분리했다.
- Electron v0.3.0 빌드 검증: 별도 `release-0.3.0` 출력 폴더로 electron-builder 빌드를 실행해 artifactName 분리 설정과 native export 변경이 포함된 패키징을 확인했다. 산출물은 `PaceKeeper Movie Maker-0.3.0-x64-Setup.exe`, `PaceKeeper Movie Maker-0.3.0-x64-Portable.exe`, `win-unpacked`이다. 앱 icon은 아직 설정되지 않아 기본 Electron icon이 사용된다.
- 진행 계획: Native FFmpeg export로 넘어가기 전에 하단 Track 창 스크롤 UX를 먼저 정리한다. 사용자가 제안한 A+C 조합을 적용해 기본 수평/수직 스크롤바는 숨기되 실제 scroll state는 유지하고, 오른쪽에 얇은 Track Navigator를 추가해 현재 보이는 track 범위와 전체 track 위치를 표시한다. 마우스 wheel은 일반 wheel=세로 track 이동, `Shift + wheel`=timeline 좌우 이동, `Ctrl/Alt/Meta + wheel`=zoom으로 분리해 수평/수직이 동시에 움직이는 느낌을 줄인다.
- UI 스크롤 UX/버전 증가: Track 창 A+C 조합을 1차 반영했다. native 수평/수직 스크롤바는 숨기고 내부 scroll state는 유지하며, 오른쪽 `Track Navigator` thumb로 현재 보이는 track 범위를 표시하고 drag로 세로 이동할 수 있게 했다. wheel 동작은 일반 wheel=세로 track 이동, `Shift + wheel`=timeline 좌우 이동, `Ctrl/Alt/Meta + wheel`=zoom으로 분리했다. 앱 버전은 `0.2.7`로 올리고 CSS/JS cache query를 `20260603-track-navigator-027`로 갱신했다. 남은 수동 확인은 최초 로딩 시 scrollbar 비노출, video/audio import 후 Fit/zoom in/out 시 navigator 표시 안정성, wheel modifier 동작이다.
- UI 스크롤 힌트 보강: 좌측 Track label 영역에 위/아래에 더 볼 track이 있을 때만 표시되는 화살표 오버레이를 추가했다. 처음에는 pseudo-element 방식으로 추가했지만 시인성을 높이기 위해 `trackHintTop`/`trackHintBottom` DOM 요소로 분리했다. 각 hint는 gradient band와 원형 chevron pill을 함께 표시하고, timeline scrollTop 기준으로 `hidden` 상태가 자동 토글된다. 기본 track 높이는 유지하며 CSS/JS cache query는 `20260603-track-hint-dom-027`로 갱신했다.
- UI 스크롤 힌트 버그 수정: `renderTimeline()`이 좌측 `laneLabels.innerHTML`을 통째로 갱신하면서 `trackHintTop`/`trackHintBottom` DOM이 삭제되어 화살표가 보이지 않던 문제를 수정했다. 이제 `ruler-gap`과 `lane-labels-content`만 교체하고 hint DOM은 보존한다. CSS/JS cache query는 `20260603-track-hint-dom-fix-027`로 갱신했다.
- UI 스크롤 힌트 경계 보정: Track label 화살표는 최상단에서는 위쪽 hint를 숨기고, 최하단에서는 아래쪽 hint를 숨기도록 경계 판정을 명확히 했다. `maxScroll`이 없으면 양쪽 hint가 모두 숨겨지며, 브라우저 소수점 scroll 오차를 고려해 1px tolerance를 둔다. CSS/JS cache query는 `20260603-track-hint-edge-027`로 갱신했다.
- UI 스크롤 힌트 판정 재보정: 전체 `timelineScroll.scrollHeight - clientHeight` 기준은 sticky ruler 높이와 내부 여백 때문에 실제 Track row가 모두 보이는 상태에서도 overflow가 있는 것으로 오판했다. hint 표시 기준을 `state.tracks.length * --lane-h`와 `timelineScroll.clientHeight - --ruler-h`로 계산하는 Track row 전용 overflow 판정으로 변경했다. CSS/JS cache query는 `20260603-track-hint-row-027`로 갱신했다.
- UI 스크롤 힌트 hidden 표시 수정: JS에서 `trackHintTop`/`trackHintBottom`의 `hidden` 속성은 토글되고 있었지만, `.track-scroll-hint { display: grid; }` CSS가 브라우저 기본 `[hidden] { display: none; }`보다 우선되어 숨김 상태에서도 화살표가 계속 보였다. `.track-scroll-hint[hidden] { display: none; }`을 명시해 최상단/최하단 숨김 동작이 실제 표시에도 반영되도록 했다. CSS/JS cache query는 `20260603-track-hint-hidden-027`로 갱신했다.
- Electron 빌드 기록: 기본 `npm.cmd run dist`는 기존 `release\win-unpacked\resources\app.asar` 파일 잠금 때문에 실패했다. 기존 release 폴더를 삭제하지 않고 `release-0.2.7` 별도 출력 폴더로 빌드해 `PaceKeeper Movie Maker-0.2.7-x64-Setup.exe`와 `PaceKeeper Movie Maker-0.2.7-x64-Portable.exe` 산출물을 생성했다. 현재 package 설정의 기본 artifactName은 nsis/portable이 같은 이름을 사용할 수 있으므로, 이번 빌드는 target별 artifactName override로 구분했다.

### 2026-06-03

- UI 후속 개선/버전 증가: 남은 수동 확인 3개(`.pkmm.json` 저장/불러오기, 밝은 회색 ruler, 선택 강조 일관성)가 확인 완료되었다. Timeline 선택 상태를 clip 단위까지 명확히 하기 위해 `selectedClipId`를 추가하고, video/audio clip 클릭/드래그 시 Inspector가 해당 clip을 대상으로 보도록 정리했다. import/delete/drag/track 추가 후에는 짧은 flash highlight를 표시해 방금 바뀐 block 또는 lane을 쉽게 확인할 수 있게 했다. 앱 버전은 `0.2.6`으로 올리고 CSS/JS cache query를 `20260603-selection-flash-026`으로 갱신했다.
- UI 조정/버전 증가: timeline ruler의 cyan glow가 화면 톤에서 과하게 보인다는 수동 확인 결과를 반영해, ruler 시간 표시와 BPM tag/section 텍스트의 glow를 제거하고 밝은 회색 계열로 낮췄다. 좌측 Projects/track label 폭 정렬과 ruler sticky 동작은 확인 완료로 기록한다. 앱 버전은 `0.2.5`로 올리고 CSS/JS cache query를 `20260603-ruler-gray-025`로 갱신했다.
- UI 개선/버전 증가: Projects sidebar와 하단 track label 영역의 폭을 같은 CSS 변수로 맞추고, timeline ruler를 세로 스크롤 중에도 상단에 고정되도록 개선했다. ruler 시간 표시에는 cyan 계열 색상과 약한 glow를 적용하고, selected lane/block 강조, audio/BPM label 가독성, toolbar overflow 처리, timeline 높이를 함께 조정했다. 앱 버전은 `0.2.4`로 올리고 CSS/JS cache query를 `20260603-timeline-ui-024`로 갱신했다.
- UI 개선 검토 기록: Native FFmpeg export로 넘어가기 전에 Timeline 가독성과 선택 상태를 먼저 정리하기로 했다. 현재 기능이 늘면서 하단 track/timeline 영역의 밀도와 스크롤 동작이 사용성을 크게 좌우하므로, project sidebar와 track label width 정렬, timeline header/ruler 고정, 하단 track viewport 개선, timeline 시간 표시 cyan glow 적용, BPM Logo/Visualizer/Audio block 가독성 개선을 UI 개선 항목으로 우선 검토한다.
- 버그 수정/버전 증가: Audio clip을 timeline에서 드래그하거나 import 배치 규칙 때문에 기존 audio clip이 뒤로 밀릴 때, 해당 clip에 귀속된 BPM Logo overlay item들의 `start/end`가 함께 이동하지 않던 문제를 수정했다. `setMediaClipStart()`/`shiftBpmLogoItemsForAudioClip()` 경로를 추가해 audio clip start 변경이 BPM Logo item 시간에도 같은 delta로 반영되도록 했다. 또한 BPM Logo는 preview 표시를 위해 같은 시간대에 여러 logo/text item을 생성하므로 timeline lane에서 겹쳐 보이던 문제를 줄이기 위해, BPM Logo 생성 item은 section 단위 대표 block 하나로 그룹 렌더링한다. 앱 버전은 `0.2.3`으로 올렸다.
- 버그 수정/버전 증가: Audio clip 삭제 후 마지막 audio가 사라졌는데도 전역 `state.bpm`/`state.bpmSections`가 남아 BPM lane에 `139 BPM` 같은 잔여 section/tag가 표시되던 문제를 수정했다. Audio clip/track 삭제 후 남은 audio clip 기준으로 BPM 전역 포인터를 재동기화하고, audio clip이 하나도 없으면 BPM 값, BPM sections, BPM input, Canvas BPM toggle, audio element src를 초기화한다. 연결된 BPM Logo 생성 item이 모두 삭제된 빈 `BPM Logo` overlay track도 정리한다. 같은 파일을 다시 선택해도 import가 되도록 file input change 처리 후 input value를 비운다. 앱 버전은 `0.2.2`로 올렸다.
- 버그 수정/버전 증가: Electron native file dialog import에서 renderer가 `file://` URL을 `fetch()`해 `File`로 변환하던 흐름을 보강했다. main process가 선택 파일의 bytes와 MIME type을 함께 넘기고 renderer가 이를 우선 사용하도록 변경해, `file://` fetch 실패 시 native dialog import가 조용히 file input fallback으로 떨어질 가능성을 줄였다. 이 버그 수정에 맞춰 앱 버전을 `0.2.1`로 올리고 화면 표시 버전과 `package.json` 버전을 함께 갱신했다.
- 캐시 회피 수정: `index.html`의 `app.js` query version이 예전 `20260602-fit-track-import`에 머물러 있어 최신 renderer 변경이 브라우저 캐시에 가려질 수 있던 문제를 수정했다. 새 query version은 `20260603-dialog-import-021`이다.
- 작업 방향 기록: 긴급 구조 개선 항목 중 `Track별 media clip 구조화`를 우선 진행했다. 기존 단일 `state.video`/`state.audio`를 즉시 완전히 제거하기보다, 새 `state.videoClips[]`/`state.audioClips[]`를 주 데이터 구조로 추가하고 기존 필드는 현재 선택/대표 clip을 가리키는 호환 포인터로 유지했다. 이렇게 해서 기존 렌더링/export/BPM 코드의 대규모 파손을 줄이면서 track별 clip 저장과 표시를 먼저 안정화했다.
- 버그 수정: `Video Track 1`에 영상을 넣은 뒤 `Video Track 2`에 다른 영상을 import하면 첫 번째 영상이 사라지던 문제를 수정했다. 영상 import는 이제 선택된 video track에 새 clip을 추가하며 기존 track의 clip을 덮어쓰지 않는다. Audio import도 동일하게 `state.audioClips[]`에 누적되도록 변경했다.
- 개선 반영: 영상/음악 import 시 clip 시작 위치를 항상 0초로 두지 않고 현재 playhead 위치(`state.time`)를 기본 `start`로 사용하도록 변경했다. import 상태 메시지에도 배치된 timeline 시작 시간이 표시된다.
- 기능/구조 반영: Video/Audio timeline 렌더링은 track별 clip 배열을 필터링해 표시한다. 각 clip은 `id`, `trackId`, `name`, `url`, `duration`, `start`, `trimStart`, `trimEnd`, `volume`, `muted`를 기본으로 가지며, video clip은 `thumbs`, audio clip은 `peaks`를 함께 가진다.
- 기능/UX 반영: Video/Audio track 삭제 시 기본 locked system track은 유지하고, 사용자가 추가한 video/audio track만 삭제 가능하다. 삭제되는 추가 track에 연결된 media clip은 함께 삭제하는 초기 정책을 적용했다.
- 기능/UX 반영: Video trim handle과 Video/Audio block drag를 단일 `videoOffset`/`audioOffset`이 아니라 clip `id` 기준으로 동작하도록 변경했다. Inspector의 `Timeline start`도 선택된 track의 현재/첫 media clip `start`를 수정한다.
- 저장/불러오기 반영: IndexedDB 프로젝트 저장 레코드에 `videoClips`/`audioClips` 배열을 포함했다. Blob 포함 저장에서는 clip별 Blob을 함께 저장하고, Electron `.pkmm.json` 저장에서는 clip 이름, track, start, trim 같은 설정 중심 정보를 저장한다. 기존 `videoBlob`/`audioBlob`, `videoOffset`/`audioOffset`, `videoTrackId`/`audioTrackId` 기반 프로젝트는 단일 clip으로 migration되도록 호환 처리를 남겼다.
- 현재 한계 기록: 미리보기 media element는 여전히 video/audio 각각 1개라 같은 시간에 여러 video clip 또는 audio clip을 완전 합성/믹싱하지는 않는다. 현재 시간에 활성인 clip 중 track order 기준 대표 clip을 media element에 붙여 preview한다. 다중 동시 합성/믹싱은 native FFmpeg export와 media engine 고도화 단계에서 별도 구현이 필요하다.
- 검증 기록: `node --check src/renderer/app.js`, `node --check src/main/main.js`, `node --check src/preload/preload.js` 정적 검사를 통과했다. in-app Browser smoke test는 Windows sandbox `spawn setup refresh` 오류로 실행하지 못했다.
- BPM 알고리즘 개선 작업 방향 기록: 짧은 초반 BPM 구간 누락 문제를 줄이기 위해 구간 분석 창을 기존 16초 window / 8초 hop 중심에서 더 촘촘한 최대 8초 window / window 1/4 hop 구조로 변경했다. 60초 테스트 기준으로 약 8초 window / 2초 hop이 사용되어 `0~10초` 같은 짧은 앞구간을 더 자주 독립 평가한다.
- BPM 알고리즘 개선 내용: section merge 시 BPM 값이 매우 가깝거나 같은 BPM level일 때만 병합하고, `Slow`와 `Normal`처럼 level이 달라지는 짧은 구간은 기본적으로 보존하도록 변경했다. 너무 짧은 잡음 구간만 인접 section과 재병합하는 `mergeShortBpmSections()` 후처리를 추가했다.
- BPM 진단 추가: `window.pacekeeperDebug()` 결과에 `bpmSections` 목록과 각 section의 BPM level을 포함하도록 했다. BPM 감지 결과가 이상할 때 console에서 실제 구간 경계와 level 판정을 바로 확인할 수 있다.
- BPM 현재 한계 기록: 실제 `0~10초 90 BPM`, `10~40초 120 BPM`, `40~60초 160 BPM` 테스트 MP3로 브라우저 실행 검증은 아직 수행하지 못했다. Windows sandbox 문제로 in-app Browser 자동 smoke test가 실패했으므로, 해당 샘플을 직접 import해 구간 경계가 보존되는지 수동 확인이 필요하다.
- Electron 파일 import 강화 작업 방향 기록: 브라우저 직접 실행의 `<input type=file>` 흐름은 유지하고, Electron 환경에서는 native file dialog를 먼저 사용하도록 변경했다. dialog 실패 또는 브라우저 실행 환경에서는 기존 input fallback으로 돌아간다.
- Electron 파일 import 구현 내용: main process에 `media:open` IPC를 추가하고 video/audio/image 확장자별 open dialog를 제공한다. preload에는 `openMediaFile(kind)`, `openImageFile()` API를 노출했다. renderer의 Video/Audio/Logo import 버튼은 Electron API를 우선 호출하고, 선택된 로컬 파일의 `file://` URL을 읽어 기존 import 함수로 전달한다.
- 로컬 media reference 저장 반영: Electron dialog로 import한 video/audio/logo에는 `sourcePath`를 저장한다. `.pkmm.json` 저장 시 clip 이름, path, track, start, trim 같은 설정 중심 정보를 남기고, IndexedDB Blob 저장에서는 기존처럼 Blob 기반 복구를 유지한다. `.pkmm.json` 불러오기 시 main process가 `sourcePath`를 `file://` URL로 복구해 가능한 media reference를 다시 연결한다.
- Electron 파일 import 현재 한계 기록: missing media relink UX는 아직 구현되지 않았다. `.pkmm.json`을 다른 컴퓨터/폴더로 옮겨 `sourcePath`가 깨지는 경우 사용자가 새 위치를 선택해 재연결하는 UI가 다음 단계로 필요하다. JSON 저장은 파일 경로 참조 중심이라 waveform peaks/thumbnail 같은 캐시성 데이터는 저장하지 않는다.
- UI 폰트 톤 조정: 화면 전반의 버튼, 패널 제목, 라벨, 타임라인 블록, BPM section, 통계 값에 적용되어 있던 700~900대 bold weight를 대부분 400으로 낮췄다. 브랜드명/프로젝트명/주요 실행 버튼처럼 최소한의 강조가 필요한 요소만 500 수준으로 유지해 UI가 덜 무겁게 보이도록 조정했다.
- UI 폰트 추가 조정: 상단 transport 시계 표시(`#timecode`)가 굵게 보이지 않도록 `font-weight: 400`을 명시했다.
- UI 확인용 색상 변경: 상단 transport 시계 표시(`#timecode`)의 글자색, 배경, 테두리, glow를 오렌지 계열로 변경했다. 사용자가 실제로 보고 있는 시간 표시 요소가 맞는지 확인하기 위한 임시/진단 성격의 변경이다.
- Import 배치 규칙 개선: Video/Audio import 시 같은 track 안에서 playhead가 기존 clip 내부에 있으면 새 clip을 해당 clip 끝에 이어 붙인다. playhead가 기존 clip 앞에 있고 새 clip이 기존 clip과 겹치면 기존 clip을 새 clip 뒤로 이동시키며, 뒤쪽 clip도 겹치면 순서대로 밀어낸다. playhead가 기존 clip 뒤에 있어 겹치지 않으면 기존처럼 playhead 위치에 배치한다.
- Video/Audio track 삭제 UX 보강: 추가된 video/audio track 삭제 시 해당 track의 media clip을 함께 삭제하는 정책을 유지하고, 삭제 상태 메시지에 삭제된 clip 개수를 표시하도록 변경했다. 기본 locked system Video/Audio track은 계속 유지한다.
- UI 폰트 변경: 상단 transport 시계 표시(`#timecode`)의 font family를 `Cascadia Mono, Consolas, monospace`로 직접 지정했다.
- Clip 삭제 기능 추가: Video/Audio timeline clip 오른쪽 상단에 `x` 삭제 버튼을 표시하고, 클릭 시 track은 유지한 채 해당 media clip만 삭제되도록 했다. 삭제 시 활성 media element가 해당 clip을 보고 있으면 src를 비우고 대표 clip 포인터를 다시 동기화한다.
- UI 폰트 재수정: 상단 시계 표시가 여전히 굵게 보이는 문제를 확인하기 위해 `#timecode` 태그를 `<b>`에서 `<span>`으로 바꾸고, CSS 캐시 버전을 `v=20260603-timecode-font`로 갱신했다. `Cascadia Code`, `Cascadia Mono`를 우선 지정하고 `font-synthesis: none`, `font-weight: normal !important`, `letter-spacing: 0`, `text-shadow: none`을 적용해 브라우저 bold 합성과 glow로 인한 굵어 보임을 줄였다.
- UI 폰트 재수정 2: Cascadia 계열 숫자가 기존 mono 숫자와 시각적으로 크게 다르지 않아 확인이 어렵다는 피드백을 반영했다. `#timecode`를 `Segoe UI, Inter, Arial, sans-serif`, `font-weight: 300`, `proportional-nums`로 변경하고 CSS 캐시 버전을 `v=20260603-timecode-segoe`로 갱신했다.
- UI 시간창 흔들림 수정: `Segoe UI` 숫자의 proportional width 때문에 시간이 바뀔 때 시간 표시 박스가 흔들리는 문제가 있어, 폰트는 유지하되 `font-variant-numeric: tabular-nums`로 변경하고 CSS 캐시 버전을 `v=20260603-timecode-tabular`로 갱신했다.
- BPM Logo Overlay 생성 기능 추가: BPM Inspector에 `Create BPM Logo Track` 버튼을 추가했다. 버튼을 누르면 `BPM Logo` Overlay track을 만들거나 기존 track을 재사용하고, 현재 `bpmSections` 또는 단일 BPM 값을 기준으로 각 구간마다 PNG logo item과 text item을 생성한다. 생성된 항목은 `source.kind = "bpm-logo"` metadata를 가지며, 재생성 시 기존 BPM Logo 생성 항목만 삭제 후 다시 만든다. 생성 후 중복 표시를 피하기 위해 기존 Canvas BPM overlay는 꺼진다.
- BPM Logo Overlay 현재 한계: 현재 생성 방식은 구간별 대표 icon + label을 정적으로 배치한다. 기존 Canvas BPM overlay처럼 4개 단계 아이콘을 모두 동시에 보여주거나 pulse animation을 적용하지 않는다. 생성된 logo/text는 일반 Overlay item처럼 위치, 크기, 색상, in/out을 수동 조정할 수 있다.
- BPM Canvas overlay 자동 표시 수정: Audio/MP3 import 후 BPM이 감지되면 우측 상단 Canvas BPM animation이 자동으로 나타나던 문제를 수정했다. `bpmOv.enabled` 기본값을 `false`로 변경하고, audio import 감지 완료 후에도 자동으로 꺼진 상태를 유지한다. 사용자가 상단 `BPM` toggle을 직접 켤 때만 Canvas BPM overlay가 표시된다.
- BPM Logo Overlay 자동 생성: Audio/MP3 import 후 BPM 분석이 끝나면 `BPM Logo` Overlay track을 자동 생성/갱신하도록 변경했다. 자동 생성은 기존 `source.kind = "bpm-logo"` 항목만 교체하며, import 직후 선택 상태는 Audio track에 남도록 유지한다. Canvas BPM overlay는 계속 꺼진 상태로 유지된다.
- BPM Logo Overlay 표시 방식 변경: 각 BPM section마다 해당 BPM level 하나만 생성하던 방식을 변경했다. 이제 section마다 `Slow`, `Normal`, `Fast`, `Sprint` 4개 logo/text item을 모두 생성하고, 현재 section의 active level만 color PNG와 강조 글자색을 사용한다. inactive level은 gray PNG와 회색 글자색을 사용하므로, Fast section에서는 Fast만 color, Sprint section으로 넘어가면 Fast는 gray로 돌아가고 Sprint가 color로 바뀐다.
- Overlay preview drag 기능 추가: Preview Canvas 위에서 현재 보이는 Overlay item(자막, 로고, BPM Logo 생성 item)을 직접 드래그해 `x/y` 위치를 변경할 수 있도록 했다. Video/Audio/BPM system track은 대상이 아니며, `state.subs`에 포함된 overlay item만 hit-test한다. 드래그 중에는 Inspector 재렌더를 줄이고, 드래그 종료 시 전체 UI를 갱신한다.
- BPM Logo 그룹 이동 개선: Preview Canvas에서 BPM Logo 생성 item 중 하나를 드래그하면 `source.kind = "bpm-logo"`인 전체 logo/text item이 같은 delta로 함께 이동하도록 변경했다. 일반 자막/로고 overlay item은 기존처럼 개별 이동한다.
- BPM Logo Overlay 구간 수 기준 생성으로 변경: 이전 구현은 section마다 `Slow`, `Normal`, `Fast`, `Sprint` 4개 고정 상태판을 만들었지만, 요구사항에 맞게 BPM 분석 section 개수만큼 logo/text를 표시하도록 변경했다. 예를 들어 분석 결과가 3개 section이면 3개, `slow-normal-fast-sprint-fast`면 5개, `normal-fast-sprint-fast-sprint-fast`면 6개가 순서대로 표시된다. 각 시간 section에서는 해당 section index만 color PNG/강조 글자색을 사용하고 나머지 section logo/text는 gray 상태로 표시된다.
- Audio clip별 BPM/Visualizer/BPM Logo 귀속 수정: 두 번째 audio import 시 기존 audio clip의 Visualizer/BPM lane/BPM Logo overlay가 사라지는 문제를 수정했다. BPM 분석 결과를 전역 `state.bpmSections`에만 두지 않고 각 `audioClip.bpm`/`audioClip.bpmSections`에 저장하며, BPM Logo 생성 item에는 `source.audioClipId`를 기록한다. 추가 audio import 시 기존 clip의 BPM Logo는 유지하고 새 clip의 BPM Logo만 생성/갱신한다.
- Audio clip 삭제 연동: 특정 audio clip을 삭제하면 해당 clip의 `source.audioClipId`로 생성된 BPM Logo overlay item도 함께 삭제된다. BPM lane과 Visualizer lane은 audio clip 배열을 기준으로 렌더링하므로, clip 삭제 후 해당 clip의 BPM 구간 표시와 visualizer block도 함께 사라진다. BPM Logo preview drag도 이제 같은 audio clip에서 생성된 BPM Logo item끼리만 그룹 이동한다.
- 버전 표기 시작: 앱 버전을 `0.2.0`으로 올리고, 상단 브랜드 영역의 `PaceKeeper` 오른쪽에 작은 non-bold `v0.2.0` 표시를 추가했다. `package.json`의 `version`도 같은 값으로 맞췄다. 이후 기능 추가/버그 수정 작업마다 버전 숫자를 올리는 방식으로 관리한다.

### 2026-06-02

- 버그 수정/패키징: 브라우저에서는 정상 동작하지만 Electron 빌드 결과에서 일부 기능이 깨질 수 있는 원인으로 `package.json`의 build files 목록에 `assets/**/*`가 빠져 있던 문제를 수정했다. BPM PNG 아이콘 등 renderer가 상대 경로로 참조하는 asset이 빌드 산출물에 포함되도록 했다.
- 진단 기능 추가: Electron 앱에서만 문제가 발생할 때 콘솔 에러를 확인할 수 있도록 `PACEKEEPER_DEVTOOLS=1` 환경변수로 실행하면 DevTools가 열리도록 main process에 옵션을 추가했다.
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
- 구현 메모: BPM 수동 입력은 전역 BPM 값만 갱신하고, Tap BPM은 측정값을 BPM input/status에 표시하는 수동 측정기로만 동작한다. BPM track의 section/beat line과 BPM Logo overlay는 audio clip에 저장된 BPM 분석값을 기준으로 표시한다.
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

2026-06-03 1차 구현 완료: `state.videoClips[]`/`state.audioClips[]`를 추가하고 import, timeline 렌더링, drag/trim, 저장/불러오기 migration을 clip 배열 중심으로 변경했다. 기존 `state.video`/`state.audio`는 대표 clip 호환 포인터로만 유지한다. 남은 작업은 같은 시간대의 여러 video/audio clip 동시 합성/믹싱 규칙과 native export 연동이다.

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

2026-06-03 1차 구현 완료: 분석 창을 최대 8초, hop을 window 1/4 수준으로 줄이고, BPM level이 달라지는 section은 짧아도 병합하지 않는 규칙을 추가했다. 너무 짧은 잡음 section만 후처리로 인접 section에 병합한다. 남은 작업은 실제 테스트 MP3 import 검증, onset novelty curve 기반 경계 후보 탐색, confidence score 저장이다.

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

2026-06-03 1차 구현 완료: Electron main/preload에 media open dialog IPC를 추가하고, renderer import 버튼에서 Electron dialog를 우선 사용하도록 변경했다. 선택한 파일은 `sourcePath`로 저장되며 `.pkmm.json` 불러오기 시 가능한 경우 `file://` URL로 복구한다. 남은 작업은 missing media relink UX와 assets 폴더 복사 정책이다.

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

- 프로젝트 sidebar 가로 폭과 하단 track label 영역의 가로 폭을 일치시켜 좌측 UI가 한 덩어리로 정렬되어 보이게 한다. 현재는 Projects 패널 폭과 lane label 폭이 달라 timeline 진입부가 어긋나 보인다.
- 하단 track/timeline 영역의 viewport를 개선한다. 사용자가 세로 스크롤하거나 드래그할 때 ruler/header가 위로 밀려 사라지면 현재 시간과 위치를 잃기 쉬우므로, timeline ruler와 toolbar 또는 최소한 ruler를 sticky로 유지하는 방안을 우선 검토한다.
- timeline ruler 시간 표시 색상은 cyan glow보다 밝은 회색 계열이 더 적합한 것으로 확인되었다. 시간 표시는 밝은 회색 계열로 유지하고 glow는 제거한다.
- track lane 높이와 block label 밀도를 재정리한다. Audio/Visualizer/BPM Logo가 3개 이상 있을 때 각 block이 서로 과하게 붙거나 겹쳐 보이지 않도록 label overflow, block padding, 대표 block 표시 방식을 다듬는다.
- 선택 상태를 더 명확히 한다. 현재 선택된 clip/track/subtitle이 Inspector와 timeline에서 같은 대상으로 보이도록 selected outline, lane highlight, Inspector 제목을 맞춘다.
- import/delete/drag 후 짧은 highlight 상태를 추가하는 방안을 검토한다. statusbar 메시지와 함께 방금 바뀐 clip이나 track이 시각적으로 확인되면 수동 검증과 실제 편집이 쉬워진다.
- 하단 track을 보는 방식 개선 아이디어:
  - Timeline ruler/header sticky 처리.
  - Timeline 영역 높이 조절 splitter 추가.
  - track lane label 고정 + timeline content만 가로/세로 스크롤.
  - track type별 접기/collapse와 compact mode 추가.
  - playhead 중심 자동 스크롤 toggle 추가.
  - zoom preset과 Fit 버튼의 동작을 더 명확히 분리.
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

---

## 13. 확인해야할 사항

남은 수동 확인 항목:

- 현재 없음.

현재 자동 검증으로 확인한 항목:

```powershell
node --check src/renderer/app.js
node --check src/main/main.js
node --check src/preload/preload.js
```

자동 브라우저 smoke test는 Windows sandbox `spawn setup refresh` 문제로 수행하지 못했다.

---

## 14. 버전 표기

현재 앱 버전: `0.4.1`

버전 표시 위치:

- `package.json`의 `version`
- `index.html` 상단 브랜드 영역의 `.app-version`
- 배포 artifact 이름은 `electron-builder` 설정상 `${productName}-${version}-${arch}.${ext}` 형식을 사용한다.

버전 증가 규칙:

- 버그 수정, UI 조정, 작은 UX 개선: patch 증가. 예: `0.2.0` -> `0.2.1`
- 기능 추가, 저장 데이터 구조 확장, 사용자 workflow 변경: minor 증가. 예: `0.2.x` -> `0.3.0`
- 호환성이 크게 깨지는 구조 변경 또는 export 방식 대전환: major 증가. 예: `0.x.x` -> `1.0.0` 또는 이후 major 증가

작업 규칙:

- 기능 추가나 버그 수정이 완료되면 `package.json`과 화면 표시 버전을 함께 갱신한다.
- CSS/JS 캐시 회피가 필요하면 `index.html`의 query version도 함께 갱신한다.
- `dev_plan.md` 변경 기록에 버전 증가 이유를 함께 남긴다.
