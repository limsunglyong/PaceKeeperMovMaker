const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let win;

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
  win.loadFile(path.join(__dirname, "../../index.html"));
}

app.whenReady().then(createWindow);
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
