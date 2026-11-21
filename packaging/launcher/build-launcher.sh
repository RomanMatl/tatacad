#!/usr/bin/env bash
#
# Builds the TataCAD launcher (installer + updater, see launcher/):
#   dist/TataCAD-Launcher-windows-x64.exe
#   dist/TataCAD-Launcher-macos-arm64.zip   ("TataCAD Launcher.app")
#
# Usage: packaging/launcher/build-launcher.sh --manifest <url> [--version <v>] [--out <dir>]
#
# The asset names carry no version, so
# https://github.com/<owner>/<repo>/releases/latest/download/<name> always
# points to the newest launcher.
#
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST=""
VERSION="dev"
OUT="$REPO/dist"

while [ $# -gt 0 ]; do
    case "$1" in
        --manifest) MANIFEST="$2"; shift 2 ;;
        --version) VERSION="$2"; shift 2 ;;
        --out) OUT="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done
[ -n "$MANIFEST" ] || { echo "error: --manifest <url> is required" >&2; exit 2; }
command -v go >/dev/null || { echo "error: go not found" >&2; exit 1; }

mkdir -p "$OUT"
LDFLAGS="-s -w -X main.defaultManifestURL=$MANIFEST -X main.launcherVersion=$VERSION"
cd "$REPO/launcher"

echo "==> Windows x64"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 \
    go build -trimpath -ldflags "$LDFLAGS -H windowsgui" -o "$OUT/TataCAD-Launcher-windows-x64.exe" .

echo "==> macOS arm64"
APP="$OUT/TataCAD Launcher.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 \
    go build -trimpath -ldflags "$LDFLAGS" -o "$APP/Contents/MacOS/tatacad-launcher" .
cp "$REPO/src/run/qcad.icns" "$APP/Contents/Resources/TataCAD.icns"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>TataCAD</string>
    <key>CFBundleDisplayName</key><string>TataCAD</string>
    <key>CFBundleIdentifier</key><string>cz.tatacad.launcher</string>
    <key>CFBundleExecutable</key><string>tatacad-launcher</string>
    <key>CFBundleIconFile</key><string>TataCAD.icns</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>LSUIElement</key><true/>
</dict>
</plist>
EOF
if command -v codesign >/dev/null; then
    codesign --force --deep --sign - "$APP"
fi
rm -f "$OUT/TataCAD-Launcher-macos-arm64.zip"
(cd "$OUT" && zip -qry "TataCAD-Launcher-macos-arm64.zip" "TataCAD Launcher.app")
echo "Created $OUT/TataCAD-Launcher-windows-x64.exe and $OUT/TataCAD-Launcher-macos-arm64.zip"
