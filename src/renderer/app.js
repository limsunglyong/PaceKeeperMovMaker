(function () {
  "use strict";

  const CW = 1280;
  const CH = 720;
  const FFT = 512;
  const COLORS = ["#ffffff", "#ff4d5e", "#2dd4bf", "#ffb020", "#a78bfa", "#5b8cff"];
  const SUBTITLE_FONTS = [
    { label: "Inter", value: "Inter, Segoe UI, Arial, sans-serif" },
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
    projectName: $("projectName"),
    projectList: $("projectList"),
    inspector: $("inspectorBody"),
    timelineScroll: $("timelineScroll"),
    timelineInner: $("timelineInner"),
    laneLabels: $("laneLabels"),
    ruler: $("ruler"),
    playhead: $("playhead"),
    videoInput: $("videoInput"),
    audioInput: $("audioInput"),
    logoInput: $("logoInput"),
    projectInput: $("projectInput"),
    bpmInput: $("bpmInput"),
    vizBtn: $("vizBtn"),
    bpmBtn: $("bpmBtn"),
    trackModal: $("trackModal"),
    trackModalClose: $("trackModalClose")
  };
  const ctx = el.stage.getContext("2d");

  function defaultTracks() {
    return [
      { id: "video", label: "Video", type: "video", color: "#5b8cff", locked: true },
      { id: "audio", label: "Audio", type: "audio", color: "#2dd4bf", locked: true },
      { id: "viz", label: "Visualizer", type: "viz", color: "#a78bfa", locked: true },
      { id: "overlay-1", label: "Overlay 1", type: "overlay", color: "#ffb020" },
      { id: "bpm", label: "BPM", type: "bpm", color: "#ff4d5e", locked: true }
    ];
  }

  const state = {
    id: null,
    name: "Untitled",
    video: null,
    audio: null,
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
    bpmOv: { enabled: true, x: 0.88, y: 0.13, color: "#ff4d5e", offset: 0, imageSet: "color", showIcon: true, showLabel: true, showNumber: false },
    subtitleFx: { effect: "none", shadow: true, background: false, align: "center" },
    tracks: defaultTracks(),
    subs: [],
    selected: null,
    time: 0,
    playing: false,
    exporting: false,
    pxPerSec: 48,
    projects: []
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
    tap: [],
    waveCanvas: null,
    bpmImages: {}
  };

  function setStatus(text) { el.status.textContent = text; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function duration() {
    return Math.max(
      state.video ? state.videoOffset + trimDuration() : 0,
      state.audio ? state.audioOffset + state.audio.duration : 0,
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
    const bpmIndex = state.tracks.findIndex((item) => item.id === "bpm");
    if (bpmIndex >= 0) state.tracks.splice(bpmIndex, 0, track);
    else state.tracks.push(track);
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
    const insertBefore = state.tracks.findIndex((item) => item.type === "viz" || item.type === "overlay" || item.type === "bpm");
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
    if (track.type === "overlay") {
      const fallback = overlayTracks().find((item) => item.id !== removeId);
      if (!fallback) {
        setStatus("Keep at least one overlay track.");
        return false;
      }
      state.subs.forEach((sub) => { if (sub.trackId === removeId) sub.trackId = fallback.id; });
      setStatus("Removed overlay track. Existing items moved to the next overlay track.");
    } else {
      if (track.type === "video" && state.videoTrackId === removeId) {
        state.videoTrackId = state.tracks.find((item) => item.type === "video" && item.id !== removeId)?.id || "video";
      }
      if (track.type === "audio" && state.audioTrackId === removeId) {
        state.audioTrackId = state.tracks.find((item) => item.type === "audio" && item.id !== removeId)?.id || "audio";
      }
      setStatus(`Removed ${track.type} track.`);
    }
    state.tracks = state.tracks.filter((item) => item.id !== removeId);
    if (state.selected === removeId) state.selected = null;
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
    const local = state.audio ? audioLocalTime(time) : time;
    const sections = state.bpmSections || [];
    const found = sections.find((section) => local >= section.start && local < section.end);
    if (found) return found;
    if (sections.length && local >= sections[sections.length - 1].end) return sections[sections.length - 1];
    return state.bpm > 0 ? { start: 0, end: duration(), bpm: state.bpm } : null;
  }
  function currentBpmAt(time) {
    const section = bpmSectionAt(time);
    return section && section.bpm > 0 ? section.bpm : state.bpm;
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
    out.fontWeight = out.fontWeight || "800";
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
  function detectBPMSections(buffer) {
    const ch = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const dur = buffer.duration;
    if (!dur || dur < 4) return [];
    const windowSec = dur < 24 ? dur : 16;
    const hopSec = dur < 24 ? dur : 8;
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
      if (last && (Math.abs(last.bpm - win.bpm) <= 3 || bpmLevelFor(last.bpm).id === level)) {
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
    return merged.map((section) => ({
      start: Number(section.start.toFixed(2)),
      end: Number(section.end.toFixed(2)),
      bpm: Math.round(section.bpm)
    }));
  }

  function renderFrame(t) {
    const fx = state.subtitleFx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, CW, CH);
    const videoActive = state.video && videoLocalTime(t) >= 0 && videoLocalTime(t) <= trimDuration();
    if (videoActive && el.video.readyState >= 2) {
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

    const audioLocal = state.audio ? audioLocalTime(t) : 0;
    const audioActive = state.audio && audioLocal >= 0 && audioLocal <= state.audio.duration;
    if (state.viz.enabled && state.audio && audioActive) {
      if (state.playing && refs.analyser) refs.analyser.getByteFrequencyData(refs.freq);
      else staticSpectrum(audioLocal, refs.freq);
      drawViz(refs.freq);
    }
    if (state.bpmOv.enabled && (state.bpm > 0 || (state.bpmSections && state.bpmSections.length))) drawBpm(t);
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
    if (state.audio && state.audio.peaks) {
      const i = Math.floor((t / state.audio.duration) * (state.audio.peaks.maxs.length - 1));
      amp = Math.min(1, Math.abs(state.audio.peaks.maxs[clamp(i, 0, state.audio.peaks.maxs.length - 1)]) * 1.4 + 0.12);
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
  function drawBpm(t) {
    const cfg = state.bpmOv;
    const bpm = currentBpmAt(t);
    if (!bpm || bpm <= 0) return;
    const activeLevel = bpmLevelFor(bpm);
    const interval = 60 / bpm;
    const phase = ((t - state.audioOffset - cfg.offset) % interval + interval) % interval;
    const pulse = Math.max(0, 1 - phase / interval * 3.2);
    const cx = cfg.x * CW;
    const cy = cfg.y * CH;
    const iconSize = 44;
    const activeBoost = 10 + pulse * 7;
    const gap = 18;
    const total = BPM_LEVELS.length * iconSize + (BPM_LEVELS.length - 1) * gap;
    const startX = cx - total / 2 + iconSize / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    BPM_LEVELS.forEach((level, index) => {
      const active = level.id === activeLevel.id;
      const x = startX + index * (iconSize + gap);
      const size = active ? iconSize + activeBoost : iconSize;
      const imgSet = active ? "color" : "gray";
      const img = refs.bpmImages[imgSet] && refs.bpmImages[imgSet][level.id];
      ctx.fillStyle = active ? cfg.color : "rgba(255,255,255,.28)";
      if (active) {
        ctx.globalAlpha = 0.18 + pulse * 0.24;
        ctx.beginPath();
        ctx.arc(x, cy - 8, size * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = active ? 1 : 0.78;
      if (cfg.showIcon && img && img.complete) {
        ctx.drawImage(img, x - size / 2, cy - 8 - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, cy - 8, size * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      if (cfg.showLabel) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = active ? "#fff" : "rgba(255,255,255,.5)";
        ctx.font = active ? "800 18px Consolas, monospace" : "700 15px Consolas, monospace";
        ctx.fillText(level.label, x, cy + 38);
      }
    });
    ctx.globalAlpha = 1;
    if (cfg.showNumber) {
      ctx.fillStyle = "rgba(255,255,255,.78)";
      ctx.font = "800 17px Consolas, monospace";
      ctx.fillText(`${bpm} BPM`, cx, cy + (cfg.showLabel ? 62 : 42));
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
    const fontWeight = s.fontWeight || "800";
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
  function syncMedia(t) {
    if (state.video) {
      const local = videoLocalTime(t);
      const active = local >= 0 && local <= trimDuration();
      const want = state.trim.start + clamp(local, 0, trimDuration());
      if (Math.abs(el.video.currentTime - want) > 0.12) {
        try { el.video.currentTime = want; } catch (_) {}
      }
      if (state.playing && active && el.video.paused) el.video.play().catch(() => {});
      if ((!active || !state.playing) && !el.video.paused) el.video.pause();
    }
    if (state.audio) {
      const local = audioLocalTime(t);
      const active = local >= 0 && local <= state.audio.duration;
      const want = clamp(local, 0, state.audio.duration);
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
    refs.raf = requestAnimationFrame(loop);
  }

  async function loadVideo(file, trackId) {
    refs.videoBlob = file;
    const url = URL.createObjectURL(file);
    el.video.src = url;
    await new Promise((resolve) => { el.video.onloadedmetadata = resolve; });
    state.videoTrackId = trackId || activeMediaTrackId("video");
    state.video = { name: file.name, url, duration: el.video.duration || 0, thumbs: [] };
    state.trim = { start: 0, end: state.video.duration };
    state.videoOffset = 0;
    state.time = 0;
    state.selected = state.videoTrackId;
    setStatus(`Loaded video "${file.name}" on ${state.tracks.find((track) => track.id === state.videoTrackId)?.label || "Video"}.`);
    refresh();
    try {
      setStatus(`Generating thumbnails for "${file.name}"...`);
      state.video.thumbs = await captureVideoThumbnails(url, state.video.duration);
      setStatus(`Loaded video "${file.name}" with ${state.video.thumbs.length} timeline thumbnails.`);
      refresh();
    } catch (_) {
      setStatus(`Loaded video "${file.name}". Thumbnail generation was skipped.`);
    }
  }
  async function loadAudio(file, detect, trackId) {
    setStatus("Decoding audio...");
    const buffer = await decodeAudio(file);
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
    state.audioTrackId = trackId || activeMediaTrackId("audio");
    state.audio = { name: file.name, url, duration: buffer.duration, peaks };
    state.audioOffset = 0;
    state.selected = state.audioTrackId;
    if (detect) {
      state.bpmSections = detectBPMSections(buffer);
      if (state.bpmSections.length) {
        const total = state.bpmSections.reduce((sum, section) => sum + section.bpm * Math.max(0.001, section.end - section.start), 0);
        const len = state.bpmSections.reduce((sum, section) => sum + Math.max(0.001, section.end - section.start), 0);
        state.bpm = Math.round(total / len);
      } else {
        state.bpm = detectBPM(buffer);
      }
      el.bpmInput.value = String(state.bpm);
      setStatus(`Loaded audio "${file.name}" on ${state.tracks.find((track) => track.id === state.audioTrackId)?.label || "Audio"}. Detected about ${state.bpm} BPM across ${Math.max(1, state.bpmSections.length)} section(s).`);
    } else {
      setStatus(`Loaded audio "${file.name}" on ${state.tracks.find((track) => track.id === state.audioTrackId)?.label || "Audio"}.`);
    }
    refresh();
  }
  function addSubtitle() {
    const id = `s${Date.now()}`;
    const start = state.time;
    const end = start + 3;
    state.subs.push(normalizeSubtitle({ id, type: "text", text: "New subtitle", start, end, trackId: activeOverlayTrackId(), x: 0.5, y: 0.74, size: 56, color: "#ffffff", background: true }));
    state.selected = id;
    state.time = start;
    syncMedia(state.time);
    refresh();
  }
  function addLogo(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const id = `s${Date.now()}`;
      const start = state.time;
      state.subs.push(normalizeSubtitle({ id, type: "logo", text: file.name, start, end: start + 6, trackId: activeOverlayTrackId(), x: 0.5, y: 0.18, size: 0.22, color: "#fff", url, img, blob: file }));
      state.selected = id;
      state.time = start;
      syncMedia(state.time);
      refresh();
    };
    img.src = url;
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
      el.inspector.innerHTML = `
        <div class="section"><h3>Video Track</h3></div>
        ${selectedTrack.locked ? "" : textRow("Name", "track.label", selectedTrack.label)}
        ${checkboxRow("Mute clip audio", "videoAudio.muted", state.videoAudio.muted)}
        ${slider("Clip audio volume","videoAudio.volume",state.videoAudio.volume,0,1,.01,"%")}
        ${numberRow("Timeline start","videoOffset",state.videoOffset,0,999,.1)}
        <div class="stats">
          <div><span>Source</span><b>${state.video ? state.video.name : "-"}</b></div>
          <div><span>Trim</span><b>${fmtTC(state.trim.start, false)} - ${fmtTC(state.trim.end, false)}</b></div>
        </div>
        ${selectedTrack.locked ? "" : `<button class="danger" id="deleteTrackBtn">Remove Track</button>`}
      `;
    } else if (selectedTrack && selectedTrack.type === "audio") {
      el.inspector.innerHTML = `
        <div class="section"><h3>Music Track</h3></div>
        ${selectedTrack.locked ? "" : textRow("Name", "track.label", selectedTrack.label)}
        ${checkboxRow("Mute music", "musicAudio.muted", state.musicAudio.muted)}
        ${slider("Music volume","musicAudio.volume",state.musicAudio.volume,0,1,.01,"%")}
        ${numberRow("Timeline start","audioOffset",state.audioOffset,0,999,.1)}
        <div class="stats">
          <div><span>Source</span><b>${state.audio ? state.audio.name : "-"}</b></div>
          <div><span>Duration</span><b>${state.audio ? fmtTC(state.audio.duration, false) : "-"}</b></div>
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
    } else if (selected === "bpm") {
      const currentBpm = currentBpmAt(state.time);
      const currentLevel = currentBpm ? bpmLevelFor(currentBpm) : null;
      const currentSection = bpmSectionAt(state.time);
      el.inspector.innerHTML = `
        <div class="section"><h3>Track E BPM</h3></div>
        ${numberRow("Tempo","bpm",state.bpm || "",40,240,.1)}
        ${checkboxRow("Show icon", "bpmOv.showIcon", state.bpmOv.showIcon)}
        ${checkboxRow("Show label", "bpmOv.showLabel", state.bpmOv.showLabel)}
        ${checkboxRow("Show BPM number", "bpmOv.showNumber", state.bpmOv.showNumber)}
        ${slider("Beat offset","bpmOv.offset",state.bpmOv.offset,-1,1,.01,"s")}
        ${slider("Position X","bpmOv.x",state.bpmOv.x,0,1,.01,"%")}
        ${slider("Position Y","bpmOv.y",state.bpmOv.y,0,1,.01,"%")}
        <div class="stats">
          <div><span>Current section</span><b>${currentSection ? `${fmtTC(currentSection.start, false)} - ${fmtTC(currentSection.end, false)}` : "-"}</b></div>
          <div><span>Current BPM</span><b>${currentBpm ? `${currentBpm} ${currentLevel.label}` : "-"}</b></div>
          <div><span>Detected sections</span><b>${state.bpmSections && state.bpmSections.length ? state.bpmSections.length : "-"}</b></div>
          <div><span>Active preset</span><b>${currentLevel ? BPM_IMAGE_PRESETS.color[currentLevel.id] : "-"}</b></div>
        </div>
        ${swatches("bpmOv.color", state.bpmOv.color)}
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
        <div class="stats">
          <div><span>Video</span><b>${state.video ? state.video.name : "-"}</b></div>
          <div><span>Audio</span><b>${state.audio ? state.audio.name : "-"}</b></div>
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
    } else {
      const parts = path.split(".");
      if (parts.length === 1) state[parts[0]] = value;
      else state[parts[0]][parts[1]] = value;
    }
  }

  function renderTimeline() {
    const dur = duration() || 30;
    const width = Math.max(el.timelineScroll.clientWidth, dur * state.pxPerSec + 60);
    const height = 27 + state.tracks.length * 44;
    el.timelineInner.style.width = `${width}px`;
    el.timelineInner.style.height = `${height}px`;
    el.laneLabels.innerHTML = `<div class="ruler-gap"></div>`;
    state.tracks.forEach((track, index) => {
      const row = document.createElement("div");
      const selectedSub = state.subs.find((sub) => sub.id === state.selected);
      row.className = (selectedSub && selectedSub.trackId === track.id) || state.selected === track.id ? "selected" : "";
      row.dataset.track = track.id;
      row.innerHTML = `<b style="background:${track.color}">${codeForTrack(index)}</b><span>${escapeHtml(track.label)}</span>${track.locked ? "" : `<button class="remove-track" data-remove-track="${track.id}" title="Remove track">x</button>`}`;
      el.laneLabels.appendChild(row);
    });
    el.laneLabels.innerHTML = `<div class="lane-labels-content">${el.laneLabels.innerHTML}</div>`;
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
      lane.className = `lane ${track.type === "overlay" ? "subs-lane" : ""} ${track.type === "bpm" ? "bpm-lane" : ""}`;
      lane.dataset.track = track.id;
      el.timelineInner.appendChild(lane);

      if (track.type === "video" && state.video && track.id === state.videoTrackId) {
        const b = block("video-block", state.video.name, state.videoOffset, trimDuration());
        b.dataset.media = "video";
        b.insertAdjacentHTML("afterbegin", videoThumbStrip());
        b.innerHTML += `<span class="handle left" data-trim="start"></span><span class="handle right" data-trim="end"></span>`;
        lane.appendChild(b);
      } else if (track.type === "video") {
        lane.appendChild(block("empty-block", "Empty video track", 0, 4));
      } else if (track.type === "audio" && state.audio && track.id === state.audioTrackId) {
        const b = block("audio-block", `<canvas></canvas><span>${escapeHtml(state.audio.name)}</span>`, state.audioOffset, state.audio.duration, true);
        b.dataset.media = "audio";
        lane.appendChild(b);
        refs.waveCanvas = b.querySelector("canvas");
        drawWaveform();
      } else if (track.type === "audio") {
        lane.appendChild(block("empty-block", "Empty audio track", 0, 4));
      } else if (track.type === "viz" && state.audio && state.viz.enabled) {
        const b = block(`viz-block ${state.selected === "viz" ? "selected" : ""}`, `${vizMini()}<span>${state.viz.style} spectrum</span>`, state.audioOffset, state.audio.duration, true);
        b.dataset.select = "viz";
        lane.appendChild(b);
      } else if (track.type === "overlay") {
        state.subs.filter((s) => (s.trackId || "overlay-1") === track.id).forEach((s) => {
          const cls = `${s.type === "logo" ? "logo-block" : "sub-block"} ${state.selected === s.id ? "selected" : ""}`;
          const b = block(cls, overlayBlockContent(s), s.start, Math.max(0.2, s.end - s.start), true);
          b.dataset.sub = s.id;
          b.innerHTML += `<span class="handle left" data-sub-resize="${s.id}:start"></span><span class="handle right" data-sub-resize="${s.id}:end"></span>`;
          lane.appendChild(b);
        });
      } else if (track.type === "bpm") {
        renderBpmLane(lane);
      }
    });
  }
  function block(cls, content, start, len, raw) {
    const div = document.createElement("div");
    div.className = `block ${cls}`;
    div.style.left = `${start * state.pxPerSec}px`;
    div.style.width = `${Math.max(24, len * state.pxPerSec)}px`;
    div.innerHTML = raw ? content : `<span>${escapeHtml(content)}</span>`;
    return div;
  }
  function videoThumbStrip() {
    if (!state.video || !state.video.thumbs || !state.video.thumbs.length || trimDuration() <= 0) return "";
    const imgs = state.video.thumbs
      .filter((thumb) => thumb.time >= state.trim.start && thumb.time <= state.trim.end)
      .map((thumb) => {
        const left = ((thumb.time - state.trim.start) / trimDuration()) * 100;
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
  function drawWaveform() {
    if (!refs.waveCanvas || !state.audio) return;
    const w = Math.max(10, Math.floor(state.audio.duration * state.pxPerSec));
    refs.waveCanvas.width = w;
    refs.waveCanvas.height = 40;
    const wctx = refs.waveCanvas.getContext("2d");
    const { mins, maxs } = state.audio.peaks;
    wctx.clearRect(0, 0, w, 40);
    wctx.fillStyle = "rgba(45,212,191,.9)";
    for (let x = 0; x < w; x++) {
      const i = Math.floor(x / w * (maxs.length - 1));
      const top = 20 - maxs[i] * 18;
      const bot = 20 - mins[i] * 18;
      wctx.fillRect(x, top, 1, Math.max(1, bot - top));
    }
  }
  function renderBpmLane(lane) {
    lane.innerHTML = "";
    const sections = (state.bpmSections && state.bpmSections.length)
      ? state.bpmSections
      : (state.bpm > 0 ? [{ start: 0, end: state.audio ? state.audio.duration : duration(), bpm: state.bpm }] : []);
    sections.forEach((section) => {
      if (!section.bpm || section.bpm <= 0) return;
      const start = state.audioOffset + section.start;
      const end = state.audioOffset + section.end;
      const level = bpmLevelFor(section.bpm);
      const sec = document.createElement("span");
      sec.className = `bpm-section bpm-${level.id}`;
      sec.style.left = `${start * state.pxPerSec}px`;
      sec.style.width = `${Math.max(8, (end - start) * state.pxPerSec)}px`;
      sec.textContent = `${level.label} ${section.bpm}`;
      lane.appendChild(sec);
      const beat = 60 / section.bpm;
      for (let t = start + state.bpmOv.offset; t <= end; t += beat) {
        if (t < 0) continue;
        const line = document.createElement("span");
        line.className = "beat-line";
        line.style.left = `${t * state.pxPerSec}px`;
        lane.appendChild(line);
      }
    });
    if (sections.length) {
      const tag = document.createElement("span");
      tag.className = "bpm-tag";
      tag.textContent = sections.length > 1 ? `${sections.length} BPM sections` : `${sections[0].bpm} BPM - ${(60 / sections[0].bpm).toFixed(2)}s/beat`;
      lane.appendChild(tag);
    }
  }
  function renderProjects() {
    el.projectList.innerHTML = state.projects.length ? "" : `<div class="project-card"><span class="empty-thumb"></span><div><b>No saved projects</b><small>Use Save after editing.</small></div></div>`;
    state.projects.forEach((p) => {
      const card = document.createElement("div");
      card.className = `project-card ${p.id === state.id ? "active" : ""}`;
      card.dataset.project = p.id;
      card.innerHTML = `${p.thumb ? `<img src="${p.thumb}" alt="">` : `<span class="empty-thumb"></span>`}<div><b>${escapeHtml(p.name)}</b><small>${new Date(p.updatedAt).toLocaleString()}</small></div>`;
      el.projectList.appendChild(card);
    });
  }
  function syncLaneLabelScroll() {
    const content = el.laneLabels.querySelector(".lane-labels-content");
    if (content) content.style.transform = `translateY(${-el.timelineScroll.scrollTop}px)`;
  }
  function refresh(options) {
    options = options || {};
    state.name = el.projectName.value || "Untitled";
    fitStageToPreview();
    applyAudioSettings();
    updateClock();
    el.vizBtn.classList.toggle("is-on", state.viz.enabled);
    el.bpmBtn.classList.toggle("is-on", state.bpmOv.enabled);
    if (options.inspector !== false) renderInspector();
    renderTimeline();
    if (options.projects !== false) renderProjects();
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
  function projectRecord(includeBlobs) {
    return {
      version: 1,
      id: state.id || `p${Date.now()}`,
      name: el.projectName.value || "Untitled",
      updatedAt: Date.now(),
      thumb: thumbnail(),
      trim: state.trim,
      videoOffset: state.videoOffset,
      audioOffset: state.audioOffset,
      videoTrackId: state.videoTrackId,
      audioTrackId: state.audioTrackId,
      tracks: state.tracks,
      viz: state.viz,
      bpm: state.bpm,
      bpmSections: state.bpmSections,
      bpmOv: state.bpmOv,
      videoName: state.video && state.video.name,
      audioName: state.audio && state.audio.name,
      videoAudio: state.videoAudio,
      musicAudio: state.musicAudio,
      videoBlob: includeBlobs ? refs.videoBlob : null,
      audioBlob: includeBlobs ? refs.audioBlob : null,
      subtitleFx: state.subtitleFx,
      subs: state.subs.map((s) => {
        const sub = normalizeSubtitle(s);
        return { id: sub.id, type: sub.type, text: sub.text, start: sub.start, end: sub.end, trackId: sub.trackId, x: sub.x, y: sub.y, size: sub.size, color: sub.color, fontFamily: sub.fontFamily, fontWeight: sub.fontWeight, fontStyle: sub.fontStyle, effect: sub.effect, align: sub.align, background: sub.background };
      }),
      logoBlobs: includeBlobs ? Object.fromEntries(state.subs.filter((s) => s.type === "logo" && s.blob).map((s) => [s.id, s.blob])) : {}
    };
  }
  async function saveProject() {
    const rec = projectRecord(true);
    state.id = rec.id;
    await idbTx("readwrite", (s) => s.put(rec));
    if (window.pacekeeper && window.pacekeeper.saveProjectFile) {
      const fileRec = projectRecord(false);
      fileRec.media = {
        video: state.video ? { name: state.video.name } : null,
        audio: state.audio ? { name: state.audio.name } : null
      };
      try { await window.pacekeeper.saveProjectFile(fileRec); } catch (_) {}
    }
    await refreshProjects();
    setStatus(`Saved project "${rec.name}".`);
  }
  async function loadProject(id) {
    stop();
    const rec = await idbTx("readonly", (s) => s.get(id));
    if (!rec) return;
    Object.assign(state, {
      id: rec.id,
      tracks: rec.tracks || defaultTracks(),
      videoTrackId: rec.videoTrackId || "video",
      audioTrackId: rec.audioTrackId || "audio",
      videoAudio: rec.videoAudio || state.videoAudio,
      musicAudio: rec.musicAudio || state.musicAudio,
      viz: rec.viz || state.viz,
      bpm: rec.bpm || 0,
      bpmSections: rec.bpmSections || [],
      bpmOv: { ...state.bpmOv, ...(rec.bpmOv || {}) },
      subtitleFx: rec.subtitleFx || state.subtitleFx,
      trim: rec.trim || { start: 0, end: 0 },
      videoOffset: rec.videoOffset ?? 0,
      audioOffset: rec.audioOffset ?? 0,
      subs: [],
      selected: null,
      time: 0,
      video: null,
      audio: null
    });
    el.projectName.value = rec.name || "Untitled";
    el.bpmInput.value = state.bpm ? String(state.bpm) : "";
    if (rec.audioBlob) {
      await loadAudio(rec.audioBlob, false, state.audioTrackId);
      state.audioOffset = rec.audioOffset ?? state.audioOffset;
    }
    if (rec.videoBlob) {
      await loadVideo(rec.videoBlob, state.videoTrackId);
      state.trim = rec.trim || state.trim;
      state.videoOffset = rec.videoOffset ?? state.videoOffset;
    }
    state.subs = (rec.subs || []).map((s) => {
      const out = normalizeSubtitle(s);
      if (out.type === "logo" && rec.logoBlobs && rec.logoBlobs[out.id]) {
        out.blob = rec.logoBlobs[out.id];
        out.url = URL.createObjectURL(out.blob);
        out.img = new Image();
        out.img.src = out.url;
      }
      return out;
    });
    setStatus(`Loaded project "${rec.name}".`);
    refresh();
  }
  async function loadProjectJsonFile(file) {
    const rec = JSON.parse(await file.text());
    el.projectName.value = rec.name || "Untitled";
    state.id = rec.id || null;
    state.trim = rec.trim || { start: 0, end: 0 };
    state.videoOffset = rec.videoOffset ?? 0;
    state.audioOffset = rec.audioOffset ?? 0;
    state.tracks = rec.tracks || defaultTracks();
    state.videoTrackId = rec.videoTrackId || firstTrackIdOfType("video");
    state.audioTrackId = rec.audioTrackId || firstTrackIdOfType("audio");
    state.videoAudio = rec.videoAudio || state.videoAudio;
    state.musicAudio = rec.musicAudio || state.musicAudio;
    state.viz = rec.viz || state.viz;
    state.bpm = rec.bpm || 0;
    state.bpmSections = rec.bpmSections || [];
    state.bpmOv = { ...state.bpmOv, ...(rec.bpmOv || {}) };
    state.subtitleFx = rec.subtitleFx || state.subtitleFx;
    state.subs = (rec.subs || []).map((sub) => normalizeSubtitle({ ...sub, trackId: sub.trackId || activeOverlayTrackId() }));
    state.selected = null;
    el.bpmInput.value = state.bpm ? String(state.bpm) : "";
    setStatus("Loaded project settings. Re-import media files if this JSON was moved.");
    refresh();
  }

  function startTrimDrag(which, ev) {
    ev.stopPropagation();
    const sourceStart = state.trim.start;
    const sourceEnd = state.trim.end;
    const offsetStart = state.videoOffset;
    const move = (e) => {
      const t = timeFromEvent(e);
      if (which === "start") {
        const newOffset = clamp(t, 0, offsetStart + sourceEnd - sourceStart - 0.1);
        const delta = newOffset - offsetStart;
        state.videoOffset = newOffset;
        state.trim.start = clamp(sourceStart + delta, 0, state.trim.end - 0.1);
      } else {
        state.trim.end = clamp(state.trim.start + Math.max(0.1, t - state.videoOffset), state.trim.start + 0.1, state.video ? state.video.duration : sourceEnd);
      }
      refresh();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function startSubDrag(s, ev) {
    ev.stopPropagation();
    state.selected = s.id;
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
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    refresh();
  }
  function startSubResize(s, edge, ev) {
    ev.stopPropagation();
    state.selected = s.id;
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
  function startMediaDrag(kind, ev) {
    ev.stopPropagation();
    state.selected = kind === "video" ? state.videoTrackId : state.audioTrackId;
    const x0 = ev.clientX;
    const start = kind === "video" ? state.videoOffset : state.audioOffset;
    const move = (e) => {
      const offset = Math.max(0, start + (e.clientX - x0) / state.pxPerSec);
      if (kind === "video") state.videoOffset = offset;
      else state.audioOffset = offset;
      if (state.playing) refs.clock = { t0: state.time, perf0: performance.now() };
      syncMedia(state.time);
      refresh();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    refresh();
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
        state.bpm = bpm;
        state.bpmSections = [];
        el.bpmInput.value = String(bpm);
        refresh();
      }
    }
  }
  async function exportVideo() {
    if (state.exporting) return;
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
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${el.projectName.value || "PaceKeeper"}.webm`;
      a.click();
      state.exporting = false;
      el.export.textContent = "Export";
      setStatus("Preview export complete. Native MP4 export is wired for the desktop FFmpeg phase.");
      refresh();
    };
    state.exporting = true;
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
    $("videoBtn").onclick = () => el.videoInput.click();
    $("audioBtn").onclick = () => el.audioInput.click();
    $("logoBtn").onclick = () => el.logoInput.click();
    $("subtitleBtn").onclick = addSubtitle;
    $("addTrackBtn").onclick = showTrackModal;
    el.trackModalClose.onclick = hideTrackModal;
    el.trackModal.addEventListener("click", (e) => {
      if (e.target === el.trackModal) hideTrackModal();
      const type = e.target.closest("[data-add-track-type]") && e.target.closest("[data-add-track-type]").dataset.addTrackType;
      if (!type) return;
      const id = addTrack(type);
      if (id) {
        state.selected = id;
        setStatus(`Added a new ${type} track.`);
        hideTrackModal();
        refresh();
      }
    });
    $("newProjectBtn").onclick = () => {
      stop();
      state.id = null; state.video = null; state.audio = null; state.tracks = defaultTracks(); state.videoTrackId = "video"; state.audioTrackId = "audio"; state.videoOffset = 0; state.audioOffset = 0; state.videoAudio = { muted: true, volume: 0.8 }; state.musicAudio = { muted: false, volume: 1 }; state.subtitleFx = { effect: "none", shadow: true, background: false, align: "center" }; state.subs = []; state.selected = null; state.bpm = 0; state.bpmSections = []; state.time = 0; state.trim = { start: 0, end: 0 };
      refs.videoBlob = null; refs.audioBlob = null; el.video.removeAttribute("src"); el.audio.removeAttribute("src"); el.projectName.value = "Untitled";
      setStatus("New project.");
      refresh();
    };
    $("saveProjectBtn").onclick = saveProject;
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
    el.videoInput.onchange = (e) => e.target.files[0] && loadVideo(e.target.files[0], activeMediaTrackId("video"));
    el.audioInput.onchange = (e) => e.target.files[0] && loadAudio(e.target.files[0], true, activeMediaTrackId("audio"));
    el.logoInput.onchange = (e) => e.target.files[0] && addLogo(e.target.files[0]);
    el.projectInput.onchange = (e) => e.target.files[0] && loadProjectJsonFile(e.target.files[0]);
    $("rewindBtn").onclick = () => seek(0);
    $("forwardBtn").onclick = () => seek(duration());
    $("stopBtn").onclick = stop;
    el.play.onclick = () => state.playing ? pause() : play();
    el.export.onclick = exportVideo;
    el.vizBtn.onclick = () => { state.viz.enabled = !state.viz.enabled; state.selected = "viz"; refresh(); };
    el.bpmBtn.onclick = () => { state.bpmOv.enabled = !state.bpmOv.enabled; state.selected = "bpm"; refresh(); };
    $("tapBtn").onclick = tapBpm;
    el.bpmInput.oninput = (e) => { state.bpm = parseFloat(e.target.value) || 0; state.bpmSections = []; refresh(); };
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
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.timelineScroll.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    el.timelineScroll.addEventListener("scroll", () => {
      syncLaneLabelScroll();
    });
    document.addEventListener("pointerdown", (e) => {
      const trim = e.target.dataset.trim;
      if (trim) { startTrimDrag(trim, e); return; }
      const subResize = e.target.dataset.subResize;
      if (subResize) {
        const [id, edge] = subResize.split(":");
        const sub = state.subs.find((s) => s.id === id);
        if (sub) startSubResize(sub, edge, e);
        return;
      }
      const media = e.target.closest(".block") && e.target.closest(".block").dataset.media;
      if (media) { startMediaDrag(media, e); return; }
      const subId = e.target.closest(".block") && e.target.closest(".block").dataset.sub;
      if (subId) {
        const sub = state.subs.find((s) => s.id === subId);
        if (sub) {
          if (!state.playing && (state.time < sub.start || state.time > sub.end)) seekIntoSubtitle(sub);
          startSubDrag(sub, e);
        }
      }
      const sel = e.target.closest(".block") && e.target.closest(".block").dataset.select;
      if (sel) { state.selected = sel; refresh(); }
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
      if (track && track.type === "bpm") state.selected = "bpm";
      else if (track && track.type === "viz") state.selected = "viz";
      else if (track && track.type === "overlay") state.selected = track.id;
      else if (track) state.selected = track.id;
      refresh();
    });
    el.inspector.addEventListener("input", (e) => {
      const path = e.target.dataset.bind;
      if (!path) return;
      const isText = e.target.tagName === "TEXTAREA";
      const isCheck = e.target.type === "checkbox";
      const isString = isText || e.target.tagName === "SELECT" || path.endsWith(".text") || path.endsWith(".color") || path.endsWith(".trackId") || path.endsWith(".effect") || path.endsWith(".align");
      setPath(path, isCheck ? e.target.checked : isString ? e.target.value : parseFloat(e.target.value) || 0);
      updateInspectorValue(path, isCheck ? e.target.checked : isString ? e.target.value : parseFloat(e.target.value) || 0);
      refresh({ inspector: false, projects: false });
    });
    el.inspector.addEventListener("click", (e) => {
      const style = e.target.dataset.vizStyle;
      if (style) { state.viz.style = style; refresh(); }
      const subEffect = e.target.dataset.subEffect;
      if (subEffect) { state.subtitleFx.effect = subEffect; refresh(); }
      const subStyleButton = e.target.closest("[data-sub-style]");
      const subStyle = subStyleButton ? subStyleButton.dataset.subStyle : "";
      if (subStyle) {
        const [key, value] = subStyle.split(":");
        const sub = state.subs.find((s) => s.id === state.selected);
        if (sub) {
          if (key === "fontStyle") sub.fontStyle = sub.fontStyle === value ? "normal" : value;
          else sub[key] = value;
          Object.assign(sub, normalizeSubtitle(sub));
          refresh();
        }
      }
      const swatch = e.target.dataset.swatch;
      if (swatch) {
        const idx = swatch.indexOf(":");
        setPath(swatch.slice(0, idx), swatch.slice(idx + 1));
        updateInspectorValue(swatch.slice(0, idx), swatch.slice(idx + 1));
        refresh({ inspector: false, projects: false });
      }
      const colorPick = e.target.dataset.colorPick;
      if (colorPick) {
        const input = el.inspector.querySelector(`input[data-color-input="${colorPick}"]`);
        if (input) input.click();
      }
      if (e.target.id === "deleteSubBtn") {
        state.subs = state.subs.filter((s) => s.id !== state.selected);
        state.selected = null;
        refresh();
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
    el.projectList.onclick = (e) => {
      const card = e.target.closest("[data-project]");
      if (card) loadProject(card.dataset.project);
    };
    document.addEventListener("keydown", (e) => {
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
}());
