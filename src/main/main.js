const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

let win;
const openDevTools = process.env.PACEKEEPER_DEVTOOLS === "1";
let ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
let activeNativeExportProcess = null;

function mimeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif"
  };
  return types[ext] || "application/octet-stream";
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0c0d10",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`Failed to load ${url}: ${code} ${description}`);
  });
  win.loadFile(path.join(__dirname, "../../index.html"));
  if (openDevTools) win.webContents.openDevTools({ mode: "detach" });
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const settings = JSON.parse(raw);
    if (settings.ffmpegPath) ffmpegPath = settings.ffmpegPath;
  } catch (_) {}
}

async function saveSettings() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify({ ffmpegPath }, null, 2), "utf8");
}

function runFfmpeg(args, onProgress, onChild) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    if (onChild) onChild(child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onProgress) onProgress(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout || stderr);
      else reject(new Error(stderr || stdout || `FFmpeg exited with code ${code}`));
    });
  });
}

function audioClipsFromExportOptions(options) {
  if (Array.isArray(options.audioClips) && options.audioClips.length) {
    return options.audioClips
      .filter((clip) => clip && clip.path)
      .map((clip) => ({
        path: clip.path,
        start: Math.max(0, Number(clip.start) || 0),
        trimStart: Math.max(0, Number(clip.trimStart) || 0),
        trimEnd: Math.max(0, Number(clip.trimEnd) || 0),
        volume: Math.max(0, Math.min(1, Number(clip.volume ?? 1) || 0))
      }))
      .filter((clip) => clip.volume > 0 && (!clip.trimEnd || clip.trimEnd > clip.trimStart));
  }
  if (options.audioPath) {
    return [{
      path: options.audioPath,
      start: Math.max(0, Number(options.audioStart) || 0),
      trimStart: 0,
      trimEnd: 0,
      volume: 1
    }];
  }
  return [];
}

function audioFilterForClips(clips, projectDuration) {
  const labels = [];
  const filters = clips.map((clip, index) => {
    const input = index + 1;
    const label = `a${index}`;
    labels.push(`[${label}]`);
    const parts = [];
    if (clip.trimEnd > clip.trimStart) parts.push(`atrim=start=${clip.trimStart.toFixed(3)}:end=${clip.trimEnd.toFixed(3)}`);
    else parts.push(`atrim=start=${clip.trimStart.toFixed(3)}`);
    parts.push("asetpts=PTS-STARTPTS");
    parts.push(`volume=${clip.volume.toFixed(3)}`);
    const delay = Math.max(0, Math.round(clip.start * 1000));
    if (delay > 0) parts.push(`adelay=${delay}:all=1`);
    return `[${input}:a]${parts.join(",")}[${label}]`;
  });
  if (!filters.length) return "";
  const duration = Math.max(0.1, Number(projectDuration) || 0);
  if (labels.length === 1) {
    filters.push(`${labels[0]}atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS[aout]`);
  } else {
    filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0,atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS[aout]`);
  }
  return filters.join(";");
}

function escapeFfmpegMetadataValue(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function parseFfmpegMetadata(text) {
  const metadata = {};
  String(text || "").split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith(";") || !line.includes("=")) return;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key && value) metadata[key] = value;
  });
  return metadata;
}

async function readMediaMetadata(filePath) {
  if (!filePath) return {};
  try {
    const output = await runFfmpeg([
      "-hide_banner",
      "-i", filePath,
      "-f", "ffmetadata",
      "-"
    ]);
    return parseFfmpegMetadata(output);
  } catch (_) {
    return {};
  }
}

function exportMetadataFromAudioTags(tags, generationDate) {
  const title = tags.title || "";
  const description = tags.description || tags.comment || "";
  const musician = tags.composer || tags.artist || tags.album_artist || tags.albumartist || "";
  const metadata = {
    creation_time: generationDate
  };
  if (title) metadata.title = title;
  if (description) metadata.description = description;
  if (musician) {
    metadata.artist = musician;
    metadata.composer = musician;
    metadata.director = musician;
    metadata.content_provider = musician;
    metadata.encoded_by = musician;
    metadata.copyright = musician;
  }
  return metadata;
}

function metadataArgs(metadata) {
  return Object.entries(metadata || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .flatMap(([key, value]) => ["-metadata", `${key}=${escapeFfmpegMetadataValue(value)}`]);
}

async function ffmpegVersion() {
  const output = await runFfmpeg(["-version"]);
  return output.split(/\r?\n/)[0] || "ffmpeg";
}

app.whenReady().then(async () => {
  await loadSettings();
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("project:saveJson", async (_event, project) => {
  const result = await dialog.showSaveDialog(win, {
    title: "Save PaceKeeper project",
    defaultPath: `${project.name || "Untitled"}.pkmm.json`,
    filters: [{ name: "PaceKeeper project", extensions: ["pkmm.json", "json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, JSON.stringify(project, null, 2), "utf8");
  return { canceled: false, path: result.filePath };
});

ipcMain.handle("project:loadJson", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Open PaceKeeper project",
    properties: ["openFile"],
    filters: [{ name: "PaceKeeper project", extensions: ["pkmm.json", "json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const raw = await fs.readFile(result.filePaths[0], "utf8");
  const project = JSON.parse(raw);
  for (const clip of project.videoClips || []) {
    if (clip.sourcePath && !clip.url) clip.url = pathToFileURL(clip.sourcePath).toString();
  }
  for (const clip of project.audioClips || []) {
    if (clip.sourcePath && !clip.url) clip.url = pathToFileURL(clip.sourcePath).toString();
  }
  for (const sub of project.subs || []) {
    if (sub.type === "logo" && sub.sourcePath && !sub.url) sub.url = pathToFileURL(sub.sourcePath).toString();
  }
  return { canceled: false, path: result.filePaths[0], project };
});

ipcMain.handle("media:open", async (_event, kind) => {
  const filters = kind === "image"
    ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
    : kind === "audio"
      ? [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac"] }]
      : [{ name: "Video", extensions: ["mp4", "mov", "m4v", "webm", "mkv", "avi"] }];
  const result = await dialog.showOpenDialog(win, {
    title: kind === "image" ? "Import image" : kind === "audio" ? "Import audio" : "Import video",
    properties: ["openFile"],
    filters
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return {
    canceled: false,
    path: filePath,
    name: path.basename(filePath),
    url: pathToFileURL(filePath).toString(),
    type: mimeForPath(filePath),
    data
  };
});

ipcMain.handle("export:selectFfmpeg", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Select FFmpeg executable",
    properties: ["openFile"],
    filters: [{ name: "FFmpeg", extensions: ["exe"] }, { name: "All files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  ffmpegPath = result.filePaths[0];
  const version = await ffmpegVersion();
  await saveSettings();
  return { canceled: false, path: ffmpegPath, version };
});

ipcMain.handle("export:ffmpegStatus", async () => {
  try {
    const version = await ffmpegVersion();
    return { ok: true, path: ffmpegPath, version };
  } catch (error) {
    return { ok: false, path: ffmpegPath, error: error.message };
  }
});

ipcMain.handle("export:beginNative", async (_event, options) => {
  const name = `${options.name || "PaceKeeper"}.mp4`.replace(/[<>:"/\\|?*]+/g, "_");
  const result = await dialog.showSaveDialog(win, {
    title: "Export MP4 with FFmpeg",
    defaultPath: name,
    filters: [{ name: "MP4 video", extensions: ["mp4"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await ffmpegVersion();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pacekeeper-frames-"));
  return { canceled: false, outputPath: result.filePath, tempDir };
});

ipcMain.handle("export:writeFrame", async (_event, session, index, bytes) => {
  const framePath = path.join(session.tempDir, `frame-${String(index).padStart(6, "0")}.png`);
  await fs.writeFile(framePath, Buffer.from(bytes));
  return { ok: true };
});

ipcMain.handle("export:finishNative", async (_event, session, options) => {
  const fps = Number(options.fps) || 30;
  const crf = String(options.crf ?? 18);
  const preset = options.preset || "medium";
  const audioClips = audioClipsFromExportOptions(options);
  const metadataSourcePath = options.metadataAudioPath || (audioClips.find((clip) => /\.mp3$/i.test(clip.path)) || audioClips[0] || {}).path || "";
  const audioTags = await readMediaMetadata(metadataSourcePath);
  const exportMetadata = exportMetadataFromAudioTags(audioTags, new Date().toISOString());
  const args = [
    "-y",
    "-framerate", String(fps),
    "-i", path.join(session.tempDir, "frame-%06d.png")
  ];
  audioClips.forEach((clip) => {
    args.push("-i", clip.path);
  });
  if (audioClips.length) {
    args.push("-filter_complex", audioFilterForClips(audioClips, options.duration), "-map", "0:v", "-map", "[aout]");
  }
  args.push(
    "-c:v", "libx264",
    "-preset", preset,
    "-crf", crf,
    "-pix_fmt", "yuv420p"
  );
  if (audioClips.length) args.push("-c:a", "aac", "-b:a", options.audioBitrate || "192k");
  const metaArgs = metadataArgs(exportMetadata);
  if (metaArgs.length) args.push("-movflags", "use_metadata_tags", ...metaArgs);
  args.push(session.outputPath);
  try {
    await runFfmpeg(args, (text) => {
      const match = text.match(/time=(\d+:\d+:\d+\.\d+)/);
      if (match && win) win.webContents.send("export:progress", { time: match[1] });
    }, (child) => {
      activeNativeExportProcess = child;
    });
    return { ok: true, outputPath: session.outputPath };
  } finally {
    activeNativeExportProcess = null;
    try { await fs.rm(session.tempDir, { recursive: true, force: true }); } catch (_) {}
  }
});

ipcMain.handle("export:cancelNative", async () => {
  if (!activeNativeExportProcess) return { ok: false, reason: "No active FFmpeg export." };
  try {
    activeNativeExportProcess.kill("SIGTERM");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});
