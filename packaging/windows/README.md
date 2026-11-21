# Windows x64 package

`build-windows.ps1` builds TataCAD on a 64-bit Windows machine and produces:

- `dist\TataCAD\` – ready-to-run folder
- `dist\TataCAD-<version>-win-x64.zip` – portable package
- `dist\TataCAD-<version>-win-x64-setup.exe` – installer (only if Inno Setup 6 is installed)

x64 (also called x86-64 or AMD64) is the target; 32-bit x86 and Windows on ARM are not built.

## Prerequisites

| Tool | Install |
|---|---|
| Visual Studio 2022 or Build Tools 2022, workload **Desktop development with C++** | <https://visualstudio.microsoft.com/downloads/> |
| Git | `winget install Git.Git` |
| CMake 3.16+ | `winget install Kitware.CMake` |
| Ninja | `winget install Ninja-build.Ninja` |
| Python 3 (downloads Qt via aqtinstall) | `winget install Python.Python.3.12` |
| Inno Setup 6 (optional, for the installer) | `winget install JRSoftware.InnoSetup` |

Qt does not need to be installed beforehand: the script installs Qt 6.9.0
(`win64_msvc2022_64` + `qt5compat`) into `C:\Qt` if it is missing.

## Usage

From the repository root, in a normal PowerShell window (the script loads the
MSVC environment itself):

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\build-windows.ps1
```

Options:

| Parameter | Default | Meaning |
|---|---|---|
| `-QtVersion` | `6.9.0` | Qt version to build against |
| `-QtRoot` | `C:\Qt` | Where Qt is (or will be) installed |
| `-QtArch` | `win64_msvc2022_64` | aqtinstall architecture |
| `-OutDir` | `<repo>\dist` | Output folder |
| `-Jobs` | CPU count | Parallel compile jobs |
| `-SkipInstaller` | off | Only build the zip |
| `-Clean` | off | Delete previous build folders first |

## What the script does

1. Loads the MSVC x64 environment (`vswhere` + `vcvars64.bat`).
2. Installs Qt with aqtinstall if needed.
3. Fetches the JavaScript engine plugin sources at pinned commits into
   `jsapi\qtjsapi` and `jsapi\qcadjsapi`, and creates the junction
   `jsapi\qcad` → repository root that their CMake files expect.
4. Builds TataCAD, then qtjsapi, then qcadjsapi (Release, Ninja). Build
   folders are `build-win\` and `jsapi\*\build-win\`.
5. Stages `dist\TataCAD` (executables, libraries, `plugins\`, resources,
   translations, scripts, license files), runs `windeployqt` and bundles the
   MSVC runtime DLLs so the zip runs without a separate VC++ redistributable.
6. Zips the folder and, if `ISCC.exe` is found, compiles `tatacad.iss`.

## Notes

- The installer is per-machine by default (Program Files) and can also be
  installed for the current user only. It offers a desktop shortcut and an
  optional `.dxf` file association.
- The executable is still called `qcad.exe`; product name, shortcuts and
  installer use **TataCAD**. QCAD is a trademark of RibbonSoft, so do not
  distribute builds under the QCAD name or logo. The application icon embedded
  in `qcad.exe` (`src/run/qcad.ico`) is QCAD's and should be replaced before
  public distribution.
- TataCAD is GPLv3: when you hand out binaries, also provide the complete
  source, including the two jsapi repositories at the pinned commits (listed in
  `SOURCE.txt` inside the package).
- The binaries are not code-signed; Windows SmartScreen will warn on first run
  until they are signed with a code-signing certificate.
