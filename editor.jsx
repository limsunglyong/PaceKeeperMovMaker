/* ============================================================
   editor.jsx — VideoEditor (single component)
   Hooks: useState / useRef / useEffect. Web Audio + IndexedDB only.
   Presentational pieces come from ui.jsx via window.
   ============================================================ */
const { useState, useRef, useEffect } = React;
const { TIcon, LedClock, Row, Slider, Swatches, VizStylePicker, ProjectsRail } = window;

const CW = 1280;
const CH = 720;
const FFT = 512;

const DEFAULT_VIZ = { enabled: true, style: "bars", x: 0.5, y: 0.78, scale: 0.85, opacity: 0.92, color: "#2dd4bf" };
const DEFAULT_BPMOV = { enabled: true, x: 0.88, y: 0.13, color: "#ff4d5e", offset: 0 };

function VideoEditor() {
  /* ---------------- tracks ---------------- */
  const [video, setVideo] = useState(null);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [audio, setAudio] = useState(null);
  const [viz, setViz] = useState(DEFAULT_VIZ);
  const [bpm, setBpm] = useState(0);
  const [bpmOv, setBpmOv] = useState(DEFAULT_BPMOV);
  const [subs, setSubs] = useState([]);
  const [selected, setSelected] = useState(null);

  /* ---------------- transport ---------------- */
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(48);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("New project — import a background video and an MP3 to begin.");

  /* ---------------- projects ---------------- */
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Untitled");

  /* ---------------- refs ---------------- */
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const audioElRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const srcRef = useRef(null);
  const freqRef = useRef(new Uint8Array(FFT / 2));
  const destRef = useRef(null);
  const recRef = useRef(null);
  const rafRef = useRef(0);
  const clockRef = useRef({ t0: 0, perf0: 0 });
  const liveRef = useRef({});
  const exportingRef = useRef(false);
  const playingRef = useRef(false);
  const tapRef = useRef([]);
  const pxRef = useRef(48);
  const videoFileRef = useRef(null);
  const audioFileRef = useRef(null);
  const vidInRef = useRef(null);
  const audInRef = useRef(null);
  const logoInRef = useRef(null);
  const laneAreaRef = useRef(null);
  const waveRef = useRef(null);

  /* ---------------- derived ---------------- */
  const trimDur = Math.max(0, trim.end - trim.start);
  const duration = Math.max(trimDur, audio ? audio.duration : 0);
  const beatInt = bpm > 0 ? 60 / bpm : 0;

  /* ============================================================ AUDIO GRAPH */
  function ensureCtx() {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  /* ============================================================ MEDIA LOAD */
  function loadVideo(blob, name, presetTrim) {
    const url = URL.createObjectURL(blob);
    videoFileRef.current = blob;
    const v = videoRef.current;
    v.src = url;
    v.muted = true;
    v.onloadedmetadata = () => {
      const d = v.duration || 0;
      setVideo({ name, url, duration: d });
      const tr = presetTrim || { start: 0, end: d };
      setTrim(tr);
      try { v.currentTime = tr.start; } catch (e) {}
      setStatus(`Loaded video "${name}" (${fmtTC(d, false)})`);
    };
  }
  async function loadAudio(blob, name, detect) {
    const ctx = ensureCtx();
    setStatus("Decoding audio…");
    try {
      const buf = await decodeAudioFile(blob, ctx);
      const peaks = buildPeaks(buf, 2000);
      const url = URL.createObjectURL(blob);
      audioFileRef.current = blob;
      const a = audioElRef.current;
      a.src = url;
      if (!srcRef.current) {
        srcRef.current = ctx.createMediaElementSource(a);
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = FFT;
        analyserRef.current.smoothingTimeConstant = 0.8;
        srcRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      }
      setAudio({ name, url, duration: buf.duration, peaks });
      if (detect) {
        const det = detectBPM(buf);
        setBpm(det);
        setStatus(`Loaded audio "${name}". Detected ~${det} BPM.`);
      } else {
        setStatus(`Loaded audio "${name}".`);
      }
    } catch (e) {
      setStatus("Could not decode that audio file.");
    }
  }
  function importLogo(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const id = "s" + Date.now();
      setSubs((p) => [...p, {
        id, type: "logo", text: file.name, url, _img: img, _blob: file,
        start: Math.max(0, time), end: Math.min(duration || time + 6, time + 6),
        lane: 2, x: 0.5, y: 0.18, size: 0.22, color: "#ffffff",
      }]);
      setSelected(id);
    };
    img.src = url;
  }

  /* ============================================================ SUBTITLE OPS */
  function addText() {
    const id = "s" + Date.now();
    setSubs((p) => [...p, {
      id, type: "text", text: "New subtitle",
      start: Math.max(0, time), end: duration ? Math.min(duration, time + 3) : time + 3,
      lane: 0, x: 0.5, y: 0.86, size: 52, color: "#ffffff",
    }]);
    setSelected(id);
  }
  function updateSub(id, patch) { setSubs((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))); }
  function delSub(id) { setSubs((p) => p.filter((s) => s.id !== id)); if (selected === id) setSelected(null); }

  /* ============================================================ BPM TAP */
  function tap() {
    const now = performance.now();
    const arr = tapRef.current.filter((t) => now - t < 2500);
    arr.push(now);
    tapRef.current = arr;
    if (arr.length >= 2) {
      let sum = 0;
      for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1];
      const b = Math.round(60000 / (sum / (arr.length - 1)));
      if (b >= 40 && b <= 240) setBpm(b);
    }
  }

  /* ============================================================ TRANSPORT */
  function syncMedia(T) {
    const v = videoRef.current;
    if (video && v) {
      const want = trim.start + Math.min(T, trimDur);
      if (Math.abs(v.currentTime - want) > 0.12) { try { v.currentTime = want; } catch (e) {} }
    }
    const a = audioElRef.current;
    if (audio && a && Math.abs(a.currentTime - T) > 0.12) { try { a.currentTime = T; } catch (e) {} }
  }
  function play() {
    if (playingRef.current) return;
    if (duration <= 0) { setStatus("Nothing to play yet — import media first."); return; }
    ensureCtx();
    let T = time;
    if (T >= duration - 0.02) T = 0;
    clockRef.current = { t0: T, perf0: performance.now() };
    setPlaying(true);
    playingRef.current = true;
    const v = videoRef.current;
    if (video && v) { v.currentTime = trim.start + Math.min(T, trimDur); if (T < trimDur) v.play().catch(() => {}); }
    const a = audioElRef.current;
    if (audio && a) { a.currentTime = T; a.play().catch(() => {}); }
    loop();
  }
  function pause() {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current; if (v) v.pause();
    const a = audioElRef.current; if (a) a.pause();
  }
  function stop() { pause(); seek(0); }
  function loop() {
    const c = clockRef.current;
    let T = c.t0 + (performance.now() - c.perf0) / 1000;
    if (T >= duration) {
      T = duration; setTime(T); renderFrame(T);
      if (exportingRef.current && recRef.current) { try { recRef.current.stop(); } catch (e) {} }
      pause(); return;
    }
    setTime(T);
    const v = videoRef.current;
    if (video && v && T > trimDur && !v.paused) v.pause();
    renderFrame(T);
    rafRef.current = requestAnimationFrame(loop);
  }
  function seek(T) {
    T = Math.max(0, Math.min(duration || 0, T));
    setTime(T);
    if (playingRef.current) clockRef.current = { t0: T, perf0: performance.now() };
    syncMedia(T);
    requestAnimationFrame(() => renderFrame(T));
  }

  /* ============================================================ RENDER FRAME */
  function staticSpectrum(T, out, L) {
    let amp = 0.25;
    if (L.peaks && L.audioDur > 0) {
      const i = Math.floor((T / L.audioDur) * (L.peaks.maxs.length - 1));
      amp = Math.min(1, Math.abs(L.peaks.maxs[Math.max(0, i)] || 0) * 1.4 + 0.12);
    }
    const n = out.length;
    for (let i = 0; i < n; i++) {
      const fall = Math.pow(1 - i / n, 0.7);
      const wob = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.27 + T * 1.5));
      out[i] = Math.min(255, amp * 255 * fall * wob);
    }
  }
  function renderFrame(T) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = CW, H = CH;
    const L = liveRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);
    const v = videoRef.current;
    if (L.hasVideo && v && v.readyState >= 2) drawCover(ctx, v, W, H);
    else {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.font = "500 24px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TRACK A — background video", W / 2, H / 2);
      ctx.restore();
    }
    if (L.viz.enabled && L.hasAudio) {
      const data = freqRef.current;
      if (L.playing && analyserRef.current) analyserRef.current.getByteFrequencyData(data);
      else staticSpectrum(T, data, L);
      drawViz(ctx, W, H, data, L.viz);
    }
    if (L.bpmOv.enabled && L.bpm > 0) drawBpm(ctx, W, H, T, L.bpm, L.bpmOv);
    for (const s of L.subs) if (T >= s.start && T <= s.end) drawSub(ctx, W, H, s);
  }
  function drawViz(ctx, W, H, data, cfg) {
    ctx.save();
    ctx.globalAlpha = cfg.opacity;
    ctx.fillStyle = cfg.color;
    ctx.strokeStyle = cfg.color;
    const cx = cfg.x * W;
    const cy = cfg.y * H;
    const n = data.length;
    const fieldW = cfg.scale * W;
    const x0 = cx - fieldW / 2;
    const maxH = 0.3 * H * (cfg.scale * 0.4 + 0.7);
    if (cfg.style === "bars") {
      const bars = 64, bw = fieldW / bars;
      for (let i = 0; i < bars; i++) {
        const val = data[Math.floor((i / bars) * n)] / 255;
        const h = Math.max(2, val * maxH);
        const x = x0 + i * bw;
        ctx.fillRect(x, cy - h, bw * 0.66, h);
        ctx.globalAlpha = cfg.opacity * 0.35;
        ctx.fillRect(x, cy + 2, bw * 0.66, h * 0.45);
        ctx.globalAlpha = cfg.opacity;
      }
    } else if (cfg.style === "mirror") {
      const bars = 56, bw = fieldW / bars;
      for (let i = 0; i < bars; i++) {
        const val = data[Math.floor((i / bars) * n)] / 255;
        const h = Math.max(2, val * maxH * 0.6);
        const x = x0 + i * bw;
        ctx.fillRect(x, cy - h, bw * 0.62, h * 2);
      }
    } else if (cfg.style === "wave") {
      const pts = 96;
      ctx.lineWidth = Math.max(2, fieldW * 0.005);
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const val = data[Math.floor((i / pts) * n)] / 255;
        const x = x0 + (i / pts) * fieldW;
        const y = cy - val * maxH * 0.9 + maxH * 0.1;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = cfg.opacity * 0.18;
      ctx.lineTo(x0 + fieldW, cy + 2);
      ctx.lineTo(x0, cy + 2);
      ctx.closePath();
      ctx.fill();
    } else if (cfg.style === "dots") {
      const dots = 40;
      for (let i = 0; i < dots; i++) {
        const val = data[Math.floor((i / dots) * n)] / 255;
        const x = x0 + ((i + 0.5) / dots) * fieldW;
        const r = 2 + val * 24 * (cfg.scale * 0.6 + 0.5);
        ctx.beginPath();
        ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // circle
      const R = cfg.scale * 0.17 * Math.min(W, H);
      const bars = 84;
      ctx.lineWidth = Math.max(2, R * 0.05);
      for (let i = 0; i < bars; i++) {
        const val = data[Math.floor((i / bars) * n)] / 255;
        const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const r2 = R + val * R * 1.1 + 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawBpm(ctx, W, H, T, bpmVal, cfg) {
    const interval = 60 / bpmVal;
    const phase = ((T - cfg.offset) % interval + interval) % interval;
    const pulse = Math.max(0, 1 - (phase / interval) * 3.2);
    const cx = cfg.x * W, cy = cfg.y * H;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const r = 13 + pulse * 16;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = cfg.color;
    ctx.beginPath(); ctx.arc(cx - 72, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.22 + pulse * 0.35;
    ctx.beginPath(); ctx.arc(cx - 72, cy, r + 10 + pulse * 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "800 46px ui-monospace, monospace";
    ctx.fillText(String(bpmVal), cx + 4, cy - 2);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "700 16px ui-monospace, monospace";
    ctx.fillText("BPM", cx + 4, cy + 26);
    ctx.restore();
  }
  function drawSub(ctx, W, H, s) {
    ctx.save();
    if (s.type === "logo" && s._img && s._img.complete) {
      const iw = s.size * W;
      const ih = (s._img.height / s._img.width) * iw;
      ctx.drawImage(s._img, s.x * W - iw / 2, s.y * H - ih / 2, iw, ih);
    } else {
      const size = s.size;
      ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = wrapText(ctx, s.text, W * 0.8);
      const lh = size * 1.18;
      let y = s.y * H - ((lines.length - 1) * lh) / 2;
      for (const ln of lines) {
        ctx.lineWidth = size * 0.14;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(ln, s.x * W, y);
        ctx.fillStyle = s.color;
        ctx.fillText(ln, s.x * W, y);
        y += lh;
      }
    }
    ctx.restore();
  }

  /* ============================================================ EXPORT */
  function doExport() {
    if (exportingRef.current) return;
    if (duration <= 0) { setStatus("Import media before exporting."); return; }
    if (typeof MediaRecorder === "undefined") { setStatus("MediaRecorder not supported here."); return; }
    ensureCtx();
    const canvas = canvasRef.current;
    let stream;
    try { stream = canvas.captureStream(30); } catch (e) { setStatus("captureStream not supported."); return; }
    if (audio) {
      if (!destRef.current) { destRef.current = ctxRef.current.createMediaStreamDestination(); analyserRef.current.connect(destRef.current); }
      destRef.current.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
    let rec;
    try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }); }
    catch (e) { setStatus("Could not start recorder."); return; }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (projectName || "PaceKeeper") + ".webm";
      document.body.appendChild(a); a.click(); a.remove();
      exportingRef.current = false; setExporting(false);
      setStatus("Export complete — downloaded " + (projectName || "PaceKeeper") + ".webm");
    };
    recRef.current = rec; exportingRef.current = true; setExporting(true);
    setStatus("Exporting… recording timeline in real time.");
    seek(0);
    setTimeout(() => { rec.start(100); play(); }, 140);
  }

  /* ============================================================ PROJECTS */
  async function refreshProjects() {
    try {
      const all = await idbAll();
      setProjects(all.map((r) => ({ id: r.id, name: r.name, thumb: r.thumb, updatedAt: r.updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {}
  }
  async function saveProject() {
    try {
      const thumb = makeThumb(canvasRef.current, 256);
      const id = currentProjectId || "p" + Date.now();
      const rec = {
        id, name: projectName || "Untitled", updatedAt: Date.now(), thumb,
        videoBlob: videoFileRef.current || null, audioBlob: audioFileRef.current || null,
        videoName: video ? video.name : null, audioName: audio ? audio.name : null,
        trim, bpm, viz, bpmOv,
        subs: subs.map((s) => { const o = { ...s }; delete o._img; delete o._blob; delete o.url; return o; }),
        logoBlobs: {},
      };
      subs.forEach((s) => { if (s.type === "logo" && s._blob) rec.logoBlobs[s.id] = s._blob; });
      await idbPut(rec);
      setCurrentProjectId(id);
      await refreshProjects();
      setStatus(`Saved project "${rec.name}".`);
    } catch (e) { setStatus("Save failed: " + e.message); }
  }
  async function loadProject(id) {
    try {
      pause();
      const rec = await idbGet(id);
      if (!rec) return;
      setProjectName(rec.name);
      setCurrentProjectId(id);
      setBpm(rec.bpm || 0);
      setViz(rec.viz || DEFAULT_VIZ);
      setBpmOv(rec.bpmOv || DEFAULT_BPMOV);
      setSelected(null);
      const subs2 = (rec.subs || []).map((s) => {
        const o = { ...s };
        if (o.type === "logo" && rec.logoBlobs && rec.logoBlobs[o.id]) {
          const url = URL.createObjectURL(rec.logoBlobs[o.id]);
          const img = new Image(); img.src = url;
          o._img = img; o.url = url; o._blob = rec.logoBlobs[o.id];
        }
        return o;
      });
      setSubs(subs2);
      audioFileRef.current = null; videoFileRef.current = null;
      if (rec.audioBlob) await loadAudio(rec.audioBlob, rec.audioName || "audio", false);
      else { setAudio(null); }
      if (rec.videoBlob) loadVideo(rec.videoBlob, rec.videoName || "video", rec.trim);
      else { setVideo(null); setTrim(rec.trim || { start: 0, end: 0 }); }
      setTime(0);
      setStatus(`Loaded project "${rec.name}".`);
    } catch (e) { setStatus("Load failed: " + e.message); }
  }
  async function deleteProject(id) {
    try { await idbDel(id); if (id === currentProjectId) setCurrentProjectId(null); await refreshProjects(); }
    catch (e) {}
  }
  function newProject() {
    pause();
    setVideo(null); setAudio(null);
    videoFileRef.current = null; audioFileRef.current = null;
    const v = videoRef.current; if (v) v.removeAttribute("src");
    const a = audioElRef.current; if (a) a.removeAttribute("src");
    setTrim({ start: 0, end: 0 }); setSubs([]); setBpm(0);
    setViz(DEFAULT_VIZ); setBpmOv(DEFAULT_BPMOV);
    setTime(0); setSelected(null); setCurrentProjectId(null);
    setProjectName("Untitled " + (projects.length + 1));
    setStatus("New project.");
  }

  /* ============================================================ EFFECTS */
  useEffect(() => {
    liveRef.current = {
      hasVideo: !!video, hasAudio: !!audio,
      audioDur: audio ? audio.duration : 0, peaks: audio ? audio.peaks : null,
      trimStart: trim.start, trimDur, viz, bpm, bpmOv, subs, duration, playing,
    };
    pxRef.current = pxPerSec;
    if (!playingRef.current) renderFrame(time);
  });
  useEffect(() => { refreshProjects(); return () => cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); playingRef.current ? pause() : play(); }
      if (e.code === "Home") { e.preventDefault(); seek(0); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* wheel zoom / pan over timeline (req 4) */
  useEffect(() => {
    const el = laneAreaRef.current;
    if (!el) return;
    function onWheel(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const t = (localX + el.scrollLeft) / pxRef.current;
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        const np = Math.max(6, Math.min(400, pxRef.current * factor));
        pxRef.current = np;
        setPxPerSec(np);
        requestAnimationFrame(() => { el.scrollLeft = t * np - localX; });
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomBtn(factor) {
    const el = laneAreaRef.current;
    const localX = el ? el.clientWidth / 2 : 0;
    const t = el ? (localX + el.scrollLeft) / pxRef.current : 0;
    const np = Math.max(6, Math.min(400, pxRef.current * factor));
    pxRef.current = np; setPxPerSec(np);
    if (el) requestAnimationFrame(() => { el.scrollLeft = t * np - localX; });
  }
  function fitZoom() {
    const el = laneAreaRef.current;
    if (!el) return;
    const d = duration || 30;
    const np = Math.max(6, Math.min(400, (el.clientWidth - 24) / d));
    pxRef.current = np; setPxPerSec(np);
    requestAnimationFrame(() => { el.scrollLeft = 0; });
  }

  /* waveform canvas */
  useEffect(() => {
    const cv = waveRef.current;
    if (!cv || !audio) return;
    const w = Math.max(10, Math.floor(audio.duration * pxPerSec));
    cv.width = w; cv.height = 40;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, w, 40);
    const { mins, maxs } = audio.peaks;
    const mid = 20;
    ctx.fillStyle = "rgba(45,212,191,0.9)";
    for (let x = 0; x < w; x++) {
      const i = Math.floor((x / w) * (maxs.length - 1));
      const top = mid - maxs[i] * 18;
      const bot = mid - mins[i] * 18;
      ctx.fillRect(x, top, 1, Math.max(1, bot - top));
    }
  }, [audio, pxPerSec]);

  /* ============================================================ TIMELINE INTERACTION */
  function timeFromEvent(e) {
    const el = laneAreaRef.current;
    const rect = el.getBoundingClientRect();
    return Math.max(0, (e.clientX - rect.left + el.scrollLeft) / pxPerSec);
  }
  function startTrimDrag(which, e) {
    e.stopPropagation();
    const move = (ev) => {
      const t = timeFromEvent(ev);
      setTrim((p) => which === "start" ? { ...p, start: Math.min(t, p.end - 0.1) } : { ...p, end: Math.max(t, p.start + 0.1) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function startSubDrag(s, e) {
    e.stopPropagation();
    setSelected(s.id);
    const startX = e.clientX, len = s.end - s.start, t0 = s.start;
    const move = (ev) => {
      const ns = Math.max(0, t0 + (ev.clientX - startX) / pxPerSec);
      updateSub(s.id, { start: ns, end: ns + len });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  /* ============================================================ UI DATA */
  const timelineW = Math.max(1, duration || 30) * pxPerSec;
  const selSub = subs.find((s) => s.id === selected);
  const beatPx = beatInt * pxPerSec;
  const ruler = [];
  const tickStep = pxPerSec < 24 ? 10 : pxPerSec < 60 ? 5 : 1;
  for (let s = 0; s <= (duration || 30); s += tickStep) {
    ruler.push(<div key={s} className="tick" style={{ left: s * pxPerSec }}><span>{fmtTC(s, false).slice(0, 5)}</span></div>);
  }
  const LANES = [
    { id: "A", label: "Video", color: "#5b8cff" },
    { id: "B", label: "Audio", color: "#2dd4bf" },
    { id: "C", label: "Visualizer", color: "#a78bfa" },
    { id: "D", label: "Subtitle / Logo", color: "#ffb020" },
    { id: "E", label: "BPM", color: "#ff4d5e" },
  ];

  return (
    <div className="app">
      <video ref={videoRef} style={{ display: "none" }} playsInline></video>
      <audio ref={audioElRef} style={{ display: "none" }}></audio>
      <input ref={vidInRef} type="file" accept="video/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) loadVideo(e.target.files[0], e.target.files[0].name); e.target.value = ""; }} />
      <input ref={audInRef} type="file" accept="audio/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) loadAudio(e.target.files[0], e.target.files[0].name, true); e.target.value = ""; }} />
      <input ref={logoInRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { importLogo(e.target.files[0]); e.target.value = ""; }} />

      {/* ---------- HEADER ---------- */}
      <header className="header">
        <div className="brand">
          <span className="logo-mark"></span>
          <span className="brand-name">PaceKeeper</span>
        </div>
        <div className="transport">
          <button className="t-btn" onClick={() => seek(0)} title="Rewind to start"><TIcon name="rewind" /></button>
          <button className="t-btn stop" onClick={stop} title="Stop"><TIcon name="stop" /></button>
          <button className="t-btn play" onClick={() => (playing ? pause() : play())} title="Play / Pause">
            <TIcon name={playing ? "pause" : "play"} size={20} />
          </button>
          <button className="t-btn" onClick={() => seek(duration)} title="Forward to end"><TIcon name="forward" /></button>
          <LedClock t={time} dur={duration} playing={playing} />
        </div>
        <button className={"export " + (exporting ? "busy" : "")} onClick={doExport} disabled={exporting}>
          {exporting ? `Exporting ${Math.round((duration ? time / duration : 0) * 100)}%` : "Export Video"}
        </button>
      </header>

      {/* ---------- BODY ---------- */}
      <div className="body">
        <ProjectsRail
          projects={projects} currentId={currentProjectId}
          name={projectName} setName={setProjectName}
          onSave={saveProject} onNew={newProject} onLoad={loadProject} onDelete={deleteProject} />

        <div className="center">
          <div className="preview">
            <div className="canvas-wrap">
              <canvas ref={canvasRef} width={CW} height={CH} className="stage"></canvas>
              {exporting && <div className="rec-badge"><span className="rec-dot"></span>REC</div>}
            </div>
          </div>

          <div className="toolbar">
            <button className="tool" onClick={() => vidInRef.current.click()}>Import Video</button>
            <button className="tool" onClick={() => audInRef.current.click()}>Import Audio</button>
            <span className="div"></span>
            <button className="tool" onClick={addText}>Add Subtitle</button>
            <button className="tool" onClick={() => logoInRef.current.click()}>Add Logo</button>
            <span className="div"></span>
            <button className={"tool toggle " + (viz.enabled ? "on" : "")}
              onClick={() => { setViz((p) => ({ ...p, enabled: !p.enabled })); setSelected("viz"); }}>
              Visualizer {viz.enabled ? "On" : "Off"}
            </button>
            <span className="div"></span>
            <label className="bpm-field">BPM
              <input type="number" min="40" max="240" value={bpm || ""} placeholder="—"
                onChange={(e) => setBpm(parseInt(e.target.value || "0", 10))} />
            </label>
            <button className="tool sm" onClick={tap}>Tap</button>
            <button className={"tool sm toggle " + (bpmOv.enabled ? "on" : "")}
              onClick={() => { setBpmOv((p) => ({ ...p, enabled: !p.enabled })); setSelected("bpm"); }}>
              BPM Overlay
            </button>
          </div>
        </div>

        {/* ---------- INSPECTOR ---------- */}
        <aside className="inspector">
          {!selected && (
            <div className="insp-empty">
              <h3>Inspector</h3>
              <p>Select a clip, subtitle, the visualizer, or the BPM overlay to edit its properties.</p>
              <div className="proj-stats">
                <div><span>Video</span><b>{video ? video.name : "—"}</b></div>
                <div><span>Audio</span><b>{audio ? audio.name : "—"}</b></div>
                <div><span>BPM</span><b>{bpm || "—"}</b></div>
                <div><span>Duration</span><b>{fmtTC(duration, false)}</b></div>
                <div><span>Subtitles</span><b>{subs.length}</b></div>
              </div>
            </div>
          )}

          {selected === "viz" && (
            <div className="insp">
              <h3>Visualizer · Track C</h3>
              <VizStylePicker value={viz.style} on={(style) => setViz({ ...viz, style })} />
              <Slider label="Position X" v={viz.x} min={0} max={1} step={0.01} on={(x) => setViz({ ...viz, x })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Slider label="Position Y" v={viz.y} min={0} max={1} step={0.01} on={(y) => setViz({ ...viz, y })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Slider label="Size" v={viz.scale} min={0.3} max={1.6} step={0.01} on={(s) => setViz({ ...viz, scale: s })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Slider label="Opacity" v={viz.opacity} min={0.1} max={1} step={0.01} on={(o) => setViz({ ...viz, opacity: o })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Swatches v={viz.color} on={(color) => setViz({ ...viz, color })} />
            </div>
          )}

          {selected === "bpm" && (
            <div className="insp">
              <h3>BPM Display · Track E</h3>
              <Row label="Tempo">
                <div className="bpm-big">
                  <input type="number" value={bpm || ""} min="40" max="240" onChange={(e) => setBpm(parseInt(e.target.value || "0", 10))} />
                  <button onClick={tap}>Tap</button>
                </div>
              </Row>
              <Slider label="Beat offset" v={bpmOv.offset} min={-1} max={1} step={0.01} on={(o) => setBpmOv({ ...bpmOv, offset: o })} fmt={(v) => v.toFixed(2) + "s"} />
              <Slider label="Position X" v={bpmOv.x} min={0} max={1} step={0.01} on={(x) => setBpmOv({ ...bpmOv, x })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Slider label="Position Y" v={bpmOv.y} min={0} max={1} step={0.01} on={(y) => setBpmOv({ ...bpmOv, y })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Swatches v={bpmOv.color} on={(color) => setBpmOv({ ...bpmOv, color })} />
            </div>
          )}

          {selSub && (
            <div className="insp">
              <h3>{selSub.type === "logo" ? "Logo" : "Subtitle"} · Track D</h3>
              {selSub.type !== "logo" && (
                <Row label="Text">
                  <textarea className="ta" value={selSub.text} rows={2} onChange={(e) => updateSub(selSub.id, { text: e.target.value })} />
                </Row>
              )}
              <div className="two">
                <Row label="In"><input className="num" type="number" step="0.1" value={selSub.start.toFixed(1)} onChange={(e) => updateSub(selSub.id, { start: parseFloat(e.target.value) || 0 })} /></Row>
                <Row label="Out"><input className="num" type="number" step="0.1" value={selSub.end.toFixed(1)} onChange={(e) => updateSub(selSub.id, { end: parseFloat(e.target.value) || 0 })} /></Row>
              </div>
              <Slider label="Position X" v={selSub.x} min={0} max={1} step={0.01} on={(x) => updateSub(selSub.id, { x })} fmt={(v) => Math.round(v * 100) + "%"} />
              <Slider label="Position Y" v={selSub.y} min={0} max={1} step={0.01} on={(y) => updateSub(selSub.id, { y })} fmt={(v) => Math.round(v * 100) + "%"} />
              {selSub.type === "logo"
                ? <Slider label="Logo size" v={selSub.size} min={0.05} max={0.6} step={0.01} on={(size) => updateSub(selSub.id, { size })} fmt={(v) => Math.round(v * 100) + "%"} />
                : <Slider label="Font size" v={selSub.size} min={20} max={120} step={1} on={(size) => updateSub(selSub.id, { size })} fmt={(v) => Math.round(v) + "px"} />}
              {selSub.type !== "logo" && <Swatches v={selSub.color} on={(color) => updateSub(selSub.id, { color })} />}
              <button className="danger" onClick={() => delSub(selSub.id)}>Delete</button>
            </div>
          )}
        </aside>
      </div>

      {/* ---------- TIMELINE ---------- */}
      <div className="timeline">
        <div className="tl-labels">
          <div className="tl-ruler-spacer"></div>
          {LANES.map((l) => (
            <div key={l.id} className="lane-label">
              <span className="lane-id" style={{ background: l.color }}>{l.id}</span>{l.label}
            </div>
          ))}
        </div>
        <div className="tl-scroll" ref={laneAreaRef}
          onClick={(e) => { if (e.target.closest(".block,.handle")) return; seek(timeFromEvent(e)); }}>
          <div className="tl-inner" style={{ width: timelineW }}>
            <div className="ruler">{ruler}</div>
            <div className="playhead" style={{ left: time * pxPerSec }}><div className="ph-head"></div></div>

            <div className="lane">
              {video && (
                <div className="block vid" style={{ left: trim.start * pxPerSec, width: trimDur * pxPerSec }} onClick={() => setSelected(null)}>
                  <span className="block-name">{video.name}</span>
                  <div className="handle l" onPointerDown={(e) => startTrimDrag("start", e)}></div>
                  <div className="handle r" onPointerDown={(e) => startTrimDrag("end", e)}></div>
                </div>
              )}
            </div>
            <div className="lane">
              {audio && (
                <div className="block aud" style={{ left: 0, width: audio.duration * pxPerSec }}>
                  <canvas ref={waveRef} className="wave"></canvas>
                  <span className="block-name over">{audio.name}</span>
                </div>
              )}
            </div>
            <div className="lane">
              {audio && viz.enabled && (
                <div className={"block viz " + (selected === "viz" ? "sel" : "")} style={{ left: 0, width: audio.duration * pxPerSec }}
                  onClick={(e) => { e.stopPropagation(); setSelected("viz"); }}>
                  <span className="block-name">≋ {viz.style} spectrum</span>
                </div>
              )}
            </div>
            <div className="lane multi">
              {subs.map((s) => (
                <div key={s.id} className={"block sub " + (s.type === "logo" ? "logo " : "") + (selected === s.id ? "sel" : "")}
                  style={{ left: s.start * pxPerSec, width: Math.max(24, (s.end - s.start) * pxPerSec), top: 4 + s.lane * 12 }}
                  onPointerDown={(e) => startSubDrag(s, e)}>
                  <span className="block-name">{s.type === "logo" ? "▣ " : ""}{s.text}</span>
                </div>
              ))}
            </div>
            <div className="lane bpm-lane" onClick={(e) => { e.stopPropagation(); setSelected("bpm"); }}
              style={beatPx > 2 ? { backgroundImage: `repeating-linear-gradient(90deg, ${bpmOv.color} 0 1.5px, transparent 1.5px ${beatPx}px)`, backgroundPosition: `${bpmOv.offset * pxPerSec}px 0` } : {}}>
              {bpm > 0 && <span className="bpm-tag">{bpm} BPM · {beatInt.toFixed(2)}s/beat</span>}
            </div>
          </div>
        </div>

        <div className="tl-foot">
          <span className="status">{status}</span>
          <div className="zoom">
            <button onClick={() => zoomBtn(1 / 1.4)} title="Zoom out">−</button>
            <button className="fit" onClick={fitZoom} title="Fit timeline">Fit</button>
            <button onClick={() => zoomBtn(1.4)} title="Zoom in">＋</button>
            <span className="zoom-hint">⌘/Alt + scroll</span>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<VideoEditor />);
