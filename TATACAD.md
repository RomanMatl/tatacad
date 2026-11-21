# TataCAD

TataCAD is a fork of [QCAD](https://github.com/qcad/qcad) 27.0.7 (GPLv3) with an
AutoCAD-style workflow on top: the **Tata Panel** and the tools behind it.

## Tata Panel

Dockable panel (View → Tata Panel, shortcut `t,p`) with five sections:
Kreslení, Modifikace, Kóty, Režimy a nástroje, Hladiny. Its contents are a data
table at the top of [`scripts/Widgets/TataPanel/TataPanel.js`](scripts/Widgets/TataPanel/TataPanel.js):
each row names an action script and a status. Colors: normal = works,
orange = works with limitations (tooltip explains), red = no backend yet.

### Tools added by TataCAD

| Tool | Script | Shortcut / command |
|---|---|---|
| Array (rectangular, polar) | `scripts/Modify/ArrayTool/` | `a,y` / `array` |
| Center mark | `scripts/Draw/Dimension/CenterMark/` | `d,c` / `dimcenter` |
| Arc length dimension | `scripts/Draw/Dimension/DimArcLength/` | `d,g` / `dimarc` |
| Multileader | `scripts/Draw/Dimension/MultiLeader/` | `d,m` / `mleader` |
| Named dimension styles (ISO-25, ČSN 3,5, architectural presets) | `scripts/Draw/Dimension/DimStyles/` | `d,y` / `dimstyle` |
| Construction line (XLine) | `scripts/Draw/Line/XLine2P/` | `x,l` / `xline` |
| Hatch by picking an internal point | `scripts/Draw/Hatch/HatchPick/` | `h,i` / `bhatch` |
| Table | `scripts/Draw/Table/` | `t,b` / `table` |
| Add N layers at once | `scripts/Layer/AddLayers/` | `y,m` |
| Freeze layer (separate from visibility) | `scripts/Layer/ToggleLayerFreeze/` | `y,f` |
| Calculator | `scripts/Widgets/Calculator/` | `k,a` |
| Dynamic input near the cursor | `scripts/Widgets/DynamicInput/` | `F12` |
| Ortho toggle | `scripts/Snap/ToggleOrtho/` | `F8` |
| Snap toggle | `scripts/Snap/ToggleSnap/` | `F3` |

Changes to upstream behavior:

- F8 moved from Display Distance/Angle to the ortho toggle.
- Layer visibility and freeze are separate also without QCAD Pro
  (`Layer.getShowFrozen()` in `scripts/Layer/Layer.js`); the eye icon in the
  layer list only toggles visibility.

Known limitations: hatch by picking does not detect islands; tables and
multileaders are stored as plain lines/texts and a leader (no native TABLE or
MLEADER object).

## Building (macOS, development)

Prerequisites: Xcode command line tools, `brew install qt ninja`.

```bash
cmake -S . -B build -G Ninja -DBUILD_QT6=ON -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=/opt/homebrew/opt/qt
ninja -C build
```

In Qt 6 builds all menus and tools are JavaScript, executed by a plugin built
from two separate repositories. They expect the QCAD sources in a sibling
folder named `qcad`, so they live in `jsapi/` (git-ignored) with a symlink:

```bash
mkdir -p jsapi && cd jsapi
git clone https://github.com/qcad/qtjsapi.git    # pinned: bc46cc865d595160b5f447782260d42ce567abf7
git clone https://github.com/qcad/qcadjsapi.git  # pinned: afd25cfe1e1358535be47d024342319c847cd7af
ln -s .. qcad
for p in qtjsapi qcadjsapi; do
  CMAKE_PREFIX_PATH=/opt/homebrew/opt/qt cmake -S $p -B $p/build -G Ninja -DBUILD_QT6=ON -DCMAKE_BUILD_TYPE=Release
  ninja -C $p/build
done
```

Run with `open release/QCAD.app`. The development build reads `scripts/`
from disk, so script changes only need an application restart.

On macOS every build regenerates `src/scripts/scripts*.qrc` (Windows and Linux
use the committed files). Build with `LC_ALL=en_US.UTF-8` so the file order
matches upstream and the diff stays small; commit the regenerated `.qrc` files
together with new script folders.

## Windows x64 package

[`packaging/windows/build-windows.ps1`](packaging/windows/build-windows.ps1)
builds TataCAD on a 64-bit Windows machine (Visual Studio 2022 C++, Git, CMake,
Ninja, Python) and produces a portable `TataCAD-<version>-win-x64.zip` and, if
Inno Setup 6 is installed, `TataCAD-<version>-win-x64-setup.exe`
([`tatacad.iss`](packaging/windows/tatacad.iss)). It installs Qt 6.9.0 via
aqtinstall, fetches the pinned jsapi repositories and bundles Qt plus the MSVC
runtime.

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\build-windows.ps1
```

Details, parameters and prerequisites: [`packaging/windows/README.md`](packaging/windows/README.md).
The script has not been run on Windows yet; expect fixes on the first build.

## Installing and updating (launcher)

Users install TataCAD with the **launcher** from the latest GitHub release and
always start TataCAD through it:

| System | Download |
|---|---|
| Windows x64 | [TataCAD-Launcher-windows-x64.exe](../../releases/latest/download/TataCAD-Launcher-windows-x64.exe) |
| macOS (Apple Silicon) | [TataCAD-Launcher-macos-arm64.zip](../../releases/latest/download/TataCAD-Launcher-macos-arm64.zip) |

On every start the launcher ([`launcher/`](launcher), Go, no dependencies):

1. reads `release/manifest.json` from this repository (version, package URL,
   SHA-256 per platform);
2. if nothing is installed or the manifest has a newer version, downloads the
   package, verifies the checksum, extracts it to `versions/<version>/` and
   switches `current.json` to it (the previous version is kept as a fallback,
   older ones are deleted);
3. starts TataCAD. Without network access it starts the installed version.

Install folder (per user, no admin rights): `%LOCALAPPDATA%\TataCAD` on
Windows, `~/Library/Application Support/TataCAD` on macOS. On Windows the
launcher also copies itself there as `TataCAD.exe` and creates Start menu and
desktop shortcuts. A console window with progress appears only while
downloading; on macOS progress is shown as notifications.

Inside TataCAD, *Help > Check for Updates* reads the same manifest and offers
"update and restart" (starts the launcher with `-wait-pid`, then quits); a
silent check at startup leaves a note in the command line when a newer version
exists. Development builds (not started from a launcher install) skip this.

Launcher options: `-check` (show installed / available version), `-no-launch`,
`-manifest <url>`, `-root <dir>`; environment `TATACAD_HOME`,
`TATACAD_MANIFEST_URL`.

## Release pipeline

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on every
push to `master` (and manually):

1. version = `<RVersion.h major.minor.rev>.<workflow run number>`;
2. builds the macOS package ([`packaging/macos/build-macos.sh`](packaging/macos/build-macos.sh),
   self-contained `TataCAD.app`, ad-hoc signed) and both launchers
   ([`packaging/launcher/build-launcher.sh`](packaging/launcher/build-launcher.sh))
   on `macos-15`, and the Windows package on `windows-2022`;
3. creates the GitHub release `v<version>` with all files;
4. commits `release/manifest.json` (`[skip ci]`) – from then on launchers
   install the new version.

Packages are release assets rather than files committed to git: each package
is close to 100 MB, GitHub rejects files above 100 MB and the repository
would grow with every release. The manifest is the only committed release file.

## Distribution notes

- **License:** GPLv3. Ship the complete source with binaries, including the
  two jsapi repositories at the pinned commits (`SOURCE.txt` in the package).
- **Name:** QCAD is a trademark of RibbonSoft. Distribute as TataCAD; the
  executable is still `qcad.exe` / `QCAD.app` and carries the QCAD icon, which
  should be replaced before public distribution.
- **Signing:** packages and launchers are not code-signed with a vendor
  certificate. Windows SmartScreen warns on first start of the launcher
  ("More info > Run anyway"); on macOS the launcher must be allowed once
  (right-click > Open, or System Settings > Privacy & Security > Open Anyway).
  TataCAD itself, downloaded by the launcher, is not quarantined.
