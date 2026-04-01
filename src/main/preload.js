const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  getRes:      (d)  => ipcRenderer.invoke("get-res", d),
  getMonitors: ()   => ipcRenderer.invoke("get-monitors"),
  apply:       (i)  => ipcRenderer.invoke("apply", i),
  getCfg:      ()   => ipcRenderer.invoke("get-cfg"),
  saveCfg:     (c)  => ipcRenderer.invoke("save-cfg", c),
  getAuto:     ()   => ipcRenderer.invoke("get-auto"),
  setAuto:     (v)  => ipcRenderer.invoke("set-auto", v),
  minimize:    ()   => ipcRenderer.send("win-min"),
  quit:        ()   => ipcRenderer.send("win-close"),
  onApplied:   (cb) => {
    const fn = (_, d) => cb(d);
    ipcRenderer.on("applied", fn);
    return () => ipcRenderer.removeListener("applied", fn);
  },
});
