const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hamrita", {
  system: {
    summary: () => ipcRenderer.invoke("system:summary")
  },
  gaming: {
    status: () => ipcRenderer.invoke("gaming:status"),
    setGameMode: (v) => ipcRenderer.invoke("gaming:gameMode", v),
    setHags: (v) => ipcRenderer.invoke("gaming:hags", v)
  },
  power: {
    plans: () => ipcRenderer.invoke("power:plans"),
    highPerformance: () => ipcRenderer.invoke("power:high")
  },
  network: {
    diagnostics: () => ipcRenderer.invoke("network:diagnostics"),
    flushDns: () => ipcRenderer.invoke("network:flushDns")
  },
  cleaner: {
    scan: () => ipcRenderer.invoke("cleanup:scan"),
    apply: () => ipcRenderer.invoke("cleanup:apply")
  },
  startup: {
    list: () => ipcRenderer.invoke("startup:list")
  },
  backup: {
    create: () => ipcRenderer.invoke("backup:create")
  },
  logs: {
    get: () => ipcRenderer.invoke("logs:get")
  },
  app: {
    version: () => ipcRenderer.invoke("app:version")
  }
});