const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pacekeeper", {
  saveProjectFile: (project) => ipcRenderer.invoke("project:saveJson", project),
  loadProjectFile: () => ipcRenderer.invoke("project:loadJson")
});
