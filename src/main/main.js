const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

let win;

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
  return { canceled: false, path: result.filePaths[0], project: JSON.parse(raw) };
});
