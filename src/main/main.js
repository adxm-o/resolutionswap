const {
  app, BrowserWindow, Tray, Menu, ipcMain,
  globalShortcut, nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const os = require("os");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null, tray = null, cfg = null;
const startHidden = process.argv.includes("--hidden");

const CFG_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "ResolutionSwap"
);
const CFG_FILE = path.join(CFG_DIR, "config.json");

const DEFAULTS = {
  slots: [
    { label: "Slot 1", w: 0, h: 0, hz: 144, key: "F5", scale: "default", configured: false },
    { label: "Slot 2", w: 0, h: 0, hz: 144, key: "F6", scale: "default", configured: false },
    { label: "Slot 3", w: 0, h: 0, hz: 60,  key: "F7", scale: "default", configured: false },
    { label: "Slot 4", w: 0, h: 0, hz: 60,  key: "F8", scale: "default", configured: false },
  ],
  monitor: "",
  launchOnStartup: false,
  profiles: [{ name: "Default", slots: null }],
  activeProfile: 0,
};

function loadCfg() {
  try {
    fs.mkdirSync(CFG_DIR, { recursive: true });
    if (fs.existsSync(CFG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CFG_FILE, "utf-8"));
      if (raw.profiles && !raw.slots) {
        saveCfg(DEFAULTS);
        return JSON.parse(JSON.stringify(DEFAULTS));
      }
      if (raw.slots && raw.slots.length >= 1) {
        raw.slots = raw.slots.map(function(s) {
          if (s.configured === undefined) {
            s.configured = !!(s.w && s.h && s.hz && Number(s.w) > 0 && Number(s.h) > 0 && Number(s.hz) > 0);
          }
          s.w = Number(s.w) || 0;
          s.h = Number(s.h) || 0;
          s.hz = Number(s.hz) || 0;
          return s;
        });
        if (!raw.profiles) raw.profiles = [{ name: "Default", slots: null }];
        if (raw.activeProfile == null) raw.activeProfile = 0;
        saveCfg(raw);
        return raw;
      }
    }
  } catch (e) { console.error("cfg load:", e); }
  saveCfg(DEFAULTS);
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function saveCfg(c) {
  try {
    fs.mkdirSync(CFG_DIR, { recursive: true });
    fs.writeFileSync(CFG_FILE, JSON.stringify(c, null, 2));
  } catch (e) { console.error("cfg save:", e); }
}

const PS_FILE = path.join(os.tmpdir(), "resswap_core.ps1");

const PS_CODE = String.raw`
param([string]$Action,[string]$Dev="",[int]$W=0,[int]$H=0,[int]$Hz=0,[int]$Stretch=0)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using System.Collections.Generic;

public class ResSwap {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmDeviceName;
    public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
    public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
    public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
    public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType;
    public int dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
  }

  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]  public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceString;
    public int StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceKey;
  }

  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  static extern int ChangeDisplaySettingsExW(string d, ref DEVMODE dm, IntPtr h, int f, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  static extern bool EnumDisplaySettingsW(string d, int m, ref DEVMODE dm);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  static extern bool EnumDisplayDevicesW(string d, int i, ref DISPLAY_DEVICE dd, int f);
  [DllImport("kernel32.dll", CharSet=CharSet.Ansi)]
  static extern IntPtr LoadLibrary(string name);
  [DllImport("kernel32.dll", CharSet=CharSet.Ansi)]
  static extern IntPtr GetProcAddress(IntPtr hModule, string name);

  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  delegate IntPtr QueryInterfaceDel(uint id);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  delegate int NvInitDel();
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  delegate int NvGetIdDel(IntPtr name, out uint displayId);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  delegate int NvTryCustomDel(IntPtr pDisplayIds, uint count, IntPtr pCustDisp);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  delegate int NvSaveCustomDel(IntPtr pDisplayIds, uint count, int isOutputOnly, int isMonitorOnly);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  delegate int NvRevertCustomDel(IntPtr pDisplayIds, uint count);

  public static string ListMonitors() {
    var results = new List<string>();
    for (int i = 0; i < 16; i++) {
      DISPLAY_DEVICE dd = new DISPLAY_DEVICE();
      dd.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
      if (!EnumDisplayDevicesW(null, i, ref dd, 0)) break;
      if ((dd.StateFlags & 1) != 0) {
        DEVMODE dm = new DEVMODE();
        dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        EnumDisplaySettingsW(dd.DeviceName, -1, ref dm);
        string name = dd.DeviceName.TrimEnd('\0');
        string desc = dd.DeviceString.TrimEnd('\0').Trim();
        results.Add(name + "|" + desc + "|" + dm.dmPelsWidth + "x" + dm.dmPelsHeight + "@" + dm.dmDisplayFrequency);
      }
    }
    return string.Join("\n", results);
  }

  public static string Get(string dev) {
    DEVMODE dm = new DEVMODE();
    dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
    string d = string.IsNullOrEmpty(dev) ? null : dev;
    EnumDisplaySettingsW(d, -1, ref dm);
    return dm.dmPelsWidth + "x" + dm.dmPelsHeight + "@" + dm.dmDisplayFrequency;
  }

  static int TryApply(string dev, int w, int h, int hz, bool stretch, int flags) {
    DEVMODE dm = new DEVMODE();
    dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
    dm.dmPelsWidth = w;
    dm.dmPelsHeight = h;
    dm.dmDisplayFrequency = hz;
    dm.dmFields = 0x80000 | 0x100000 | 0x400000;
    if (stretch) { dm.dmDisplayFixedOutput = 1; dm.dmFields |= 0x20000000; }
    string d = string.IsNullOrEmpty(dev) ? null : dev;
    return ChangeDisplaySettingsExW(d, ref dm, IntPtr.Zero, flags, IntPtr.Zero);
  }

  static int TryApplyNoHz(string dev, int w, int h, bool stretch, int flags) {
    DEVMODE dm = new DEVMODE();
    dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
    dm.dmPelsWidth = w;
    dm.dmPelsHeight = h;
    dm.dmFields = 0x80000 | 0x100000;
    if (stretch) { dm.dmDisplayFixedOutput = 1; dm.dmFields |= 0x20000000; }
    string d = string.IsNullOrEmpty(dev) ? null : dev;
    return ChangeDisplaySettingsExW(d, ref dm, IntPtr.Zero, flags, IntPtr.Zero);
  }

  static void SetGpuScaling(bool stretch) {
    try {
      int v = stretch ? 3 : 4;
      string bp = "SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Configuration";
      using (var ck = Registry.LocalMachine.OpenSubKey(bp)) {
        if (ck != null) foreach (string cn in ck.GetSubKeyNames())
          foreach (string sub in new[] { "00\\00", "00\\01", "01\\00" })
            try { using (var k = Registry.LocalMachine.OpenSubKey(bp + "\\" + cn + "\\" + sub, true))
              if (k != null) k.SetValue("Scaling", v, RegistryValueKind.DWord); } catch {}
      }
    } catch {}
  }

  static string RegisterNvidiaCustomRes(string displayName, int w, int h, int hz) {
    IntPtr lib = LoadLibrary("nvapi64.dll");
    if (lib == IntPtr.Zero) return "ERR:no_nvidia";

    IntPtr pQI = GetProcAddress(lib, "nvapi_QueryInterface");
    if (pQI == IntPtr.Zero) return "ERR:no_qi";

    var QI = Marshal.GetDelegateForFunctionPointer<QueryInterfaceDel>(pQI);

    IntPtr pInit   = QI(0x0150E828u);
    IntPtr pGetId  = QI(0xAE457190u);
    IntPtr pTry    = QI(0x1F7DB630u);
    IntPtr pSave   = QI(0xA0A1D735u);
    IntPtr pRevert = QI(0x748B8A8u);

    if (pInit == IntPtr.Zero || pTry == IntPtr.Zero || pSave == IntPtr.Zero)
      return "ERR:missing_nvapi_funcs";

    var Init = Marshal.GetDelegateForFunctionPointer<NvInitDel>(pInit);
    int r = Init();
    if (r != 0) return "ERR:nvapi_init:" + r;

    uint dispId = 0;
    if (pGetId != IntPtr.Zero) {
      string name = string.IsNullOrEmpty(displayName) ? "\\\\.\\DISPLAY1" : displayName;
      byte[] nameBytes = System.Text.Encoding.ASCII.GetBytes(name + "\0");
      IntPtr pName = Marshal.AllocHGlobal(nameBytes.Length);
      Marshal.Copy(nameBytes, 0, pName, nameBytes.Length);
      var GetId = Marshal.GetDelegateForFunctionPointer<NvGetIdDel>(pGetId);
      r = GetId(pName, out dispId);
      Marshal.FreeHGlobal(pName);
      if (r != 0) return "ERR:getid:" + r;
    }

    int hFP = 48, hSync = 32, hBlank = 160;
    int vFP = 3, vSync = 4, vBP = 6;
    int hTotal = w + hBlank;
    int vTotal = h + vFP + vSync + vBP;
    uint pclk = (uint)((long)hTotal * vTotal * hz / 10000);

    byte[] cd = new byte[152];
    uint version = 152u | (1u << 16);

    BitConverter.GetBytes(version).CopyTo(cd, 0);
    BitConverter.GetBytes((uint)w).CopyTo(cd, 4);
    BitConverter.GetBytes((uint)h).CopyTo(cd, 8);
    BitConverter.GetBytes(32u).CopyTo(cd, 12);
    BitConverter.GetBytes(0x12u).CopyTo(cd, 16);
    BitConverter.GetBytes(0.0f).CopyTo(cd, 20);
    BitConverter.GetBytes(0.0f).CopyTo(cd, 24);
    BitConverter.GetBytes(1.0f).CopyTo(cd, 28);
    BitConverter.GetBytes(1.0f).CopyTo(cd, 32);
    BitConverter.GetBytes(1.0f).CopyTo(cd, 36);
    BitConverter.GetBytes(1.0f).CopyTo(cd, 40);

    int t = 44;
    BitConverter.GetBytes((ushort)w).CopyTo(cd, t);
    BitConverter.GetBytes((ushort)0).CopyTo(cd, t+2);
    BitConverter.GetBytes((ushort)hFP).CopyTo(cd, t+4);
    BitConverter.GetBytes((ushort)hSync).CopyTo(cd, t+6);
    BitConverter.GetBytes((ushort)hTotal).CopyTo(cd, t+8);
    cd[t+10] = 1;
    BitConverter.GetBytes((ushort)h).CopyTo(cd, t+12);
    BitConverter.GetBytes((ushort)0).CopyTo(cd, t+14);
    BitConverter.GetBytes((ushort)vFP).CopyTo(cd, t+16);
    BitConverter.GetBytes((ushort)vSync).CopyTo(cd, t+18);
    BitConverter.GetBytes((ushort)vTotal).CopyTo(cd, t+20);
    cd[t+22] = 0;
    BitConverter.GetBytes((ushort)0).CopyTo(cd, t+24);
    BitConverter.GetBytes(pclk).CopyTo(cd, t+28);
    BitConverter.GetBytes((ushort)hz).CopyTo(cd, t+36);
    BitConverter.GetBytes((uint)(hz*1000)).CopyTo(cd, t+40);

    IntPtr pDispId = Marshal.AllocHGlobal(4);
    Marshal.WriteInt32(pDispId, (int)dispId);
    IntPtr pCD = Marshal.AllocHGlobal(cd.Length);
    Marshal.Copy(cd, 0, pCD, cd.Length);

    var Try = Marshal.GetDelegateForFunctionPointer<NvTryCustomDel>(pTry);
    r = Try(pDispId, 1, pCD);

    if (r != 0) {
      if (pRevert != IntPtr.Zero) {
        var Revert = Marshal.GetDelegateForFunctionPointer<NvRevertCustomDel>(pRevert);
        Revert(pDispId, 1);
      }
      Marshal.FreeHGlobal(pDispId);
      Marshal.FreeHGlobal(pCD);
      return "ERR:try_custom:" + r;
    }

    var Save = Marshal.GetDelegateForFunctionPointer<NvSaveCustomDel>(pSave);
    r = Save(pDispId, 1, 1, 1);
    Marshal.FreeHGlobal(pDispId);
    Marshal.FreeHGlobal(pCD);

    if (r != 0) return "ERR:save_custom:" + r;
    return "OK";
  }

  public static string Set(string dev, int w, int h, int hz, bool stretch) {
    if (TryApply(dev, w, h, hz, stretch, 2) == 0) {
      int r = TryApply(dev, w, h, hz, stretch, 1);
      if (r == 0) { SetGpuScaling(stretch); return "OK"; }
    }

    if (TryApply(dev, w, h, hz, stretch, 1) == 0) {
      SetGpuScaling(stretch); return "OK";
    }

    if (TryApply(dev, w, h, hz, stretch, 4) == 0) {
      SetGpuScaling(stretch); return "OK";
    }

    if (stretch) {
      if (TryApply(dev, w, h, hz, false, 1) == 0) {
        SetGpuScaling(stretch); return "OK";
      }
    }

    if (TryApplyNoHz(dev, w, h, stretch, 1) == 0) {
      SetGpuScaling(stretch); return "OK";
    }

    if (TryApply(dev, w, h, hz, stretch, 0) == 0) {
      SetGpuScaling(stretch); return "OK";
    }

    string nvResult = RegisterNvidiaCustomRes(dev, w, h, hz);
    if (nvResult == "OK") {
      System.Threading.Thread.Sleep(500);
      if (TryApply(dev, w, h, hz, stretch, 2) == 0) {
        int r2 = TryApply(dev, w, h, hz, stretch, 1);
        if (r2 == 0) { SetGpuScaling(stretch); return "OK"; }
      }
      if (TryApply(dev, w, h, hz, stretch, 1) == 0) {
        SetGpuScaling(stretch); return "OK";
      }
      if (TryApply(dev, w, h, hz, stretch, 4) == 0) {
        SetGpuScaling(stretch); return "OK";
      }
      return "ERR:registered_but_failed";
    }

    return "ERR:unsupported|" + nvResult;
  }
}
'@
switch ($Action) {
  "monitors" { Write-Output ([ResSwap]::ListMonitors()) }
  "get"      { Write-Output ([ResSwap]::Get($Dev)) }
  "set"      { Write-Output ([ResSwap]::Set($Dev, $W, $H, $Hz, ($Stretch -eq 1))) }
}
`;

function initPS() { fs.writeFileSync(PS_FILE, PS_CODE, "utf-8"); }

function ps(args) {
  return new Promise((res, rej) => {
    execFile("powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS_FILE, ...args],
      { timeout: 15000, windowsHide: true },
      (e, out, err) => e ? rej(new Error(err || e.message)) : res(out.trim())
    );
  });
}

async function getMonitors() {
  try {
    const raw = await ps(["-Action", "monitors"]);
    if (!raw) return [];
    return raw.split("\n").filter(Boolean).map(l => {
      const p = l.split("|");
      return { name: (p[0] || "").trim(), desc: (p[1] || "").trim(), res: (p[2] || "").trim() };
    });
  } catch (e) { return []; }
}

async function getRes(dev) {
  try {
    const args = ["-Action", "get"];
    if (dev) args.push("-Dev", dev);
    const r = await ps(args);
    const m = r.match(/^(\d+)x(\d+)@(\d+)$/);
    if (m) return { w: +m[1], h: +m[2], hz: +m[3] };
  } catch (e) {}
  return { w: 0, h: 0, hz: 0 };
}

async function setRes(dev, w, h, hz, scale) {
  try {
    const args = ["-Action", "set", "-W", "" + w, "-H", "" + h, "-Hz", "" + hz,
      "-Stretch", scale === "stretch" ? "1" : "0"];
    if (dev) args.push("-Dev", dev);
    const result = await ps(args);
    if (result.startsWith("OK")) return { ok: true };
    return { ok: false, err: result };
  } catch (e) { return { ok: false, err: e.message }; }
}

async function applySlot(i) {
  if (!cfg || !cfg.slots[i]) return false;
  const s = cfg.slots[i];
  if (!s.configured) return false;
  const w = Number(s.w), h = Number(s.h), hz = Number(s.hz);
  if (!w || !h || !hz) {
    if (win && !win.isDestroyed()) win.webContents.send("applied", { i, ok: false, err: "Invalid resolution values" });
    return false;
  }
  const result = await setRes(cfg.monitor || "", w, h, hz, s.scale);
  if (win && !win.isDestroyed()) win.webContents.send("applied", { i, ok: result.ok, err: result.err || "" });
  return result.ok;
}

function rebind() {
  globalShortcut.unregisterAll();
  if (!cfg) return;
  cfg.slots.forEach((s, i) => {
    if (!s.key || !s.configured) return;
    try { globalShortcut.register(s.key, () => applySlot(i)); } catch (e) {}
  });
}

function getIconPath() {
  const dev = path.join(__dirname, "..", "..", "assets", "icon.png");
  const packed = path.join(process.resourcesPath || "", "assets", "icon.png");
  if (fs.existsSync(dev)) return dev;
  if (fs.existsSync(packed)) return packed;
  return null;
}

function trayMenu() {
  const items = [{ label: "Open", click: () => { win?.show(); win?.focus(); } }, { type: "separator" }];
  if (cfg) cfg.slots.filter(s => s.configured).forEach(s => {
    const idx = cfg.slots.indexOf(s);
    items.push({ label: s.label + "  " + s.w + "x" + s.h, click: () => applySlot(idx) });
  });
  items.push({ type: "separator" }, { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } });
  return Menu.buildFromTemplate(items);
}

function createTray() {
  const iconPath = getIconPath();
  let icon;
  if (iconPath) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    const s = 16, buf = Buffer.alloc(s * s * 4);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      if (x >= 3 && x <= 12 && y >= 3 && y <= 12) {
        buf[i] = 0x34; buf[i + 1] = 0xd3; buf[i + 2] = 0x99; buf[i + 3] = 0xff;
      }
    }
    icon = nativeImage.createFromBuffer(buf, { width: s, height: s });
  }
  tray = new Tray(icon);
  tray.setToolTip("ResolutionSwap");
  tray.setContextMenu(trayMenu());
  tray.on("double-click", () => { win?.show(); win?.focus(); });
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const iconPath = getIconPath();
  win = new BrowserWindow({
    width: 540, height: 680,
    resizable: false, maximizable: false, fullscreenable: false,
    frame: false, backgroundColor: "#08080a", show: false,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  const html = path.join(__dirname, "..", "..", "dist-renderer", "index.html");
  if (fs.existsSync(html)) win.loadFile(html);
  else win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  win.once("ready-to-show", () => {
    if (!startHidden) { win.show(); win.focus(); }
  });
  win.on("close", e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
}

function setupIPC() {
  ipcMain.handle("get-res", (_, dev) => getRes(dev || cfg?.monitor || ""));
  ipcMain.handle("get-monitors", () => getMonitors());
  ipcMain.handle("apply", async (_, i) => { return await applySlot(i); });
  ipcMain.handle("get-cfg", () => cfg);
  ipcMain.handle("save-cfg", (_, c) => {
    if (c.slots) {
      c.slots = c.slots.map(s => ({
        ...s, w: Number(s.w) || 0, h: Number(s.h) || 0, hz: Number(s.hz) || 0,
      }));
    }
    cfg = c; saveCfg(c); rebind();
    if (tray) tray.setContextMenu(trayMenu());
    return true;
  });
  ipcMain.handle("get-auto", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("set-auto", (_, v) => {
    app.setLoginItemSettings({
      openAtLogin: v,
      args: v ? ["--hidden"] : [],
    });
    if (cfg) { cfg.launchOnStartup = v; saveCfg(cfg); }
    return true;
  });
  ipcMain.on("win-min", () => win?.hide());
  ipcMain.on("win-close", () => { app.isQuitting = true; app.quit(); });
}

app.whenReady().then(() => {
  cfg = loadCfg(); initPS(); setupIPC();
  createWindow(); createTray(); rebind();
  if (cfg.launchOnStartup) {
    app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
  }
});
app.on("second-instance", () => { win?.show(); win?.focus(); });
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});
