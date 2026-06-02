const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pacekeeper", {
  saveProjectFile: (project) => ipcRenderer.invoke("project:saveJson", project),
  loadProjectFile: () => ipcRenderer.invoke("project:loadJson"),
  openMediaFile: (kind) => ipcRenderer.invoke("media:open", kind),
  openImageFile: () => ipcRenderer.invoke("media:open", "image")
});
