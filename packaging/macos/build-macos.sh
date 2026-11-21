#!/usr/bin/env bash
#
# Builds a self-contained TataCAD.app for macOS and zips it:
#   dist/TataCAD.app
#   dist/TataCAD-<version>-macos-<arch>.zip
#
# Usage: packaging/macos/build-macos.sh [--qt <qt prefix>] [--version <x.y.z.n>] [--out <dir>] [--jobs <n>]
#
# --qt defaults to $QT_PREFIX or the Homebrew Qt (brew --prefix qt).
#
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
QT="${QT_PREFIX:-}"
VERSION=""
OUT="$REPO/dist"
JOBS="$(sysctl -n hw.ncpu)"

while [ $# -gt 0 ]; do
    case "$1" in
        --qt) QT="$2"; shift 2 ;;
        --version) VERSION="$2"; shift 2 ;;
        --out) OUT="$2"; shift 2 ;;
        --jobs) JOBS="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

step() { printf '\n==> %s\n' "$*"; }
die() { echo "error: $*" >&2; exit 1; }

if [ -z "$QT" ]; then
    QT="$(brew --prefix qt 2>/dev/null || true)"
fi
[ -x "$QT/bin/macdeployqt" ] || die "macdeployqt not found in '$QT/bin' (pass --qt <qt prefix>)"
command -v cmake >/dev/null || die "cmake not found"
command -v ninja >/dev/null || die "ninja not found"

if [ -z "$VERSION" ]; then
    h="$REPO/src/core/RVersion.h"
    v() { sed -n "s/^#define R_QCAD_VERSION_$1 *\([0-9]*\).*/\1/p" "$h"; }
    VERSION="$(v MAJOR).$(v MINOR).$(v REV).$(v BUILD)"
fi
ARCH="$(uname -m)"
echo "TataCAD $VERSION ($ARCH), Qt: $QT"

# Pinned so a package is reproducible (same commits as packaging/windows/build-windows.ps1).
JSAPI_REPOS="qtjsapi https://github.com/qcad/qtjsapi.git bc46cc865d595160b5f447782260d42ce567abf7
qcadjsapi https://github.com/qcad/qcadjsapi.git afd25cfe1e1358535be47d024342319c847cd7af"

step "JS API sources"
mkdir -p "$REPO/jsapi"
# Their CMake files expect the QCAD sources in a sibling folder named "qcad":
ln -sfn .. "$REPO/jsapi/qcad"
echo "$JSAPI_REPOS" | while read -r name url commit; do
    dir="$REPO/jsapi/$name"
    if [ ! -d "$dir/.git" ]; then
        git init -q "$dir"
        git -C "$dir" remote add origin "$url"
    fi
    if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)" != "$commit" ]; then
        git -C "$dir" fetch -q --depth 1 origin "$commit"
        git -C "$dir" checkout -q --force "$commit"
    fi
    echo "$name @ $commit"
done

step "Building TataCAD"
cmake -S "$REPO" -B "$REPO/build" -G Ninja -DBUILD_QT6=ON -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_PREFIX_PATH="$QT" >/dev/null
ninja -C "$REPO/build" -j "$JOBS"

for p in qtjsapi qcadjsapi; do
    step "Building $p"
    cmake -S "$REPO/jsapi/$p" -B "$REPO/jsapi/$p/build" -G Ninja -DBUILD_QT6=ON \
        -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH="$QT" >/dev/null
    ninja -C "$REPO/jsapi/$p/build" -j "$JOBS"
done

step "Staging TataCAD.app"
mkdir -p "$OUT"
APP="$OUT/TataCAD.app"
rm -rf "$APP"
cp -R "$REPO/release/QCAD.app" "$APP"
RES="$APP/Contents/Resources"
FW="$APP/Contents/Frameworks"
PLG="$APP/Contents/PlugIns"
mkdir -p "$RES" "$FW" "$PLG"

# Resources/scripts must exist: it is how QCAD recognizes a deployed bundle.
rsync -a --exclude 'Tests/' --exclude 'doc/' --exclude 'actual/' "$REPO/scripts" "$RES/"
for d in fonts patterns linetypes themes libraries; do
    rsync -a "$REPO/$d" "$RES/"
done
mkdir -p "$RES/ts"
cp "$REPO"/ts/*.qm "$RES/ts/" 2>/dev/null || true

cp "$REPO"/release/*.dylib "$FW/"
cp "$REPO"/plugins/*.dylib "$PLG/"
# custom widgets (RCommandLine, RMathLineEdit, ...) used by the .ui files:
mkdir -p "$PLG/designer"
cp "$REPO"/plugins/designer/*.dylib "$PLG/designer/"

step "macdeployqt"
exec_args=()
for f in "$PLG"/*.dylib "$PLG"/designer/*.dylib "$FW"/*.dylib; do
    exec_args+=("-executable=$f")
done
"$QT/bin/macdeployqt" "$APP" -libpath="$REPO/release" "${exec_args[@]}" -verbose=1
# Qt's ODBC, PostgreSQL and Mimer drivers link client libraries that are not
# part of macOS; TataCAD only needs SQLite.
find "$PLG/sqldrivers" -name '*.dylib' ! -name 'libqsqlite.dylib' -delete 2>/dev/null || true

step "Fixing rpaths"
rpaths() { otool -l "$1" | awk '/LC_RPATH/{f=1} f&&/ path /{print $2; f=0}'; }
fix_rpaths() {
    local file="$1" wanted="$2" p
    for p in $(rpaths "$file"); do
        case "$p" in
            @*) ;;
            *) install_name_tool -delete_rpath "$p" "$file" 2>/dev/null || true ;;
        esac
    done
    if ! rpaths "$file" | grep -qx "$wanted"; then
        install_name_tool -add_rpath "$wanted" "$file"
    fi
}
fix_rpaths "$APP/Contents/MacOS/QCAD" "@executable_path/../Frameworks"
for f in "$FW"/*.dylib; do fix_rpaths "$f" "@loader_path"; done
for f in "$PLG"/*.dylib; do fix_rpaths "$f" "@loader_path/../Frameworks"; done
for f in "$PLG"/designer/*.dylib; do fix_rpaths "$f" "@loader_path/../../Frameworks"; done

PL="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$PL" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string $VERSION" "$PL"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$PL" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $VERSION" "$PL"
/usr/libexec/PlistBuddy -c "Set :CFBundleName TataCAD" "$PL" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleName string TataCAD" "$PL"
echo "$VERSION" > "$RES/tatacad-version.txt"

step "Checking for references outside the bundle"
bad=0
while IFS= read -r -d '' f; do
    if file "$f" | grep -q "Mach-O"; then
        # load commands only: a library's own install name (LC_ID_DYLIB) is irrelevant at runtime
        if otool -l "$f" | awk '/cmd LC_(LOAD|LOAD_WEAK|REEXPORT|LAZY_LOAD)_DYLIB/{f=1} f&&/ name /{print $2; f=0}' \
                | grep -E "$REPO|/opt/homebrew|/usr/local/" ; then
            echo "  in $f"
            bad=1
        fi
    fi
done < <(find "$APP/Contents" -type f -print0)
[ "$bad" -eq 0 ] || die "bundle still links to files outside the app"

step "Signing (ad hoc)"
# install_name_tool invalidates signatures; arm64 refuses to run unsigned code.
codesign --force --deep --sign - "$APP"

step "Zipping"
ZIP="$OUT/TataCAD-$VERSION-macos-$ARCH.zip"
rm -f "$ZIP"
ditto -c -k --norsrc --noextattr --noqtn --keepParent "$APP" "$ZIP"
echo "Created $ZIP"
