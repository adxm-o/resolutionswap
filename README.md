# ResolutionSwap

Switch between display resolutions instantly with hotkeys. Built for competitive gamers who need stretched res, desktop users who swap between work and gaming setups, or anyone tired of digging through Windows display settings.

## Common fixes

NVIDIA GPU's:
"Resolution not supported by display. Tried all methods including NVIDIA custom registration" - 
Open NVIDIA Control Panel - Change resolution - Customize - Create custom resolution - Change horizontal and vertical pixels to your desired resolution and change Refresh rate to your desired frames too. - Click "Test" and then save. Adjust desktop size and position (found in the left tab of NVIDIA control panel) - Click Full Screen.

Any other GPU's has not been tested yet and its functionality is yet to be discovered


## What it does

- 4 configurable resolution slots — set any width, height, refresh rate and scaling mode you want
- Global hotkeys (F5-F8 default, rebindable) that work in any app, any game, fullscreen or not
- Stretched resolution support with GPU scaling (writes to the GPU scaling registry so 4:3 actually fills the screen)
- Multi-monitor support — pick which display to target in settings
- Profiles — save your current slot layout, name it, switch between setups
- Starts minimized to system tray on boot if you enable startup launch
- For non-standard resolutions on NVIDIA GPUs, it tries to register them as custom resolutions automatically through NvAPI so you don't have to mess with NVIDIA Control Panel


## Download

Grab the latest installer from [Releases](https://github.com/adxm-o/ResolutionSwap/releases). Run it, pick your install folder, done.

Windows 10/11 only. Needs admin (required for changing display settings and writing GPU scaling registry keys).

## Building from source

You need [Node.js](https://nodejs.org) (LTS).

```
git clone https://github.com/adxm-o/ResolutionSwap.git
cd ResolutionSwap
```

Quick test:
```
run.bat
```

Build the installer:
```
build.bat
```

The `.exe` installer ends up in `release/`.

## Config

Stored at `%APPDATA%\ResolutionSwap\config.json`. You can edit it by hand if you want but the app handles everything through the UI.

Hotkeys use Electron accelerator format — `F5`, `Control+Shift+1`, `Alt+F9`, etc.

### Scaling modes

- **Default** — no scaling override, uses whatever Windows/GPU is set to
- **Stretched** — fills the entire screen (sets GPU scaling to fullscreen and writes the registry key)
- **Centered** — black bars, native pixel mapping

### Hz options

60, 90, 120, 144, 170, 240 — picked from a dropdown when configuring a slot.

## How resolution switching works

The app uses `ChangeDisplaySettingsEx` from the Windows API through PowerShell with inline C#. When a standard resolution fails (like a custom stretched res that isn't in your GPU's mode list), it runs through a fallback chain:

1. Standard test + apply
2. Direct apply without test
3. Fullscreen mode flag (what games use)
4. Apply without the stretch flag
5. Apply without specifying Hz
6. Temporary mode change
7. Register as an NVIDIA custom resolution via NvAPI, then retry

For NVIDIA custom resolution registration, it loads `nvapi64.dll` directly, calculates CVT Reduced Blanking timing parameters, and calls `NvAPI_DISP_TryCustomDisplay` / `NvAPI_DISP_SaveCustomDisplay`. This is the same thing NVIDIA Control Panel does when you create a custom resolution — just automated.

## Stack

- Electron + React + Vite
- PowerShell with embedded C# for Windows display API calls
- NvAPI interop for NVIDIA custom resolution registration
- NSIS installer via electron-builder

## License

MIT
