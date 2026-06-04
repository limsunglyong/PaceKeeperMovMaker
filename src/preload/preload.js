const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pacekeeper", {
  saveProjectFile: (project) => ipcRenderer.invoke("project:saveJson", project),
  loadProjectFile: () => ipcRenderer.invoke("project:loadJson"),
  openMediaFile: (kind) => ipcRenderer.invoke("media:open", kind),
  openImageFile: () => ipcRenderer.invoke("media:open", "image"),
  selectFfmpeg: () => ipcRenderer.invoke("export:selectFfmpeg"),
  ffmpegStatus: () => ipcRenderer.invoke("export:ffmpegStatus"),
  beginNativeExport: (options) => ipcRenderer.invoke("export:beginNative", options),
  writeNativeExportFrame: (session, index, bytes) => ipcRenderer.invoke("export:writeFrame", session, index, bytes),
  finishNativeExport: (session, options) => ipcRenderer.invoke("export:finishNative", session, options),
  cancelNativeExport: () => ipcRenderer.invoke("export:cancelNative"),
  onExportProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("export:progress", listener);
    return () => ipcRenderer.removeListener("export:progress", listener);
  }
});
