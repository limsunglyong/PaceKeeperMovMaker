/* ============================================================
   helpers.jsx — pure, non-React utilities for the editor
   Exposed on window so editor.jsx (separate Babel scope) can use them.
   ============================================================ */

/* Format seconds -> "MM:SS:FF" (FF = frames at 30fps) or "MM:SS.mmm" */
function fmtTC(t, withFrames) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  if (withFrames) {
    const f = Math.floor((t - Math.floor(t)) * 30);
    return (
      String(m).padStart(2, "0") +
      ":" +
      String(s).padStart(2, "0") +
      ":" +
      String(f).padStart(2, "0")
    );
  }
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  return (
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    String(ms).padStart(3, "0")
  );
}

/* Decode a File into an AudioBuffer using a (possibly shared) AudioContext */
async function decodeAudioFile(file, ctx) {
  const arr = await file.arrayBuffer();
  // decodeAudioData wants a fresh copy of the buffer
  return await ctx.decodeAudioData(arr.slice(0));
}

/* Build min/max peak buckets for waveform rendering.
   Returns Float32 arrays [mins, maxs] of length `buckets`. */
function buildPeaks(audioBuffer, buckets) {
  const ch = audioBuffer.getChannelData(0);
  const n = ch.length;
  const step = Math.max(1, Math.floor(n / buckets));
  const mins = new Float32Array(buckets);
  const maxs = new Float32Array(buckets);
  for (let b = 0; b < buckets; b++) {
    let mn = 1.0,
      mx = -1.0;
    const start = b * step;
    const end = Math.min(n, start + step);
    for (let i = start; i < end; i++) {
      const v = ch[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (start >= end) {
      mn = 0;
      mx = 0;
    }
    mins[b] = mn;
    maxs[b] = mx;
  }
  return { mins, maxs };
}

/* Best-effort tempo estimate via onset autocorrelation.
   Returns an integer BPM in [60,180]. */
function detectBPM(audioBuffer) {
  const ch = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const envRate = 200; // Hz
  const hop = Math.max(1, Math.floor(sr / envRate));
  const env = [];
  for (let i = 0; i < ch.length; i += hop) {
    let sum = 0;
    const end = Math.min(ch.length, i + hop);
    for (let j = i; j < end; j++) {
      const v = ch[j];
      sum += v * v;
    }
    env.push(Math.sqrt(sum / hop));
  }
  // onset envelope (positive first difference)
  const onset = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) {
    const d = env[i] - env[i - 1];
    onset[i] = d > 0 ? d : 0;
  }
  let best = 120;
  let bestVal = -1;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = Math.round((envRate * 60) / bpm);
    let sum = 0;
    for (let i = 0; i + lag < onset.length; i++) {
      sum += onset[i] * onset[i + lag];
    }
    // mild preference for mid-tempo to avoid octave errors
    const weight = 1 - Math.abs(bpm - 120) / 600;
    sum *= weight;
    if (sum > bestVal) {
      bestVal = sum;
      best = bpm;
    }
  }
  return best;
}

/* Cover-fit drawImage: fill dest rect, cropping overflow (like background-size:cover) */
function drawCover(ctx, media, dw, dh) {
  const mw = media.videoWidth || media.width || dw;
  const mh = media.videoHeight || media.height || dh;
  if (!mw || !mh) return;
  const scale = Math.max(dw / mw, dh / mh);
  const w = mw * scale;
  const h = mh * scale;
  const x = (dw - w) / 2;
  const y = (dh - h) / 2;
  ctx.drawImage(media, x, y, w, h);
}

/* Wrap text into lines that fit maxWidth (canvas ctx must have font set) */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* Downscale a source canvas to a JPEG data-URL thumbnail */
function makeThumb(srcCanvas, w) {
  w = w || 256;
  const h = Math.round((w * srcCanvas.height) / srcCanvas.width);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(srcCanvas, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}

/* ---------- IndexedDB project store ---------- */
function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("pacekeeper_db", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbPut(rec) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(rec);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbAll() {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("projects", "readonly");
    const r = tx.objectStore("projects").getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("projects", "readonly");
    const r = tx.objectStore("projects").get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDel(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

Object.assign(window, {
  fmtTC,
  decodeAudioFile,
  buildPeaks,
  detectBPM,
  drawCover,
  wrapText,
  makeThumb,
  idbOpen,
  idbPut,
  idbAll,
  idbGet,
  idbDel,
});
