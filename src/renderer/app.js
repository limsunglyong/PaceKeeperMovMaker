(function () {
  "use strict";

  const CW = 1280;
  const CH = 720;
  const FFT = 512;
  const HISTORY_LIMIT = 10;
  const COLORS = ["#ffffff", "#ff4d5e", "#2dd4bf", "#ffb020", "#a78bfa", "#5b8cff"];
  const SUBTITLE_FONTS = [
    { label: "Inter", value: "Inter, Segoe UI, Arial, sans-serif" },
    { label: "Imperial Script", value: "Imperial Script, cursive" },
    { label: "Google Sans", value: "Google Sans, Product Sans, Arial, sans-serif" },
    { label: "Raleway", value: "Raleway, Inter, Segoe UI, sans-serif" },
    { label: "Kings", value: "Kings, cursive" },
    { label: "Snowburst One", value: "Snowburst One, cursive" },
    { label: "Bitcount Grid Single", value: "Bitcount Grid Single, monospace" },
    { label: "Story Script", value: "Story Script, cursive" },
    { label: "Uncial Antiqua", value: "Uncial Antiqua, serif" },
    { label: "Tapestry", value: "Tapestry, serif" },
    { label: "Audiowide", value: "Audiowide, sans-serif" },
    { label: "Tektur", value: "Tektur, sans-serif" },
    { label: "Dongle", value: "Dongle, sans-serif" },
    { label: "Orbit", value: "Orbit, sans-serif" },
    { label: "Asta Sans", value: "Asta Sans, sans-serif" },
    { label: "Gowun Batang", value: "Gowun Batang, serif" },
    { label: "Arial", value: "Arial, Helvetica, sans-serif" },
    { label: "Segoe UI", value: "Segoe UI, Arial, sans-serif" },
    { label: "Georgia", value: "Georgia, Times New Roman, serif" },
    { label: "Consolas", value: "Consolas, Courier New, monospace" }
  ];
  const BPM_IMAGE_PRESETS = {
    gray: {
      slow: "assets/bpm/gray-slow.png",
      normal: "assets/bpm/gray-normal.png",
      fast: "assets/bpm/gray-fast.png",
      sprint: "assets/bpm/gray-sprint.png"
    },
    color: {
      slow: "assets/bpm/color-slow.png",
      normal: "assets/bpm/color-normal.png",
      fast: "assets/bpm/color-fast.png",
      sprint: "assets/bpm/color-sprint.png"
    }
  };
  const BPM_LEVELS = [
    { id: "slow", label: "Slow", min: 0, max: 109 },
    { id: "normal", label: "Normal", min: 110, max: 139 },
    { id: "fast", label: "Fast", min: 140, max: 169 },
    { id: "sprint", label: "Sprint", min: 170, max: 999 }
  ];
  const $ = (id) => document.getElementById(id);

  const el = {
    stage: $("stage"),
    video: $("videoEl"),
    audio: $("audioEl"),
    status: $("status"),
    timecode: $("timecode"),
    duration: $("duration"),
    lamp: $("liveLamp"),
    play: $("playBtn"),
    export: $("exportBtn"),
    undo: $("undoBtn"),
    redo: $("redoBtn"),
    projectName: $("projectName"),
    projectListWrap: $("projectListWrap"),
    projectList: $("projectList"),
    projectHintTop: $("projectHintTop"),
    projectHintBottom: $("projectHintBottom"),
    inspector: $("inspectorBody"),
    timelineScroll: $("timelineScroll"),
    timelineInner: $("timelineInner"),
    laneLabels: $("laneLabels"),
    trackHintTop: $("trackHintTop"),
    trackHintBottom: $("trackHintBottom"),
    trackNavigator: $("trackNavigator"),
    trackNavigatorThumb: $("trackNavigatorThumb"),
    ruler: $("ruler"),
    playhead: $("playhead"),
    videoInput: $("videoInput"),
    audioInput: $("audioInput"),
    logoInput: $("logoInput"),
    projectInput: $("projectInput"),
    bpmInput: $("bpmInput"),
    vizBtn: $("vizBtn"),
    trackModal: $("trackModal"),
    trackModalClose: $("trackModalClose"),
    deleteProjectModal: $("deleteProjectModal"),
    deleteProjectText: $("deleteProjectText"),
    deleteProjectYes: $("deleteProjectYes"),
    deleteProjectNo: $("deleteProjectNo"),
    deleteProjectCancelTop: $("deleteProjectCancelTop"),
    switchProjectModal: $("switchProjectModal"),
    switchProjectText: $("switchProjectText"),
    switchProjectYes: $("switchProjectYes"),
    switchProjectNo: $("switchProjectNo"),
    switchProjectCancel: $("switchProjectCancel"),
    switchProjectCancelTop: $("switchProjectCancelTop"),
    saveProjectModal: $("saveProjectModal"),
    saveProjectText: $("saveProjectText"),
    saveProjectYes: $("saveProjectYes"),
    saveProjectNo: $("saveProjectNo"),
    saveProjectCancelTop: $("saveProjectCancelTop"),
    exportModal: $("exportModal"),
    exportModalTitle: $("exportModalTitle"),
    exportModalText: $("exportModalText"),
    exportRemaining: $("exportRemaining"),
    exportProgressBar: $("exportProgressBar"),
    exportCancel: $("exportCancel"),
    exportClose: $("exportClose"),
    colorModal: $("colorModal"),
    colorModalInput: $("colorModalInput"),
    colorModalOk: $("colorModalOk"),
    colorModalCancel: $("colorModalCancel"),
    colorModalClose: $("colorModalClose")
  };
  const ctx = el.stage.getContext("2d");

  function defaultTracks() {
    return [
      { id: "video", label: "Video", type: "video", color: "#5b8cff", locked: true },
      { id: "audio", label: "Audio", type: "audio", color: "#2dd4bf", locked: true },
      { id: "viz", label: "Visualizer", type: "viz", color: "#a78bfa", locked: true },
      { id: "overlay-1", label: "Overlay 1", type: "overlay", color: "#ffb020" }
    ];
  }
  function normalizeTracks(tracks) {
    const list = (tracks && tracks.length ? tracks : defaultTracks())
      .filter((track) => track.type !== "bpm" && track.id !== "bpm" && track.label !== "BPM Logo");
    if (!list.some((track) => track.type === "overlay")) list.push({ id: "overlay-1", label: "Overlay 1", type: "overlay", color: "#ffb020" });
    return list;
  }

  const state = {
    id: null,
    name: "Untitled",
    video: null,
    audio: null,
    videoClips: [],
    audioClips: [],
    videoTrackId: "video",
    audioTrackId: "audio",
    trim: { start: 0, end: 0 },
    videoOffset: 0,
    audioOffset: 0,
    videoAudio: { muted: true, volume: 0.8 },
    musicAudio: { muted: false, volume: 1 },
    viz: { enabled: true, style: "bars", x: 0.5, y: 0.78, scale: 0.85, opacity: 0.92, color: "#2dd4bf" },
    bpm: 0,
    bpmSections: [],
    bpmOv: { enabled: false, x: 0.88, y: 0.13, color: "#ff4d5e", offset: 0, imageSet: "color", showIcon: true, showLabel: true, showNumber: false },
    nativeExport: { fps: 30, crf: 18, preset: "medium", audioBitrate: "192k", ffmpegPath: "", ffmpegVersion: "" },
    subtitleFx: { effect: "none", shadow: true, background: false, align: "center" },
    tracks: defaultTracks(),
    subs: [],
    selected: null,
    selectedClipId: null,
    flash: null,
    time: 0,
    playing: false,
    exporting: false,
    pxPerSec: 48,
    projects: [],
    pendingDeleteProjectId: null,
    pendingSwitchProjectId: null,
    cleanProjectSnapshot: "",
    pendingColorPath: "",
    pendingColorOriginal: ""
  };

  const refs = {
    audioCtx: null,
    source: null,
    musicGain: null,
    analyser: null,
    freq: new Uint8Array(FFT / 2),
    dest: null,
    raf: 0,
    viewportRefresh: 0,
    stageResizeObserver: null,
    clock: { t0: 0, perf0: 0 },
    videoBlob: null,
    audioBlob: null,
    videoBlobs: {},
    audioBlobs: {},
    activeVideoClipId: null,
    activeAudioClipId: null,
    flashTimer: 0,
    trackNavigatorDrag: null,
    historyPast: [],
    historyFuture: [],
    historyRestoring: false,
    exportCancelRequested: false,
    exportCompleted: false,
    exportStartedAt: 0,
    tap: [],
    waveCanvas: null,
    bpmImages: {}
  };

  function setStatus(text) { el.status.textContent = text; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function mediaClips(type) { return type === "video" ? state.videoClips : state.audioClips; }
  function findMediaClip(id) {
    return state.videoClips.find((clip) => clip.id === id) || state.audioClips.find((clip) => clip.id === id) || null;
  }
  function selectedMediaClip() {
    return findMediaClip(state.selectedClipId);
  }
  function selectMediaClip(clip) {
    if (!clip) return;
    state.selected = clip.trackId;
    state.selectedClipId = clip.id;
    if (clip.type === "video") state.videoTrackId = clip.trackId;
    if (clip.type === "audio") state.audioTrackId = clip.trackId;
  }
  function clearSelectedMediaClip() {
    state.selectedClipId = null;
  }
  function trackIsSelected(track) {
    const selectedSub = state.subs.find((sub) => sub.id === state.selected);
    const clip = selectedMediaClip();
    return state.selected === track.id
      || (selectedSub && selectedSub.trackId === track.id)
      || (clip && clip.trackId === track.id);
  }
  function isFreshFlash(kind, id) {
    if (!state.flash || state.flash.kind !== kind || state.flash.id !== id) return false;
    if (performance.now() > state.flash.until) {
      state.flash = null;
      return false;
    }
    return true;
  }
  function flashClass(kind, id) {
    return isFreshFlash(kind, id) ? " flash" : "";
  }
  function markFlash(kind, id) {
    if (!kind || !id) return;
    state.flash = { kind, id, until: performance.now() + 950 };
    if (refs.flashTimer) clearTimeout(refs.flashTimer);
    refs.flashTimer = setTimeout(() => {
      refs.flashTimer = 0;
      if (state.flash && state.flash.kind === kind && state.flash.id === id) {
        state.flash = null;
        refresh({ inspector: false, projects: false });
      }
    }, 1000);
  }
  function primaryClip(type) {
    const clips = mediaClips(type);
    const trackId = type === "video" ? state.videoTrackId : state.audioTrackId;
    return clips.find((clip) => clip.trackId === trackId) || clips[0] || null;
  }
  function syncLegacyMediaState() {
    const video = primaryClip("video");
    const audio = primaryClip("audio");
    state.video = video;
    state.audio = audio;
    state.videoOffset = video ? video.start : 0;
    state.audioOffset = audio ? audio.start : 0;
    state.trim = video ? { start: video.trimStart || 0, end: video.trimEnd ?? video.duration ?? 0 } : { start: 0, end: 0 };
  }
  function clipDuration(clip) {
    if (!clip) return 0;
    if (clip.type === "video") return Math.max(0, (clip.trimEnd ?? clip.duration ?? 0) - (clip.trimStart || 0));
    return Math.max(0, clip.duration || 0);
  }
  function clipLocalTime(clip, t) { return t - (clip ? clip.start || 0 : 0); }
  function trackOrderIndex(trackId) {
    const index = state.tracks.findIndex((track) => track.id === trackId);
    return index < 0 ? 9999 : index;
  }
  function activeClipAt(type, t) {
    return mediaClips(type)
      .filter((clip) => {
        const local = clipLocalTime(clip, t);
        return local >= 0 && local <= clipDuration(clip);
      })
      .sort((a, b) => trackOrderIndex(a.trackId) - trackOrderIndex(b.trackId))[0] || null;
  }
  function selectedClipForTrack(type, trackId) {
    const selected = selectedMediaClip();
    return selected && selected.type === type && selected.trackId === trackId ? selected
      : mediaClips(type).find((clip) => clip.trackId === trackId && state.time >= clip.start && state.time <= clip.start + clipDuration(clip))
      || mediaClips(type).find((clip) => clip.trackId === trackId)
      || null;
  }
  function shiftBpmLogoItemsForAudioClip(audioClipId, delta) {
    if (!audioClipId || !delta) return;
    state.subs.forEach((sub) => {
      if (!sub.source || sub.source.kind !== "bpm-logo" || sub.source.audioClipId !== audioClipId) return;
      sub.start = Math.max(0, (Number(sub.start) || 0) + delta);
      sub.end = Math.max(sub.start + 0.05, (Number(sub.end) || 0) + delta);
    });
  }
  function setMediaClipStart(clip, nextStart) {
    if (!clip) return;
    const current = Number(clip.start) || 0;
    const next = Math.max(0, Number(nextStart) || 0);
    const delta = next - current;
    if (!delta) return;
    clip.start = next;
    if (clip.type === "audio") shiftBpmLogoItemsForAudioClip(clip.id, delta);
  }
  function resolveImportStart(type, trackId, newDuration) {
    const clips = mediaClips(type)
      .filter((clip) => clip.trackId === trackId)
      .sort((a, b) => (a.start || 0) - (b.start || 0));
    const playhead = state.time;
    const containing = clips.find((clip) => playhead >= (clip.start || 0) && playhead <= (clip.start || 0) + clipDuration(clip));
    let start = containing ? (containing.start || 0) + clipDuration(containing) : playhead;
    let cursorEnd = start + Math.max(0, newDuration || 0);
    clips.forEach((clip) => {
      const clipStart = clip.start || 0;
      const clipEnd = clipStart + clipDuration(clip);
      if (clipEnd <= start || clipStart >= cursorEnd) return;
      setMediaClipStart(clip, cursorEnd);
      cursorEnd = clip.start + clipDuration(clip);
    });
    return start;
  }
  function duration() {
    return Math.max(
      ...state.videoClips.map((clip) => (clip.start || 0) + clipDuration(clip)),
      ...state.audioClips.map((clip) => (clip.start || 0) + clipDuration(clip)),
      ...state.subs.map((sub) => sub.end || 0),
      0
    );
  }
  function trimDuration() { return Math.max(0, state.trim.end - state.trim.start); }
  function firstTrackIdOfType(type) {
    const found = state.tracks.find((track) => track.type === type);
    return found ? found.id : type;
  }
  function activeMediaTrackId(type) {
    const selectedClip = selectedMediaClip();
    if (selectedClip && selectedClip.type === type && state.tracks.some((track) => track.id === selectedClip.trackId)) return selectedClip.trackId;
    const selectedTrack = state.tracks.find((track) => track.id === state.selected && track.type === type);
    if (selectedTrack) return selectedTrack.id;
    const key = type === "video" ? "videoTrackId" : "audioTrackId";
    if (state.tracks.some((track) => track.id === state[key] && track.type === type)) return state[key];
    return firstTrackIdOfType(type);
  }
  function overlayTracks() { return state.tracks.filter((track) => track.type === "overlay"); }
  function activeOverlayTrackId() {
    const selectedTrack = state.tracks.find((track) => track.id === state.selected && track.type === "overlay");
    if (selectedTrack) return selectedTrack.id;
    const selectedSub = state.subs.find((sub) => sub.id === state.selected);
    if (selectedSub && state.tracks.some((track) => track.id === selectedSub.trackId)) return selectedSub.trackId;
    const first = overlayTracks()[0];
    return first ? first.id : addOverlayTrack();
  }
  function addOverlayTrack(label) {
    const count = overlayTracks().length + 1;
    const track = {
      id: `overlay-${Date.now()}-${count}`,
      label: label || `Overlay ${count}`,
      type: "overlay",
      color: count % 2 ? "#ffb020" : "#a78bfa"
    };
    state.tracks.push(track);
    return track.id;
  }
  function addMediaTrack(type) {
    const count = state.tracks.filter((track) => track.type === type).length + 1;
    const track = {
      id: `${type}-${Date.now()}-${count}`,
      label: `${type === "video" ? "Video" : "Audio"} ${count}`,
      type,
      color: type === "video" ? "#5b8cff" : "#2dd4bf"
    };
    const insertBefore = state.tracks.findIndex((item) => item.type === "viz" || item.type === "overlay");
    if (insertBefore >= 0) state.tracks.splice(insertBefore, 0, track);
    else state.tracks.push(track);
    return track.id;
  }
  function addTrack(type) {
    if (type === "overlay") return addOverlayTrack();
    if (type === "video" || type === "audio") return addMediaTrack(type);
    return null;
  }
  function removeTrackById(removeId) {
    const track = state.tracks.find((item) => item.id === removeId);
    if (!track || track.locked) return false;
    let flashTrackId = null;
    if (track.type === "overlay") {
      const fallback = overlayTracks().find((item) => item.id !== removeId);
      if (!fallback) {
        setStatus("Keep at least one overlay track.");
        return false;
      }
      pushHistory("Remove track");
      flashTrackId = fallback.id;
      state.subs.forEach((sub) => { if (sub.trackId === removeId) sub.trackId = fallback.id; });
      setStatus("Removed overlay track. Existing items moved to the next overlay track.");
    } else {
      pushHistory("Remove track");
      const removedClipCount = track.type === "video"
        ? state.videoClips.filter((clip) => clip.trackId === removeId).length
        : state.audioClips.filter((clip) => clip.trackId === removeId).length;
      const removedAudioClipIds = track.type === "audio" ? state.audioClips.filter((clip) => clip.trackId === removeId).map((clip) => clip.id) : [];
      if (track.type === "video") state.videoClips = state.videoClips.filter((clip) => clip.trackId !== removeId);
      if (track.type === "audio") state.audioClips = state.audioClips.filter((clip) => clip.trackId !== removeId);
      if (removedAudioClipIds.length) state.subs = state.subs.filter((sub) => !(sub.source && removedAudioClipIds.includes(sub.source.audioClipId)));
      if (track.type === "video" && state.videoTrackId === removeId) {
        state.videoTrackId = state.tracks.find((item) => item.type === "video" && item.id !== removeId)?.id || "video";
      }
      if (track.type === "audio" && state.audioTrackId === removeId) {
        state.audioTrackId = state.tracks.find((item) => item.type === "audio" && item.id !== removeId)?.id || "audio";
      }
      flashTrackId = track.type === "video" ? state.videoTrackId : state.audioTrackId;
      setStatus(`Removed ${track.type} track with ${removedClipCount} clip(s).`);
    }
    state.tracks = state.tracks.filter((item) => item.id !== removeId);
    if (state.selected === removeId) state.selected = null;
    if (state.selectedClipId && !findMediaClip(state.selectedClipId)) state.selectedClipId = null;
    markFlash("track", flashTrackId);
    if (track.type === "audio") cleanupAudioDerivedState();
    return true;
  }
  function cleanupAudioDerivedState() {
    const audioClipIds = new Set(state.audioClips.map((clip) => clip.id));
    state.subs = state.subs.filter((sub) => !(sub.source && sub.source.kind === "bpm-logo" && sub.source.audioClipId && !audioClipIds.has(sub.source.audioClipId)));
    const bpmLogoTrackIds = new Set(state.subs.filter((sub) => sub.source && sub.source.kind === "bpm-logo").map((sub) => sub.trackId));
    state.tracks = state.tracks.filter((track) => !(track.type === "overlay" && track.label === "BPM Logo" && !bpmLogoTrackIds.has(track.id)));
    if (!state.audioClips.length) {
      state.audio = null;
      state.audioOffset = 0;
      state.bpm = 0;
      state.bpmSections = [];
      state.bpmOv.enabled = false;
      refs.audioBlob = null;
      refs.activeAudioClipId = null;
      el.audio.pause();
      el.audio.removeAttribute("src");
      el.audio.load();
      el.bpmInput.value = "";
    } else {
      const audio = primaryClip("audio");
      state.bpm = audio && audio.bpm ? audio.bpm : 0;
      state.bpmSections = audio && audio.bpmSections ? audio.bpmSections : [];
      el.bpmInput.value = state.bpm ? String(state.bpm) : "";
    }
  }
  function removeMediaClipById(clipId) {
    const videoClip = state.videoClips.find((clip) => clip.id === clipId);
    const audioClip = state.audioClips.find((clip) => clip.id === clipId);
    const clip = videoClip || audioClip;
    if (!clip) return false;
    pushHistory("Remove clip");
    if (videoClip) {
      state.videoClips = state.videoClips.filter((item) => item.id !== clipId);
      delete refs.videoBlobs[clipId];
      if (refs.activeVideoClipId === clipId) {
        refs.activeVideoClipId = null;
        el.video.pause();
        el.video.removeAttribute("src");
      }
    } else {
      state.audioClips = state.audioClips.filter((item) => item.id !== clipId);
      state.subs = state.subs.filter((sub) => !(sub.source && sub.source.audioClipId === clipId));
      delete refs.audioBlobs[clipId];
      if (refs.activeAudioClipId === clipId) {
        refs.activeAudioClipId = null;
        el.audio.pause();
        el.audio.removeAttribute("src");
        el.audio.load();
      }
      cleanupAudioDerivedState();
    }
    if (state.selectedClipId === clipId) state.selectedClipId = null;
    state.selected = clip.trackId;
    markFlash("track", clip.trackId);
    syncLegacyMediaState();
    setStatus(`Removed ${clip.type} clip "${clip.name}".`);
    return true;
  }
  function codeForTrack(index) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (index < alphabet.length) return alphabet[index];
    return `T${index + 1}`;
  }
  function applyAudioSettings() {
    el.video.muted = !!state.videoAudio.muted;
    el.video.volume = clamp(Number(state.videoAudio.volume) || 0, 0, 1);
    el.audio.muted = !!state.musicAudio.muted;
    el.audio.volume = clamp(Number(state.musicAudio.volume) || 0, 0, 1);
    if (refs.musicGain) refs.musicGain.gain.value = state.musicAudio.muted ? 0 : clamp(Number(state.musicAudio.volume) || 0, 0, 1);
  }
  function showTrackModal() {
    el.trackModal.hidden = false;
  }
  function hideTrackModal() {
    el.trackModal.hidden = true;
  }
  function videoLocalTime(t) {
    return t - state.videoOffset;
  }
  function audioLocalTime(t) {
    return t - state.audioOffset;
  }
  function loadBpmImages() {
    Object.entries(BPM_IMAGE_PRESETS).forEach(([setName, levels]) => {
      refs.bpmImages[setName] = refs.bpmImages[setName] || {};
      Object.entries(levels).forEach(([level, src]) => {
        if (refs.bpmImages[setName][level]) return;
        const img = new Image();
        img.onload = () => renderFrame(state.time);
        img.src = src;
        refs.bpmImages[setName][level] = img;
      });
    });
  }
  function bpmLevelFor(value) {
    return BPM_LEVELS.find((level) => value >= level.min && value <= level.max) || BPM_LEVELS[0];
  }
  function bpmSectionAt(time) {
    const audio = activeClipAt("audio", time) || primaryClip("audio");
    const local = audio ? clipLocalTime(audio, time) : time;
    const sections = audio && audio.bpmSections && audio.bpmSections.length ? audio.bpmSections : (state.bpmSections || []);
    const bpm = audio && audio.bpm ? audio.bpm : state.bpm;
    const found = sections.find((section) => local >= section.start && local < section.end);
    if (found) return found;
    if (sections.length && local >= sections[sections.length - 1].end) return sections[sections.length - 1];
    return bpm > 0 ? { start: 0, end: audio ? audio.duration : duration(), bpm } : null;
  }
  function currentBpmAt(time) {
    const section = bpmSectionAt(time);
    const audio = activeClipAt("audio", time) || primaryClip("audio");
    return section && section.bpm > 0 ? section.bpm : audio && audio.bpm ? audio.bpm : state.bpm;
  }
  function fmtTC(t, frames) {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    if (frames) {
      const f = Math.floor((t - Math.floor(t)) * 30);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(Math.floor((t % 1) * 1000)).padStart(3, "0")}`;
  }
  function drawContain(media) {
    const mw = media.videoWidth || media.width || CW;
    const mh = media.videoHeight || media.height || CH;
    const scale = Math.min(CW / mw, CH / mh);
    const w = mw * scale;
    const h = mh * scale;
    ctx.drawImage(media, (CW - w) / 2, (CH - h) / 2, w, h);
  }
  function fitStageToPreview() {
    const preview = el.stage.closest(".preview");
    if (!preview) return;
    const style = getComputedStyle(preview);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availableW = Math.max(160, preview.clientWidth - padX);
    const availableH = Math.max(90, preview.clientHeight - padY);
    const aspect = CW / CH;
    let w = availableW;
    let h = w / aspect;
    if (h > availableH) {
      h = availableH;
      w = h * aspect;
    }
    const nextW = `${Math.floor(w)}px`;
    const nextH = `${Math.floor(h)}px`;
    if (el.stage.style.width !== nextW) el.stage.style.width = nextW;
    if (el.stage.style.height !== nextH) el.stage.style.height = nextH;
  }
  function wrapText(text, maxWidth) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  function normalizeSubtitle(sub) {
    const out = { ...sub };
    out.type = out.type || "text";
    out.text = out.text || (out.type === "logo" ? "Logo" : "New subtitle");
    out.start = Number.isFinite(parseFloat(out.start)) ? parseFloat(out.start) : state.time;
    out.end = Number.isFinite(parseFloat(out.end)) && parseFloat(out.end) > out.start ? parseFloat(out.end) : out.start + (out.type === "logo" ? 6 : 3);
    out.trackId = out.trackId || (overlayTracks()[0] ? overlayTracks()[0].id : addOverlayTrack());
    out.x = Number.isFinite(parseFloat(out.x)) ? clamp(parseFloat(out.x), 0, 1) : 0.5;
    out.y = Number.isFinite(parseFloat(out.y)) ? clamp(parseFloat(out.y), 0, 1) : (out.type === "logo" ? 0.18 : 0.74);
    out.size = Number.isFinite(parseFloat(out.size)) && parseFloat(out.size) > 0 ? parseFloat(out.size) : (out.type === "logo" ? 0.22 : 56);
    out.color = out.color || "#ffffff";
    out.fontFamily = out.fontFamily || SUBTITLE_FONTS[0].value;
    out.fontWeight = out.fontWeight || "400";
    out.fontStyle = out.fontStyle || "normal";
    if (out.type === "text" && out.background == null) out.background = true;
    return out;
  }
  function thumbnail() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 144;
    c.getContext("2d").drawImage(el.stage, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  }
  async function captureVideoThumbnails(url, durationSeconds) {
    const times = [];
    for (let t = 0; t <= durationSeconds; t += 10) times.push(Math.min(t, Math.max(0, durationSeconds - 0.05)));
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    video.playsInline = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Could not load video for thumbnails."));
    });
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 54;
    const tctx = canvas.getContext("2d");
    const thumbs = [];
    for (const time of times) {
      await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done, { once: true });
        setTimeout(done, 900);
        try { video.currentTime = time; } catch (_) { resolve(); }
      });
      tctx.fillStyle = "#05060a";
      tctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        const vw = video.videoWidth || canvas.width;
        const vh = video.videoHeight || canvas.height;
        const scale = Math.max(canvas.width / vw, canvas.height / vh);
        const w = vw * scale;
        const h = vh * scale;
        tctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        thumbs.push({ time, url: canvas.toDataURL("image/jpeg", 0.68) });
      } catch (_) {}
    }
    video.removeAttribute("src");
    return thumbs;
  }

  function ensureAudioCtx() {
    if (!refs.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      refs.audioCtx = new AC();
    }
    if (refs.audioCtx.state === "suspended") refs.audioCtx.resume();
    return refs.audioCtx;
  }
  async function decodeAudio(file) {
    const ac = ensureAudioCtx();
    const arr = await file.arrayBuffer();
    return ac.decodeAudioData(arr.slice(0));
  }
  function buildPeaks(buffer, buckets) {
    const ch = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / buckets));
    const mins = new Float32Array(buckets);
    const maxs = new Float32Array(buckets);
    for (let b = 0; b < buckets; b++) {
      let mn = 1, mx = -1;
      const start = b * step;
      const end = Math.min(ch.length, start + step);
      for (let i = start; i < end; i++) {
        const v = ch[i];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      mins[b] = start < end ? mn : 0;
      maxs[b] = start < end ? mx : 0;
    }
    return { mins, maxs };
  }
  function correctBpmAlias(bpm, previousBpm) {
    const value = Math.round(bpm);
    if (!value || value >= 90 || !previousBpm) return value;
    const candidates = [value * 3, value * 2].filter((candidate) => candidate >= 90 && candidate <= 220);
    const close = candidates.find((candidate) => Math.abs(candidate - previousBpm) <= 45);
    if (close) return close;
    const fast = candidates.find((candidate) => previousBpm >= 140 && candidate >= 160);
    return fast || value;
  }
  function detectBPMInRange(ch, sr, startSec, endSec) {
    const startSample = Math.max(0, Math.floor(startSec * sr));
    const endSample = Math.min(ch.length, Math.floor(endSec * sr));
    if (endSample - startSample < sr * 4) return 0;
    const envRate = 200;
    const hop = Math.max(1, Math.floor(sr / envRate));
    const env = [];
    for (let i = startSample; i < endSample; i += hop) {
      let sum = 0;
      const end = Math.min(endSample, i + hop);
      for (let j = i; j < end; j++) sum += ch[j] * ch[j];
      env.push(Math.sqrt(sum / Math.max(1, end - i)));
    }
    const onset = new Float32Array(env.length);
    for (let i = 1; i < env.length; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);
    const scores = new Map();
    for (let bpm = 60; bpm <= 200; bpm++) {
      const lag = Math.round((envRate * 60) / bpm);
      let score = 0;
      for (let i = 0; i + lag < onset.length; i++) score += onset[i] * onset[i + lag];
      scores.set(bpm, score);
    }
    let best = 120, bestVal = -1;
    for (let bpm = 60; bpm <= 200; bpm++) {
      let score = scores.get(bpm) || 0;
      score *= bpm < 90 ? 0.72 : 1 - Math.abs(bpm - 140) / 900;
      if (bpm >= 120) score += (scores.get(Math.round(bpm / 2)) || 0) * 0.22;
      if (bpm >= 170) score += (scores.get(Math.round(bpm / 3)) || 0) * 0.38;
      if (score > bestVal) { best = bpm; bestVal = score; }
    }
    return best;
  }
  function detectBPM(buffer) {
    return detectBPMInRange(buffer.getChannelData(0), buffer.sampleRate, 0, buffer.duration);
  }
  function sectionLevel(section) {
    return bpmLevelFor(section.bpm).id;
  }
  function mergeShortBpmSections(sections, minSec) {
    if (sections.length <= 1) return sections;
    const out = sections.map((section) => ({ ...section }));
    let changed = true;
    while (changed && out.length > 1) {
      changed = false;
      for (let i = 0; i < out.length; i++) {
        const current = out[i];
        const len = current.end - current.start;
        if (len >= minSec) continue;
        const prev = out[i - 1];
        const next = out[i + 1];
        const prevSameLevel = prev && sectionLevel(prev) === sectionLevel(current);
        const nextSameLevel = next && sectionLevel(next) === sectionLevel(current);
        if (!prevSameLevel && !nextSameLevel && len >= Math.min(3, minSec)) continue;
        const targetIndex = prev && next
          ? (Math.abs(prev.bpm - current.bpm) <= Math.abs(next.bpm - current.bpm) ? i - 1 : i + 1)
          : (prev ? i - 1 : i + 1);
        const target = out[targetIndex];
        const totalLen = Math.max(0.001, (target.end - target.start) + len);
        target.bpm = Math.round((target.bpm * (target.end - target.start) + current.bpm * len) / totalLen);
        if (targetIndex < i) target.end = current.end;
        else target.start = current.start;
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
    return out;
  }
  function detectBPMSections(buffer) {
    const ch = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const dur = buffer.duration;
    if (!dur || dur < 4) return [];
    const windowSec = dur < 12 ? dur : Math.min(8, Math.max(6, dur / 8));
    const hopSec = dur < 12 ? dur : Math.max(1.5, windowSec / 4);
    const windows = [];
    for (let start = 0; start < dur; start += hopSec) {
      const end = Math.min(dur, start + windowSec);
      const previous = windows.length ? windows[windows.length - 1].bpm : 0;
      const bpm = correctBpmAlias(detectBPMInRange(ch, sr, start, end), previous);
      if (bpm > 0) windows.push({ start, end, bpm });
      if (end >= dur) break;
    }
    if (!windows.length) return [];
    const segments = windows.map((win, index) => {
      const prev = windows[index - 1];
      const next = windows[index + 1];
      const center = (win.start + win.end) / 2;
      const prevCenter = prev ? (prev.start + prev.end) / 2 : 0;
      const nextCenter = next ? (next.start + next.end) / 2 : dur;
      return {
        start: index === 0 ? 0 : (prevCenter + center) / 2,
        end: index === windows.length - 1 ? dur : (center + nextCenter) / 2,
        bpm: win.bpm
      };
    });
    const merged = [];
    segments.forEach((win) => {
      const last = merged[merged.length - 1];
      const level = bpmLevelFor(win.bpm).id;
      const sameLevel = last && bpmLevelFor(last.bpm).id === level;
      const closeTempo = last && Math.abs(last.bpm - win.bpm) <= 3;
      if (last && (closeTempo || sameLevel)) {
        const lastLen = last.end - last.start;
        const winLen = win.end - win.start;
        last.bpm = Math.round((last.bpm * lastLen + win.bpm * winLen) / Math.max(0.001, lastLen + winLen));
        last.end = win.end;
      } else {
        merged.push({ start: win.start, end: win.end, bpm: win.bpm });
      }
    });
    merged[0].start = 0;
    merged[merged.length - 1].end = dur;
    const cleaned = mergeShortBpmSections(merged, Math.min(4, Math.max(2.5, dur / 18)));
    cleaned[0].start = 0;
    cleaned[cleaned.length - 1].end = dur;
    return cleaned.map((section) => ({
      start: Number(section.start.toFixed(2)),
      end: Number(section.end.toFixed(2)),
      bpm: Math.round(section.bpm)
    }));
  }

  function renderFrame(t) {
    const fx = state.subtitleFx;
    const videoClip = activeClipAt("video", t);
    const audioClip = activeClipAt("audio", t) || primaryClip("audio");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, CW, CH);
    if (videoClip) attachVideoClip(videoClip);
    const videoActive = videoClip && el.video.readyState >= 2;
    if (videoActive) {
      drawContain(el.video);
    } else {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.055)";
      for (let x = 0; x < CW; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
      for (let y = 0; y < CH; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }
      ctx.fillStyle = "rgba(255,255,255,.24)";
      ctx.font = "600 24px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TRACK A - BACKGROUND VIDEO", CW / 2, CH / 2);
      ctx.restore();
    }

    const audioLocal = audioClip ? clipLocalTime(audioClip, t) : 0;
    const audioActive = audioClip && audioLocal >= 0 && audioLocal <= audioClip.duration;
    if (state.viz.enabled && audioClip && audioActive) {
      if (state.playing && refs.analyser) refs.analyser.getByteFrequencyData(refs.freq);
      else staticSpectrum(audioLocal, refs.freq);
      drawViz(refs.freq);
    }
    drawActiveSubtitles(t, fx);
  }
  function drawActiveSubtitles(t, fx) {
    const trackOrder = new Map(state.tracks.map((track, index) => [track.id, index]));
    const active = state.subs
      .map(normalizeSubtitle)
      .filter((s) => t >= s.start && t <= s.end)
      .sort((a, b) => (trackOrder.get(a.trackId || "overlay-1") || 0) - (trackOrder.get(b.trackId || "overlay-1") || 0));
    active.forEach((s) => drawSub(s, fx));
    active.filter((s) => s.type !== "logo").forEach((s) => drawTextSubtitle(s, fx));
    if (!state.playing && !state.exporting) {
      const selectedSub = state.subs.find((s) => s.id === state.selected);
      const selectedActive = selectedSub && active.some((s) => s.id === selectedSub.id);
      if (selectedSub && !selectedActive) drawSub(normalizeSubtitle(selectedSub), fx);
    }
  }
  function staticSpectrum(t, out) {
    let amp = 0.25;
    const audio = primaryClip("audio");
    if (audio && audio.peaks) {
      const i = Math.floor((t / audio.duration) * (audio.peaks.maxs.length - 1));
      amp = Math.min(1, Math.abs(audio.peaks.maxs[clamp(i, 0, audio.peaks.maxs.length - 1)]) * 1.4 + 0.12);
    }
    for (let i = 0; i < out.length; i++) {
      const fall = Math.pow(1 - i / out.length, 0.7);
      const wob = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.27 + t * 1.5));
      out[i] = Math.min(255, amp * 255 * fall * wob);
    }
  }
  function drawViz(data) {
    const cfg = state.viz;
    const cx = cfg.x * CW;
    const cy = cfg.y * CH;
    const fieldW = cfg.scale * CW;
    const x0 = cx - fieldW / 2;
    const maxH = 0.3 * CH * (cfg.scale * 0.4 + 0.7);
    ctx.save();
    ctx.globalAlpha = cfg.opacity;
    ctx.fillStyle = cfg.color;
    ctx.strokeStyle = cfg.color;
    if (cfg.style === "bars" || cfg.style === "mirror") {
      const bars = cfg.style === "bars" ? 64 : 56;
      const bw = fieldW / bars;
      for (let i = 0; i < bars; i++) {
        const val = data[Math.floor(i / bars * data.length)] / 255;
        const h = Math.max(2, val * maxH * (cfg.style === "mirror" ? 0.62 : 1));
        const x = x0 + i * bw;
        if (cfg.style === "mirror") ctx.fillRect(x, cy - h, bw * 0.62, h * 2);
        else {
          ctx.fillRect(x, cy - h, bw * 0.66, h);
          ctx.globalAlpha = cfg.opacity * 0.35;
          ctx.fillRect(x, cy + 2, bw * 0.66, h * 0.45);
          ctx.globalAlpha = cfg.opacity;
        }
      }
    } else if (cfg.style === "wave") {
      ctx.lineWidth = Math.max(2, fieldW * 0.005);
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) {
        const val = data[Math.floor(i / 96 * data.length)] / 255;
        const x = x0 + i / 96 * fieldW;
        const y = cy - val * maxH * 0.9 + maxH * 0.1;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = cfg.opacity * 0.18;
      ctx.lineTo(x0 + fieldW, cy + 2);
      ctx.lineTo(x0, cy + 2);
      ctx.closePath();
      ctx.fill();
    } else if (cfg.style === "dots") {
      for (let i = 0; i < 40; i++) {
        const val = data[Math.floor(i / 40 * data.length)] / 255;
        const x = x0 + (i + 0.5) / 40 * fieldW;
        ctx.beginPath();
        ctx.arc(x, cy, 2 + val * 24 * (cfg.scale * 0.6 + 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const r = cfg.scale * 0.17 * Math.min(CW, CH);
      ctx.lineWidth = Math.max(2, r * 0.05);
      for (let i = 0; i < 84; i++) {
        const val = data[Math.floor(i / 84 * data.length)] / 255;
        const a = i / 84 * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + val * r * 1.1 + 3), cy + Math.sin(a) * (r + val * r * 1.1 + 3));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawSub(s, fx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    if (s.type === "logo" && s.img && s.img.complete) {
      const iw = s.size * CW;
      const ih = s.img.height / s.img.width * iw;
      ctx.drawImage(s.img, s.x * CW - iw / 2, s.y * CH - ih / 2, iw, ih);
    } else drawTextSubtitle(s, fx);
    ctx.restore();
  }
  function drawTextSubtitle(s, fx) {
    const size = Number.isFinite(parseFloat(s.size)) && parseFloat(s.size) > 0 ? parseFloat(s.size) : 56;
    const color = s.color || "#ffffff";
    const subX = Number.isFinite(parseFloat(s.x)) ? clamp(parseFloat(s.x), 0, 1) : 0.5;
    const subY = Number.isFinite(parseFloat(s.y)) ? clamp(parseFloat(s.y), 0, 1) : 0.74;
    const align = s.align || fx.align || "center";
    const effect = s.effect || fx.effect || "none";
    const fontFamily = s.fontFamily || SUBTITLE_FONTS[0].value;
    const fontWeight = s.fontWeight || "400";
    const fontStyle = s.fontStyle || "normal";
    const lines = wrapText(s.text || "New subtitle", CW * 0.82);
    const lh = size * 1.18;
    let y = subY * CH - (lines.length - 1) * lh / 2;
    const x = subX * CW;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = `${fontStyle} ${fontWeight} ${size}px ${fontFamily}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    lines.forEach((line) => {
      const metrics = ctx.measureText(line);
      const bgX = align === "center" ? x - metrics.width / 2 : align === "right" ? x - metrics.width : x;
      if (s.background || fx.background) {
        ctx.fillStyle = "rgba(0,0,0,.72)";
        ctx.fillRect(bgX - 18, y - size * 0.68, metrics.width + 36, size * 1.28);
      }
      if (s.shadow !== false && fx.shadow) {
        ctx.shadowColor = "rgba(0,0,0,.9)";
        ctx.shadowBlur = effect === "glow" ? 18 : 7;
        ctx.shadowOffsetY = effect === "drop" ? 5 : 2;
      }
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = effect === "outline" ? size * 0.18 : size * 0.14;
      ctx.strokeStyle = "rgba(0,0,0,.95)";
      ctx.strokeText(line, x, y);
      if (effect === "glow") {
        ctx.shadowColor = color;
        ctx.shadowBlur = 22;
      }
      ctx.fillStyle = color;
      ctx.fillText(line, x, y);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      y += lh;
    });
    ctx.restore();
  }
  function debugSnapshot() {
    const activeSubs = state.subs.map(normalizeSubtitle).filter((s) => state.time >= s.start && state.time <= s.end);
    return {
      time: state.time,
      selected: state.selected,
      subtitleCount: state.subs.length,
      activeSubtitles: activeSubs.map((s) => ({ id: s.id, type: s.type, text: s.text, start: s.start, end: s.end, x: s.x, y: s.y, size: s.size, color: s.color, background: s.background })),
      bpmSections: (state.bpmSections || []).map((section) => ({ start: section.start, end: section.end, bpm: section.bpm, level: bpmLevelFor(section.bpm).id })),
      canvas: { width: el.stage.width, height: el.stage.height }
    };
  }

  function updateClock() {
    el.timecode.textContent = fmtTC(state.time, true);
    el.duration.textContent = `DUR ${fmtTC(duration(), true)}`;
    el.play.textContent = state.playing ? "Pause" : "Play";
    el.lamp.classList.toggle("live", state.playing);
    el.playhead.style.left = `${state.time * state.pxPerSec}px`;
    if (state.exporting) el.export.textContent = `Export ${Math.round((duration() ? state.time / duration() : 0) * 100)}%`;
  }
  function attachVideoClip(clip) {
    if (!clip || refs.activeVideoClipId === clip.id) return;
    refs.activeVideoClipId = clip.id;
    el.video.src = clip.url;
  }
  function attachAudioClip(clip) {
    if (!clip || refs.activeAudioClipId === clip.id) return;
    refs.activeAudioClipId = clip.id;
    el.audio.src = clip.url;
    applyAudioSettings();
  }
  function syncMedia(t) {
    const videoClip = activeClipAt("video", t) || primaryClip("video");
    if (videoClip) {
      attachVideoClip(videoClip);
      const local = clipLocalTime(videoClip, t);
      const active = local >= 0 && local <= clipDuration(videoClip);
      const want = (videoClip.trimStart || 0) + clamp(local, 0, clipDuration(videoClip));
      if (Math.abs(el.video.currentTime - want) > 0.12) {
        try { el.video.currentTime = want; } catch (_) {}
      }
      if (state.playing && active && el.video.paused) el.video.play().catch(() => {});
      if ((!active || !state.playing) && !el.video.paused) el.video.pause();
    }
    const audioClip = activeClipAt("audio", t) || primaryClip("audio");
    if (audioClip) {
      attachAudioClip(audioClip);
      const local = clipLocalTime(audioClip, t);
      const active = local >= 0 && local <= audioClip.duration;
      const want = clamp(local, 0, audioClip.duration);
      if (Math.abs(el.audio.currentTime - want) > 0.12) {
        try { el.audio.currentTime = want; } catch (_) {}
      }
      if (state.playing && active && el.audio.paused) el.audio.play().catch(() => {});
      if ((!active || !state.playing) && !el.audio.paused) el.audio.pause();
    }
  }
  function seek(t) {
    state.time = clamp(t, 0, duration());
    if (state.playing) refs.clock = { t0: state.time, perf0: performance.now() };
    syncMedia(state.time);
    renderFrame(state.time);
    refresh();
  }
  function seekIntoSubtitle(sub) {
    if (!sub) return;
    const start = Number(sub.start) || 0;
    const end = Number(sub.end) || start + 0.1;
    const target = clamp(start + Math.min(0.05, Math.max(0, (end - start) / 2)), 0, duration());
    seek(target);
  }
  function play() {
    if (duration() <= 0) { setStatus("Import media before playback."); return; }
    ensureAudioCtx();
    applyAudioSettings();
    if (state.time >= duration() - 0.02) state.time = 0;
    refs.clock = { t0: state.time, perf0: performance.now() };
    state.playing = true;
    syncMedia(state.time);
    loop();
    refresh();
  }
  function pause() {
    state.playing = false;
    cancelAnimationFrame(refs.raf);
    el.video.pause();
    el.audio.pause();
    refresh();
  }
  function stop() { pause(); seek(0); }
  function loop() {
    const c = refs.clock;
    state.time = c.t0 + (performance.now() - c.perf0) / 1000;
    if (state.exporting && refs.exportCancelRequested) {
      if (refs.recorder && refs.recorder.state !== "inactive") {
        try { refs.recorder.stop(); } catch (_) {}
      }
      pause();
      return;
    }
    if (state.time >= duration()) {
      state.time = duration();
      renderFrame(state.time);
      if (state.exporting && refs.recorder) {
        try { refs.recorder.stop(); } catch (_) {}
      }
      pause();
      return;
    }
    syncMedia(state.time);
    renderFrame(state.time);
    updateClock();
    if (state.exporting) {
      const progress = duration() ? state.time / duration() : 0;
      updateExportModal("Exporting timeline in real time...", progress, Math.max(0, duration() - state.time));
    }
    refs.raf = requestAnimationFrame(loop);
  }

  async function fileFromOpenResult(result) {
    if (result.data) {
      const bytes = result.data instanceof ArrayBuffer
        ? new Uint8Array(result.data)
        : ArrayBuffer.isView(result.data)
          ? new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength)
          : new Uint8Array(result.data);
      return new File([bytes], result.name, { type: result.type || "" });
    }
    const response = await fetch(result.url);
    const blob = await response.blob();
    return new File([blob], result.name, { type: result.type || blob.type || "" });
  }
  async function importVideoFromDialog() {
    if (!window.pacekeeper || !window.pacekeeper.openMediaFile) {
      el.videoInput.click();
      return;
    }
    try {
      const result = await window.pacekeeper.openMediaFile("video");
      if (result.canceled) return;
      await loadVideo(await fileFromOpenResult(result), activeMediaTrackId("video"), result.path);
    } catch (_) {
      el.videoInput.click();
    }
  }
  async function importAudioFromDialog() {
    if (!window.pacekeeper || !window.pacekeeper.openMediaFile) {
      el.audioInput.click();
      return;
    }
    try {
      const result = await window.pacekeeper.openMediaFile("audio");
      if (result.canceled) return;
      await loadAudio(await fileFromOpenResult(result), true, activeMediaTrackId("audio"), result.path);
    } catch (_) {
      el.audioInput.click();
    }
  }
  async function importLogoFromDialog() {
    if (!window.pacekeeper || !window.pacekeeper.openImageFile) {
      el.logoInput.click();
      return;
    }
    try {
      const result = await window.pacekeeper.openImageFile();
      if (result.canceled) return;
      addLogo(await fileFromOpenResult(result), result.path);
    } catch (_) {
      el.logoInput.click();
    }
  }

  async function loadVideo(file, trackId, sourcePath) {
    const url = URL.createObjectURL(file);
    el.video.src = url;
    await new Promise((resolve) => { el.video.onloadedmetadata = resolve; });
    pushHistory("Import video");
    const targetTrackId = trackId || activeMediaTrackId("video");
    const sourceDuration = el.video.duration || 0;
    const start = resolveImportStart("video", targetTrackId, sourceDuration);
    const clip = {
      id: `v${Date.now()}`,
      type: "video",
      trackId: targetTrackId,
      name: file.name,
      url,
      duration: sourceDuration,
      start,
      trimStart: 0,
      trimEnd: sourceDuration,
      volume: state.videoAudio.volume,
      muted: state.videoAudio.muted,
      thumbs: [],
      blob: file,
      sourcePath: sourcePath || ""
    };
    refs.videoBlob = file;
    refs.videoBlobs[clip.id] = file;
    refs.activeVideoClipId = clip.id;
    state.videoTrackId = targetTrackId;
    state.videoClips.push(clip);
    syncLegacyMediaState();
    selectMediaClip(clip);
    markFlash("clip", clip.id);
    setStatus(`Loaded video "${file.name}" on ${state.tracks.find((track) => track.id === state.videoTrackId)?.label || "Video"} at ${fmtTC(clip.start, false)}.`);
    refresh();
    try {
      setStatus(`Generating thumbnails for "${file.name}"...`);
      clip.thumbs = await captureVideoThumbnails(url, clip.duration);
      syncLegacyMediaState();
      setStatus(`Loaded video "${file.name}" with ${clip.thumbs.length} timeline thumbnails.`);
      refresh();
    } catch (_) {
      setStatus(`Loaded video "${file.name}". Thumbnail generation was skipped.`);
    }
  }
  async function loadAudio(file, detect, trackId, sourcePath) {
    setStatus("Decoding audio...");
    const buffer = await decodeAudio(file);
    pushHistory("Import audio");
    refs.audioBlob = file;
    const peaks = buildPeaks(buffer, 2400);
    const url = URL.createObjectURL(file);
    el.audio.src = url;
    if (!refs.source) {
      refs.source = refs.audioCtx.createMediaElementSource(el.audio);
      refs.musicGain = refs.audioCtx.createGain();
      refs.analyser = refs.audioCtx.createAnalyser();
      refs.analyser.fftSize = FFT;
      refs.analyser.smoothingTimeConstant = 0.8;
      refs.source.connect(refs.musicGain);
      refs.musicGain.connect(refs.analyser);
      refs.analyser.connect(refs.audioCtx.destination);
    }
    applyAudioSettings();
    const targetTrackId = trackId || activeMediaTrackId("audio");
    const start = resolveImportStart("audio", targetTrackId, buffer.duration);
    const clip = {
      id: `a${Date.now()}`,
      type: "audio",
      trackId: targetTrackId,
      name: file.name,
      url,
      duration: buffer.duration,
      start,
      trimStart: 0,
      trimEnd: buffer.duration,
      volume: state.musicAudio.volume,
      muted: state.musicAudio.muted,
      peaks,
      blob: file,
      sourcePath: sourcePath || "",
      bpm: 0,
      bpmSections: []
    };
    refs.audioBlobs[clip.id] = file;
    refs.activeAudioClipId = clip.id;
    state.audioTrackId = targetTrackId;
    state.audioClips.push(clip);
    syncLegacyMediaState();
    selectMediaClip(clip);
    markFlash("clip", clip.id);
    if (detect) {
      clip.bpmSections = detectBPMSections(buffer);
      if (clip.bpmSections.length) {
        const total = clip.bpmSections.reduce((sum, section) => sum + section.bpm * Math.max(0.001, section.end - section.start), 0);
        const len = clip.bpmSections.reduce((sum, section) => sum + Math.max(0.001, section.end - section.start), 0);
        clip.bpm = Math.round(total / len);
      } else {
        clip.bpm = detectBPM(buffer);
      }
      state.bpmSections = clip.bpmSections;
      state.bpm = clip.bpm;
      state.bpmOv.enabled = false;
      el.bpmInput.value = String(state.bpm);
      setStatus(`Loaded audio "${file.name}" on ${state.tracks.find((track) => track.id === state.audioTrackId)?.label || "Audio"} at ${fmtTC(clip.start, false)}. Detected about ${clip.bpm} BPM across ${Math.max(1, clip.bpmSections.length)} section(s).`);
    } else {
      setStatus(`Loaded audio "${file.name}" on ${state.tracks.find((track) => track.id === state.audioTrackId)?.label || "Audio"} at ${fmtTC(clip.start, false)}.`);
    }
    refresh();
  }
  function addSubtitle() {
    pushHistory("Add subtitle");
    const id = `s${Date.now()}`;
    const start = state.time;
    const end = start + 3;
    state.subs.push(normalizeSubtitle({ id, type: "text", text: "New subtitle", start, end, trackId: activeOverlayTrackId(), x: 0.5, y: 0.74, size: 56, color: "#ffffff", background: true }));
    state.selected = id;
    clearSelectedMediaClip();
    markFlash("sub", id);
    state.time = start;
    syncMedia(state.time);
    refresh();
  }
  function addLogo(file, sourcePath) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      pushHistory("Add logo");
      const id = `s${Date.now()}`;
      const start = state.time;
      state.subs.push(normalizeSubtitle({ id, type: "logo", text: file.name, start, end: start + 6, trackId: activeOverlayTrackId(), x: 0.5, y: 0.18, size: 0.22, color: "#fff", url, img, blob: file, sourcePath: sourcePath || "" }));
      state.selected = id;
      clearSelectedMediaClip();
      markFlash("sub", id);
      state.time = start;
      syncMedia(state.time);
      refresh();
    };
    img.src = url;
  }
  function bpmLogoSections(audioClip) {
    const audio = audioClip || primaryClip("audio");
    const sections = audio && audio.bpmSections && audio.bpmSections.length ? audio.bpmSections : (state.bpmSections || []);
    const bpm = audio && audio.bpm ? audio.bpm : state.bpm;
    if (sections.length) {
      return sections.map((section) => ({
        start: (audio ? audio.start : 0) + section.start,
        end: (audio ? audio.start : 0) + section.end,
        bpm: section.bpm,
        audioClipId: audio ? audio.id : ""
      }));
    }
    if (bpm > 0) {
      const start = audio ? audio.start : 0;
      const end = audio ? audio.start + audio.duration : duration();
      return [{ start, end, bpm, audioClipId: audio ? audio.id : "" }];
    }
    return [];
  }
  function bpmLogoTrackId() {
    const existing = state.tracks.find((track) => track.type === "overlay" && track.label === "BPM Logo");
    if (existing) return existing.id;
    const id = addOverlayTrack("BPM Logo");
    const track = state.tracks.find((item) => item.id === id);
    if (track) track.color = "#ffb020";
    return id;
  }
  function generateBpmLogoOverlay(options) {
    options = options || {};
    const previousSelected = state.selected;
    const audioClip = options.audioClip || primaryClip("audio");
    const audioClipId = audioClip ? audioClip.id : "";
    const sections = bpmLogoSections(audioClip).filter((section) => section.bpm > 0 && section.end > section.start);
    if (!sections.length) {
      if (!options.silent) setStatus("Import audio or set BPM before creating BPM Logo overlay.");
      return;
    }
    const trackId = bpmLogoTrackId();
    state.subs = state.subs.filter((sub) => !(sub.source && sub.source.kind === "bpm-logo" && (sub.source.audioClipId || "") === audioClipId));
    sections.forEach((section, index) => {
      const baseId = `bpm-logo-${Date.now()}-${index}`;
      const count = sections.length;
      const spacing = count > 1 ? Math.min(0.08, 0.72 / Math.max(1, count - 1)) : 0;
      const totalWidth = spacing * Math.max(0, count - 1);
      const startX = count > 1 ? clamp(state.bpmOv.x - totalWidth / 2, 0.04, 0.96 - totalWidth) : state.bpmOv.x;
      const iconSize = count > 6 ? 0.052 : count > 4 ? 0.058 : 0.065;
      const activeIconSize = iconSize + 0.01;
      const labelSize = count > 6 ? 16 : count > 4 ? 18 : 20;
      const activeLabelSize = labelSize + 3;
      sections.forEach((displaySection, displayIndex) => {
        const item = bpmLevelFor(displaySection.bpm);
        const active = displayIndex === index;
        const iconUrl = BPM_IMAGE_PRESETS[active ? "color" : "gray"][item.id];
        const icon = new Image();
        icon.src = iconUrl;
        const x = clamp(startX + spacing * displayIndex, 0.04, 0.96);
        const label = active && state.bpmOv.showNumber ? `${item.label} ${displaySection.bpm}` : item.label;
        state.subs.push(normalizeSubtitle({
          id: `${baseId}-section-${displayIndex}-icon`,
          type: "logo",
          text: `${item.label} icon`,
          trackId,
          start: section.start,
          end: section.end,
          x,
          y: state.bpmOv.y,
          size: active ? activeIconSize : iconSize,
          color: active ? state.bpmOv.color : "rgba(255,255,255,.45)",
          url: iconUrl,
          img: icon,
          source: { kind: "bpm-logo", role: "icon", audioClipId, bpm: displaySection.bpm, paceLevel: item.id, active, sectionIndex: displayIndex, activeSectionIndex: index }
        }));
        state.subs.push(normalizeSubtitle({
          id: `${baseId}-section-${displayIndex}-label`,
          type: "text",
          text: label,
          trackId,
          start: section.start,
          end: section.end,
          x,
          y: Math.min(0.96, state.bpmOv.y + 0.08),
          size: active ? activeLabelSize : labelSize,
          color: active ? state.bpmOv.color : "rgba(255,255,255,.48)",
          background: false,
          fontWeight: active ? "500" : "400",
          source: { kind: "bpm-logo", role: "label", audioClipId, bpm: displaySection.bpm, paceLevel: item.id, active, sectionIndex: displayIndex, activeSectionIndex: index }
        }));
      });
    });
    state.bpmOv.enabled = false;
    state.selected = options.silent ? previousSelected : trackId;
    if (!options.silent) setStatus(`Created BPM Logo overlay track with ${sections.length} section(s).`);
    if (!options.silent) refresh();
  }
  function updateSub(id, patch) {
    const s = state.subs.find((item) => item.id === id);
    if (s) Object.assign(s, patch);
    refresh();
  }

  function renderInspector() {
    const selected = state.selected;
    const sub = state.subs.find((s) => s.id === selected);
    const selectedTrack = state.tracks.find((track) => track.id === selected);
    if (selectedTrack && selectedTrack.type === "video") {
      const clip = selectedClipForTrack("video", selectedTrack.id);
      el.inspector.innerHTML = `
        <div class="section"><h3>Video Track</h3></div>
        ${selectedTrack.locked ? "" : textRow("Name", "track.label", selectedTrack.label)}
        ${checkboxRow("Mute clip audio", "videoAudio.muted", state.videoAudio.muted)}
        ${slider("Clip audio volume","videoAudio.volume",state.videoAudio.volume,0,1,.01,"%")}
        ${clip ? numberRow("Timeline start","media.start",clip.start,0,999,.1) : ""}
        <div class="stats">
          <div><span>Source</span><b>${clip ? clip.name : "-"}</b></div>
          <div><span>Clip count</span><b>${state.videoClips.filter((item) => item.trackId === selectedTrack.id).length || "-"}</b></div>
          <div><span>Trim</span><b>${clip ? `${fmtTC(clip.trimStart || 0, false)} - ${fmtTC(clip.trimEnd ?? clip.duration, false)}` : "-"}</b></div>
        </div>
        ${selectedTrack.locked ? "" : `<button class="danger" id="deleteTrackBtn">Remove Track</button>`}
      `;
    } else if (selectedTrack && selectedTrack.type === "audio") {
      const clip = selectedClipForTrack("audio", selectedTrack.id);
      el.inspector.innerHTML = `
        <div class="section"><h3>Music Track</h3></div>
        ${selectedTrack.locked ? "" : textRow("Name", "track.label", selectedTrack.label)}
        ${checkboxRow("Mute music", "musicAudio.muted", state.musicAudio.muted)}
        ${slider("Music volume","musicAudio.volume",state.musicAudio.volume,0,1,.01,"%")}
        ${clip ? numberRow("Timeline start","media.start",clip.start,0,999,.1) : ""}
        <div class="stats">
          <div><span>Source</span><b>${clip ? clip.name : "-"}</b></div>
          <div><span>Clip count</span><b>${state.audioClips.filter((item) => item.trackId === selectedTrack.id).length || "-"}</b></div>
          <div><span>Duration</span><b>${clip ? fmtTC(clip.duration, false) : "-"}</b></div>
        </div>
        ${selectedTrack.locked ? "" : `<button class="danger" id="deleteTrackBtn">Remove Track</button>`}
      `;
    } else if (selected === "viz") {
      el.inspector.innerHTML = `
        <div class="section"><h3>Visualizer Track</h3>
          <div class="seg">${["bars","mirror","wave","circle","dots"].map((v) => `<button data-viz-style="${v}" class="${state.viz.style === v ? "is-on" : ""}">${v}</button>`).join("")}</div>
        </div>
        ${slider("Position X","viz.x",state.viz.x,0,1,.01,"%")}
        ${slider("Position Y","viz.y",state.viz.y,0,1,.01,"%")}
        ${slider("Size","viz.scale",state.viz.scale,.3,1.6,.01,"%")}
        ${slider("Opacity","viz.opacity",state.viz.opacity,.1,1,.01,"%")}
        ${swatches("viz.color", state.viz.color)}
      `;
    } else if (state.tracks.some((track) => track.id === selected && track.type === "overlay")) {
      const track = state.tracks.find((item) => item.id === selected);
      el.inspector.innerHTML = `
        <div class="section"><h3>Subtitle Track</h3></div>
        ${textRow("Name", "track.label", track.label)}
        ${swatches("track.color", track.color)}
        <div class="section"><h3>Subtitle Effect</h3>
          <div class="seg">${["none","outline","drop","glow"].map((v) => `<button data-sub-effect="${v}" class="${state.subtitleFx.effect === v ? "is-on" : ""}">${v}</button>`).join("")}</div>
        </div>
        ${checkboxRow("Text shadow", "subtitleFx.shadow", state.subtitleFx.shadow)}
        ${checkboxRow("Text background", "subtitleFx.background", state.subtitleFx.background)}
        <div class="row"><label>Alignment</label><select data-bind="subtitleFx.align">${["left","center","right"].map((v) => `<option value="${v}" ${state.subtitleFx.align === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <button class="danger" id="deleteTrackBtn">Remove Track</button>
      `;
    } else if (sub) {
      el.inspector.innerHTML = `
        <div class="section"><h3>${sub.type === "logo" ? "Logo" : "Subtitle"} Overlay</h3></div>
        <div class="row"><label>Track</label><select data-bind="sub.trackId">${overlayTracks().map((track) => `<option value="${track.id}" ${track.id === (sub.trackId || "overlay-1") ? "selected" : ""}>${escapeHtml(track.label)}</option>`).join("")}</select></div>
        ${sub.type === "text" ? textRow("Text", "sub.text", sub.text) : ""}
        <div class="two">${numberRow("In","sub.start",sub.start,0,999,.1)}${numberRow("Out","sub.end",sub.end,0,999,.1)}</div>
        ${slider("Position X","sub.x",sub.x,0,1,.01,"%")}
        ${slider("Position Y","sub.y",sub.y,0,1,.01,"%")}
        ${sub.type === "logo" ? slider("Logo size","sub.size",sub.size,.05,.6,.01,"%") : `
          <div class="row"><label>Font</label><select data-bind="sub.fontFamily">${SUBTITLE_FONTS.map((font) => `<option value="${escapeHtml(font.value)}" ${sub.fontFamily === font.value ? "selected" : ""}>${escapeHtml(font.label)}</option>`).join("")}</select></div>
          <div class="section compact"><h3>Style</h3>
            <div class="seg text-style">
              <button data-sub-style="fontWeight:400" class="${sub.fontWeight === "400" ? "is-on" : ""}">Normal</button>
              <button data-sub-style="fontWeight:800" class="${sub.fontWeight !== "400" ? "is-on" : ""}">Bold</button>
              <button data-sub-style="fontStyle:italic" class="${sub.fontStyle === "italic" ? "is-on" : ""}"><i>Italic</i></button>
            </div>
          </div>
          ${slider("Font size","sub.size",sub.size,20,160,1,"px")}
        `}
        ${sub.type === "text" ? `<div class="row"><label>Effect</label><select data-bind="sub.effect"><option value="">Track default</option>${["none","outline","drop","glow"].map((v) => `<option value="${v}" ${sub.effect === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>` : ""}
        ${sub.type === "text" ? `<div class="row"><label>Alignment</label><select data-bind="sub.align"><option value="">Track default</option>${["left","center","right"].map((v) => `<option value="${v}" ${sub.align === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>` : ""}
        ${sub.type === "text" ? checkboxRow("Background", "sub.background", !!sub.background) : ""}
        ${sub.type === "text" ? swatches("sub.color", sub.color) : ""}
        <button class="danger" id="deleteSubBtn">Delete</button>
      `;
    } else {
      el.inspector.innerHTML = `
        <div class="section"><h3>Native Export</h3></div>
        ${numberRow("FPS", "nativeExport.fps", state.nativeExport.fps, 12, 60, 1)}
        ${numberRow("CRF", "nativeExport.crf", state.nativeExport.crf, 12, 30, 1)}
        <div class="row"><label>Preset</label><select data-bind="nativeExport.preset">${["medium","slow","fast","veryfast"].map((v) => `<option value="${v}" ${state.nativeExport.preset === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="row"><label>Audio bitrate</label><select data-bind="nativeExport.audioBitrate">${["128k","192k","256k","320k"].map((v) => `<option value="${v}" ${state.nativeExport.audioBitrate === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <button class="wide-action" id="selectFfmpegBtn">Select FFmpeg</button>
        <div class="stats">
          <div><span>FFmpeg</span><b>${state.nativeExport.ffmpegVersion || state.nativeExport.ffmpegPath || "Not checked"}</b></div>
        </div>
        <div class="stats">
          <div><span>Video clips</span><b>${state.videoClips.length || "-"}</b></div>
          <div><span>Audio clips</span><b>${state.audioClips.length || "-"}</b></div>
          <div><span>BPM</span><b>${state.bpm || "-"}</b></div>
          <div><span>Duration</span><b>${fmtTC(duration(), false)}</b></div>
          <div><span>Subtitles</span><b>${state.subs.length}</b></div>
        </div>
      `;
    }
  }
  function slider(label, path, value, min, max, step, unit) {
    const shown = unit === "%" ? `${Math.round(Number(value) * 100)}%` : `${Number(value).toFixed(step < 1 ? 2 : 0)}${unit}`;
    return `<div class="row"><label>${label}<span data-value-for="${path}" data-unit="${unit}" data-step="${step}">${shown}</span></label><input data-bind="${path}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  }
  function numberRow(label, path, value, min, max, step) {
    return `<div class="row"><label>${label}</label><input data-bind="${path}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  }
  function checkboxRow(label, path, value) {
    return `<label class="check-row"><input data-bind="${path}" type="checkbox" ${value ? "checked" : ""}>${label}</label>`;
  }
  function textRow(label, path, value) {
    return `<div class="row"><label>${label}</label><textarea data-bind="${path}">${escapeHtml(value)}</textarea></div>`;
  }
  function swatches(path, value) {
    return `<div class="row"><label>Color</label><div class="swatches">${COLORS.map((c) => `<button data-swatch="${path}:${c}" class="${value === c ? "is-on" : ""}" style="background:${c}"></button>`).join("")}<button class="rgb-swatch" data-color-pick="${path}" title="Full color">RGB</button><input data-color-input="${path}" type="color" value="${value || "#ffffff"}" hidden></div></div>`;
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
  function formatValueForDisplay(value, unit, step) {
    const n = Number(value) || 0;
    if (unit === "%") return `${Math.round(n * 100)}%`;
    return `${n.toFixed(Number(step) < 1 ? 2 : 0)}${unit || ""}`;
  }
  function updateInspectorValue(path, value) {
    const out = Array.from(el.inspector.querySelectorAll("[data-value-for]")).find((node) => node.dataset.valueFor === path);
    if (out) out.textContent = formatValueForDisplay(value, out.dataset.unit, out.dataset.step);
    el.inspector.querySelectorAll("[data-swatch]").forEach((btn) => {
      if (!btn.dataset.swatch.startsWith(`${path}:`)) return;
      btn.classList.toggle("is-on", btn.dataset.swatch === `${path}:${value}`);
    });
  }
  function getPathValue(path) {
    if (path.startsWith("sub.")) {
      const s = state.subs.find((item) => item.id === state.selected);
      return s ? s[path.slice(4)] : "";
    }
    if (path.startsWith("track.")) {
      const track = state.tracks.find((item) => item.id === state.selected);
      return track ? track[path.slice(6)] : "";
    }
    const parts = path.split(".");
    if (parts.length === 1) return state[parts[0]];
    return state[parts[0]] ? state[parts[0]][parts[1]] : "";
  }
  function openColorModal(path) {
    if (!el.colorModal || !el.colorModalInput) return;
    const current = getPathValue(path) || "#ffffff";
    pushHistory("Change color");
    state.pendingColorPath = path;
    state.pendingColorOriginal = current;
    el.colorModalInput.value = /^#[0-9a-f]{6}$/i.test(current) ? current : "#ffffff";
    el.colorModal.hidden = false;
  }
  function closeColorModal(commit) {
    if (!state.pendingColorPath) return;
    if (!commit) {
      setPath(state.pendingColorPath, state.pendingColorOriginal);
      updateInspectorValue(state.pendingColorPath, state.pendingColorOriginal);
      refresh({ inspector: false, projects: false });
    }
    state.pendingColorPath = "";
    state.pendingColorOriginal = "";
    if (el.colorModal) el.colorModal.hidden = true;
  }
  async function refreshFfmpegStatus() {
    if (!window.pacekeeper || !window.pacekeeper.ffmpegStatus) return;
    try {
      const result = await window.pacekeeper.ffmpegStatus();
      state.nativeExport.ffmpegPath = result.path || "";
      state.nativeExport.ffmpegVersion = result.ok ? (result.version || result.path || "") : "";
      if (!result.ok) setStatus("FFmpeg not found. Use Select FFmpeg before native export.");
      refresh({ projects: false });
    } catch (_) {}
  }
  function setPath(path, value) {
    if (path === "bpm") {
      state.bpm = parseFloat(value) || 0;
      state.bpmSections = [];
      el.bpmInput.value = state.bpm ? String(state.bpm) : "";
    } else if (path.startsWith("sub.")) {
      const s = state.subs.find((item) => item.id === state.selected);
      if (s) Object.assign(s, normalizeSubtitle({ ...s, [path.slice(4)]: value }));
    } else if (path.startsWith("track.")) {
      const track = state.tracks.find((item) => item.id === state.selected);
      if (track) track[path.slice(6)] = value;
    } else if (path.startsWith("media.")) {
      const selectedTrack = state.tracks.find((track) => track.id === state.selected);
      const clip = selectedTrack ? selectedClipForTrack(selectedTrack.type, selectedTrack.id) : null;
      if (clip) {
        if (path === "media.start") setMediaClipStart(clip, value);
        else clip[path.slice(6)] = value;
        syncLegacyMediaState();
      }
    } else {
      const parts = path.split(".");
      if (parts.length === 1) state[parts[0]] = value;
      else state[parts[0]][parts[1]] = value;
    }
  }

  function renderTimeline() {
    const dur = duration() || 30;
    const width = Math.max(el.timelineScroll.clientWidth, dur * state.pxPerSec + 60);
    const height = 29 + state.tracks.length * 44;
    el.timelineInner.style.width = `${width}px`;
    el.timelineInner.style.height = `${height}px`;
    const labelRows = [];
    state.tracks.forEach((track, index) => {
      const row = document.createElement("div");
      row.className = `${trackIsSelected(track) ? "selected" : ""}${flashClass("track", track.id)}`;
      row.dataset.track = track.id;
      row.innerHTML = `<b style="background:${track.color}">${codeForTrack(index)}</b><span>${escapeHtml(track.label)}</span>${track.locked ? "" : `<button class="remove-track" data-remove-track="${track.id}" title="Remove track">x</button>`}`;
      labelRows.push(row.outerHTML);
    });
    el.laneLabels.querySelector(".ruler-gap")?.remove();
    el.laneLabels.querySelector(".lane-labels-content")?.remove();
    el.laneLabels.insertAdjacentHTML("afterbegin", `<div class="ruler-gap"></div><div class="lane-labels-content">${labelRows.join("")}</div>`);
    syncLaneLabelScroll();
    el.ruler.innerHTML = "";
    const step = state.pxPerSec < 24 ? 10 : state.pxPerSec < 60 ? 5 : 1;
    for (let s = 0; s <= dur; s += step) {
      const tick = document.createElement("div");
      tick.className = "tick";
      tick.style.left = `${s * state.pxPerSec}px`;
      tick.style.height = `${height}px`;
      tick.innerHTML = `<span>${fmtTC(s, false).slice(0, 5)}</span>`;
      el.ruler.appendChild(tick);
    }
    Array.from(el.timelineInner.querySelectorAll(".lane")).forEach((lane) => lane.remove());
    state.tracks.forEach((track) => {
      const lane = document.createElement("div");
      lane.className = `lane ${track.type === "overlay" ? "subs-lane" : ""} ${trackIsSelected(track) ? "selected" : ""}${flashClass("track", track.id)}`;
      lane.dataset.track = track.id;
      el.timelineInner.appendChild(lane);

      if (track.type === "video") {
        const clips = state.videoClips.filter((clip) => clip.trackId === track.id);
        if (clips.length) {
          clips.forEach((clip) => {
            const b = block(`video-block ${state.selectedClipId === clip.id ? "selected" : ""}${flashClass("clip", clip.id)}`, clip.name, clip.start, clipDuration(clip));
            b.dataset.mediaClip = clip.id;
            b.insertAdjacentHTML("afterbegin", videoThumbStrip(clip));
            b.innerHTML += `<button class="clip-delete" data-delete-media-clip="${clip.id}" title="Delete clip">x</button><span class="handle left" data-trim="${clip.id}:start"></span><span class="handle right" data-trim="${clip.id}:end"></span>`;
            lane.appendChild(b);
          });
        } else {
          lane.appendChild(block("empty-block", "Empty video track", 0, 4));
        }
      } else if (track.type === "audio") {
        const clips = state.audioClips.filter((clip) => clip.trackId === track.id);
        if (clips.length) {
          clips.forEach((clip) => {
            const b = block(`audio-block ${state.selectedClipId === clip.id ? "selected" : ""}${flashClass("clip", clip.id)}`, `<canvas></canvas><span>${escapeHtml(clip.name)}</span>`, clip.start, clip.duration, true);
            b.dataset.mediaClip = clip.id;
            b.innerHTML += `<button class="clip-delete" data-delete-media-clip="${clip.id}" title="Delete clip">x</button>`;
            lane.appendChild(b);
            drawWaveform(b.querySelector("canvas"), clip);
          });
        } else {
          lane.appendChild(block("empty-block", "Empty audio track", 0, 4));
        }
      } else if (track.type === "viz" && state.audioClips.length && state.viz.enabled) {
        state.audioClips.forEach((audio) => {
          const b = block(`viz-block ${state.selected === "viz" ? "selected" : ""}${flashClass("track", "viz")}`, `${vizMini()}<span>${state.viz.style} spectrum</span>`, audio.start, audio.duration, true);
          b.dataset.select = "viz";
          lane.appendChild(b);
        });
      } else if (track.type === "overlay") {
        groupedOverlayTimelineItems(track.id).forEach((item) => {
          const s = item.sub;
          const cls = `${s.type === "logo" ? "logo-block" : "sub-block"} ${state.selected === s.id ? "selected" : ""}${flashClass("sub", s.id)}`;
          const b = block(cls, item.content || overlayBlockContent(s), s.start, Math.max(0.2, s.end - s.start), true);
          if (item.grouped) b.dataset.select = s.id;
          else {
            b.dataset.sub = s.id;
            b.innerHTML += `<span class="handle left" data-sub-resize="${s.id}:start"></span><span class="handle right" data-sub-resize="${s.id}:end"></span>`;
          }
          lane.appendChild(b);
        });
      }
    });
  }
  function groupedOverlayTimelineItems(trackId) {
    const items = [];
    const groups = new Map();
    state.subs.filter((s) => (s.trackId || "overlay-1") === trackId).forEach((sub) => {
      if (sub.source && sub.source.kind === "bpm-logo") {
        const key = [
          sub.source.audioClipId || "",
          sub.source.activeSectionIndex ?? "",
          Number(sub.start || 0).toFixed(3),
          Number(sub.end || 0).toFixed(3)
        ].join(":");
        if (!groups.has(key)) {
          const level = sub.source.paceLevel ? bpmLevelFor(sub.source.bpm || 0).label : "BPM";
          groups.set(key, {
            sub,
            grouped: true,
            content: `<span class="subtitle-label">BPM Logo ${escapeHtml(level)}</span>`
          });
          items.push(groups.get(key));
        }
      } else {
        items.push({ sub, grouped: false });
      }
    });
    return items.sort((a, b) => (a.sub.start || 0) - (b.sub.start || 0));
  }
  function block(cls, content, start, len, raw) {
    const div = document.createElement("div");
    div.className = `block ${cls}`;
    div.style.left = `${start * state.pxPerSec}px`;
    div.style.width = `${Math.max(24, len * state.pxPerSec)}px`;
    div.innerHTML = raw ? content : `<span>${escapeHtml(content)}</span>`;
    return div;
  }
  function videoThumbStrip(clip) {
    if (!clip || !clip.thumbs || !clip.thumbs.length || clipDuration(clip) <= 0) return "";
    const trimStart = clip.trimStart || 0;
    const trimEnd = clip.trimEnd ?? clip.duration;
    const imgs = clip.thumbs
      .filter((thumb) => thumb.time >= trimStart && thumb.time <= trimEnd)
      .map((thumb) => {
        const left = ((thumb.time - trimStart) / clipDuration(clip)) * 100;
        return `<img src="${thumb.url}" style="left:${left}%" title="${fmtTC(thumb.time, false)}" alt="">`;
      })
      .join("");
    return `<div class="thumb-strip">${imgs}</div>`;
  }
  function vizMini() {
    const style = state.viz.style;
    if (style === "wave") return `<span class="viz-mini wave"><i></i></span>`;
    if (style === "circle") return `<span class="viz-mini circle"><i></i></span>`;
    if (style === "dots") return `<span class="viz-mini dots"><i></i><i></i><i></i></span>`;
    const bars = style === "mirror" ? [2, 8, 4, 10, 5] : [4, 10, 6, 14, 8];
    return `<span class="viz-mini bars">${bars.map((h) => `<i style="height:${h}px"></i>`).join("")}</span>`;
  }
  function overlayBlockContent(s) {
    if (s.type === "logo") {
      return `${s.url ? `<img class="overlay-thumb" src="${s.url}" alt="">` : ""}<span>${escapeHtml(s.text || "Logo")}</span>`;
    }
    return `<span class="subtitle-label">${escapeHtml(s.text || "Subtitle")}</span>`;
  }
  function drawWaveform(canvas, clip) {
    if (!canvas || !clip || !clip.peaks) return;
    const w = Math.max(10, Math.floor(clip.duration * state.pxPerSec));
    canvas.width = w;
    canvas.height = 40;
    const wctx = canvas.getContext("2d");
    const { mins, maxs } = clip.peaks;
    wctx.clearRect(0, 0, w, 40);
    wctx.fillStyle = "rgba(45,212,191,.9)";
    for (let x = 0; x < w; x++) {
      const i = Math.floor(x / w * (maxs.length - 1));
      const top = 20 - maxs[i] * 18;
      const bot = 20 - mins[i] * 18;
      wctx.fillRect(x, top, 1, Math.max(1, bot - top));
    }
  }
  function bpmTimelineSections() {
    const sections = [];
    state.audioClips.forEach((audio) => {
      const clipSections = audio.bpmSections && audio.bpmSections.length
        ? audio.bpmSections
        : (audio.bpm > 0 ? [{ start: 0, end: audio.duration, bpm: audio.bpm }] : []);
      clipSections.forEach((section) => {
        if (!section.bpm || section.bpm <= 0) return;
        sections.push({
          start: (audio.start || 0) + section.start,
          end: (audio.start || 0) + section.end,
          bpm: section.bpm,
          audioClipId: audio.id
        });
      });
    });
    if (!sections.length && state.bpm > 0) {
      sections.push({ start: 0, end: duration(), bpm: state.bpm, audioClipId: "" });
    }
    return sections.sort((a, b) => a.start - b.start);
  }
  function renderProjects() {
    el.projectList.innerHTML = state.projects.length ? "" : `<div class="project-card"><span class="empty-thumb"></span><div><b>No saved projects</b><small>Use Save after editing.</small></div></div>`;
    state.projects.forEach((p) => {
      const card = document.createElement("div");
      card.className = `project-card ${p.id === state.id ? "active" : ""}`;
      card.dataset.project = p.id;
      card.innerHTML = `
        <button class="project-delete" data-delete-project="${p.id}" title="Delete project">x</button>
        ${p.thumb ? `<img src="${p.thumb}" alt="">` : `<span class="empty-thumb"></span>`}
        <div><b>${escapeHtml(p.name)}</b><small>${new Date(p.updatedAt).toLocaleString()}</small></div>
      `;
      el.projectList.appendChild(card);
    });
    syncProjectListScroll();
  }
  function syncProjectListScroll() {
    if (!el.projectList) return;
    const maxScroll = Math.max(0, el.projectList.scrollHeight - el.projectList.clientHeight);
    const scrollTop = clamp(el.projectList.scrollTop, 0, maxScroll);
    const atTop = scrollTop <= 1;
    const atBottom = maxScroll <= 1 || scrollTop >= maxScroll - 1;
    if (el.projectHintTop) el.projectHintTop.hidden = atTop;
    if (el.projectHintBottom) el.projectHintBottom.hidden = atBottom;
  }
  function syncLaneLabelScroll() {
    const content = el.laneLabels.querySelector(".lane-labels-content");
    if (content) content.style.transform = `translateY(${-el.timelineScroll.scrollTop}px)`;
    const rulerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ruler-h")) || 29;
    const laneHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lane-h")) || 44;
    const visibleTrackHeight = Math.max(0, el.timelineScroll.clientHeight - rulerHeight);
    const trackContentHeight = state.tracks.length * laneHeight;
    const maxScroll = Math.max(0, trackContentHeight - visibleTrackHeight);
    const scrollTop = clamp(el.timelineScroll.scrollTop, 0, maxScroll);
    const atTop = scrollTop <= 1;
    const atBottom = maxScroll <= 1 || scrollTop >= maxScroll - 1;
    if (el.trackHintTop) el.trackHintTop.hidden = atTop;
    if (el.trackHintBottom) el.trackHintBottom.hidden = atBottom;
    updateTrackNavigator();
  }
  function updateTrackNavigator() {
    if (!el.trackNavigator || !el.trackNavigatorThumb) return;
    const maxScroll = el.timelineScroll.scrollHeight - el.timelineScroll.clientHeight;
    if (maxScroll <= 1) {
      el.trackNavigator.hidden = true;
      return;
    }
    el.trackNavigator.hidden = false;
    const navHeight = el.trackNavigator.clientHeight;
    if (navHeight <= 0) return;
    const thumbHeight = clamp((el.timelineScroll.clientHeight / el.timelineScroll.scrollHeight) * navHeight, 24, navHeight);
    const maxThumbTop = Math.max(0, navHeight - thumbHeight);
    const thumbTop = maxScroll > 0 ? (el.timelineScroll.scrollTop / maxScroll) * maxThumbTop : 0;
    el.trackNavigatorThumb.style.height = `${thumbHeight}px`;
    el.trackNavigatorThumb.style.transform = `translateY(${thumbTop}px)`;
  }
  function scrollTimelineFromNavigator(e, drag) {
    const r = el.trackNavigator.getBoundingClientRect();
    const navHeight = el.trackNavigator.clientHeight;
    const thumbHeight = el.trackNavigatorThumb.offsetHeight || 24;
    const maxScroll = el.timelineScroll.scrollHeight - el.timelineScroll.clientHeight;
    const maxThumbTop = Math.max(1, navHeight - thumbHeight);
    const offset = drag && Number.isFinite(drag.pointerOffset) ? drag.pointerOffset : thumbHeight / 2;
    const thumbTop = clamp(e.clientY - r.top - offset, 0, maxThumbTop);
    el.timelineScroll.scrollTop = (thumbTop / maxThumbTop) * maxScroll;
  }
  function startTrackNavigatorDrag(e) {
    if (!el.trackNavigator || el.trackNavigator.hidden) return;
    e.preventDefault();
    const thumbRect = el.trackNavigatorThumb.getBoundingClientRect();
    const pointerOffset = e.target === el.trackNavigatorThumb
      ? clamp(e.clientY - thumbRect.top, 0, thumbRect.height)
      : thumbRect.height / 2;
    refs.trackNavigatorDrag = { pointerId: e.pointerId, pointerOffset };
    el.trackNavigator.classList.add("dragging");
    el.trackNavigator.setPointerCapture(e.pointerId);
    scrollTimelineFromNavigator(e, refs.trackNavigatorDrag);
  }
  function moveTrackNavigatorDrag(e) {
    if (!refs.trackNavigatorDrag || refs.trackNavigatorDrag.pointerId !== e.pointerId) return;
    e.preventDefault();
    scrollTimelineFromNavigator(e, refs.trackNavigatorDrag);
  }
  function endTrackNavigatorDrag(e) {
    if (!refs.trackNavigatorDrag || refs.trackNavigatorDrag.pointerId !== e.pointerId) return;
    refs.trackNavigatorDrag = null;
    el.trackNavigator.classList.remove("dragging");
    if (el.trackNavigator.hasPointerCapture(e.pointerId)) el.trackNavigator.releasePointerCapture(e.pointerId);
  }
  function refresh(options) {
    options = options || {};
    state.name = el.projectName.value || "Untitled";
    syncLegacyMediaState();
    fitStageToPreview();
    applyAudioSettings();
    updateClock();
    el.vizBtn.classList.toggle("is-on", state.viz.enabled);
    if (options.inspector !== false) renderInspector();
    renderTimeline();
    if (options.projects !== false) renderProjects();
    else syncProjectListScroll();
    renderFrame(state.time);
  }
  function scheduleViewportRefresh() {
    if (refs.viewportRefresh) cancelAnimationFrame(refs.viewportRefresh);
    refs.viewportRefresh = requestAnimationFrame(() => {
      refs.viewportRefresh = 0;
      refresh({ inspector: false, projects: false });
    });
  }

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("pacekeeper_movmaker", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("projects", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbTx(mode, fn) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("projects", mode);
      const store = tx.objectStore("projects");
      const req = fn(store);
      tx.oncomplete = () => resolve(req && "result" in req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function refreshProjects() {
    state.projects = (await idbTx("readonly", (s) => s.getAll()) || [])
      .map((p) => ({ id: p.id, name: p.name, thumb: p.thumb, updatedAt: p.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    renderProjects();
  }
  function showDeleteProjectModal(projectId) {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project || !el.deleteProjectModal) return;
    state.pendingDeleteProjectId = projectId;
    if (el.deleteProjectText) el.deleteProjectText.textContent = `Delete "${project.name || "Untitled"}"?`;
    el.deleteProjectModal.hidden = false;
  }
  function hideDeleteProjectModal() {
    state.pendingDeleteProjectId = null;
    if (el.deleteProjectModal) el.deleteProjectModal.hidden = true;
  }
  async function deletePendingProject() {
    const projectId = state.pendingDeleteProjectId;
    if (!projectId) return;
    await idbTx("readwrite", (s) => s.delete(projectId));
    if (state.id === projectId) {
      state.id = null;
      el.projectName.value = "Untitled";
    }
    hideDeleteProjectModal();
    await refreshProjects();
    setStatus("Deleted project.");
  }
  function hasProjectContent() {
    return state.videoClips.length
      || state.audioClips.length
      || state.subs.length
      || state.bpmSections.length
      || (el.projectName.value || "Untitled") !== "Untitled";
  }
  function showSwitchProjectModal(projectId) {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project || !el.switchProjectModal) return;
    state.pendingSwitchProjectId = projectId;
    if (el.switchProjectText) {
      el.switchProjectText.textContent = `Save the current project before opening "${project.name || "Untitled"}"?`;
    }
    el.switchProjectModal.hidden = false;
  }
  function hideSwitchProjectModal() {
    state.pendingSwitchProjectId = null;
    if (el.switchProjectModal) el.switchProjectModal.hidden = true;
  }
  async function openProjectFromList(projectId) {
    if (!projectId || projectId === state.id) return;
    if (hasProjectContent() && isProjectDirty()) {
      showSwitchProjectModal(projectId);
      return;
    }
    await loadProject(projectId);
  }
  async function continueSwitchProject(saveCurrent) {
    const projectId = state.pendingSwitchProjectId;
    if (!projectId) return;
    hideSwitchProjectModal();
    if (saveCurrent) await saveProject();
    await loadProject(projectId);
  }
  function currentSavedProject() {
    return state.id ? state.projects.find((item) => item.id === state.id) : null;
  }
  function shouldConfirmProjectOverwrite() {
    const project = currentSavedProject();
    if (!project) return false;
    return (project.name || "Untitled") === (el.projectName.value || "Untitled");
  }
  function showSaveProjectModal() {
    const project = currentSavedProject();
    if (!project || !el.saveProjectModal) return false;
    if (el.saveProjectText) el.saveProjectText.textContent = `Overwrite "${project.name || "Untitled"}"?`;
    el.saveProjectModal.hidden = false;
    return true;
  }
  function hideSaveProjectModal() {
    if (el.saveProjectModal) el.saveProjectModal.hidden = true;
  }
  async function requestSaveProject() {
    if (shouldConfirmProjectOverwrite() && showSaveProjectModal()) return;
    await saveProject();
  }
  async function confirmSaveProjectOverwrite() {
    hideSaveProjectModal();
    await saveProject({ forceNew: false });
  }
  function newProjectId() {
    return `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  function projectRecord(includeBlobs, options) {
    options = options || {};
    return {
      version: 1,
      id: options.id || state.id || newProjectId(),
      name: el.projectName.value || "Untitled",
      updatedAt: options.updatedAt ?? Date.now(),
      thumb: options.skipThumb ? "" : thumbnail(),
      trim: state.trim,
      videoOffset: state.videoOffset,
      audioOffset: state.audioOffset,
      videoTrackId: state.videoTrackId,
      audioTrackId: state.audioTrackId,
      tracks: normalizeTracks(state.tracks),
      viz: state.viz,
      bpm: state.bpm,
      bpmSections: state.bpmSections,
      bpmOv: state.bpmOv,
      nativeExport: state.nativeExport,
      videoClips: state.videoClips.map((clip) => ({ id: clip.id, type: "video", trackId: clip.trackId, name: clip.name, sourcePath: clip.sourcePath || "", duration: clip.duration, start: clip.start, trimStart: clip.trimStart || 0, trimEnd: clip.trimEnd ?? clip.duration, volume: clip.volume, muted: clip.muted, thumbs: includeBlobs ? (clip.thumbs || []) : [], blob: includeBlobs ? (clip.blob || refs.videoBlobs[clip.id]) : null })),
      audioClips: state.audioClips.map((clip) => ({ id: clip.id, type: "audio", trackId: clip.trackId, name: clip.name, sourcePath: clip.sourcePath || "", duration: clip.duration, start: clip.start, trimStart: clip.trimStart || 0, trimEnd: clip.trimEnd ?? clip.duration, volume: clip.volume, muted: clip.muted, bpm: clip.bpm || 0, bpmSections: clip.bpmSections || [], peaks: includeBlobs ? clip.peaks : null, blob: includeBlobs ? (clip.blob || refs.audioBlobs[clip.id]) : null })),
      videoName: state.video && state.video.name,
      audioName: state.audio && state.audio.name,
      videoAudio: state.videoAudio,
      musicAudio: state.musicAudio,
      videoBlob: includeBlobs ? refs.videoBlob : null,
      audioBlob: includeBlobs ? refs.audioBlob : null,
      subtitleFx: state.subtitleFx,
      subs: state.subs.filter((s) => !(s.source && s.source.kind === "bpm-logo")).map((s) => {
        const sub = normalizeSubtitle(s);
        return { id: sub.id, type: sub.type, text: sub.text, sourcePath: sub.sourcePath || "", url: sub.url || "", source: sub.source || null, start: sub.start, end: sub.end, trackId: sub.trackId, x: sub.x, y: sub.y, size: sub.size, color: sub.color, fontFamily: sub.fontFamily, fontWeight: sub.fontWeight, fontStyle: sub.fontStyle, effect: sub.effect, align: sub.align, background: sub.background };
      }),
      logoBlobs: includeBlobs ? Object.fromEntries(state.subs.filter((s) => s.type === "logo" && s.blob).map((s) => [s.id, s.blob])) : {}
    };
  }
  function projectSnapshot() {
    const rec = projectRecord(false, { id: "snapshot", updatedAt: 0, skipThumb: true });
    return JSON.stringify(rec);
  }
  function makeHistorySnapshot() {
    return {
      rec: projectRecord(true, { id: state.id || "__new_project__", updatedAt: 0, skipThumb: true }),
      hadProjectId: !!state.id,
      selected: state.selected,
      selectedClipId: state.selectedClipId,
      time: state.time,
      pxPerSec: state.pxPerSec,
      bpmInput: el.bpmInput.value || ""
    };
  }
  function clearHistory() {
    refs.historyPast = [];
    refs.historyFuture = [];
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    if (el.undo) el.undo.disabled = !refs.historyPast.length;
    if (el.redo) el.redo.disabled = !refs.historyFuture.length;
  }
  function pushHistory(label) {
    if (refs.historyRestoring || state.exporting) return;
    refs.historyPast.push(makeHistorySnapshot());
    if (refs.historyPast.length > HISTORY_LIMIT) refs.historyPast.shift();
    refs.historyFuture = [];
    updateHistoryButtons();
  }
  async function restoreHistorySnapshot(snapshot) {
    if (!snapshot || !snapshot.rec) return;
    stop();
    refs.historyRestoring = true;
    refs.videoBlobs = {};
    refs.audioBlobs = {};
    refs.activeVideoClipId = null;
    refs.activeAudioClipId = null;
    const rec = snapshot.rec;
    const migrated = migrateLegacyClips(rec);
    Object.assign(state, {
      id: snapshot.hadProjectId ? rec.id : null,
      tracks: normalizeTracks(rec.tracks),
      videoTrackId: rec.videoTrackId || firstTrackIdOfType("video"),
      audioTrackId: rec.audioTrackId || firstTrackIdOfType("audio"),
      videoAudio: rec.videoAudio || { muted: true, volume: 0.8 },
      musicAudio: rec.musicAudio || { muted: false, volume: 1 },
      viz: rec.viz || state.viz,
      bpm: rec.bpm || 0,
      bpmSections: rec.bpmSections || [],
      bpmOv: { ...state.bpmOv, ...(rec.bpmOv || {}) },
      nativeExport: { ...state.nativeExport, ...(rec.nativeExport || {}) },
      subtitleFx: rec.subtitleFx || state.subtitleFx,
      trim: rec.trim || { start: 0, end: 0 },
      videoOffset: rec.videoOffset ?? 0,
      audioOffset: rec.audioOffset ?? 0,
      selected: snapshot.selected || null,
      selectedClipId: snapshot.selectedClipId || null,
      time: snapshot.time || 0,
      pxPerSec: snapshot.pxPerSec || state.pxPerSec,
      video: null,
      audio: null,
      videoClips: migrated.videoClips,
      audioClips: migrated.audioClips,
      subs: []
    });
    el.projectName.value = rec.name || "Untitled";
    el.bpmInput.value = snapshot.bpmInput || (state.bpm ? String(state.bpm) : "");
    syncLegacyMediaState();
    if (state.video) attachVideoClip(state.video);
    else {
      el.video.pause();
      el.video.removeAttribute("src");
    }
    if (state.audio) attachAudioClip(state.audio);
    else {
      el.audio.pause();
      el.audio.removeAttribute("src");
      el.audio.load();
    }
    state.subs = (rec.subs || []).filter((s) => !(s.source && s.source.kind === "bpm-logo")).map((s) => {
      const out = normalizeSubtitle(s);
      if (out.type === "logo" && rec.logoBlobs && rec.logoBlobs[out.id]) {
        out.blob = rec.logoBlobs[out.id];
        out.url = URL.createObjectURL(out.blob);
        out.img = new Image();
        out.img.src = out.url;
      } else if (out.type === "logo" && out.url) {
        out.img = new Image();
        out.img.src = out.url;
      }
      return out;
    });
    syncLegacyMediaState();
    syncMedia(state.time);
    refs.historyRestoring = false;
    refresh();
  }
  async function undo() {
    if (!refs.historyPast.length) return;
    const current = makeHistorySnapshot();
    const previous = refs.historyPast.pop();
    refs.historyFuture.push(current);
    if (refs.historyFuture.length > HISTORY_LIMIT) refs.historyFuture.shift();
    await restoreHistorySnapshot(previous);
    updateHistoryButtons();
    setStatus("Undo.");
  }
  async function redo() {
    if (!refs.historyFuture.length) return;
    const current = makeHistorySnapshot();
    const next = refs.historyFuture.pop();
    refs.historyPast.push(current);
    if (refs.historyPast.length > HISTORY_LIMIT) refs.historyPast.shift();
    await restoreHistorySnapshot(next);
    updateHistoryButtons();
    setStatus("Redo.");
  }
  function rememberProjectClean() {
    state.cleanProjectSnapshot = projectSnapshot();
  }
  function isProjectDirty() {
    return projectSnapshot() !== state.cleanProjectSnapshot;
  }
  async function saveProject(options) {
    options = options || {};
    const rec = projectRecord(true, { id: options.forceNew === false && state.id ? state.id : newProjectId() });
    state.id = rec.id;
    await idbTx("readwrite", (s) => s.put(rec));
    if (window.pacekeeper && window.pacekeeper.saveProjectFile) {
      const fileRec = projectRecord(false, { id: rec.id });
      fileRec.media = {
        video: state.videoClips.map((clip) => ({ name: clip.name, path: clip.sourcePath || "", trackId: clip.trackId, start: clip.start })),
        audio: state.audioClips.map((clip) => ({ name: clip.name, path: clip.sourcePath || "", trackId: clip.trackId, start: clip.start }))
      };
      try { await window.pacekeeper.saveProjectFile(fileRec); } catch (_) {}
    }
    await refreshProjects();
    rememberProjectClean();
    setStatus(`Saved project "${rec.name}".`);
  }
  function reviveVideoClip(rec) {
    const blob = rec.blob || null;
    const url = blob ? URL.createObjectURL(blob) : rec.url || "";
    const clip = { ...rec, type: "video", url, trimStart: rec.trimStart || 0, trimEnd: rec.trimEnd ?? rec.duration ?? 0, thumbs: rec.thumbs || [], blob };
    if (blob) refs.videoBlobs[clip.id] = blob;
    return clip;
  }
  function reviveAudioClip(rec) {
    const blob = rec.blob || null;
    const url = blob ? URL.createObjectURL(blob) : rec.url || "";
    const clip = { ...rec, type: "audio", url, trimStart: rec.trimStart || 0, trimEnd: rec.trimEnd ?? rec.duration ?? 0, peaks: rec.peaks, blob };
    if (blob) refs.audioBlobs[clip.id] = blob;
    return clip;
  }
  function migrateLegacyClips(rec) {
    const videoClips = (rec.videoClips || []).map(reviveVideoClip);
    const audioClips = (rec.audioClips || []).map(reviveAudioClip);
    return { videoClips, audioClips };
  }
  async function loadProject(id) {
    stop();
    const rec = await idbTx("readonly", (s) => s.get(id));
    if (!rec) return;
    refs.videoBlobs = {};
    refs.audioBlobs = {};
    const migrated = migrateLegacyClips(rec);
    Object.assign(state, {
      id: rec.id,
      tracks: normalizeTracks(rec.tracks),
      videoTrackId: rec.videoTrackId || "video",
      audioTrackId: rec.audioTrackId || "audio",
      videoAudio: rec.videoAudio || state.videoAudio,
      musicAudio: rec.musicAudio || state.musicAudio,
      viz: rec.viz || state.viz,
      bpm: rec.bpm || 0,
      bpmSections: rec.bpmSections || [],
      bpmOv: { ...state.bpmOv, ...(rec.bpmOv || {}) },
      nativeExport: { ...state.nativeExport, ...(rec.nativeExport || {}) },
      subtitleFx: rec.subtitleFx || state.subtitleFx,
      trim: rec.trim || { start: 0, end: 0 },
      videoOffset: rec.videoOffset ?? 0,
      audioOffset: rec.audioOffset ?? 0,
      subs: [],
      selected: null,
      selectedClipId: null,
      time: 0,
      video: null,
      audio: null,
      videoClips: migrated.videoClips,
      audioClips: migrated.audioClips
    });
    el.projectName.value = rec.name || "Untitled";
    el.bpmInput.value = state.bpm ? String(state.bpm) : "";
    syncLegacyMediaState();
    if (!migrated.audioClips.length && rec.audioBlob) {
      state.time = rec.audioOffset ?? 0;
      await loadAudio(rec.audioBlob, false, state.audioTrackId);
    }
    if (!migrated.videoClips.length && rec.videoBlob) {
      state.time = rec.videoOffset ?? 0;
      await loadVideo(rec.videoBlob, state.videoTrackId);
      const clip = primaryClip("video");
      if (clip && rec.trim) {
        clip.trimStart = rec.trim.start || 0;
        clip.trimEnd = rec.trim.end || clip.duration;
      }
    }
    state.time = 0;
    syncLegacyMediaState();
    if (state.video) attachVideoClip(state.video);
    if (state.audio) attachAudioClip(state.audio);
    state.subs = (rec.subs || []).filter((s) => !(s.source && s.source.kind === "bpm-logo")).map((s) => {
      const out = normalizeSubtitle(s);
      if (out.type === "logo" && rec.logoBlobs && rec.logoBlobs[out.id]) {
        out.blob = rec.logoBlobs[out.id];
        out.url = URL.createObjectURL(out.blob);
        out.img = new Image();
        out.img.src = out.url;
      } else if (out.type === "logo" && out.url) {
        out.img = new Image();
        out.img.src = out.url;
      }
      return out;
    });
    setStatus(`Loaded project "${rec.name}".`);
    refresh();
    rememberProjectClean();
    clearHistory();
  }
  async function loadProjectJsonFile(file) {
    const rec = JSON.parse(await file.text());
    el.projectName.value = rec.name || "Untitled";
    state.id = rec.id || null;
    state.trim = rec.trim || { start: 0, end: 0 };
    state.videoOffset = rec.videoOffset ?? 0;
    state.audioOffset = rec.audioOffset ?? 0;
    state.tracks = normalizeTracks(rec.tracks);
    state.videoTrackId = rec.videoTrackId || firstTrackIdOfType("video");
    state.audioTrackId = rec.audioTrackId || firstTrackIdOfType("audio");
    refs.videoBlobs = {};
    refs.audioBlobs = {};
    state.videoClips = (rec.videoClips || []).map(reviveVideoClip);
    state.audioClips = (rec.audioClips || []).map(reviveAudioClip);
    state.videoAudio = rec.videoAudio || state.videoAudio;
    state.musicAudio = rec.musicAudio || state.musicAudio;
    state.viz = rec.viz || state.viz;
    state.bpm = rec.bpm || 0;
    state.bpmSections = rec.bpmSections || [];
    state.bpmOv = { ...state.bpmOv, ...(rec.bpmOv || {}) };
    state.nativeExport = { ...state.nativeExport, ...(rec.nativeExport || {}) };
    state.subtitleFx = rec.subtitleFx || state.subtitleFx;
    state.subs = (rec.subs || []).filter((sub) => !(sub.source && sub.source.kind === "bpm-logo")).map((sub) => {
      const out = normalizeSubtitle({ ...sub, trackId: sub.trackId || activeOverlayTrackId() });
      if (out.type === "logo" && out.url) {
        out.img = new Image();
        out.img.src = out.url;
      }
      return out;
    });
    state.selected = null;
    state.selectedClipId = null;
    syncLegacyMediaState();
    el.bpmInput.value = state.bpm ? String(state.bpm) : "";
    setStatus("Loaded project settings. Re-import media files if this JSON was moved.");
    refresh();
    rememberProjectClean();
    clearHistory();
  }

  function startTrimDrag(clipId, which, ev) {
    ev.stopPropagation();
    const clip = state.videoClips.find((item) => item.id === clipId);
    if (!clip) return;
    pushHistory("Trim clip");
    selectMediaClip(clip);
    const sourceStart = clip.trimStart || 0;
    const sourceEnd = clip.trimEnd ?? clip.duration;
    const offsetStart = clip.start || 0;
    const move = (e) => {
      const t = timeFromEvent(e);
      if (which === "start") {
        const newOffset = clamp(t, 0, offsetStart + sourceEnd - sourceStart - 0.1);
        const delta = newOffset - offsetStart;
        clip.start = newOffset;
        clip.trimStart = clamp(sourceStart + delta, 0, (clip.trimEnd ?? clip.duration) - 0.1);
      } else {
        clip.trimEnd = clamp((clip.trimStart || 0) + Math.max(0.1, t - (clip.start || 0)), (clip.trimStart || 0) + 0.1, clip.duration || sourceEnd);
      }
      syncLegacyMediaState();
      refresh();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      markFlash("clip", clip.id);
      refresh();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function startSubDrag(s, ev) {
    ev.stopPropagation();
    pushHistory("Move subtitle");
    state.selected = s.id;
    clearSelectedMediaClip();
    if (!state.playing && (state.time < s.start || state.time > s.end)) seekIntoSubtitle(s);
    const x0 = ev.clientX;
    const start = s.start;
    const len = s.end - s.start;
    const move = (e) => {
      const ns = Math.max(0, start + (e.clientX - x0) / state.pxPerSec);
      s.start = ns;
      s.end = ns + len;
      refresh();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      markFlash("sub", s.id);
      refresh();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    refresh();
  }
  function startSubResize(s, edge, ev) {
    ev.stopPropagation();
    pushHistory("Resize subtitle");
    state.selected = s.id;
    clearSelectedMediaClip();
    const x0 = ev.clientX;
    const start0 = s.start;
    const end0 = s.end;
    const move = (e) => {
      const dt = (e.clientX - x0) / state.pxPerSec;
      if (edge === "start") s.start = clamp(start0 + dt, 0, end0 - 0.1);
      else s.end = Math.max(start0 + 0.1, end0 + dt);
      refresh({ inspector: false, projects: false });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      refresh();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    refresh();
  }
  function startMediaDrag(clipId, ev) {
    ev.stopPropagation();
    const clip = findMediaClip(clipId);
    if (!clip) return;
    pushHistory("Move clip");
    selectMediaClip(clip);
    const x0 = ev.clientX;
    const start = clip.start || 0;
    const move = (e) => {
      const offset = Math.max(0, start + (e.clientX - x0) / state.pxPerSec);
      setMediaClipStart(clip, offset);
      syncLegacyMediaState();
      if (state.playing) refs.clock = { t0: state.time, perf0: performance.now() };
      syncMedia(state.time);
      refresh();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      markFlash("clip", clip.id);
      setStatus(`Moved ${clip.type} clip "${clip.name}" to ${fmtTC(clip.start || 0, false)}.`);
      refresh();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    refresh();
  }
  function canvasPointFromEvent(ev) {
    const rect = el.stage.getBoundingClientRect();
    return {
      x: clamp((ev.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((ev.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
    };
  }
  function overlayBounds(sub) {
    const s = normalizeSubtitle(sub);
    if (s.type === "logo") {
      const w = Math.max(0.04, Number(s.size) || 0.22);
      const ratio = s.img && s.img.width && s.img.height ? s.img.height / s.img.width : 1;
      const h = clamp(w * ratio * (CW / CH), 0.04, 0.6);
      return { left: s.x - w / 2, right: s.x + w / 2, top: s.y - h / 2, bottom: s.y + h / 2 };
    }
    const fontSize = Number(s.size) || 56;
    const width = clamp(String(s.text || "Subtitle").length * fontSize * 0.00042 + 0.08, 0.12, 0.82);
    const height = clamp(fontSize / CH * 1.5, 0.06, 0.28);
    return { left: s.x - width / 2, right: s.x + width / 2, top: s.y - height / 2, bottom: s.y + height / 2 };
  }
  function overlayItemAtPoint(point) {
    const trackOrder = new Map(state.tracks.map((track, index) => [track.id, index]));
    const candidates = state.subs
      .filter((sub) => state.time >= sub.start && state.time <= sub.end)
      .sort((a, b) => (trackOrder.get(b.trackId || "overlay-1") || 0) - (trackOrder.get(a.trackId || "overlay-1") || 0));
    const selected = state.subs.find((sub) => sub.id === state.selected);
    if (selected && !candidates.some((sub) => sub.id === selected.id)) candidates.unshift(selected);
    return candidates.find((sub) => {
      const b = overlayBounds(sub);
      return point.x >= b.left && point.x <= b.right && point.y >= b.top && point.y <= b.bottom;
    }) || null;
  }
  function startOverlayCanvasDrag(ev) {
    if (state.exporting) return false;
    const point = canvasPointFromEvent(ev);
    const sub = overlayItemAtPoint(point);
    if (!sub) return false;
    pushHistory("Move overlay");
    ev.preventDefault();
    ev.stopPropagation();
    state.selected = sub.id;
    clearSelectedMediaClip();
    const startPoint = point;
    const targets = sub.source && sub.source.kind === "bpm-logo"
      ? state.subs.filter((item) => item.source && item.source.kind === "bpm-logo" && item.source.audioClipId === sub.source.audioClipId)
      : [sub];
    const starts = targets.map((item) => ({
      item,
      x: Number(item.x) || 0.5,
      y: Number(item.y) || 0.5
    }));
    const move = (e) => {
      const next = canvasPointFromEvent(e);
      const dx = next.x - startPoint.x;
      const dy = next.y - startPoint.y;
      starts.forEach((entry) => {
        entry.item.x = clamp(entry.x + dx, 0, 1);
        entry.item.y = clamp(entry.y + dy, 0, 1);
      });
      refresh({ inspector: false, projects: false });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      markFlash("sub", sub.id);
      refresh();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    refresh();
    return true;
  }
  function timeFromEvent(e) {
    const r = el.timelineScroll.getBoundingClientRect();
    return Math.max(0, (e.clientX - r.left + el.timelineScroll.scrollLeft) / state.pxPerSec);
  }
  function zoom(factor) {
    const center = el.timelineScroll.clientWidth / 2;
    const t = (el.timelineScroll.scrollLeft + center) / state.pxPerSec;
    state.pxPerSec = clamp(state.pxPerSec * factor, 6, 400);
    refresh();
    el.timelineScroll.scrollLeft = t * state.pxPerSec - center;
  }
  function fitZoom() {
    state.pxPerSec = clamp((el.timelineScroll.clientWidth - 36) / (duration() || 30), 6, 400);
    refresh();
    el.timelineScroll.scrollLeft = 0;
  }
  function tapBpm() {
    const now = performance.now();
    refs.tap = refs.tap.filter((t) => now - t < 2500);
    refs.tap.push(now);
    if (refs.tap.length >= 2) {
      let sum = 0;
      for (let i = 1; i < refs.tap.length; i++) sum += refs.tap[i] - refs.tap[i - 1];
      const bpm = Math.round(60000 / (sum / (refs.tap.length - 1)));
      if (bpm >= 40 && bpm <= 240) {
        pushHistory("Tap BPM");
        state.bpm = bpm;
        state.bpmSections = [];
        el.bpmInput.value = String(bpm);
        refresh();
      }
    }
  }
  function fmtRemaining(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const total = Math.ceil(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function estimatedRemaining(progress, fallback) {
    const clamped = clamp(progress || 0, 0, 1);
    if (clamped >= 1) return 0;
    if (clamped > 0.02 && refs.exportStartedAt) {
      const elapsed = (performance.now() - refs.exportStartedAt) / 1000;
      return Math.max(0, elapsed / clamped - elapsed);
    }
    return fallback;
  }
  function showExportModal(title) {
    refs.exportCancelRequested = false;
    refs.exportCompleted = false;
    refs.exportStartedAt = performance.now();
    if (!el.exportModal) return;
    if (el.exportModalTitle) el.exportModalTitle.textContent = title || "Export";
    if (el.exportModalText) el.exportModalText.textContent = "Preparing export...";
    if (el.exportProgressBar) el.exportProgressBar.style.width = "0%";
    if (el.exportRemaining) el.exportRemaining.textContent = "--:--";
    if (el.exportCancel) el.exportCancel.hidden = false;
    if (el.exportClose) el.exportClose.hidden = true;
    el.exportModal.hidden = false;
  }
  function updateExportModal(text, progress, remaining) {
    if (!el.exportModal || el.exportModal.hidden) return;
    const clamped = clamp(progress || 0, 0, 1);
    if (el.exportModalText) el.exportModalText.textContent = text || "Exporting...";
    if (el.exportProgressBar) el.exportProgressBar.style.width = `${Math.round(clamped * 100)}%`;
    if (el.exportRemaining) el.exportRemaining.textContent = fmtRemaining(remaining);
  }
  function completeExportModal(text) {
    refs.exportCompleted = true;
    updateExportModal(text || "Export complete.", 1, 0);
    if (el.exportCancel) el.exportCancel.hidden = true;
    if (el.exportClose) el.exportClose.hidden = false;
  }
  function closeExportModal() {
    if (el.exportModal) el.exportModal.hidden = true;
  }
  function cancelExport() {
    if (refs.exportCompleted) {
      closeExportModal();
      return;
    }
    refs.exportCancelRequested = true;
    updateExportModal("Canceling export...", 0, 0);
    if (window.pacekeeper && window.pacekeeper.cancelNativeExport) {
      window.pacekeeper.cancelNativeExport().catch(() => {});
    }
    if (refs.recorder && refs.recorder.state !== "inactive") refs.recorder.stop();
  }
  function canUseNativeExport() {
    return !!(window.pacekeeper && window.pacekeeper.beginNativeExport && window.pacekeeper.writeNativeExportFrame && window.pacekeeper.finishNativeExport);
  }
  async function selectFfmpeg() {
    if (!window.pacekeeper || !window.pacekeeper.selectFfmpeg) {
      setStatus("FFmpeg selection is available in the Electron app.");
      return;
    }
    try {
      const result = await window.pacekeeper.selectFfmpeg();
      if (result.canceled) return;
      state.nativeExport.ffmpegPath = result.path || "";
      state.nativeExport.ffmpegVersion = result.version || result.path || "";
      setStatus(`FFmpeg ready: ${state.nativeExport.ffmpegVersion}`);
      refresh();
    } catch (error) {
      setStatus(`FFmpeg check failed: ${error.message || error}`);
    }
  }
  function firstAudioForNativeExport() {
    return state.audioClips.find((clip) => clip.sourcePath) || null;
  }
  function waitForMediaSeek(media, target, timeout) {
    if (!media || !media.src) return Promise.resolve();
    if (media.readyState >= 2 && !media.seeking && Math.abs((media.currentTime || 0) - target) < 0.08) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(done, timeout || 900);
      function done() {
        clearTimeout(timer);
        media.removeEventListener("seeked", done);
        media.removeEventListener("loadeddata", done);
        resolve();
      }
      media.addEventListener("seeked", done, { once: true });
      media.addEventListener("loadeddata", done, { once: true });
    });
  }
  function stagePngBytes() {
    return new Promise((resolve, reject) => {
      el.stage.toBlob(async (blob) => {
        if (!blob) { reject(new Error("Could not encode preview frame.")); return; }
        resolve(await blob.arrayBuffer());
      }, "image/png");
    });
  }
  async function exportNativeVideo() {
    if (!canUseNativeExport()) return false;
    if (duration() <= 0) { setStatus("Import media before exporting."); return true; }
    const fps = clamp(Number(state.nativeExport.fps) || 30, 12, 60);
    const totalFrames = Math.max(1, Math.ceil(duration() * fps));
    const audioClip = firstAudioForNativeExport();
    let removeProgressListener = null;
    try {
      showExportModal("Export MP4");
      if (window.pacekeeper.onExportProgress) {
        removeProgressListener = window.pacekeeper.onExportProgress((data) => {
          if (data && data.time) {
            setStatus(`Encoding MP4 with FFmpeg... ${data.time}`);
            updateExportModal(`Encoding MP4 with FFmpeg... ${data.time}`, 0.96, "--:--");
          }
        });
      }
      const session = await window.pacekeeper.beginNativeExport({
        name: el.projectName.value || "PaceKeeper",
        fps,
        duration: duration()
      });
      if (session.canceled) return true;
      pause();
      state.exporting = true;
      el.export.textContent = "Exporting";
      for (let i = 0; i < totalFrames; i++) {
        if (refs.exportCancelRequested) throw new Error("Export canceled.");
        const t = Math.min(duration(), i / fps);
        state.time = t;
        syncMedia(t);
        const videoClip = activeClipAt("video", t);
        if (videoClip) await waitForMediaSeek(el.video, (videoClip.trimStart || 0) + clamp(clipLocalTime(videoClip, t), 0, clipDuration(videoClip)), 900);
        renderFrame(t);
        await window.pacekeeper.writeNativeExportFrame(session, i, await stagePngBytes());
        if (i % Math.max(1, Math.round(fps)) === 0 || i === totalFrames - 1) {
          const progress = (i + 1) / totalFrames * 0.92;
          const remaining = estimatedRemaining(progress, Math.max(0, duration() - t));
          setStatus(`Rendering frames for FFmpeg... ${i + 1}/${totalFrames}`);
          updateExportModal(`Rendering frames... ${i + 1}/${totalFrames}`, progress, remaining);
          updateClock();
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (refs.exportCancelRequested) throw new Error("Export canceled.");
      updateExportModal("Encoding MP4 with FFmpeg...", 0.96, "--:--");
      const result = await window.pacekeeper.finishNativeExport(session, {
        fps,
        crf: clamp(Number(state.nativeExport.crf) || 18, 12, 30),
        preset: state.nativeExport.preset || "medium",
        audioBitrate: state.nativeExport.audioBitrate || "192k",
        audioPath: audioClip ? audioClip.sourcePath : "",
        audioStart: audioClip ? audioClip.start || 0 : 0
      });
      setStatus(`Native MP4 export complete: ${result.outputPath}`);
      completeExportModal(`Export complete: ${result.outputPath}`);
      return true;
    } catch (error) {
      const canceled = /canceled/i.test(error.message || String(error));
      setStatus(canceled ? "Export canceled." : `Native export failed: ${error.message || error}`);
      completeExportModal(canceled ? "Export canceled." : `Native export failed: ${error.message || error}`);
      return true;
    } finally {
      if (removeProgressListener) removeProgressListener();
      state.exporting = false;
      el.export.textContent = "Export";
      renderFrame(state.time);
      refresh();
    }
  }
  async function exportVideo() {
    if (state.exporting) return;
    if (await exportNativeVideo()) return;
    if (duration() <= 0) { setStatus("Import media before exporting."); return; }
    if (!el.stage.captureStream || typeof MediaRecorder === "undefined") {
      setStatus("This browser cannot export from canvas. Try Electron/Chrome.");
      return;
    }
    ensureAudioCtx();
    const stream = el.stage.captureStream(30);
    if (state.audio && refs.analyser) {
      if (!refs.dest) {
        refs.dest = refs.audioCtx.createMediaStreamDestination();
        refs.analyser.connect(refs.dest);
      }
      refs.dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
    const chunks = [];
    refs.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000 });
    refs.recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    refs.recorder.onstop = () => {
      const canceled = refs.exportCancelRequested;
      const blob = new Blob(chunks, { type: "video/webm" });
      if (!canceled) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${el.projectName.value || "PaceKeeper"}.webm`;
        a.click();
      }
      state.exporting = false;
      el.export.textContent = "Export";
      setStatus(canceled ? "Export canceled." : "Preview export complete. Native MP4 export is wired for the desktop FFmpeg phase.");
      completeExportModal(canceled ? "Export canceled." : "Export complete. File download started.");
      refresh();
    };
    state.exporting = true;
    showExportModal("Export WebM");
    updateExportModal("Exporting timeline in real time...", 0, duration());
    setStatus("Exporting timeline in real time...");
    seek(0);
    setTimeout(() => { refs.recorder.start(100); play(); }, 150);
  }

  function wire() {
    window.addEventListener("resize", scheduleViewportRefresh);
    window.addEventListener("focus", scheduleViewportRefresh);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleViewportRefresh();
    });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", scheduleViewportRefresh);
    if (typeof ResizeObserver !== "undefined") {
      refs.stageResizeObserver = new ResizeObserver(scheduleViewportRefresh);
      refs.stageResizeObserver.observe(el.stage);
      const preview = el.stage.closest(".preview");
      if (preview) refs.stageResizeObserver.observe(preview);
    }
    el.stage.addEventListener("pointerdown", startOverlayCanvasDrag);
    $("videoBtn").onclick = importVideoFromDialog;
    $("audioBtn").onclick = importAudioFromDialog;
    $("logoBtn").onclick = importLogoFromDialog;
    $("subtitleBtn").onclick = addSubtitle;
    $("addTrackBtn").onclick = showTrackModal;
    el.trackModalClose.onclick = hideTrackModal;
    el.trackModal.addEventListener("click", (e) => {
      if (e.target === el.trackModal) hideTrackModal();
      const type = e.target.closest("[data-add-track-type]") && e.target.closest("[data-add-track-type]").dataset.addTrackType;
      if (!type) return;
      pushHistory("Add track");
      const id = addTrack(type);
      if (id) {
        state.selected = id;
        clearSelectedMediaClip();
        markFlash("track", id);
        setStatus(`Added a new ${type} track.`);
        hideTrackModal();
        refresh();
      }
    });
    $("newProjectBtn").onclick = () => {
      stop();
      state.id = null; state.video = null; state.audio = null; state.videoClips = []; state.audioClips = []; state.tracks = defaultTracks(); state.videoTrackId = "video"; state.audioTrackId = "audio"; state.videoOffset = 0; state.audioOffset = 0; state.videoAudio = { muted: true, volume: 0.8 }; state.musicAudio = { muted: false, volume: 1 }; state.subtitleFx = { effect: "none", shadow: true, background: false, align: "center" }; state.subs = []; state.selected = null; state.selectedClipId = null; state.flash = null; state.bpm = 0; state.bpmSections = []; state.time = 0; state.trim = { start: 0, end: 0 };
      refs.videoBlob = null; refs.audioBlob = null; refs.videoBlobs = {}; refs.audioBlobs = {}; refs.activeVideoClipId = null; refs.activeAudioClipId = null; el.video.removeAttribute("src"); el.audio.removeAttribute("src"); el.projectName.value = "Untitled";
      setStatus("New project.");
      refresh();
      rememberProjectClean();
      clearHistory();
    };
    $("saveProjectBtn").onclick = () => requestSaveProject().catch((error) => setStatus(`Save failed: ${error.message || error}`));
    $("loadFileBtn").onclick = async () => {
      if (window.pacekeeper && window.pacekeeper.loadProjectFile) {
        const res = await window.pacekeeper.loadProjectFile();
        if (!res.canceled && res.project) {
          const blob = new Blob([JSON.stringify(res.project)], { type: "application/json" });
          await loadProjectJsonFile(new File([blob], "project.pkmm.json"));
        }
      } else {
        el.projectInput.click();
      }
    };
    el.videoInput.onchange = (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) loadVideo(file, activeMediaTrackId("video"));
    };
    el.audioInput.onchange = (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) loadAudio(file, true, activeMediaTrackId("audio"));
    };
    el.logoInput.onchange = (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) addLogo(file);
    };
    el.projectInput.onchange = (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) loadProjectJsonFile(file);
    };
    $("rewindBtn").onclick = () => seek(0);
    $("forwardBtn").onclick = () => seek(duration());
    $("stopBtn").onclick = stop;
    el.play.onclick = () => state.playing ? pause() : play();
    el.export.onclick = exportVideo;
    el.undo.onclick = () => undo().catch((error) => setStatus(`Undo failed: ${error.message || error}`));
    el.redo.onclick = () => redo().catch((error) => setStatus(`Redo failed: ${error.message || error}`));
    el.vizBtn.onclick = () => { state.viz.enabled = !state.viz.enabled; state.selected = "viz"; clearSelectedMediaClip(); markFlash("track", "viz"); refresh(); };
    $("tapBtn").onclick = tapBpm;
    el.bpmInput.oninput = (e) => {
      if (!e.target.dataset.historyActive) {
        pushHistory("Edit BPM");
        e.target.dataset.historyActive = "1";
      }
      state.bpm = parseFloat(e.target.value) || 0;
      state.bpmSections = [];
      refresh();
    };
    el.bpmInput.addEventListener("blur", () => { delete el.bpmInput.dataset.historyActive; });
    $("zoomOutBtn").onclick = () => zoom(1 / 1.4);
    $("zoomInBtn").onclick = () => zoom(1.4);
    $("fitBtn").onclick = fitZoom;
    el.timelineScroll.onclick = (e) => {
      if (e.target.closest(".block,.handle")) return;
      seek(timeFromEvent(e));
    };
    el.timelineScroll.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        zoom(e.deltaY < 0 ? 1.16 : 1 / 1.16);
      } else if (e.shiftKey) {
        e.preventDefault();
        el.timelineScroll.scrollLeft += e.deltaY || e.deltaX;
      } else {
        e.preventDefault();
        el.timelineScroll.scrollTop += e.deltaY;
      }
    }, { passive: false });
    el.timelineScroll.addEventListener("scroll", () => {
      syncLaneLabelScroll();
    });
    el.laneLabels.addEventListener("wheel", (e) => {
      e.preventDefault();
      el.timelineScroll.scrollTop += e.deltaY;
    }, { passive: false });
    if (el.trackNavigator) {
      el.trackNavigator.addEventListener("pointerdown", startTrackNavigatorDrag);
      el.trackNavigator.addEventListener("pointermove", moveTrackNavigatorDrag);
      el.trackNavigator.addEventListener("pointerup", endTrackNavigatorDrag);
      el.trackNavigator.addEventListener("pointercancel", endTrackNavigatorDrag);
    }
    if (el.projectList) {
      el.projectList.addEventListener("wheel", (e) => {
        e.preventDefault();
        el.projectList.scrollTop += e.deltaY;
      }, { passive: false });
      el.projectList.addEventListener("scroll", syncProjectListScroll);
    }
    document.addEventListener("pointerdown", (e) => {
      const deleteMediaClip = e.target.closest("[data-delete-media-clip]");
      if (deleteMediaClip) {
        e.preventDefault();
        e.stopPropagation();
        if (removeMediaClipById(deleteMediaClip.dataset.deleteMediaClip)) refresh();
        return;
      }
      const trim = e.target.dataset.trim;
      if (trim) {
        const [clipId, edge] = trim.split(":");
        startTrimDrag(clipId, edge, e);
        return;
      }
      const subResize = e.target.dataset.subResize;
      if (subResize) {
        const [id, edge] = subResize.split(":");
        const sub = state.subs.find((s) => s.id === id);
        if (sub) startSubResize(sub, edge, e);
        return;
      }
      const mediaClip = e.target.closest(".block") && e.target.closest(".block").dataset.mediaClip;
      if (mediaClip) { startMediaDrag(mediaClip, e); return; }
      const subId = e.target.closest(".block") && e.target.closest(".block").dataset.sub;
      if (subId) {
        const sub = state.subs.find((s) => s.id === subId);
        if (sub) {
          if (!state.playing && (state.time < sub.start || state.time > sub.end)) seekIntoSubtitle(sub);
          startSubDrag(sub, e);
        }
      }
      const sel = e.target.closest(".block") && e.target.closest(".block").dataset.select;
      if (sel) { state.selected = sel; clearSelectedMediaClip(); refresh(); }
    });
    el.timelineInner.addEventListener("click", (e) => {
      const lane = e.target.closest(".lane");
      if (!lane || e.target.closest(".block,.handle")) return;
      const track = state.tracks.find((item) => item.id === lane.dataset.track);
      if (!track) return;
      if (track.type === "bpm") state.selected = "bpm";
      else if (track.type === "viz") state.selected = "viz";
      else if (track.type === "overlay") state.selected = track.id;
      else state.selected = track.id;
      clearSelectedMediaClip();
      refresh();
    });
    el.laneLabels.addEventListener("click", (e) => {
      const removeId = e.target.dataset.removeTrack;
      if (removeId) {
        if (removeTrackById(removeId)) refresh();
        return;
      }
      const row = e.target.closest("[data-track]");
      if (!row) return;
      const track = state.tracks.find((item) => item.id === row.dataset.track);
      if (track && track.type === "viz") state.selected = "viz";
      else if (track && track.type === "overlay") state.selected = track.id;
      else if (track) state.selected = track.id;
      clearSelectedMediaClip();
      refresh();
    });
    el.inspector.addEventListener("input", (e) => {
      const path = e.target.dataset.bind;
      if (!path) return;
      if (!e.target.dataset.historyActive) {
        pushHistory("Edit inspector");
        e.target.dataset.historyActive = "1";
      }
      const isText = e.target.tagName === "TEXTAREA";
      const isCheck = e.target.type === "checkbox";
      const isString = isText || e.target.tagName === "SELECT" || path.endsWith(".text") || path.endsWith(".color") || path.endsWith(".trackId") || path.endsWith(".effect") || path.endsWith(".align");
      setPath(path, isCheck ? e.target.checked : isString ? e.target.value : parseFloat(e.target.value) || 0);
      updateInspectorValue(path, isCheck ? e.target.checked : isString ? e.target.value : parseFloat(e.target.value) || 0);
      refresh({ inspector: false, projects: false });
    });
    el.inspector.addEventListener("focusin", (e) => {
      if (!e.target.dataset.bind) return;
      if (e.target.dataset.historyActive) return;
      pushHistory("Edit inspector");
      e.target.dataset.historyActive = "1";
    });
    el.inspector.addEventListener("focusout", (e) => {
      if (e.target.dataset.historyActive) delete e.target.dataset.historyActive;
    });
    el.inspector.addEventListener("click", (e) => {
      const style = e.target.dataset.vizStyle;
      if (style) { pushHistory("Change visualizer style"); state.viz.style = style; refresh(); }
      const subEffect = e.target.dataset.subEffect;
      if (subEffect) { pushHistory("Change subtitle effect"); state.subtitleFx.effect = subEffect; refresh(); }
      const subStyleButton = e.target.closest("[data-sub-style]");
      const subStyle = subStyleButton ? subStyleButton.dataset.subStyle : "";
      if (subStyle) {
        const [key, value] = subStyle.split(":");
        const sub = state.subs.find((s) => s.id === state.selected);
        if (sub) {
          pushHistory("Change subtitle style");
          if (key === "fontStyle") sub.fontStyle = sub.fontStyle === value ? "normal" : value;
          else sub[key] = value;
          Object.assign(sub, normalizeSubtitle(sub));
          refresh();
        }
      }
      const swatch = e.target.dataset.swatch;
      if (swatch) {
        pushHistory("Change color");
        const idx = swatch.indexOf(":");
        setPath(swatch.slice(0, idx), swatch.slice(idx + 1));
        updateInspectorValue(swatch.slice(0, idx), swatch.slice(idx + 1));
        refresh({ inspector: false, projects: false });
      }
      const colorPick = e.target.dataset.colorPick;
      if (colorPick) {
        openColorModal(colorPick);
      }
      if (e.target.id === "deleteSubBtn") {
        pushHistory("Delete subtitle");
        const deleted = state.subs.find((s) => s.id === state.selected);
        state.subs = state.subs.filter((s) => s.id !== state.selected);
        state.selected = null;
        clearSelectedMediaClip();
        if (deleted) markFlash("track", deleted.trackId || "overlay-1");
        refresh();
      }
      if (e.target.id === "selectFfmpegBtn") {
        selectFfmpeg();
      }
      if (e.target.id === "deleteTrackBtn") {
        if (removeTrackById(state.selected)) refresh();
      }
    });
    el.inspector.addEventListener("change", (e) => {
      const path = e.target.dataset.colorInput;
      if (!path) return;
      setPath(path, e.target.value);
      updateInspectorValue(path, e.target.value);
      refresh({ inspector: false, projects: false });
    });
    if (el.colorModalInput) {
      el.colorModalInput.addEventListener("input", () => {
        if (!state.pendingColorPath) return;
        setPath(state.pendingColorPath, el.colorModalInput.value);
        updateInspectorValue(state.pendingColorPath, el.colorModalInput.value);
        refresh({ inspector: false, projects: false });
      });
    }
    el.projectList.onclick = (e) => {
      const deleteButton = e.target.closest("[data-delete-project]");
      if (deleteButton) {
        e.preventDefault();
        e.stopPropagation();
        showDeleteProjectModal(deleteButton.dataset.deleteProject);
        return;
      }
      const card = e.target.closest("[data-project]");
      if (card) openProjectFromList(card.dataset.project).catch((error) => setStatus(`Open failed: ${error.message || error}`));
    };
    if (el.deleteProjectModal) {
      el.deleteProjectModal.addEventListener("click", (e) => {
        if (e.target === el.deleteProjectModal || e.target === el.deleteProjectNo || e.target === el.deleteProjectCancelTop) hideDeleteProjectModal();
      });
    }
    if (el.deleteProjectYes) el.deleteProjectYes.onclick = () => { deletePendingProject().catch((error) => setStatus(`Delete failed: ${error.message || error}`)); };
    if (el.switchProjectModal) {
      el.switchProjectModal.addEventListener("click", (e) => {
        if (e.target === el.switchProjectModal || e.target === el.switchProjectCancel || e.target === el.switchProjectCancelTop) hideSwitchProjectModal();
      });
    }
    if (el.switchProjectYes) el.switchProjectYes.onclick = () => { continueSwitchProject(true).catch((error) => setStatus(`Open failed: ${error.message || error}`)); };
    if (el.switchProjectNo) el.switchProjectNo.onclick = () => { continueSwitchProject(false).catch((error) => setStatus(`Open failed: ${error.message || error}`)); };
    if (el.saveProjectModal) {
      el.saveProjectModal.addEventListener("click", (e) => {
        if (e.target === el.saveProjectModal || e.target === el.saveProjectNo || e.target === el.saveProjectCancelTop) hideSaveProjectModal();
      });
    }
    if (el.saveProjectYes) el.saveProjectYes.onclick = () => { confirmSaveProjectOverwrite().catch((error) => setStatus(`Save failed: ${error.message || error}`)); };
    if (el.exportCancel) el.exportCancel.onclick = cancelExport;
    if (el.exportClose) el.exportClose.onclick = closeExportModal;
    if (el.colorModal) {
      el.colorModal.addEventListener("click", (e) => {
        if (e.target === el.colorModal || e.target === el.colorModalCancel || e.target === el.colorModalClose) closeColorModal(false);
      });
    }
    if (el.colorModalOk) el.colorModalOk.onclick = () => closeColorModal(true);
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && el.deleteProjectModal && !el.deleteProjectModal.hidden) { hideDeleteProjectModal(); return; }
      if (e.code === "Escape" && el.switchProjectModal && !el.switchProjectModal.hidden) { hideSwitchProjectModal(); return; }
      if (e.code === "Escape" && el.saveProjectModal && !el.saveProjectModal.hidden) { hideSaveProjectModal(); return; }
      if (e.code === "Escape" && el.exportModal && !el.exportModal.hidden && refs.exportCompleted) { closeExportModal(); return; }
      if (e.code === "Escape" && el.colorModal && !el.colorModal.hidden) { closeColorModal(false); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        const action = e.shiftKey ? redo : undo;
        action().catch((error) => setStatus(`${e.shiftKey ? "Redo" : "Undo"} failed: ${error.message || error}`));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        redo().catch((error) => setStatus(`Redo failed: ${error.message || error}`));
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); state.playing ? pause() : play(); }
      if (e.code === "Home") { e.preventDefault(); seek(0); }
    });
  }

  wire();
  window.pacekeeperDebug = debugSnapshot;
  loadBpmImages();
  refreshProjects();
  refresh();
  rememberProjectClean();
  updateHistoryButtons();
  refreshFfmpegStatus();
}());
